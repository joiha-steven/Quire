// The admin prints this next to the version and links it to a commit page, so a value that
// is nearly right is worse than none: it sends the owner to a URL that 404s, or to somebody
// else's commit.
import { describe, expect, it, afterEach } from 'bun:test'
import { rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildSha, resetBuildSha } from '@/server/build-info'

const FILE = resolve(process.cwd(), 'build-sha')
const write = (text: string) => { writeFileSync(FILE, text); resetBuildSha() }

afterEach(() => {
  rmSync(FILE, { force: true })
  resetBuildSha()
})

describe('buildSha', () => {
  it('is null when the deploy left nothing behind', () => {
    rmSync(FILE, { force: true })
    resetBuildSha()
    expect(buildSha()).toBeNull()
  })

  it('reads a full SHA, trailing newline and all', () => {
    const sha = 'a'.repeat(40)
    write(`${sha}\n`)
    expect(buildSha()).toBe(sha)
  })

  // `git describe`, a branch name, a truncated write: each would build a commit URL that
  // goes nowhere, and a wrong link is worse than an absent one.
  it('refuses anything that is not a full hex SHA', () => {
    for (const junk of ['abc1234', 'main', 'v2.0.0', '', 'z'.repeat(40), `${'a'.repeat(40)} dirty`]) {
      write(junk)
      expect(buildSha()).toBeNull()
    }
  })
})
