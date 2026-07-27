// The cron tick, the health probe, the preview link and the WordPress import.
//
// The bearer check is the one worth the most attention: `/api/cron` is reachable without a
// session, so the secret is the only thing between an external caller and a maintenance
// run.
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { db } from '@/store/db'
import { createApp } from '@/web/app'
import { createUser } from '@/auth/users'
import { COOKIE_NAME, createSession } from '@/auth/sessions'
import { resetSecretCache } from '@/auth/secret'
import { resetLimits } from '@/server/rate-limit'
import { verifyPreview } from '@/content/preview'

const DIR = './.tmp-test-admin-ops'
freshDatabase(DIR)
afterAll(() => {
  dropDatabase(DIR)
  delete process.env.CRON_SECRET
})

const app = createApp()
let cookie = ''

beforeEach(async () => {
  for (const t of ['sessions', 'users', 'posts', 'pages', 'post_terms', 'activity_log', 'settings', 'server_secrets']) {
    db().run(`delete from ${t}`)
  }
  delete process.env.CRON_SECRET
  resetSecretCache()
  resetLimits()
  const user = await createUser({ username: 'hung', email: 'h@example.com', password: 'wandering violet cassette' })
  cookie = `${COOKIE_NAME}=${createSession(user.id).token}`
})

const asOwner = (path: string, init: RequestInit = {}) =>
  app.request(path, {
    ...init,
    headers: { cookie, 'sec-fetch-site': 'same-origin', ...(init.headers as Record<string, string> ?? {}) },
  })

describe('the gate', () => {
  it('refuses the owner-only ops routes without a session', async () => {
    expect((await app.request('/api/preview-link?slug=x')).status).toBe(401)
    const res = await app.request('/api/import/wordpress', {
      method: 'POST', headers: { 'sec-fetch-site': 'same-origin' }, body: new FormData(),
    })
    expect(res.status).toBe(401)
  })

  // ...and does NOT gate the two an external caller reaches. A probe that had to hold a
  // session would be a worse probe, and a scheduler cannot sign in at all.
  it('leaves cron and health reachable', async () => {
    expect((await app.request('/api/health')).status).toBe(200)
    expect((await app.request('/api/cron')).status).toBe(200)
  })
})

describe('the cron tick', () => {
  it('is open when no secret is set, so a fresh install still ticks', async () => {
    const res = await app.request('/api/cron')
    expect(res.status).toBe(200)
    expect((await res.json() as { alive: boolean }).alive).toBe(true)
  })

  it('demands the bearer token once a secret is set', async () => {
    process.env.CRON_SECRET = 'a-long-shared-secret'
    expect((await app.request('/api/cron')).status).toBe(401)
    expect((await app.request('/api/cron', { headers: { authorization: 'Bearer wrong' } })).status).toBe(401)
    const ok = await app.request('/api/cron', { headers: { authorization: 'Bearer a-long-shared-secret' } })
    expect(ok.status).toBe(200)
  })

  // `timingSafeEqual` throws on a length mismatch, so a wrong-length header must be
  // rejected rather than becoming a 500.
  it('rejects a header of the wrong length without throwing', async () => {
    process.env.CRON_SECRET = 'a-long-shared-secret'
    for (const authorization of ['', 'Bearer', 'Bearer x', `Bearer ${'x'.repeat(200)}`]) {
      expect((await app.request('/api/cron', { headers: { authorization } })).status).toBe(401)
    }
  })

  /**
   * A scheduled post is a PUBLISHED one with a future date — there is no `scheduled`
   * status. It goes live when its date crosses now, which is what the sweep detects, so
   * the fixture is a published post dated a minute ago and the window is six.
   */
  it('reports a post that just crossed into live', async () => {
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
    await asOwner('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Timed', status: 'published', date: oneMinuteAgo, content: 'x' }),
    })
    const res = await app.request('/api/cron?publish=1')
    expect((await res.json() as { published: number }).published).toBe(1)
    // Invariant 1: on the home page without a cold hit.
    expect(await (await app.request('/')).text()).toContain('Timed')
  })

  it('reports nothing when a post is dated outside the window', async () => {
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    await asOwner('/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Old news', status: 'published', date: lastWeek, content: 'x' }),
    })
    const res = await app.request('/api/cron?publish=1')
    expect((await res.json() as { published: number }).published).toBe(0)
  })

  it('reports the session purge it now also does', async () => {
    const res = await app.request('/api/cron')
    const body = await res.json() as { sessions: number; finalized: number }
    expect(typeof body.sessions).toBe('number')
    expect(typeof body.finalized).toBe('number')
  })
})

describe('the health probe', () => {
  it('reports both checks and never caches', async () => {
    const res = await app.request('/api/health')
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await res.json() as { status: string; checks: { database: boolean; storage: boolean } }
    expect(body.status).toBe('ok')
    expect(body.checks.database).toBe(true)
  })

  // 503 when degraded, so a load balancer takes the instance out of rotation. A 200 with
  // `status: degraded` in the body would be read by nothing.
  it('returns 503 when the storage directory is not writable', async () => {
    const previous = process.env.STORAGE_LOCAL_DIR
    process.env.STORAGE_LOCAL_DIR = './this-directory-does-not-exist-at-all'
    const res = await app.request('/api/health')
    expect(res.status).toBe(503)
    expect((await res.json() as { status: string }).status).toBe('degraded')
    if (previous === undefined) delete process.env.STORAGE_LOCAL_DIR
    else process.env.STORAGE_LOCAL_DIR = previous
  })
})

describe('the preview link', () => {
  it('returns a token the preview route accepts', async () => {
    const res = await asOwner('/api/preview-link?slug=a-draft')
    expect(res.status).toBe(200)
    const { token } = await res.json() as { token: string }
    expect(verifyPreview('a-draft', token)).toBe(true)
    // Bound to the slug it was issued for, so sharing one draft does not share them all.
    expect(verifyPreview('another-draft', token)).toBe(false)
  })

  it('requires a slug', async () => {
    expect((await asOwner('/api/preview-link')).status).toBe(400)
  })
})

describe('the WordPress import', () => {
  const wxr = (items: string) => `<?xml version="1.0"?>
<rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/">
<channel>${items}</channel></rss>`

  const item = (title: string, type = 'post', slug = '') => `
<item>
  <title>${title}</title>
  <wp:post_name>${slug}</wp:post_name>
  <wp:post_type>${type}</wp:post_type>
  <wp:status>publish</wp:status>
  <content:encoded><![CDATA[<p>Body of <strong>${title}</strong>.</p>]]></content:encoded>
</item>`

  const send = (xml: string, name = 'export.xml') => {
    const form = new FormData()
    form.append('file', new File([xml], name, { type: 'text/xml' }), name)
    return asOwner('/api/import/wordpress', { method: 'POST', body: form })
  }

  it('imports posts and pages and converts the HTML to markdown', async () => {
    const res = await send(wxr(item('First Post') + item('About', 'page')))
    expect(res.status).toBe(200)
    const result = await res.json() as { posts: number; pages: number }
    expect(result.posts).toBe(1)
    expect(result.pages).toBe(1)

    const list = await (await asOwner('/api/posts')).json() as Array<{ slug: string }>
    const full = await (await asOwner(`/api/posts/${list[0].slug}`)).json() as { content: string }
    expect(full.content).toContain('**First Post**')
    expect(full.content).not.toContain('<strong>')
  })

  /**
   * Nothing is ever overwritten: an import ADDS. Posts and pages share one namespace
   * (Invariant 2), so the suffix has to be found against both.
   */
  it('suffixes a slug that already exists rather than overwriting', async () => {
    await send(wxr(item('Same Title')))
    await send(wxr(item('Same Title')))
    const list = await (await asOwner('/api/posts')).json() as Array<{ slug: string }>
    expect(list.length).toBe(2)
    expect(new Set(list.map((p) => p.slug)).size).toBe(2)
  })

  it('rejects a file that is not a WordPress export, with a specific message', async () => {
    const res = await send('<html><body>not an export</body></html>')
    expect(res.status).toBe(400)
    // "import failed" on the wrong file is the least useful thing to say to someone.
    expect(await res.json()).toEqual({ error: 'not_a_wordpress_export' })
  })

  it('rejects a request with no file', async () => {
    const res = await asOwner('/api/import/wordpress', { method: 'POST', body: new FormData() })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'no_file' })
  })
})
