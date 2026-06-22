// Shared helpers for the static invariant checks. Node-only, zero deps.
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Recursively list files under `dir` matching `test(path)`.
export function walk(dir, test) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p, test))
    else if (test(p)) out.push(p)
  }
  return out
}

export const isTs = (p) => /\.(ts|tsx)$/.test(p)
export const isTest = (p) => /\.(test|spec)\.(ts|tsx)$/.test(p)

// Line count matching `wc -l` (count newlines).
export function lineCount(content) {
  const nl = (content.match(/\n/g) || []).length
  return content.endsWith('\n') || content.length === 0 ? nl : nl + 1
}

// Replace every comment + string/template body with spaces, preserving newlines
// and offsets, so a regex for code tokens (any, console.log) ignores comments and
// string literals. TODO/FIXME/@ts-ignore are scanned on the RAW text instead.
export function stripCommentsAndStrings(src) {
  let out = ''
  let state = 'code' // code | line | block | sq | dq | tpl
  for (let i = 0; i < src.length; ) {
    const c = src[i]
    const d = src[i + 1]
    if (state === 'code') {
      if (c === '/' && d === '/') { state = 'line'; out += '  '; i += 2; continue }
      if (c === '/' && d === '*') { state = 'block'; out += '  '; i += 2; continue }
      if (c === "'") { state = 'sq'; out += ' '; i++; continue }
      if (c === '"') { state = 'dq'; out += ' '; i++; continue }
      if (c === '`') { state = 'tpl'; out += ' '; i++; continue }
      out += c; i++; continue
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += '\n' } else out += ' '
      i++; continue
    }
    if (state === 'block') {
      if (c === '*' && d === '/') { state = 'code'; out += '  '; i += 2; continue }
      out += c === '\n' ? '\n' : ' '; i++; continue
    }
    // sq | dq | tpl
    if (c === '\\') { out += '  '; i += 2; continue }
    const close = state === 'sq' ? "'" : state === 'dq' ? '"' : '`'
    if (c === close) { state = 'code'; out += ' '; i++; continue }
    out += c === '\n' ? '\n' : ' '; i++
  }
  return out
}

// Blank only comments (line + block), preserving string/template bodies + newlines.
// Use when the token you match for lives INSIDE a string (e.g. revalidateTag('db')).
export function stripComments(src) {
  let out = ''
  let state = 'code' // code | line | block | sq | dq | tpl
  for (let i = 0; i < src.length; ) {
    const c = src[i]
    const d = src[i + 1]
    if (state === 'code') {
      if (c === '/' && d === '/') { state = 'line'; out += '  '; i += 2; continue }
      if (c === '/' && d === '*') { state = 'block'; out += '  '; i += 2; continue }
      if (c === "'") state = 'sq'
      else if (c === '"') state = 'dq'
      else if (c === '`') state = 'tpl'
      out += c; i++; continue
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += '\n' } else out += ' '
      i++; continue
    }
    if (state === 'block') {
      if (c === '*' && d === '/') { state = 'code'; out += '  '; i += 2; continue }
      out += c === '\n' ? '\n' : ' '; i++; continue
    }
    // inside a string: copy verbatim, honour escapes, exit on matching quote
    if (c === '\\') { out += src[i] + (src[i + 1] ?? ''); i += 2; continue }
    const close = state === 'sq' ? "'" : state === 'dq' ? '"' : '`'
    if (c === close) state = 'code'
    out += c; i++
  }
  return out
}

// Pretty-print a check result and return the process exit code.
export function report(name, violations) {
  if (violations.length === 0) {
    console.log(`✓ ${name}: ok`)
    return 0
  }
  console.log(`✗ ${name}: ${violations.length} violation(s)`)
  for (const v of violations) console.log(`  - ${v}`)
  return 1
}
