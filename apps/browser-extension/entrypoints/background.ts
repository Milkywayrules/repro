// biome-ignore lint/style/noDefaultExport: WXT requires a default export
export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id })
})
