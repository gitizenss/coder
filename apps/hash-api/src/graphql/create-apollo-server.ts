import { performance } from "node:perf_hooks";

import { makeExecutableSchema } from "@graphql-tools/schema";
import { Logger } from "@local/hash-backend-utils/logger";
import { SearchAdapter } from "@local/hash-backend-utils/search/adapter";
import { schema } from "@local/hash-isomorphic-utils/graphql/type-defs/schema";
import * as Sentry from "@sentry/node";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core";
import { ApolloServer } from "apollo-server-express";
import { StatsD } from "hot-shots";

import { getActorIdFromRequest } from "../auth/get-actor-id";
import { CacheAdapter } from "../cache";
import { EmailTransporter } from "../email/transporters";
import { GraphApi } from "../graph/context-types";
import { UploadableStorageProvider } from "../storage/storage-provider";
import { TemporalClient } from "../temporal";
import { VaultClient } from "../vault/index";
import { GraphQLContext } from "./context";
import { resolvers } from "./resolvers";

export interface CreateApolloServerParams {
  graphApi: GraphApi;
  cache: CacheAdapter;
  uploadProvider: UploadableStorageProvider;
  temporalClient?: TemporalClient;
  vaultClient?: VaultClient;
  search?: SearchAdapter;
  emailTransporter: EmailTransporter;
  logger: Logger;
  statsd?: StatsD;
}

export const createApolloServer = ({
  graphApi,
  cache,
  search,
  emailTransporter,
  uploadProvider,
  temporalClient,
  vaultClient,
  logger,
  statsd,
}: CreateApolloServerParams) => {
  // go via makeExecutableSchema to set inheritResolversFromInterfaces
  const combinedSchema = makeExecutableSchema({
    typeDefs: schema,
    resolvers,
    inheritResolversFromInterfaces: true,
  });
  const getDataSources = () => {
    const sources: GraphQLContext["dataSources"] = {
      graphApi,
      cache,
      uploadProvider,
    };
    if (search) {
      sources.search = search;
    }
    return sources;
  };

  return new ApolloServer({
    schema: combinedSchema,
    dataSources: getDataSources,
    context: (ctx): Omit<GraphQLContext, "dataSources"> => ({
      ...ctx,
      authentication: {
        actorId: getActorIdFromRequest(ctx.req),
      },
      user: ctx.req.user,
      emailTransporter,
      logger: logger.child({
        requestId: ctx.res.get("x-hash-request-id") ?? "",
      }),
      temporal: temporalClient,
      vault: vaultClient,
    }),
    // @todo: we may want to disable introspection at some point for production
    introspection: true,
    debug: true, // required for stack traces to be captured
    plugins: [
      {
        requestDidStart: async (ctx) => {
          ctx.logger = ctx.context.logger as Logger;
          const startedAt = performance.now();

          return {
            async didEncounterErrors(errorContext) {
              const user: Express.Request["user"] = errorContext.context.user;

              for (const err of errorContext.errors) {
                // Don't send ForbiddenErrors to Sentry – we can add more here as needed
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- this may be undefined
                if (err.extensions?.code === "FORBIDDEN") {
                  continue;
                }

                Sentry.withScope((scope) => {
                  // Annotate whether failing operation was query/mutation/subscription
                  scope.setTag("kind", errorContext.operation?.operation);

                  scope.setExtra("query", errorContext.request.query);
                  scope.setExtra("variables", errorContext.request.variables);

                  if (user) {
                    scope.setUser({
                      id: user.entity.metadata.recordId.entityId,
                      email: user.emails[0],
                      shortname: user.shortname,
                    });
                  }

                  if (err.path) {
                    scope.addBreadcrumb({
                      category: "query-path",
                      message: err.path.join(" > "),
                    });
                  }

                  Sentry.captureException(err);
                });
              }
            },

            didResolveOperation: async (didResolveOperationCtx) => {
              if (didResolveOperationCtx.operationName) {
                statsd?.increment(didResolveOperationCtx.operationName, [
                  "graphql",
                ]);
              }
            },

            willSendResponse: async (willSendResponseCtx) => {
              if (willSendResponseCtx.operationName === "IntrospectionQuery") {
                // Ignore introspection queries from graphiql
                return;
              }
              const elapsed = performance.now() - startedAt;

              // take the first part of the UA to help identify browser vs server requests
              const userAgent =
                ctx.context.req.headers["user-agent"]?.split(" ")[0];

              const msg = {
                message: "graphql",
                operation: willSendResponseCtx.operationName,
                elapsed: `${elapsed.toFixed(2)}ms`,
                userAgent,
              };
              if (willSendResponseCtx.errors) {
                willSendResponseCtx.logger.error({
                  ...msg,
                  errors: willSendResponseCtx.errors,
                  stack: willSendResponseCtx.errors
                    .map((err) => err.stack)
                    // Filter stacks caused by an apollo Forbidden error to prevent cluttering logs
                    // with errors caused by a user being logged out.
                    .filter(
                      (stack) => stack && !stack.startsWith("ForbiddenError"),
                    ),
                });
              } else {
                willSendResponseCtx.logger.info(msg);
                if (willSendResponseCtx.operationName) {
                  statsd?.timing(
                    willSendResponseCtx.operationName,
                    elapsed,
                    1,
                    ["graphql"],
                  );
                }
              }
            },
          };
        },
      },
      ApolloServerPluginLandingPageGraphQLPlayground({
        settings: { "request.credentials": "include" },
      }),
    ],
  });
};
