// Settings is one JSON blob in one row, so the risk is not the query: it is that a
// malformed or partial blob silently reshapes the site. These cover the read contract
// (never throw, always merge over defaults) and Invariant 3 across the store boundary.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { one } from '@/store/query'
import { getSettings, saveSettings, DEFAULT_SETTINGS } from '@/content/settings'

const DIR = './.tmp-test-settings'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

beforeEach(() => db().run(`delete from settings`))

const write = (data: unknown) =>
  db().run(`insert into settings (id, data) values (1, ?)`, [JSON.stringify(data)])

describe('getSettings', () => {
  it('returns the defaults when no row exists', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('returns the defaults rather than throwing on a malformed blob', async () => {
    db().run(`insert into settings (id, data) values (1, 'not json')`)
    expect((await getSettings()).title).toBe(DEFAULT_SETTINGS.title)
  })

  it('merges a partial blob over the defaults', async () => {
    write({ title: 'My Blog' })
    const s = await getSettings()
    expect(s.title).toBe('My Blog')
    expect(s.postsPerPage).toBe(DEFAULT_SETTINGS.postsPerPage)
  })

  it('expands store-relative image refs on read (Invariant 3)', async () => {
    write({ logoUrl: 'files/logo.png', faviconUrl: 'files/fav.ico' })
    const s = await getSettings()
    expect(s.logoUrl).toBe('/uploads/files/logo.png')
    expect(s.faviconUrl).toBe('/uploads/files/fav.ico')
  })

  it('clamps out-of-range numbers and rejects an unknown theme preset', async () => {
    write({ relatedCount: 999, excerptLength: 1, themePreset: 'not-a-preset' })
    const s = await getSettings()
    expect(s.relatedCount).toBe(12)
    expect(s.excerptLength).toBe(10)
    expect(s.themePreset).toBe(DEFAULT_SETTINGS.themePreset)
  })
})

describe('saveSettings', () => {
  it('persists a change and merges the next partial over it', async () => {
    await saveSettings({ title: 'First', description: 'kept' })
    await saveSettings({ title: 'Second' })
    const s = await getSettings()
    expect(s).toMatchObject({ title: 'Second', description: 'kept' })
  })

  it('writes image refs store-relative, keeping the returned value absolute', async () => {
    const returned = await saveSettings({ faviconUrl: '/uploads/files/fav.ico' })
    expect(returned.faviconUrl).toBe('/uploads/files/fav.ico')
    const stored = JSON.parse(one<{ data: string }>(`select data from settings`)!.data)
    expect(stored.faviconUrl).toBe('files/fav.ico')
  })

  it('falls back to the default title rather than storing an empty one', async () => {
    expect((await saveSettings({ title: '   ' })).title).toBe(DEFAULT_SETTINGS.title)
  })

  it('keeps exactly one row however many times it is called', async () => {
    await saveSettings({ title: 'A' })
    await saveSettings({ title: 'B' })
    expect(one<{ n: number }>(`select count(*) n from settings`)!.n).toBe(1)
  })
})
