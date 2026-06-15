import {
  cloudBaseDomain,
  cookieDomainForBase,
  localBaseDomain,
} from './product.ts'
import type { AppEnv, DeployPlatform } from './schemas.ts'

export interface HostConfig {
  api: string
  base: string
  console: string
  docs: string
  /** empty string = apex (e.g. userepro.dev) */
  marketing: string
}

/** build https URL from subdomain + base; empty subdomain → apex */
export function publicUrl(host: string, base: string): string {
  if (!host) {
    return `https://${base}`
  }
  return `https://${host}.${base}`
}

export function getHostConfig(
  appEnv: AppEnv,
  deployPlatform: DeployPlatform,
): HostConfig {
  const envKey = appEnv === 'test' ? 'dev' : appEnv

  if (deployPlatform === 'local') {
    return {
      base: localBaseDomain,
      api: 'api',
      console: 'console',
      docs: 'docs',
      marketing: '',
    }
  }

  if (envKey === 'stg') {
    return {
      base: cloudBaseDomain,
      api: 'stg-api',
      console: 'stg-console',
      docs: 'stg-docs',
      marketing: 'stg',
    }
  }

  return {
    base: cloudBaseDomain,
    api: 'api',
    console: 'console',
    docs: 'docs',
    marketing: '',
  }
}

export interface DerivedUrls {
  API_URL: string
  CONSOLE_URL: string
  DOCS_URL: string
  MARKETING_URL: string
}

export function deriveUrls(config: HostConfig): DerivedUrls {
  return {
    API_URL: publicUrl(config.api, config.base),
    CONSOLE_URL: publicUrl(config.console, config.base),
    DOCS_URL: publicUrl(config.docs, config.base),
    MARKETING_URL: publicUrl(config.marketing, config.base),
  }
}

/** surfaces that call the API — console, marketing, docs (not extension) */
export function deriveCorsOrigins(config: HostConfig): string[] {
  return [
    publicUrl(config.console, config.base),
    publicUrl(config.marketing, config.base),
    publicUrl(config.docs, config.base),
  ]
}

export function defaultCookieDomain(deployPlatform: DeployPlatform): string {
  const base = deployPlatform === 'local' ? localBaseDomain : cloudBaseDomain
  return cookieDomainForBase(base)
}

/** loopback ports for local nginx upstreams — reference for infra/nginx; set ports explicitly in each app's env */
export const localDevPorts = {
  api: 5000,
  console: 5001,
  marketing: 5002,
  docs: 5009,
} as const
