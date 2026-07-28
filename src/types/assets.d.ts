// Browser bundles are imported as TEXT (`with { type: 'text' }`) so that
// `bun build --compile` embeds them in the binary. TypeScript has no built-in type for
// that, and the files are generated, so the shape is declared here once.

declare module '@/assets/dist/*.js' {
  const source: string
  export default source
}

// A `with { type: 'file' }` import yields a PATH, which `Bun.file` reads and
// `bun build --compile` embeds. Used for the OG card's font subsets.
declare module '@/render/fonts/*.woff' {
  const path: string
  export default path
}

// The reader-facing static files: fonts, favicon, app icon. Same `type: 'file'` mechanism.
declare module '@/assets/static/*' {
  const path: string
  export default path
}

declare module '@/assets/static/fonts/*.woff2' {
  const path: string
  export default path
}
