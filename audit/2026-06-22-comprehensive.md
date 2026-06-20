# Comprehensive audit — 2026-06-22

- **Version:** 0.9.0
- **Scope:** whole project (tech, security, performance, logic, layout, code quality, docs)
- **Verdict:** clean. No security vulnerabilities or logic bugs. Fixes were limited to one
  latent layout-drift risk and stale docs/comments.

## 0. Baseline
- `npx tsc --noEmit` → exit 0
- `npm run lint` → exit 0
- `npm run build` → exit 0; `/` + `/[slug]` render `○`/`●` (ISR), admin `ƒ` (dynamic)

## 1. Security — pass
- All 34 API routes that mutate or read owner data call `requireOwner()`; only
  `api/auth/[...nextauth]` lacks it (correct — it IS the auth endpoint).
- `/admin` guarded in the admin layout (`getAuthState` → redirect home / sign-in).
- `dangerouslySetInnerHTML` sources all safe: markdown raw HTML is escaped by the `marked`
  renderer; palette colors pass a `^#[0-9a-fA-F]{3,8}$` check before the `<style>` emit
  (no CSS breakout); `customCss` strips `</style`; JSON-LD escapes `<` → `<`.
- Injection constrained: video/OG/TikTok embed URLs are rebuilt from regex-extracted ids;
  OG title/site length-capped; RSS escapes `& < > "`; sitemap uses `encodeURIComponent`;
  `themesToCss` selector ids are preset constants only (`sanitizeThemes` drops unknown ids).
- Preview token uses `timingSafeEqual` (+ length pre-check). Icon upload whitelists content
  type and `kind` (`favicon`/`app-icon`/`icon`) — no path traversal.

## 2. Logic — pass
- `revalidate.ts` purges a superset of affected surfaces per change type; the one accepted
  staleness (related-posts box) is documented + self-healing.
- Blob reads `?ts`-busted; index writes are read-modify-write — no read-after-write race.
- Data-loss path closed last session: `findUnusedMedia` scans `revisions/` so a time-machine
  image is never reported unused (the removed `sweep.ts` ignored revisions and deleted).
- `ensureSlugFree` enforces the shared post+page URL namespace; drafts + future-dated posts
  hidden via `isPublicallyVisible` on every public surface.

## 3. Performance — pass
- `getMedia` per post render + `listBlobs` per upload are `O(n)`/`O(all blobs)` but
  intentional and fine to the low hundreds of posts (documented in CLAUDE.md + ROADMAP).
- No public page is `force-dynamic`; ISR intact.

## 4. Code quality — pass
- Largest file 339 lines (< 400 cap). No `any` (only the word in comments), no stray
  `console.log`, no `TODO`/`FIXME`/`@ts-ignore`.

## 5. Layout / visual — 1 fix
- **FIXED:** the public header's 4 icon buttons (search, palette, theme, menu) each repeated
  the same literal class string `flex h-10 w-10 items-center justify-center rounded-lg
  text-meta hover:bg-rule` — a drift risk the "one shared class constant" convention forbids.
  Extracted to `ICON_BTN` (`src/components/ui/iconButton.ts`) and imported in all 4.
- Admin bar already shares `ADMIN_NAV`; wordmark + nav use the `h-9 items-center` box rule.
- Public reading UI uses theme tokens (`text-meta`/`bg-rule`/…), no hardcoded neutrals.
- One `<hr>` divider style; no `uppercase`.

## 6. i18n — pass
- 6 locales key-complete (tsc `satisfies` guarantee); `palette` + `themeTime` present in all.

## 7. Docs — fixed stale entries
- `themes.ts` header comment described the old single-`theme` model → rewritten to per-palette.
- `CHECKLIST.md` said "Clean unused **deletes**" → corrected to read-only "Check unused"
  badge/filter; added `.ico`/`files/upload`/`media/unused` checks; (layout section pending in
  a later pass if wanted).
- `README.md` feature list missing palettes/PWA/time-machine/icons + Blob prefixes → added.
- `ARCHITECTURE.md` data model missing `revisions/`+`files/` and used the old settings shape →
  updated; added themes-axes + PWA design notes and `themes.ts`/`files.ts` to the map.

## Changes shipped this pass
- `src/components/ui/iconButton.ts` (new `ICON_BTN`) + 4 call sites updated.
- `src/lib/themes.ts` comment; `CHANGELOG.md`, `CHECKLIST.md`, `README.md`, `ARCHITECTURE.md`,
  `CLAUDE.md` (conventions: `ICON_BTN`; audit-folder pointer).
- `audit/README.md` (procedure) + this report.

## Follow-ups (none blocking)
- `getSettings` spreads a legacy `theme` key from old stored JSON via `...stored` (harmless,
  unused, self-heals on next save). Not worth touching the hot path.
