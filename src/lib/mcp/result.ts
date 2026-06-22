// Shared CallToolResult helpers for MCP tools (kept separate so the tool modules
// can import them without a circular dependency).

export function asText(text: string) {
  return { content: [{ type: 'text' as const, text }] }
}
export function asJson(data: unknown) {
  return asText(JSON.stringify(data, null, 2))
}
export function asError(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true as const }
}
