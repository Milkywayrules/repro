// biome-ignore lint/performance/noBarrelFile: x
export {
  buildDocumentAppCsp,
  deriveDocumentAppCspConnectSrc,
} from './lib/csp.ts'
export {
  defaultCookieDomain,
  deriveCorsOrigins,
  deriveUrls,
  getHostConfig,
  getServiceUrls,
  localDevPorts,
  publicUrl,
  type ServiceUrlOverrides,
  type ServiceUrls,
} from './lib/domains.ts'
export {
  cloudBaseDomain,
  cloudTld,
  cookieDomainForBase,
  localBaseDomain,
  localTld,
  productSlug,
} from './lib/product.ts'
export {
  type AppEnv,
  appEnvSchema,
  type DeployPlatform,
  deployPlatformSchema,
} from './lib/schemas.ts'
