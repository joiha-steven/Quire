# Worklog

Newest first. What happened, not what is true now (that is `docs/`) or what is next (that
is `TASKS.md`). Keep entries short; the detail is in the commit.

## 2026-07-27 — Documentation layout rebuilt to the four-homes standard

Four homes adopted ([ADR 0010](../docs/decisions/0010-four-homes-doc-layout.md)). `ROADMAP`
and `audit/` moved into `state/`, the two dated files in `docs/` split by kind (the admin
design contract stayed and lost its date, the worklog became a report), ten ADRs written
covering the last month including the one that reversed a day later, and
`scripts/checks/docs.mjs` added to hold the layout. `CLAUDE.md` cut from 275 lines to a
router. Splitting `features.md` into per-module specs deferred with a reason.

## 2026-07-27 — M0.5: parity checklist

`v2/docs/07-parity.md`, 214 items, drawn from `/admin/help`, `docs/features.md` and the
invariants. Marks the behaviours that are easy to lose and have no test, and states its own
gaps so a fully ticked file is not mistaken for proof.

## 2026-07-27 — M0 shipped to production (`58cf8f9`)

`opsz` pinned at 18 ([ADR 0009](../docs/decisions/0009-pin-optical-size-axis.md)): preload
set 97,588 to 46,212 B. Speculation Rules added, and with them `lib/prerender.ts`, because a
prerendered page runs its JavaScript at speculation time and `Track` would have recorded a
pageview on every hover. The CSS split turned out to be already correct, verified in the
build rather than assumed.

Corrected the same day: an intermediate claim that the plan's font premise was false came
from a local build reading a dev database whose settings differ from production.

## 2026-07-27 — Quire 2.0 retargeted from Go to Bun

[ADR 0005](../docs/decisions/0005-rewrite-in-bun-hono-sqlite.md) supersedes
[0004](../docs/decisions/0004-rewrite-in-go-on-sqlite.md) after one day. Seven specs written
under `v2/docs/`; `go/` marked superseded with a record of what was salvaged. Admin stays
React ([0006](../docs/decisions/0006-admin-stays-react-spa.md)), Google login goes
([0007](../docs/decisions/0007-self-hosted-password-totp-auth.md)), Tailwind leaves the
public site ([0008](../docs/decisions/0008-hand-written-css-no-tailwind-public.md)).

## 2026-07-26 — v1.5.0 released, then frozen

Newsletter as a first-class subsystem, a real dev stack, a security pass, and the
`SUPABASE_*` to `POSTGREST_*` env rename. The tree was frozen the same day
([ADR 0003](../docs/decisions/0003-freeze-v1-rewrite-as-v2.md)) and the SaaS direction
dropped ([ADR 0002](../docs/decisions/0002-no-saas-single-instance.md)).

Earlier history: `CHANGELOG.md` (releases) and `state/audits/` (review passes).
