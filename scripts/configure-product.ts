#!/usr/bin/env bun
import { syncLocalInfra } from './sync-local-infra'
/**
 * set product slug + TLD knobs in product.ts, then regenerate local infra.
 *
 * usage:
 *   bun run configure-product userepro
 *   bun run configure-product myapp --local-tld test --cloud-tld dev
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const tldPattern = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/

function usage(): never {
  console.info(
    '\x1b[36musage:\x1b[0m bun run configure-product <slug> [--local-tld test] [--cloud-tld dev]',
  )
  process.exit(1)
}

const args = process.argv.slice(2)
if (args.length === 0 || args[0] === '--help') {
  usage()
}

const slug = args[0]
let localTld = 'test'
let cloudTld = 'dev'

for (let i = 1; i < args.length; i++) {
  const arg = args[i]
  if (arg === '--local-tld') {
    localTld = args[++i] ?? usage()
  } else if (arg === '--cloud-tld') {
    cloudTld = args[++i] ?? usage()
  } else {
    console.error(`unknown flag: ${arg}`)
    usage()
  }
}

if (!slugPattern.test(slug)) {
  console.error(
    `invalid slug "${slug}" — use lowercase letters, digits, hyphens`,
  )
  process.exit(1)
}
if (!(tldPattern.test(localTld) && tldPattern.test(cloudTld))) {
  console.error('invalid TLD — use lowercase letters, digits, hyphens')
  process.exit(1)
}

const productTs = `/**
 * single knobs for product hostname shape — change here or run \`bun run configure-product\`.
 * all runtime URLs, cookies, CSP, and generated local infra derive from these three constants.
 */
export const productSlug = '${slug}' as const

/** local dev base TLD (RFC 2606-style); full local base is \`{productSlug}.{localTld}\` */
export const localTld = '${localTld}' as const

/** cloud prod/stg base TLD; full cloud base is \`{productSlug}.{cloudTld}\` */
export const cloudTld = '${cloudTld}' as const

export const localBaseDomain = \`\${productSlug}.\${localTld}\` as const
export const cloudBaseDomain = \`\${productSlug}.\${cloudTld}\` as const

export function cookieDomainForBase(base: string): string {
  return \`.\${base}\`
}
`

const productPath = join(import.meta.dir, '../packages/env/src/lib/product.ts')
writeFileSync(productPath, productTs, 'utf8')
console.log(`updated ${productPath}`)

syncLocalInfra()

console.log('')
console.log('next: bun run setup:local  (if local base changed)')
console.log('      merge infra/hosts.example into /etc/hosts')
