# YES HOTELS SEO agent

Keeps a daily, honest record of the website's SEO health and a prioritised task queue.

```
config/seo-agent.config.json   site, canonical host, timezone (Asia/Kolkata), integrations switches (no secrets)
scripts/audit.mjs              read-only live audit (HTTP, titles, descriptions, canonical, H1, JSON-LD, links, robots, sitemap)
scripts/run-daily.mjs          lock + audit + report + state update (never edits or deploys the site)
state/state.json               baseline, history, last run; state/last-audit.json is the latest raw audit
tasks/queue.json               prioritised tasks (P0-P4) with status and approvals
reports/daily/YYYY-MM-DD.md    one report per run
logs/                          run logs
```

Run it by hand: `node seo-agent/scripts/run-daily.mjs`

## Scheduling at 09:00 India time (NOT active)

Nothing is scheduled. It is only "active" after a real scheduled run has produced a report.

Results (state, reports, logs) go to `SEO_AGENT_DATA_DIR` when set, otherwise into this folder. **On the server always set it to a folder outside the git checkout** (deploys run `git reset --hard`).

Recommended: the Hostinger VPS, as a systemd timer that runs the audit in a throw-away Docker container. Ready-to-copy templates are in `deploy/`:
`run-in-docker.sh`, `yeshotels-seo.service`, `yeshotels-seo.timer`, `seo.env.example`.
Full requirements, security settings, the tested/untested list and the first-run checklist: `reports/scheduler-readiness-2026-11-09.md`.

Other options: Windows Task Scheduler on this PC (`schtasks /Create /SC DAILY /ST 09:00 /TN "YES HOTELS SEO" /TR "node <repo-folder>\seo-agent\scripts\run-daily.mjs"`, PC must be on and set to India time), or a Claude Code scheduled agent if you want it to propose fixes too.

Behaviour: overlapping runs exit without doing anything; a failed audit is retried 3 times, then written as `-FAILED.md` with a non-zero exit code.

## What the agent may and may not do

May do alone: audits, reports, safe reversible code fixes on a local branch (metadata, links, alt text, sitemap/robots, schema from verified facts), with tests.
Needs your approval: deploying (a push to `main` or `hardening/phase-1` deploys automatically), DNS or nginx changes, prices, address, Google Business Profile edits, new customer-facing pages, payment or booking logic.

## Access still needed

- Search Console: add a service account as a user on the property, keep the key in a file outside the repo (chmod 600) and point GSC_SERVICE_ACCOUNT_FILE at it.
- Google Business Profile: API access from the profile owner.
