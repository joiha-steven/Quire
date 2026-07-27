# docs/ — durable truth

Everything here describes how Quire works **right now**. Out of date here is a bug: fix it
in place, in the same commit as the behaviour change that made it wrong.

What does not belong here: anything dated (that is a snapshot, see `state/`), anything about
what we intend to do (that is `state/ROADMAP.md` or `state/TASKS.md`), and any rule that is
already stated somewhere else. `check:docs` fails on a dated filename in this directory.

| File | Holds |
|---|---|
| [invariants.md](invariants.md) | The 7 load-bearing rules, each with its enforcing code and its guard |
| [data-layer.md](data-layer.md) | Operational shape, env, the `src/lib` map, caching contract, render path |
| [conventions.md](conventions.md) | Typography, header alignment, layout, dividers, i18n, scripts, releases |
| [features.md](features.md) | What each feature area does. ~20 areas, one file (see the split task in `state/TASKS.md`) |
| [performance.md](performance.md) | The resource-loading law: fonts, CSS split, island JS, the prerender rule |
| [seo-pwa.md](seo-pwa.md) | Sitemap, feeds, OG, region, PWA |
| [agent-ready.md](agent-ready.md) | Markdown negotiation, `.well-known` discovery, Content-Signal |
| [mcp.md](mcp.md) | MCP server, tokens, OAuth |
| [backups.md](backups.md) | Drive snapshots, restore, cron |
| [self-host-native.md](self-host-native.md) | Running it on your own box |
| [admin-design.md](admin-design.md) | The admin visual contract |
| [decisions/](decisions/README.md) | ADRs, append-only, with a still-in-force index |

## The rule that keeps this cheap

One rule lives in exactly ONE file. `CLAUDE.md` is a router and restates nothing, because
two copies of a rule means one of them is wrong within a month.

Related: `v2/docs/` holds the specs for Quire 2.0, which is a different implementation of
the same product and therefore has its own tree until cutover.
