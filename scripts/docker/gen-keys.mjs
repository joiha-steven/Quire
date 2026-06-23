// Generate the secrets for the bundled (no-cloud) Docker stack:
//   - POSTGRES_PASSWORD          — the superuser password for the local Postgres
//   - SUPABASE_JWT_SECRET        — HS256 secret PostgREST verifies tokens with
//   - SUPABASE_SERVICE_ROLE_KEY  — a JWT (role=service_role) the app authenticates with
// The JWT is signed with SUPABASE_JWT_SECRET, so the two MUST stay paired.
// Usage:  node scripts/docker/gen-keys.mjs >> .env.docker   (then fill the rest)
import { createHmac, randomBytes } from 'node:crypto'

const b64url = (buf) => Buffer.from(buf).toString('base64url')
const segment = (obj) => b64url(JSON.stringify(obj))

// PostgREST requires the HS256 secret to be at least 32 chars.
const jwtSecret = randomBytes(48).toString('base64url')
const pgPassword = randomBytes(18).toString('base64url')

function sign(payload) {
  const header = segment({ alg: 'HS256', typ: 'JWT' })
  const body = segment({ ...payload, iat: Math.floor(Date.now() / 1000) })
  const data = `${header}.${body}`
  const sig = createHmac('sha256', jwtSecret).update(data).digest('base64url')
  return `${data}.${sig}`
}

process.stdout.write(
  [
    '# --- bundled-stack secrets (generated; keep private) ---',
    `POSTGRES_PASSWORD=${pgPassword}`,
    `SUPABASE_JWT_SECRET=${jwtSecret}`,
    `SUPABASE_SERVICE_ROLE_KEY=${sign({ role: 'service_role', iss: 'vibeblog' })}`,
    '',
  ].join('\n'),
)
