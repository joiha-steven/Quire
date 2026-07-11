> Split from CLAUDE.md — read when touching SEO toggles, sitemap/feed/llms/robots, OG image, PWA, or the web manifest.

# SEO & PWA

## SEO (toggleable, Admin → Settings → SEO)

- `settings.seo` = `{ autoSchema, sitemap, llms, robots, rss, ogImage, ogFallbackImage }` +
  `settings.siteUrl` (canonical; '' → localhost via
  `resolveSiteUrl()`). Drives `metadataBase`.
- `robots.ts` — always disallows `/admin`+`/api`; when on, a 3-group policy: search +
  reputable AI bots allowed (`SEARCH_BOTS`/`AI_BOTS`, paired with `/llms.txt`), scrapers
  (`BAD_BOTS`: Ahrefs/Semrush/…) `Disallow: /`, `*` welcoming. Lists are consts atop the file.
- `sitemap.ts` — home + posts + pages + categories + tags; each post lists its images
  (`<image:image>`). `sitemaps.xml` → 308 to `/sitemap.xml`.
- `llms.txt` (markdown content index, 404 off) · `feed.xml` (RSS 50, 404 off, auto-discovered).
- `og/route.tsx` — dynamic OG (1200×630, runs on the **edge runtime** so its bundled Inter
  `.woff` subsets load); query `title` + optional `desc` (excerpt, 3-line-clamped) + `date` (bottom
  line) + `site` (bottom-line fallback) + `bg` + `?font=<storeUrl>` (storage host only, SSRF-guarded).
  A post card = title + excerpt + date; home/category/tag = title + site. `lib/og.ts`
  builds the card URLs (`ogImageUrl` posts/pages, `ogCardUrl`+`siteDomain` lists); honors
  `seo.ogImage`; appends `font=` when a custom font is set.
- **Canonical:** every indexable page self-canonicals via `alternates.canonical` in its
  `generateMetadata` (home `/`, `/[slug]`, `/category|tag/[slug]`, and each `…/page/[n]`), resolved
  absolute against `metadataBase`. `/page/1` (and `/category|tag/<x>/page/1`) 308-redirect to the base
  in `src/middleware.ts` — page 1 IS the base, never a duplicate. (It MUST be middleware: a page-level
  `redirect()` runs after `loading.tsx` streams, so Next downgrades it to a client meta-refresh.)
- JSON-LD via `JsonLd.tsx` (`websiteSchema` home, `articleSchema` + `breadcrumbSchema` posts —
  Home → first category → post), gated `seo.autoSchema`.
- Unknown slugs / out-of-range pages `notFound()` mid-stream, so Next returns 200 but injects
  `<meta name="robots" content="noindex">` (its documented streaming behaviour) — a soft-404 that
  search engines are told not to index. Not a bug; don't "fix" the status.
- robots/sitemap/feed/llms are ISR; an SEO toggle is a settings save → `revalidateEverything()`;
  post create/edit purges feed/sitemap/llms.

## PWA

- Installs to the home screen, launches standalone. **No service worker (offline is out of
  scope by design)** → nothing to register; admin/API are never cached.
- `app/manifest.ts` (force-dynamic) from settings (name/short_name = title, theme/bg = light
  palette bg, icons via `resolveAppIcon`). Next auto-injects `<link rel="manifest">` — don't
  add it by hand.
- iOS home-screen icon = the **apple-touch-icon** (`generateMetadata` in `app/layout.tsx`);
  standalone via the manifest's `display:standalone` (iOS 16.4+). Status bar via
  `generateViewport` → `themeColor`.
- **Notch / Dynamic Island:** `generateViewport` sets `viewportFit: 'cover'` so the page fills
  under the island and fixed top bars (the reading-progress bar) reach the true screen edge;
  `body` re-pads with `env(safe-area-inset-*)` (globals.css) so the header/content clear the
  island. `env()` is 0 on devices without insets — no effect there. Don't remove one without the
  other (cover alone tucks the header under the island; padding alone leaves the bar below it).
- App icon order: `appIconUrl` → `faviconUrl` → bundled `public/app-icon.png`.
- **Favicon: ONE `<link rel="icon">`, driven only by `generateMetadata`** (`settings.faviconUrl ||
  '/favicon.ico'`). The default lives in **`public/favicon.ico`, NOT `app/`** — an `app/favicon.ico`
  is auto-injected by Next ON TOP of the metadata icon, which shipped two conflicting favicons.
  Don't re-add `app/favicon.ico`.
