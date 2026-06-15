import { deriveUrls, getHostConfig } from './domains.ts'

const documentAppCspBase = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
] as const

/** API origins in document CSP connect-src (local + stg + prod — deduped). */
export function deriveDocumentAppCspConnectSrc(): string {
  const apiUrls = [
    deriveUrls(getHostConfig('dev', 'local')).API_URL,
    deriveUrls(getHostConfig('stg', 'railway')).API_URL,
    deriveUrls(getHostConfig('prod', 'railway')).API_URL,
  ]

  return `'self' ${[...new Set(apiUrls)].join(' ')}`
}

/** CSP for console, docs, and marketing document apps. */
export function buildDocumentAppCsp(): string {
  return [
    ...documentAppCspBase,
    `connect-src ${deriveDocumentAppCspConnectSrc()}`,
    "form-action 'self'",
  ].join('; ')
}
