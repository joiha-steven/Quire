# state/ — where things stand now

`docs/` holds durable truth. **This holds the present**, and it is expected to change every
week. If a file here stops being true, edit it; that is the point of the directory.

| File | Holds |
|---|---|
| [ROADMAP.md](ROADMAP.md) | Direction and tracks. Nothing here is built unless it says so |
| [TASKS.md](TASKS.md) | What is queued, in order, with why |
| [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) | Decisions not yet made. Answering one usually writes an ADR |
| [WORKLOG.md](WORKLOG.md) | What happened, newest first |
| `audits/` | Dated review passes, per `audits/README.md` |
| `reports/` | Dated records of a specific piece of work |

## Write-only directories

`audits/` and `reports/` are **write-only**. A dated file records what was true on its date
and is never retro-edited, never swept for current context, and never repaired when a link
in it goes stale. `check:docs` skips them for exactly that reason.

If you need the current answer, it is in `docs/`. If you need to know what someone believed
in June, it is here.
