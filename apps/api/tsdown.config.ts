import { defineConfig } from 'tsdown'

// biome-ignore lint/style/noDefaultExport: tsdown requires a default export
export default defineConfig({
  entry: './src/index.ts',
  format: 'esm',
  outDir: './dist',
  clean: true,
  noExternal: [/@repro\/.*/],
})
