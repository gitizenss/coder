/* eslint-disable import/first */

import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.HASH_TEMPORAL_WORKER_AI_SENTRY_DSN,
  enabled: !!process.env.HASH_TEMPORAL_WORKER_AI_SENTRY_DSN,
  tracesSampleRate: 1.0,
});

import * as child_process from "node:child_process";
import * as http from "node:http";
import { createRequire } from "node:module";
import * as path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createGraphClient } from "@local/hash-backend-utils/create-graph-client";
import { getRequiredEnv } from "@local/hash-backend-utils/environment";
import { SentryActivityInboundInterceptor } from "@local/hash-backend-utils/temporal/interceptors/activities/sentry";
import { sentrySinks } from "@local/hash-backend-utils/temporal/sinks/sentry";
import { createVaultClient } from "@local/hash-backend-utils/vault";
import { defaultSinks, NativeConnection, Worker } from "@temporalio/worker";
import { config } from "dotenv-flow";

import { createAiActivities, createGraphActivities } from "./activities";
import { createFlowActivities } from "./activities/flow-activities";
import { logToConsole } from "./shared/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const require = createRequire(import.meta.url);

export const monorepoRootDir = path.resolve(__dirname, "../../..");

config({ silent: true, path: monorepoRootDir });

const TEMPORAL_HOST = new URL(
  process.env.HASH_TEMPORAL_SERVER_HOST ?? "http://localhost",
).hostname;
const TEMPORAL_PORT = process.env.HASH_TEMPORAL_SERVER_PORT
  ? parseInt(process.env.HASH_TEMPORAL_SERVER_PORT, 10)
  : 7233;

const createHealthCheckServer = () => {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.setHeader("Content-Type", "application/json");
      res.writeHead(200);
      res.end(
        JSON.stringify({
          msg: "worker healthy",
        }),
      );
      return;
    }
    res.writeHead(404);
    res.end("");
  });

  return server;
};

const workflowOption = () =>
  process.env.NODE_ENV === "production"
    ? {
        workflowBundle: {
          codePath: require.resolve("../dist/workflow-bundle.js"),
        },
      }
    : { workflowsPath: require.resolve("./workflows") };

async function run() {
  // eslint-disable-next-line no-console
  console.info("Starting AI worker...");

  // eslint-disable-next-line no-console
  console.info(`Pinging Temporal server at ${TEMPORAL_HOST}...`);
  await new Promise<void>((resolve) => {
    child_process.exec(
      `ping -c 3 ${TEMPORAL_HOST}`,
      (processError, stdout, stderr) => {
        if (processError) {
          // eslint-disable-next-line no-console
          console.error(`error spawning ping process: ${processError.message}`);
          resolve();
          return;
        }
        // eslint-disable-next-line no-console
        console.error(`ping stderr: ${stderr}`);
        // eslint-disable-next-line no-console
        console.log(`ping stdout: ${stdout}`);
        resolve();
      },
    );
  });

  const graphApiClient = createGraphClient(logToConsole, {
    host: getRequiredEnv("HASH_GRAPH_API_HOST"),
    port: parseInt(getRequiredEnv("HASH_GRAPH_API_PORT"), 10),
  });

  // eslint-disable-next-line no-console
  console.info("Created Graph client");

  const vaultClient = createVaultClient();
  if (!vaultClient) {
    throw new Error("Vault client not created");
  }

  // eslint-disable-next-line no-console
  console.info("Created Vault client");

  const connection = await NativeConnection.connect({
    address: `${TEMPORAL_HOST}:${TEMPORAL_PORT}`,
  });
  // eslint-disable-next-line no-console
  console.info("Created Temporal connection");

  const worker = await Worker.create({
    ...workflowOption(),
    activities: {
      ...createAiActivities({
        graphApiClient,
      }),
      ...createGraphActivities({
        graphApiClient,
      }),
      ...createFlowActivities({
        vaultClient,
      }),
    },
    connection,
    namespace: "HASH",
    taskQueue: "ai",
    sinks: { ...defaultSinks(), ...sentrySinks() },
    interceptors: {
      workflowModules: [
        require.resolve(
          "@local/hash-backend-utils/temporal/interceptors/workflows/sentry",
        ),
      ],
      activityInbound: [(ctx) => new SentryActivityInboundInterceptor(ctx)],
    },
  });

  const httpServer = createHealthCheckServer();
  const port = 4100;
  httpServer.listen({ host: "::", port });

  // eslint-disable-next-line no-console
  console.info(`HTTP server listening on port ${port}`);

  await worker.run();
}

process.on("SIGINT", () => {
  // eslint-disable-next-line no-console
  console.info("Received SIGINT, exiting...");
  process.exit(1);
});
process.on("SIGTERM", () => {
  // eslint-disable-next-line no-console
  console.info("Received SIGTERM, exiting...");
  process.exit(1);
});

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
