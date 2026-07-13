# Admin editorial redesign — July 2026

## Goal

Bring the admin closer to Quire's reading-first identity without changing the public typography, content model, publishing rules, or editor data flow. The new direction treats admin as a quiet editorial workspace rather than a generic analytics dashboard.

## Design principles

- Typography remains unchanged. Public reading settings and font presets are deliberately out of scope.
- Use a flat light-gray neutral canvas; visual hierarchy comes from spacing and rules, not decoration.
- Cards are reserved for genuinely independent data. Shadows are reserved for overlays.
- Writing is the primary admin task. The editor gets the full desktop width and hides global navigation.
- Detailed analytics, taxonomy, integrations, and system information stay on their dedicated screens instead of competing on the home page.
- Existing server actions, autosave, revisions, preview tokens, media picking, and publish behavior are preserved.

## Changes

### Admin shell

- Replaced the dotted canvas with a quiet light-gray neutral surface (no warm/yellow cast).
- Standardized panels with a restrained 16px radius, neutral border, and one-pixel ambient shadow.
- Reduced page gutters and capped the working width for more consistent density.
- Changed active navigation from a filled block to a slim position marker.
- Kept cache clearing in the persistent sidebar footer so it remains reachable from every admin screen.

### Dashboard

- Reduced the home page to core counts, traffic/attention widgets, recent activity, and a small system footer.
- Added a prominent `New post` action to the page header.
- Removed duplicate taxonomy, SEO, traffic-source, quick-action, and full runtime cards from the home page.
- Kept detailed destinations intact in Content, Analytics, Log, Settings, and Media.

### Content list

- Moved the new-content action into the page header.
- Replaced the segmented tab track with a quieter underline navigation.
- Flattened the table surface and changed heavy black status pills to dot-and-label statuses.
- Added compact category context below titles on narrow layouts.

### Editor

- Hides the global sidebar while editing to create a focus mode.
- Moves save, preview, publish, and property controls into a sticky editor header.
- Aligns the title with the public reading column.
- Lets long titles wrap naturally while the property inspector is open.
- Makes the property inspector collapsible and sticky on wide screens.
- Removes the bottom action bar so it no longer covers the end of long posts.
- Consolidates H1–H5 controls into a paragraph-style selector.
- Keeps Markdown, media, gallery, table, autosave, revisions, and publishing behavior unchanged.

### Settings

- Kept the efficient two-column desktop layout, with consistent panel chrome, aligned gaps, and a single-column mobile fallback.
- Preserved the existing task tabs and save semantics.
- Integration panels now follow a predictable top-to-bottom order instead of competing side by side.

## Verification checklist

- TypeScript/type generation
- ESLint
- Unit tests and repository invariant checks
- Production build
- Desktop browser review of dashboard, content, editor, and settings
- Mobile review of admin navigation and editor controls

## Follow-up candidates

- Add translated strings for new editor chrome labels currently expressed in Vietnamese.
- Convert very narrow content tables to stacked list rows.
- Split Integrations into an internal secondary navigation if the number of integrations grows.
- Replace native link prompt in the editor with a small accessible popover.

## Monochrome refinement

The second visual pass tightened the system after reviewing every admin surface on production:

- Admin feedback, status, analytics trends, media selection, warnings, destructive actions, and recovery banners now use only black, white, and neutral gray.
- Theme selection opens beside the bottom sidebar control instead of below the viewport.
- The mobile admin menu is an overlay and no longer pushes page content downward.
- The expanded sidebar is narrower (176px); collapsed width is 56px.
- H1–H5 are restored as always-visible editor controls because they are frequent writing actions.
- The editor action header uses the same bordered surface and internal padding as the writing frame, rather than a flush edge-to-edge strip.
- The formatting toolbar has its own sticky offset below the desktop action header; on mobile the action header scrolls away and formatting remains pinned.
- Admin navigation uses the custom Quire line-icon language. The four public-header glyphs retain their established designs (search circle, three-circle palette, sun/moon, and two-line menu); a July 12 replacement was rejected and reverted.
- Tag labels render lowercase across the public rail, tag archives, post metadata, editor selections, and taxonomy management without mutating stored values.
- The mobile reading-rail handle is a restrained 16 × 64px edge tab with a 10 × 18px chevron. Keep it narrow; do not restore the earlier 24 × 76px footprint without a mobile review.
- The formatting toolbar offset is measured from the real action-header height, eliminating viewport- and translation-dependent gaps.
- Clear cache is restored to the admin operations footer; it remains available in both expanded and collapsed navigation.
- Legacy table and analytics panels no longer carry isolated shadows or card styling.
- Admin theme dropdown colors are isolated from the public site's configurable palette.

## Owner-approved visual decisions

- Do not change the public reading typography as part of admin-polish work; the current fonts and type settings are intentional.
- Keep Settings in two columns on desktop and one column only at the mobile breakpoint.
- Keep H1–H5 visible in the editor toolbar; these are frequent actions and must not be hidden inside a selector.
- Preserve the established four public-header icons unless a replacement is reviewed visually first. Shared button sizing still comes from `ICON_BTN`; preserving glyphs does not permit per-button chrome drift.
- Keep the editor action header framed and aligned to the editor surface, with the formatting toolbar sticky beneath its measured height.
- The square-corner rule applies only to the public reading interface. Admin is an application workspace: use the shared 16/12/8px radius hierarchy, never a global square reset and never arbitrary per-component rounding.

## Modern admin system — 2026-07-13

- Scoped the sharp-corner reset away from `.admin-shell`; frontend styling and typography remain unchanged.
- Rebuilt shared cards, tables, tabs, buttons, inputs, switches, focus rings, and empty states around a consistent neutral component system.
- Expanded the desktop sidebar to 208px (72px collapsed), added rounded active/hover surfaces, and converted the mobile menu into a floating rounded drawer.
- Rebalanced the workspace to a 1480px maximum with responsive 16/28/40/48px gutters and consistent 20–28px section rhythm.
- Dashboard stats are independent cards instead of a fused spreadsheet strip; traffic, attention, top posts, and activity use the same surface hierarchy.
- Content, Settings, Analytics, Media, Trash, Comments, Log, and Help share segmented tabs, rounded tables/panels, standard controls, and row hover feedback.
- Editor focus mode is preserved. The action header, writing frame, and property inspector are separate related surfaces; sticky toolbar, autosave, preview, revisions, media, taxonomy, and publish flows are unchanged.
- Editor formatting is a single non-wrapping icon row with horizontal overflow on narrow screens. The editor frame must not use `overflow-hidden`, because that breaks the nested sticky toolbar. Titles use content-driven height so long titles are never clipped.
- The formatting row centers its controls when they fit and naturally starts at the leading edge when it overflows; mobile remains a single horizontally scrollable line.
- The prose `contenteditable` must not inherit the global admin focus outline. The surrounding editor card supplies the workspace boundary; focus rings remain on discrete controls.
- Insert and delete input uses a block-style overlay caret, active-line pulse, and generated mechanical click. Keep visuals compositor-only, selection-safe, IME-safe, and governed by the global motion/reduced-motion settings; keep audio locally generated at the documented 20% internal volume and out of composition updates.
- Sidebar footer controls always use the same icon + label row structure; the theme control must show its sun/moon glyph before the applied mode label.
- Palette cards must remain readable in every state. Use neutral border/surface hierarchy for selected, available, and hidden palettes; never lower opacity on the entire card or its labels.
- Backup scheduling and import controls use shared rounded inputs and buttons. Native file-input chrome must stay visually hidden behind an accessible labeled trigger.
- The light admin canvas is neutral `#f5f5f5`; do not introduce cool blue-gray backgrounds into the application shell.
