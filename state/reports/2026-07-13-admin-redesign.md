# Worklog — 2026-07-13 admin and editor redesign

This is the consolidated record for the July 13 UI/UX work. It complements the design rationale in [`admin-redesign-2026-07.md`](./admin-redesign-2026-07.md), the behavior map in [`features.md`](./features.md), and the release history in [`../CHANGELOG.md`](../CHANGELOG.md).

## Scope and invariants

- Redesign the owner admin as a modern, minimal editorial workspace using only black, white, and neutral gray.
- Keep public reading typography and the approved public-header icons unchanged.
- Preserve every working route, API, database shape, autosave, revision, preview, media, taxonomy, cache, backup, import, and publish flow.
- Keep Settings two-column on desktop and one-column only at the mobile breakpoint.
- Keep H1–H5 directly visible in the editor toolbar.
- Keep tag values unchanged in storage while rendering tag labels lowercase in public and admin UI.

## Admin design system

- Scoped the public square-corner reset away from `.admin-shell`; admin uses 16px panels, 12px groups, 8px controls, and fully rounded pills/switches.
- Set the light admin canvas to true neutral gray `#f5f5f5`; removed cool-blue and warm-paper casts from the application shell.
- Standardized cards, tables, tabs, buttons, fields, switches, focus states, empty states, hover feedback, spacing, and shadows.
- Rebalanced the workspace to a 1480px maximum with responsive gutters and a 208px expanded / 72px collapsed sidebar.
- Made mobile navigation an overlay instead of a layout-pushing menu.
- Aligned Theme, Clear cache, and Sign out as identical sidebar-footer rows; Theme includes its sun/moon icon.
- Restored Clear cache to expanded, collapsed, and mobile navigation.
- Kept the established public search, palette, light/dark, and menu glyphs after rejecting a replacement icon set.
- Kept the mobile reading-rail handle narrow at 16 × 64px with a 10 × 18px directional chevron.

## Admin surfaces

- Updated Overview, Analytics, Content, Comments, Media, Trash, Settings, Log, Help, post editor, and page editor to the shared component system.
- Overview statistics became independent cards; detailed information remains on its dedicated screen.
- Content tables, status labels, tabs, modals, upload controls, and empty states now share one visual hierarchy.
- Settings retains task-based tabs and the efficient two-column layout.
- Palette cards stay legible in selected, available, and hidden states; state is shown by neutral border/surface hierarchy rather than fading the whole card.
- Backup scheduling uses responsive standard selects, spacing, and grouped surfaces.
- WordPress import hides native file-input chrome behind the shared accessible button and preserves the existing WXR import behavior.
- Favicon and application-icon previews/uploads continue to use the files API and were verified after earlier broken previews.

## Editor

- Editor focus mode hides the global sidebar and uses a framed sticky action header aligned with the writing surface.
- Long titles use content-driven height and no longer clip.
- The property inspector remains collapsible and sticky on wide screens.
- The formatting toolbar is sticky, permanently one line, centered when it fits, and horizontally scrollable when it does not.
- Descriptive actions use compact line icons; B/I/U/S, P, and H1–H5 remain familiar text controls.
- Removed the accidental global focus rectangle from TipTap while retaining focus rings on real buttons and fields.
- Removed editor overflow rules that broke nested sticky positioning.
- Added optional typewriter feedback:
  - block-style overlay caret that never enters the ProseMirror document;
  - distinct insert and delete strikes on the active block;
  - generated Web Audio clicks, with insert higher and delete lower;
  - audio volume finalized at 45% of the internal click scale (peak gain `0.0495`);
  - composition updates excluded so Vietnamese IME input is not spammed;
  - visual motion respects the master motion setting and reduced-motion preference;
  - Appearance → Rendering → Typewriter feedback disables caret, block response, and audio together;
  - existing installations default the setting to on through `sanitizeMotion()`.

## Public-facing corrections

- Public typography and chosen reading fonts were not changed.
- Tags display lowercase across public rails, archives, metadata, and admin taxonomy controls without mutating stored values.
- Approved public icons were restored and documented as the baseline.
- Mobile reading controls were reduced and visually softened without changing their behavior.

## Documentation and verification

- Updated `README.md`, `ARCHITECTURE.md`, `CHECKLIST.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `ROADMAP.md`, `docs/features.md`, `docs/conventions.md`, `docs/admin-redesign-2026-07.md`, and `CHANGELOG.md`.
- Historical audit reports remain immutable snapshots; specialized backup, MCP, SEO/PWA, self-hosting, security, and legacy documents were not changed because their contracts did not change.
- Repeated verification throughout the work: `npm run check:all` (152 tests), TypeScript, ESLint, route/file/invariant guards, production builds, authenticated desktop browser review, and `/api/health` database/storage checks.
- Production deployment used release directories, preserved `.env.local`, `data`, and `uploads`, restarted the `quire` service only after successful server build, then passed the health probe.

## Commit sequence

- `63c48ad` — redesign admin interface system
- `aa62b99` — finish admin surfaces and docs
- `d0caf02` — fix editor toolbar and admin footer alignment
- `5364e81` — polish admin forms and toolbar alignment
- `08124b9` — hide native import control from accessibility tree
- `1047665` — refine editor focus and typing feedback
- `73965e6` — add typewriter caret and key sounds
- `dc1f09b` — add typewriter settings toggle

Later corrections should append to this list and update the behavior-specific documentation in the same commit.
