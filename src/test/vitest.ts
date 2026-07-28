// A `vitest` shim over `bun:test`, so the 35 test files moved from the frozen tree keep
// working with ZERO edits.
//
// Why a shim rather than rewriting the imports: the tests are the only safety net this
// project has, and the whole premise of ADR 0005 is that a port moves code rather than
// touching it. Every line edited in a test is a line where the net can be silently
// loosened. 28 import specifiers had to change when the modules moved; the test bodies
// did not, and this file is what keeps it that way.
//
// It also fixes an accident: `import ... from 'vitest'` currently resolves up the tree to
// the FROZEN implementation's `node_modules`, which disappears at the M4 cutover. Aliasing
// `vitest` here (tsconfig `paths`) makes the dependency explicit and local.
//
// Everything here is bun:test underneath. Nothing simulates vitest behaviour beyond the
// call shapes these tests actually use; an unimplemented member throws rather than
// silently passing.
import {
  describe, it, test, expect, beforeAll, beforeEach, afterAll, afterEach,
  mock, spyOn, jest,
} from 'bun:test'

export { describe, it, test, expect, beforeAll, beforeEach, afterAll, afterEach, mock, spyOn }

/** Globals replaced by `vi.stubGlobal`, so `restoreAllMocks` can put them back. */
const stubbed = new Map<string, { had: boolean; value: unknown }>()

function unstubAllGlobals(): void {
  const g = globalThis as unknown as Record<string, unknown>
  for (const [name, prev] of stubbed) {
    if (prev.had) g[name] = prev.value
    else delete g[name]
  }
  stubbed.clear()
}

export const vi = {
  fn: mock,
  spyOn,
  mock: (specifier: string, factory: () => unknown) => mock.module(specifier, factory),

  /**
   * Replace a global and remember what was there. vitest restores these on
   * `restoreAllMocks`; bun:test has no equivalent, so the bookkeeping lives here.
   */
  stubGlobal(name: string, value: unknown): void {
    const g = globalThis as unknown as Record<string, unknown>
    if (!stubbed.has(name)) stubbed.set(name, { had: name in g, value: g[name] })
    g[name] = value
  },
  unstubAllGlobals,

  restoreAllMocks(): void {
    unstubAllGlobals()
    jest.restoreAllMocks()
  },

  useFakeTimers: () => jest.useFakeTimers(),
  useRealTimers: () => jest.useRealTimers(),

  /**
   * `rate-limit.test.ts` advances past a sliding window. The window is measured with
   * `Date.now()`, so moving the clock is what the test actually needs; bun:test exposes
   * that as `setSystemTime` rather than as a timer-queue drain.
   */
  advanceTimersByTime(ms: number): void {
    jest.setSystemTime(new Date(Date.now() + ms))
  },
}
