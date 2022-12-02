// @ory/integrations offers a package for integrating with NextJS.
import { config, createApiHandler } from "@ory/integrations/next-edge";
import { frontendDomain } from "@hashintel/hash-shared/environment";

// We need to export the config.
export { config };

const publicUrl = process.env.ORY_KRATOS_PUBLIC_URL;
const forceCookieDomain =
  process.env.FRONTEND_FORCE_COOKIE_DOMAIN ?? frontendDomain;

// And create the Ory Cloud API "bridge".
export default createApiHandler({
  apiBaseUrlOverride: publicUrl,
  forceCookieDomain,
});
