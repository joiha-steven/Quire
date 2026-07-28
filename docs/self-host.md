# Self-hosting Quire

One process, two SQLite files, one uploads directory, behind a reverse proxy. There is no
database server to provision, no container runtime, no migration command, and no
third-party account anywhere in the path.

Commands assume Ubuntu/Debian and `root` (or `sudo`). Adjust the paths.

```
Internet → CDN (optional) → nginx (TLS) → 127.0.0.1:3000  quire (systemd)
                                                │
                                    DATA_DIR/quire.db + analytics.db
                                    STORAGE_LOCAL_DIR/{media,files}  → served at /uploads
```

## 1. A user and a place to put things

Run it as its own unprivileged user. The process writes to exactly two directories, and
neither of them is the code.

```bash
adduser --system --group --home /home/quire quire
mkdir -p /var/lib/quire/{data,uploads}
chown -R quire:quire /var/lib/quire
```

## 2. Build the binary

```bash
curl -fsSL https://bun.sh/install | bash        # as the quire user
git clone https://github.com/joiha-steven/Quire.git /home/quire/app
cd /home/quire/app && bun install && bun run build
```

`bun run build` compiles everything — server, admin bundle, island JS, assets — into
`dist/quire`. That single file is what runs; the repository is only needed to build it.

## 3. Configure

Environment only, no config file. The full list is in the
[README](../README.md#-environment-variables); the four that matter:

```ini
DATA_DIR=/var/lib/quire/data
STORAGE_LOCAL_DIR=/var/lib/quire/uploads
SITE_URL=https://example.com
AUTH_SECRET=<64 random characters>
```

`SITE_URL` is not optional in practice. Leave it empty and the app derives the origin from
each request, which behind a proxy means feeds, OG images and password-reset links come out
pointing at an internal hostname.

Everything else — SMTP, Turnstile, Cloudflare, the site's own name and language — is
entered in the admin and stored in the database.

## 4. systemd

```ini
# /etc/systemd/system/quire.service
[Unit]
Description=Quire
After=network.target

[Service]
Type=simple
User=quire
WorkingDirectory=/home/quire/app
EnvironmentFile=/home/quire/app/.env
ExecStart=/home/quire/app/dist/quire
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now quire
curl -s localhost:3000/api/health
```

## 5. nginx

```nginx
server {
    listen 443 ssl;
    server_name example.com;
    ssl_certificate     /etc/nginx/ssl/example.com.pem;
    ssl_certificate_key /etc/nginx/ssl/example.com.key;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; media-src 'self' blob: https:; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests" always;

    client_max_body_size 64M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Note `script-src 'self'` with **no `'unsafe-inline'`**. Quire 2.0 emits no inline script
anywhere and that property is covered by a test, so the header can finally say so. Add
`https://challenges.cloudflare.com` to `script-src`, `connect-src` and `frame-src` if you
turn on Turnstile.

`client_max_body_size` has to be at least as large as the biggest file you intend to
upload. nginx rejects the request before the app ever sees it, and the error the browser
shows does not say so.

## 6. Your account

```bash
sudo -u quire bash -lc 'cd /home/quire/app && DATA_DIR=/var/lib/quire/data bun run user create --username you --email you@example.com'
```

It prints a TOTP secret and ten recovery codes **once**. TOTP is required, not optional.
Store the recovery codes somewhere that is not the machine.

⚠ Set `DATA_DIR` when running any CLI command. Without it the CLI opens `./data`, which is
a *different, empty* database, and it will cheerfully tell you there are no accounts.

## 7. Behind a CDN

The app sends `cache-control` for every response: 60 seconds plus
`stale-while-revalidate` for public HTML, `private, no-store` for the admin, sign-in and
API. **Let the CDN honour those headers.** A cache rule that forces a long TTL on HTML
turns a publish into something nobody can see, and — worse when you are debugging — hands
you a page from two deploys ago while you read source trying to work out why your fix did
nothing.

When verifying anything, request the origin directly (`curl localhost:3000/...` on the
box), not the public URL.

## 8. Upgrading

```bash
cd /home/quire/app && git pull && bun install && bun run build
systemctl restart quire
```

Schema changes are applied at boot, inside a transaction. **Take a backup first anyway** —
see [`backups.md`](backups.md), which also covers getting a copy off the box on a schedule.

## Coming from Quire 1.x

`scripts/import-v1.ts` reads a running 1.x instance over PostgREST and writes the whole
thing into SQLite: posts, pages, comments, subscribers, media, settings, redirects,
analytics. It verifies what it wrote and refuses to leave you with a half-migration.

```bash
POSTGREST_URL=http://127.0.0.1:3001 POSTGREST_TOKEN=<token> \
DATA_DIR=/var/lib/quire/data bun run import-v1
```

Run it while 1.x is still serving, keep 1.x reachable on another hostname afterwards, and
compare before you switch DNS. The one thing to check by hand: sessions do not carry over,
because the cookie is `__Host-` prefixed and therefore scoped to a single hostname. You
will sign in again on the new host.
