// Finds every frame and sticker PNG automatically. To add one: drop the PNG
// in the folder and reference its file name in templates.ts / stickers.ts.
// Phase 9 will add an admin upload screen for this.
const frameFiles = import.meta.glob<string>('../assets/frames/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
})
const stickerFiles = import.meta.glob<string>('../assets/stickers/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
})

const byName = (files: Record<string, string>): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const [path, url] of Object.entries(files)) out[path.split('/').pop() as string] = url
  return out
}
const frames = byName(frameFiles)
const stickers = byName(stickerFiles)

export const frameUrl = (fileName: string): string | undefined => frames[fileName]
export const stickerUrl = (fileName: string): string | undefined => stickers[fileName]

// The address of a saved file (served by the main process). `version` stops
// the browser showing an old picture after a session is saved again.
export const fileUrl = (relativePath: string, version?: number): string =>
  `pbfile://local/${relativePath}${version ? `?v=${version}` : ''}`