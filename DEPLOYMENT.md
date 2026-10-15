# YES HOTELS — Deployment and Server Guide

For whoever runs the server. Covers how the live site is set up, how releases go out, backups, and what to do when something goes wrong.

---

## 1. How the live site is set up

```
Guest / staff browser
        │  https://yeshotels.in  (also www.yeshotels.in)
        ▼
nginx (on the VPS)  ── SSL certificate from Let's Encrypt (certbot renews it)
        │  proxies to 127.0.0.1:3100 (incl. WebSocket upgrade for live chat)
        ▼
Docker container  yeshotels-app   (Node 22: website + API + Socket.IO)
        │
        ▼
Docker container  yeshotels-db    (MongoDB 8, single-node replica set "rs0", data in a Docker volume)
```

| Item | Value |
|---|---|
| Server | Hostinger VPS, Ubuntu 24.04 |
| App folder | `/opt/yeshotels` (a git checkout of this repository) |
| Server settings (secrets) | `/opt/yeshotels/.env` — permissions 600, never committed |
| nginx site | `/etc/nginx/sites-enabled/yeshotels` |
| SSL | `/etc/letsencrypt/live/yeshotels.in/` (managed by certbot) |
| Backups | `/opt/yeshotels-backups/` |
| App port | 3100, bound to `127.0.0.1` only — the public reaches the app only through nginx/HTTPS |

Other websites run on the same VPS (dealpost, karikalam.in, suvaialaya). Do not change their nginx sites, containers or ports.

## 2. Server settings (`/opt/yeshotels/.env`)

| Setting | Purpose |
|---|---|
| `CLIENT_URL=https://yeshotels.in` | Public address (links in emails, allowed origins) |
| `COOKIE_SECURE=true` | Sign-in cookies only over HTTPS |
| `JWT_ACCESS_SECRET` | Signs logins. Changing it signs everyone out. |
| `EMAIL_SERVICE`, `EMAIL_USER`, `EMAIL_PASS` | Outgoing email from bookings@yeshotels.in (Google app password) |
| `MASTER_PASSWORD_HASH` | Owner's master password (hash only). Delete the line to switch it off. |
| `RAZORPAY_*` | Online payments (when the hotel gets keys) |

`docker-compose.yml` passes these into the app container. After changing `.env`, redeploy (section 3) or run `docker compose up -d --no-deps yeshotels-app` in `/opt/yeshotels`.

## 3. Releasing a change

1. On your machine: `pnpm typecheck && pnpm test && pnpm build` — all must pass.
2. Commit and push to `main` or `hardening/phase-1`.
3. GitHub Actions (`.github/workflows/deploy.yml`) connects to the server, pulls the commit, rebuilds and restarts the app container, and waits for `/api/ready`. The database container is not restarted.
4. Check: https://yeshotels.in/api/ready returns `{"status":"ready","database":"connected"}`, then sign in as each role.

## 4. Backups

Take one before any data change and before risky releases:

```bash
ssh root@<server>
TS=$(date -u +%Y%m%dT%H%M%SZ)
docker exec yeshotels-db mongodump --db yes_hotels --archive --gzip > /opt/yeshotels-backups/yes_hotels-$TS.archive.gz
```

Restore (replaces the current data with the backup — anything written since is lost):

```bash
docker exec -i yeshotels-db mongorestore --drop --archive --gzip < /opt/yeshotels-backups/<file>.archive.gz
```

Copy backups off the server regularly (e.g. download them weekly).

## 5. Rollback

- **Bad release:** revert the commit (`git revert <sha>`) and push — the previous version deploys.
- **Bad data change:** restore the backup taken before it (section 4).

## 6. Health and logs

| Check | Command / URL |
|---|---|
| App up and database connected | https://yeshotels.in/api/ready |
| Containers | `cd /opt/yeshotels && docker compose ps` |
| App logs | `docker logs --tail 200 yeshotels-app` |
| nginx test / reload | `nginx -t && systemctl reload nginx` |
| SSL renewal test | `certbot renew --dry-run` |

## 7. Database notes

- MongoDB must stay a **replica set** (`rs0`, member `yeshotels-db:27017`). Bookings, check-in/out, payments and billing use transactions and fail on a standalone server.
- The database container is reachable only inside Docker (no published port).
- The app never edits or deletes the audit log.

## 8. Security checklist

- Change the VPS root password if it has ever been shared; prefer SSH keys.
- Keep `/opt/yeshotels/.env` at permissions 600; never commit it.
- Staff passwords and the master password: see [docs/OPERATIONS.md](docs/OPERATIONS.md). Check Admin → Audit Log for `auth.master_password_login` now and then.
- `pnpm seed` (demo data with public passwords) refuses to run in production.
