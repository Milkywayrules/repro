/**
 * single knobs for product hostname shape — change here or run `bun run configure-product`.
 * all runtime URLs, cookies, CSP, and generated local infra derive from these three constants.
 */
export const productSlug = 'userepro' as const

/** local dev base TLD (RFC 2606-style); full local base is `{productSlug}.{localTld}` */
export const localTld = 'test' as const

/** cloud prod/stg base TLD; full cloud base is `{productSlug}.{cloudTld}` */
export const cloudTld = 'dev' as const

export const localBaseDomain = `${productSlug}.${localTld}` as const
export const cloudBaseDomain = `${productSlug}.${cloudTld}` as const

export function cookieDomainForBase(base: string): string {
  return `.${base}`
}
