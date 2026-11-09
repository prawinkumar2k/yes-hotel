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

## Scheduling at 09:00 India time (NOT active yet)

Nothing is scheduled. A scheduler is only "on" once a real scheduled run has produced a report. Pick one:

1. **This Windows PC** (works only while the PC is on and signed in). In PowerShell, from the repo folder:
   `schtasks /Create /SC DAILY /ST 09:00 /TN "YES HOTELS SEO" /TR "node C:\Users\prawi\OneDrive\Documents\GitHub\yes-hotel\seo-agent\scripts\run-daily.mjs"`
   (the PC's clock must be on India time).
2. **The VPS** (always on): `0 9 * * * cd /opt/yeshotels && TZ=Asia/Kolkata node seo-agent/scripts/run-daily.mjs >> seo-agent/logs/cron.log 2>&1`.
   Needs Node on the host and the seo-agent folder deployed there. Do not change other sites on that VPS.
3. **A scheduled cloud agent** (Claude Code `/schedule`) if you want the agent to fix and propose changes, not only audit.

## What the agent may and may not do

May do alone: audits, reports, safe reversible code fixes on a local branch (metadata, links, alt text, sitemap/robots, schema from verified facts), with tests.
Needs your approval: deploying (a push to `main` or `hardening/phase-1` deploys automatically), DNS or nginx changes, prices, address, Google Business Profile edits, new customer-facing pages, payment or booking logic.

## Access still needed

- Search Console: add a service account as a user on the property, give the key to the agent through an environment variable.
- Google Business Profile: API access from the profile owner.
