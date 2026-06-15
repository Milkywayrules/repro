// biome-ignore lint/style/noDefaultExport: WXT requires a default export
export default defineContentScript({
  matches: ['*://*.google.com/*'],
  main() {
    console.log('Hello content.')
  },
})
