# Admin editorial redesign — July 2026

## Goal

Bring the admin closer to Quire's reading-first identity without changing the public typography, content model, publishing rules, or editor data flow. The new direction treats admin as a quiet editorial workspace rather than a generic analytics dashboard.

## Design principles

- Typography remains unchanged. Public reading settings and font presets are deliberately out of scope.
- Use a flat neutral canvas; visual hierarchy comes from spacing and rules, not decoration.
- Cards are reserved for genuinely independent data. Shadows are reserved for overlays.
- Writing is the primary admin task. The editor gets the full desktop width and hides global navigation.
- Detailed analytics, taxonomy, integrations, and system information stay on their dedicated screens instead of competing on the home page.
- Existing server actions, autosave, revisions, preview tokens, media picking, and publish behavior are preserved.

## Changes

### Admin shell

- Replaced the dotted canvas with a quiet warm-neutral surface.
- Standardized flat panels without shadows or large radii.
- Reduced page gutters and capped the working width for more consistent density.
- Changed active navigation from a filled block to a slim position marker.
- Removed cache clearing from persistent navigation; it remains available where operational controls belong.

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
- Admin navigation and public chrome use a lighter, custom Quire line-icon language with open contours and consistent 20px geometry.
- Tag labels render lowercase across the public rail, tag archives, post metadata, editor selections, and taxonomy management without mutating stored values.
- The mobile reading-rail handle has a wider touch target and a calmer, longer edge-tab proportion.
- Legacy table and analytics panels no longer carry isolated shadows or card styling.
- Admin theme dropdown colors are isolated from the public site's configurable palette.
