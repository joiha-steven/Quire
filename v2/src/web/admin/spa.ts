// Serving the admin: the shell HTML, and the bundle behind it.
//
// The bundle is code-split, so unlike the three public files there is no fixed list to
// import as text — the chunk names carry a hash the bundler chose. The whole directory is
// therefore read at startup and held in memory, which also keeps the compiled binary
// self-contained in the one way that matters: `Bun.embeddedFiles` covers the entry point
// and `import.meta.dir` covers running from source.
//
// The gate is the important part. The shell is served only to the owner, and everything
// under it is a router-group route (Invariant 4). A signed-out request is REDIRECTED to
// sign in rather than 404'd: the admin is not a secret, only its contents are.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from 'hono'

const DIR = join(import.meta.dir, '../../admin/dist')

type Asset = { body: Uint8Array; type: string }

const TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

/**
 * Every built file, by name. Read once: the admin is a build artefact, so a change to it
 * arrives with a restart, and re-reading per request would buy nothing but syscalls.
 */
const ASSETS = new Map<string, Asset>()
try {
  for (const name of readdirSync(DIR)) {
    const ext = name.slice(name.lastIndexOf('.'))
    const type = TYPES[ext]
    if (!type) continue
    ASSETS.set(name, { body: new Uint8Array(readFileSync(join(DIR, name))), type })
  }
} catch {
  // A source checkout that has not run `bun run build:admin` yet. The route below says so
  // in plain words rather than serving a blank page that looks like a broken admin.
}

/** The entry point's current name, which carries no hash — the chunks do. */
const ENTRY = '/admin/assets/main.js'
const STYLES = '/admin/assets/admin.css'

/**
 * The shell. Deliberately empty: there is no server rendering of the admin, because a
 * second rendering path for a tool only one person opens is a second set of bugs for no
 * reader's benefit.
 *
 * `data-admin` on <html> is what the stylesheet's dark-mode rules hang off, and the inline
 * class on <body> is the neutral canvas — the one paint the bundle must not be responsible
 * for, or the admin flashes white before React mounts.
 */
export function adminShell(): string {
  if (ASSETS.size === 0) {
    return '<!DOCTYPE html><meta charset="utf-8"><title>Quire</title>'
      + '<p style="font:14px system-ui;padding:2rem">The admin bundle has not been built. '
      + 'Run <code>bun run build:admin</code>.</p>'
  }
  return `<!DOCTYPE html>
<html lang="en" class="admin">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Quire</title>
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="${STYLES}">
</head>
<body class="bg-neutral-100 dark:bg-neutral-950">
<div id="admin"></div>
<script type="module" src="${ENTRY}"></script>
</body>
</html>
`
}

/** One built file, or null. */
export function adminAsset(name: string): Asset | null {
  return ASSETS.get(name) ?? null
}

export function handleAdminAsset(c: Context): Response {
  const name = c.req.path.replace('/admin/assets/', '')
  const asset = adminAsset(name)
  if (!asset) return new Response('Not found', { status: 404 })
  // The entry point has no hash in its name, so it must revalidate; the chunks it pulls in
  // do, and can be held forever.
  const immutable = /-[a-z0-9]{8,}\./.test(name)
  return new Response(asset.body, {
    headers: {
      'content-type': asset.type,
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    },
  })
}
