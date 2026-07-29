# Self-hosting Quire

One process, two SQLite files, one uploads directory, behind a reverse proxy. There is no
database server to provision, no container runtime, no migration command, and no
third-party account anywhere in the path.

Commands assume Ubuntu/Debian and `root` (or `sudo`). Adjust the paths. If you would rather
not install Bun on the host, [Docker](#9-docker-instead-of-systemd) is the same install in
two commands, and sections 5 and 7 still apply to it.

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
```

There is no secret to generate. 1.x needed `AUTH_SECRET`; 2.0 creates its own signing
secrets on first use and stores them in the database ([`src/auth/secret.ts`](../src/auth/secret.ts)),
because an optional secret is one an install can be left running without.

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

## 9. Docker, instead of systemd

Same app, same layout, nothing extra to run beside it. This replaces sections 1, 2, 4 and 8;
nginx (section 5) and the CDN note (section 7) still apply, and so does taking a backup
before an upgrade.

```bash
git clone https://github.com/joiha-steven/Quire.git && cd Quire
cp .env.docker.example .env          # set SITE_URL, and that is the whole of it
docker compose up -d --build
docker compose exec quire bun run user create --username you --email you@example.com
```

The image builds from source and runs `bun src/index.ts`, which is what the box in section 4
runs too. It is deliberately NOT the compiled binary: `bun build --compile` does not bundle
sharp's native module, so a compiled image has to keep a binary and a native addon agreed
about libc across every base bump, and this way `bun install` resolves sharp for the
platform like any other package.

Four things worth knowing before you change anything in `docker-compose.yml`:

- **The port is published on `127.0.0.1` on purpose.** Docker writes its own iptables rules,
  so a plain `3000:3000` reaches the internet even when the host firewall says otherwise.
- **`DATA_DIR` and `STORAGE_LOCAL_DIR` are set by compose**, after `.env` and therefore
  winning over it. They are where the volumes are mounted; a `.env` that redefines them
  points the app at an unmounted directory, where the database it writes disappears with the
  container.
- **The volumes are named volumes, not bind mounts.** The container runs unprivileged, and a
  fresh named volume inherits the image's ownership, which is what makes it writable with no
  chown at startup. If you bind-mount host directories instead, create them first and give
  them to UID 1000, or the app comes up reporting degraded storage.
- **Upgrades are `git pull && docker compose up -d --build`.** The schema is applied at boot
  as usual. Your content is in the volumes and is not touched by a rebuild.

To get data out without a bind mount, use the backup button in the admin (it hands you both
databases plus every upload), or `docker compose cp quire:/var/lib/quire/data ./data`.

`bun run import-v1` is the one command that does not work in the container: the importer
needs a package that only the build stage installs. Run it from a source checkout against
the same `DATA_DIR`, or `bun install` inside the container first.

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
