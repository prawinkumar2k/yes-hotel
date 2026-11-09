# Scheduler readiness: daily 09:00 India time on the Hostinger VPS

Date: 2026-11-09. **Status: prepared, NOT active.** No schedule exists anywhere. It will only be called active after a real scheduled run has produced a report on the server.

## Verdict
The daily audit can run safely on the existing VPS **in principle**, if it runs in a throw-away container with its results stored outside the git checkout. Two things could not be verified from here (no server access was used): the container invocation (Docker is not installed on this PC) and the server's own readiness (disk, systemd, the VPS reaching its own public URL). Both are covered by the first-run checklist below.

## Why not just run it inside the repo folder
`/opt/yeshotels` is reset with `git reset --hard origin/<branch>` on every deploy. State and reports kept inside the checkout would be overwritten or cause conflicts. So results go to `SEO_AGENT_DATA_DIR`, outside it. (Fixed in this branch; tested locally with a throw-away folder.)

## Requirements
| Item | Detail |
|---|---|
| Dependencies | None to install. The scripts use only Node built-ins and global `fetch` (Node 18+). The VPS needs **Docker**, which it already runs (the app and database are containers). The job uses `node:22-slim`, the same base as the app's Dockerfile, so the image is likely already on the server. No host Node needed. |
| systemd | `systemd` 255 on Ubuntu 24.04 supports a time zone inside `OnCalendar`, so the schedule is 09:00 Asia/Kolkata whatever the server's clock zone is. |
| Environment variables | **None required today** (the audit reads public pages only). Optional: `SEO_AGENT_DATA_DIR`, `SEO_AGENT_ATTEMPTS`, `SEO_AGENT_RETRY_WAIT_MS`, `SEO_AGENT_SITE_URL` (for testing). Future, not used yet: `GSC_SERVICE_ACCOUNT_FILE`, `GBP_OAUTH_TOKEN_FILE`, `SEO_ALERT_WEBHOOK_URL`. Secrets go in a file under `/run/secrets` or `/etc/yeshotels-seo.env` (root, mode 600), never in the repo or in state files. See `deploy/seo.env.example`. |
| Scheduler | `deploy/yeshotels-seo.timer` + `deploy/yeshotels-seo.service` (systemd). `Persistent=true` runs a missed 09:00 as soon as the server is back. |
| Runner | `deploy/run-in-docker.sh` |
| Persistent state | `/var/lib/yeshotels-seo/state/` (`state.json`, `last-audit.json`) |
| Reports | `/var/lib/yeshotels-seo/reports/daily/YYYY-MM-DD.md` (`-FAILED.md` for a failed run; a failure never overwrites a good report) |
| Logging | `/var/lib/yeshotels-seo/logs/YYYY-MM-DD.log`, plus `journalctl -u yeshotels-seo` |
| Overlap protection | Three layers: `flock` around `docker run`, a fixed container name (a second `docker run` with the same name fails), and the script's own lock file (stale after 30 min). **Tested locally:** a second run started during the first exited cleanly without touching anything. |
| Failure handling | The audit is retried up to 3 times, 2 minutes apart. If it still fails the report is written as `-FAILED.md` and the process exits non-zero, so systemd marks the unit failed. A site that cannot be reached at all is treated as a failure, not "0 issues". **Tested locally** with an unreachable address (2 attempts, FAILED report, exit code 1, lock released, no stale audit written). |
| Alerting | **Not built.** `OnFailure=` is present but commented out. Needs a decision: email or webhook. |
| Security | Container runs as uid 1000, read-only filesystem, all capabilities dropped, `no-new-privileges`, 256 MB memory and 128 process limit, repo mounted read-only, only the data folder writable. The job only sends GET/HEAD to the hotel's own public pages (about 25 pages and up to 60 link checks, 0.4 s apart: well under normal traffic) and never touches the app, the database or the other sites on the VPS. It uses a clear User-Agent (`YESHotelsSEOAgent/1.0`). |

## What was tested here
- Normal run, data written only to the data folder, repo unchanged by the run: **passed**.
- Overlapping run: **passed** (second run exited, no corruption).
- Failure path (site unreachable, retries, FAILED report, non-zero exit, lock released): **passed**.
- `bash -n` on the runner script: **passed**.
- **Not tested:** `docker run` itself, the systemd units, running on the VPS, Node 22 (tested on Node 24).

## First-run checklist (on the server, after approval)
1. `docker image ls node:22-slim` (pull if missing) and `df -h /var` (space).
2. Copy the three files from `seo-agent/deploy/`; `chmod +x run-in-docker.sh`.
3. Run `./run-in-docker.sh` once by hand. Confirm a report appears and the audit sees all pages (this proves the VPS can reach its own public URL; if not, set `SEO_AGENT_SITE_URL` to a reachable address).
4. `systemd-analyze verify /etc/systemd/system/yeshotels-seo.*`, then `systemctl enable --now yeshotels-seo.timer`, and `systemctl list-timers yeshotels-seo.timer` to see the next 09:00 IST.
5. Next morning confirm the report exists. Only then is the schedule "active".

## Rollback
`systemctl disable --now yeshotels-seo.timer` and delete the two unit files. Nothing else on the server is changed.
