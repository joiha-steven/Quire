import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Invariant 3 tripwire: every settings field holding a store URL must be run through
// `collapseBlob` on WRITE, or the stored bytes carry an origin and the row breaks the
// moment the site moves or is restored elsewhere.
//
// This is a STATIC check of the persist block, not a behavioural test — `saveSettings`
// needs the database, the blob store and the image pipeline to run. It is deliberately
// crude, because the failure it guards is silent: a new URL field simply gets forgotten
// in the collapse list and nothing complains. That is exactly how `logoEmailUrl`
// shipped un-collapsed. If this ever feels in the way, replace it with a real
// integration test — do not delete it.
const SOURCE = readFileSync('src/lib/settings.ts', 'utf8')

// Every SiteSettings field that holds a URL into the local store.
const STORE_URL_FIELDS = ['logoUrl', 'logoRenderUrl', 'logoEmailUrl', 'faviconUrl', 'appIconUrl', 'ogFallbackImage']

describe('settings persist', () => {
  it.each(STORE_URL_FIELDS)('collapses %s before writing it', (field) => {
    // Matches `field: collapseBlob(...)` and the nested `ogFallbackImage: collapseBlob(...)`.
    expect(SOURCE).toMatch(new RegExp(`${field}:\\s*collapseBlob\\(`))
  })

  it.each(STORE_URL_FIELDS)('expands %s when reading it back', (field) => {
    expect(SOURCE).toMatch(new RegExp(`${field}:\\s*expandBlob\\(`))
  })
})
