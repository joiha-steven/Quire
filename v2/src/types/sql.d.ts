// `import schema from './schema.sql' with { type: 'text' }` is a Bun feature; TypeScript
// needs to be told the import yields a string. Without this, `store/db.ts` cannot compile
// even though it runs correctly.
declare module '*.sql' {
  const content: string
  export default content
}
