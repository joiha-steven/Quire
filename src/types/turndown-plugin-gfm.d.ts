// `turndown-plugin-gfm` ships no types. It is a two-function module and the whole of the
// surface this project uses is `gfm`, so a hand-written declaration is smaller and more
// honest than a dependency on a community `@types` package that may or may not be
// maintained for the next decade.
declare module 'turndown-plugin-gfm' {
  import type TurndownService from 'turndown'
  /** Tables, strikethrough and task lists, in one plugin. */
  export function gfm(service: TurndownService): void
  export function tables(service: TurndownService): void
  export function strikethrough(service: TurndownService): void
  export function taskListItems(service: TurndownService): void
}
