#!/usr/bin/env bun
/** prints product hostname knobs as JSON for shell scripts */
import {
  cloudBaseDomain,
  localBaseDomain,
  productSlug,
} from '../packages/env/src/lib/product.ts'

console.log(
  JSON.stringify({
    productSlug,
    localBaseDomain,
    cloudBaseDomain,
    consoleUrl: `https://console.${localBaseDomain}`,
  }),
)
