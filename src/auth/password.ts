// Password hashing and policy.
//
// `Bun.password` is argon2id by default, so there is no dependency here and no cost
// parameters to get wrong. Verification is deliberately slow (~100ms), which is the point,
// and is why the rate limiter in front of it matters: without one, a slow hash is a
// denial-of-service surface rather than a defence.

/**
 * The shortest password we accept. Length is the only rule.
 *
 * No composition requirements. They measurably push people toward `Passw0rd!` — a
 * predictable shape that satisfies every checkbox — and away from the long, memorable
 * phrases that actually resist an offline attack on a stolen hash.
 */
export const MIN_LENGTH = 12

/**
 * Passwords refused regardless of length, plus anything containing the site or account
 * name. This is not a breach corpus and is not pretending to be one: it catches the
 * handful a person types when they intend to "fix it later", which is the realistic
 * failure mode for a single-owner blog.
 */
const DENY = [
  'password', 'passwords', 'passphrase', 'letmein', 'welcome',
  'qwertyuiop', 'administrator', 'changeme', 'correcthorsebatterystaple',
]

export type PasswordProblem = 'too-short' | 'too-common' | 'contains-name'

/**
 * Null when acceptable. The caller maps the problem to a translated message, so no user
 * text appears here (`src/i18n` is the only home for that).
 */
export function checkPassword(
  password: string,
  names: readonly string[] = [],
): PasswordProblem | null {
  // Count by code point, not UTF-16 unit, or a passphrase of emoji or CJK is judged
  // twice as long as it reads.
  if ([...password].length < MIN_LENGTH) return 'too-short'

  const folded = password.toLowerCase()
  if (DENY.some((bad) => folded.includes(bad))) return 'too-common'

  for (const name of names) {
    const needle = name.trim().toLowerCase()
    // Below three characters this matches nearly everything: a site called "Hi" would
    // reject every password containing "hi".
    if (needle.length >= 3 && folded.includes(needle)) return 'contains-name'
  }
  return null
}

export function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password)
}

/**
 * A hash of a value nobody knows, computed once at startup.
 *
 * Its only purpose is to be verified against when the username does not exist, so that
 * "no such account" costs the same ~100ms as "wrong password". Without it, sign-in failure
 * timing is an account-existence oracle: fast means no such user.
 */
const DUMMY_HASH = await Bun.password.hash(crypto.randomUUID())

/**
 * Verify, spending the same time whether or not the account exists.
 *
 * Pass `null` for `hash` when the lookup found nothing. Do NOT short-circuit at the call
 * site — that reintroduces exactly the timing difference this exists to remove.
 */
export async function verifyPassword(hash: string | null, password: string): Promise<boolean> {
  if (hash === null) {
    await Bun.password.verify(password, DUMMY_HASH).catch(() => false)
    return false
  }
  // `verify` throws on a malformed hash rather than returning false. A row whose hash was
  // corrupted should fail the sign-in, not 500 it.
  return Bun.password.verify(password, hash).catch(() => false)
}
