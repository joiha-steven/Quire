import { describe, it, expect, afterEach, vi } from 'vitest'

// The dev sign-in is a real auth bypass: it hands out an owner session for a shared
// secret, with no Google. Two gates keep it out of a real deployment, and BOTH are
// pinned here — a regression in either is a full admin takeover on any site that ever
// had DEV_LOGIN in its env file.
//
//  1. `devLoginEnabled` — the provider is not even registered in a production build.
//  2. `validateEnv` — a production server REFUSES TO BOOT while DEV_LOGIN is set, so a
//     leftover value is loud rather than silently inert.

vi.mock('next-auth', () => ({ default: () => ({ handlers: {}, auth: () => null, signOut: () => {} }) }))
vi.mock('next-auth/providers/google', () => ({ default: {} }))
vi.mock('next-auth/providers/credentials', () => ({ default: (o: unknown) => o }))

const { devLoginEnabled } = await import('@/lib/auth')
const { validateEnv } = await import('@/env')

const ENV = { ...process.env }
afterEach(() => {
  process.env = { ...ENV }
})

describe('devLoginEnabled', () => {
  it('is off in production even with the secret set', () => {
    expect(devLoginEnabled('production', 'hunter2')).toBe(false)
  })

  it('is off in development without a secret', () => {
    expect(devLoginEnabled('development', '')).toBe(false)
    expect(devLoginEnabled('development', undefined)).toBe(false)
  })

  it('is on only in a non-production build WITH a secret', () => {
    expect(devLoginEnabled('development', 'hunter2')).toBe(true)
    expect(devLoginEnabled('test', 'hunter2')).toBe(true)
  })
})

describe('validateEnv', () => {
  const validBackend = {
    AUTH_SECRET: 'x',
    AUTHORIZED_EMAIL: 'owner@example.com',
    POSTGREST_URL: 'http://localhost:3001',
    POSTGREST_TOKEN: 'k',
  }

  it('refuses to boot a production server while DEV_LOGIN is set', () => {
    process.env = { ...ENV, ...validBackend, NODE_ENV: 'production', DEV_LOGIN: 'hunter2' }
    expect(() => validateEnv()).toThrow(/DEV_LOGIN is set on a PRODUCTION server/)
  })

  it('allows a production server with DEV_LOGIN unset', () => {
    process.env = { ...ENV, ...validBackend, NODE_ENV: 'production', DEV_LOGIN: '' }
    expect(() => validateEnv()).not.toThrow()
  })

  it('allows a development server with DEV_LOGIN set', () => {
    process.env = { ...ENV, ...validBackend, NODE_ENV: 'development', DEV_LOGIN: 'hunter2' }
    expect(() => validateEnv()).not.toThrow()
  })
})
