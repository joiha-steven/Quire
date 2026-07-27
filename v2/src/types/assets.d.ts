// Browser bundles are imported as TEXT (`with { type: 'text' }`) so that
// `bun build --compile` embeds them in the binary. TypeScript has no built-in type for
// that, and the files are generated, so the shape is declared here once.

declare module '@/assets/dist/*.js' {
  const source: string
  export default source
}
