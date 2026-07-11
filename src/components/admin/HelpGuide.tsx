// In-admin help. Content is ENGLISH by design (canonical, like the repo docs) — the
// nav label + page title are localized, the body links out to docs/*.md for depth.
// Pure server component (static), so it ships no client JS.
import Link from 'next/link'
import { PageHeader, Card } from './kit'

const REPO = 'https://github.com/joiha-steven/Quire'
const doc = (p: string) => `${REPO}/blob/main/${p}`

const A = 'text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-600 dark:text-neutral-100 dark:decoration-neutral-600 dark:hover:decoration-neutral-300'
const P = 'text-sm leading-relaxed text-neutral-600 dark:text-neutral-300'

// One external link (opens a new tab) or internal admin link.
function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={A}>{children}</a>
}
function In({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className={A}>{children}</Link>
}

// A row of quick links under a section.
function Links({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-500 dark:text-neutral-400">{children}</p>
}

export function HelpGuide({ title, version }: { title: string; version: string }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description="How to run your Quire blog — writing, settings, self-host, and Cloudflare. This is a concise index; the deep detail links out to the docs."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Writing &amp; publishing">
          <ul className={`${P} space-y-2 list-disc pl-4`}>
            <li>The editor is Markdown plus a rich toolbar. Drafts <b>autosave locally</b> and only go live when you Save or Publish — so editing a published post never pushes half-finished text.</li>
            <li>Drop images into the editor or the Media library; responsive <b>AVIF/WebP variants + thumbnails</b> are generated automatically.</li>
            <li>Reader <b>comments are off by default</b>. Enable them in Settings → Content; moderate and restore from Comments (delete goes to Trash).</li>
          </ul>
          <Links>
            <In href="/admin/editor">New post</In>
            <In href="/admin/content">All content</In>
            <In href="/admin/media">Media</In>
            <In href="/admin/comments">Comments</In>
          </Links>
        </Card>

        <Card title="Settings">
          <p className={P}>One form, one Save; changes apply site-wide with <b>no redeploy</b>. Five tabs:</p>
          <ul className={`${P} mt-2 space-y-1 list-disc pl-4`}>
            <li><b>Site</b> — title, logo, header menu, language, content width.</li>
            <li><b>Content</b> — reader features (search, table of contents, sidebar, related…) and comments.</li>
            <li><b>Appearance</b> — palettes, built-in/custom fonts, per-role text sizes, custom CSS.</li>
            <li><b>SEO</b> — sitemap, RSS, robots, OG images (canonical + breadcrumbs are automatic).</li>
            <li><b>Integrations</b> — MCP, Google Drive backups, Cloudflare, WordPress import, comment keys.</li>
          </ul>
          <Links><In href="/admin/settings">Open Settings</In></Links>
        </Card>

        <Card title="Server &amp; self-host">
          <ul className={`${P} space-y-2 list-disc pl-4`}>
            <li>Runs entirely on <b>your own server</b> — PostgreSQL + PostgREST for text, the local filesystem for images/files. Two flavors: <b>native</b> or <b>Docker</b>, no cloud account.</li>
            <li>Liveness/readiness probe at <Ext href="https://manhhung.me/api/health">/api/health</Ext> (checks the database + storage). Boot fails fast if a required env var is missing.</li>
            <li><b>Backups</b>: full snapshots (DB + all binaries) to Google Drive, scheduled with restore. Set it up in Settings → Integrations.</li>
            <li>Upgrades apply tracked SQL migrations, so schema changes are safe.</li>
          </ul>
          <Links>
            <Ext href={doc('docs/self-host-native.md')}>Self-host guide</Ext>
            <Ext href={doc('docs/backups.md')}>Backups</Ext>
            <Ext href={`${REPO}#readme`}>README</Ext>
          </Links>
        </Card>

        <Card title="Cloudflare">
          <p className={P}>Put Cloudflare in front for TLS and a global edge cache (big win when readers are far from the origin). Recommended setup:</p>
          <ul className={`${P} mt-2 space-y-1 list-disc pl-4`}>
            <li><b>Cache Rules</b>: bypass <code>/admin</code> + <code>/api</code>; cache everything else (respect the origin TTL).</li>
            <li>Enable <b>Smart Tiered Cache</b> — a reader&apos;s POP miss pulls from a warm upper tier, not your far origin.</li>
            <li><b>SSL: Full (Strict)</b>; turn <b>Rocket Loader OFF</b> (it defers JS and breaks React hydration).</li>
            <li><b>Auto-purge</b>: add a Cloudflare API token (Cache Purge) + Zone ID in Settings → Integrations, and the blog purges the whole zone on every save and deploy.</li>
          </ul>
          <Links>
            <Ext href="https://developers.cloudflare.com/cache/how-to/cache-rules/">Cache Rules docs</Ext>
            <Ext href="https://developers.cloudflare.com/cache/how-to/tiered-cache/">Tiered Cache docs</Ext>
          </Links>
        </Card>

        <Card title="Cache &amp; operations">
          <ul className={`${P} space-y-2 list-disc pl-4`}>
            <li><b>Clear all cache</b> (sidebar) purges the origin + Cloudflare, then re-warms the home and newest pages so the next visitor is fast.</li>
            <li>Every <b>save</b> already purges exactly the affected pages (and the CF zone) — an edit is live on the next request.</li>
            <li>On <b>deploy</b>: run migrations, then flush the edge with <code>GET /api/cron?purge=1</code> (CRON_SECRET). A per-deploy <b>deploymentId</b> makes any open tab auto-reload, so it never sticks on the loading screen.</li>
          </ul>
          <Links>
            <Ext href={doc('CHECKLIST.md')}>Deploy checklist</Ext>
            <Ext href={doc('docs/seo-pwa.md')}>SEO &amp; caching</Ext>
          </Links>
        </Card>

        <Card title="MCP — let an AI run it">
          <p className={P}>
            The built-in <b>MCP server</b> gives an AI agent (Claude, ChatGPT…) the <b>same rules as the admin</b> — create/update posts and pages, manage media and settings, all revalidated and logged like a human action. Enable it and mint access tokens in Settings → Integrations.
          </p>
          <Links>
            <Ext href={doc('docs/mcp.md')}>MCP docs</Ext>
            <In href="/admin/settings">Integrations</In>
          </Links>
        </Card>
      </div>

      <p className="pt-2 text-center text-xs text-neutral-400 dark:text-neutral-500">
        <Ext href={REPO}>Quire</Ext> v{version} · open source (MIT) · docs in the repo
      </p>
    </div>
  )
}
