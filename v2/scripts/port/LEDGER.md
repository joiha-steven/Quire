# Port ledger

Every file moved from the frozen tree, and every one deliberately left behind. Kept so a
module cannot be dropped silently: `v2/docs/07-parity.md` covers behaviour, this covers
files.

Closed milestones are split out as they finish, so this file stays the CURRENT one:

| Milestone | File |
|---|---|
| M1, the data layer | [LEDGER-M1.md](LEDGER-M1.md) |
| M2, the public renderer | [LEDGER-M2.md](LEDGER-M2.md) |
| M3, admin, API and auth | this file |

## M3 begins: the auth core (2026-07-28)

Nothing was moved here. Authentication is the one area of 2.0 that is **not** a port:
`next-auth` and the Google provider are deleted outright, and password + TOTP is new code
against `v2/docs/06-auth.md`. So the porting rule does not apply, and the protection it
normally buys — a diff that is pure motion — is absent. Everything below is therefore
covered by tests written alongside it.

**Written:** `auth/totp.ts`, `auth/password.ts`, `auth/sessions.ts`, `auth/recovery.ts`,
`auth/users.ts`, `auth/csrf.ts`, `auth/login.ts`, `auth/secret.ts`.

**TOTP without a library.** RFC 6238 is ~90 lines against `node:crypto`, and a TOTP
dependency is a supply-chain entry for an algorithm unchanged since 2011. The configuration
is deliberately the boring one — SHA-1, 30-second step, 6 digits — because that is what
every authenticator assumes when it scans a QR that does not spell out its parameters.
SHA-256 would be marginally stronger and would fail silently in some apps.

All six RFC 6238 appendix B vectors pass, including `T=20000000000`. That last one is the
reason the counter is written through a `DataView` with a `BigInt`: a naive
two-`writeUInt32BE` split works for every vector below 2^31 steps and breaks in 2038.

**Three deviations from 06-auth.md**, each documented there in the same commit:

1. **The lockout counts failures, not attempts.** Built the spec's way first, and the tests
   immediately locked the owner out: the per-username window charges every attempt, so the
   sixth *successful* sign-in inside fifteen minutes is refused. That is a normal amount of
   signing in while setting up a new device. `rate-limit.ts` gained `overLimit` /
   `recordHit` / `clearLimit`; `rateLimited` keeps its combined record-and-verdict shape for
   public endpoints, where every request genuinely is a request.
2. **Auth events are `auth.<event>` and bypass the `activityLog` toggle.** The names match
   the `<area>.<event>` shape of the enum they join rather than the spec's informal prose.
   The bypass matters more: every other entry in that log is a convenience, these are the
   answer to "was somebody trying to get in", and a security trail a setting can silence is
   one an intruder can silence.
3. **`AUTH_SECRET` had a second job.** It left with next-auth, but it was also salting the
   analytics visitor hash — as `process.env.AUTH_SECRET ?? 'quire'`, and the fallback was
   the worse half: a salt printed in the source is one anybody holding the database can
   reuse to try candidate IP and user agent pairs until one matches, which is the single
   property that hash exists to deny. Replaced by a `server_secrets` table and
   `auth/secret.ts`, generated on first use, distinct per purpose.

**`--dev` dropped.** The spec called for `quire user create --dev`, mirroring `DEV_LOGIN`.
But `DEV_LOGIN` existed because the frozen tree's only sign-in was Google OAuth, which
cannot run against localhost without credentials. Password sign-in has no such problem:
`bun run user create` IS the development path, so a second weaker one gated on `NODE_ENV`
would be a permanent liability bought for no convenience.

## M3: the sign-in flow, and Invariant 4 made enforceable (2026-07-28)

**Written:** `web/guard.ts`, `web/auth-routes.ts`, `web/login-page.ts`, `web/login.css.ts`,
`render/qr.ts`, `assets/js/login.ts`, `scripts/user.ts`,
`scripts/checks/routes-guarded.ts`.

**The gate is structural.** `ownerRouter()` applies `requireOwner()` at construction, so
there is no router someone can create and then forget to guard. The CSRF origin check lives
inside that same middleware rather than beside it: a cookie-authenticated write is exactly
the request that needs both, and splitting them creates the possibility of mounting one
without the other.

`check:routes` is the other half — a build failure for any write route outside a gated
router, unless its path is in `PUBLIC_WRITES` **with a written reason**. Making the
exception a list entry that carries an argument is the point; a naming convention would not
be one. Proved it fires by injecting a `DELETE` route before trusting it, and it then caught
a real forgotten `/api/auth/enrol/done`.

### Two security bugs, both found by RUNNING the flow

Neither was visible in the code. Every part was individually correct; only the sequence was
wrong.

1. **The TOTP code used to enrol could be replayed to sign in.** `setTotpSecret` resets the
   replay floor to null — correctly, since the old floor referred to a different secret — so
   the code just used to confirm enrolment was still unspent. Signing in with it worked.
   That is precisely the replay the guard exists to stop, defeated at the one moment the
   guard is initialised.
2. **`/api/auth/enrol/done` issued a session from the pending ticket alone.** Nothing
   checked that enrolment had actually completed, so anyone with the correct password could
   POST straight to it and receive a session, skipping two-factor entirely — on a flow whose
   entire purpose is that two-factor is not optional. It surfaced because a test about open
   redirects passed *through that path by accident*, which is the more useful lesson: the
   test was green and proving nothing.

Both now have a test named after the failure.

**Progressive enhancement, which matters most here.** The sign-in page is the one page a
reader cannot route around, so every screen is a real form with a method and an action.
`login.js` is 858 b and carries three conveniences only: the reveal toggle, the caps-lock
warning (via `getModifierState`, because inferring it from typed case fails for a password
with no letters) and auto-submit on a pasted one-time code.

**QR: a dependency, deliberately.** QR is Reed-Solomon over a bit-interleaved layout, and a
subtly wrong encoder produces an image that looks exactly like a QR code and cannot be
scanned — the "looks right and is not" failure mode, with no scanner here to catch it.
`qrcode-generator` is one file with no dependencies, chosen over the more popular `qrcode`
(29 packages, including a CLI argument parser and a PNG encoder that would never be called).

Tested by structure the QR specification fixes independently of any implementation: the
three finder patterns, the deliberately absent fourth (it is how a scanner tells which way
up the code is), and a clear quiet zone. Black on white regardless of theme, because a dark
theme rendering it inverted produces a code many scanners refuse — the one place in this
codebase where a hardcoded colour is the right answer.

**Also fixed:** `scripts/user.ts` read the whole stdin stream on the first prompt, so the
confirmation prompt always read empty and every scripted install failed on "They did not
match".

## Not moved yet

`mcp/auth`, `mcp/consent`, `mcp/tools`, `mcp/tools-library`, `well-known`, and the 61 API
routes. `Turnstile` is the last unported island and lands with the comment form's
configuration.
