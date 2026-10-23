# Metricpedia production blog CMS

This is a direct adaptation of `wepubly/ublong` production `src/AdminApp.tsx`, `src/admin.css`, and the blog API/render/review code in `worker/index.ts`, `worker/render.ts`, `worker/editorial.ts`, retrieved from main on 2026-10-22. Unrelated portal, music, journeys and authentication code is excluded.

Only Metricpedia-specific content destination fields are added: category, calculator type and calculator. They cascade from the existing routes catalog, are validated together on the server, and are stored in each immutable article snapshot. The generated final URL is displayed before scheduling, e.g. `/home-garden/paint-calculators/paint-calculator/article-slug/`.

The Writer records the external Grok approval and operates scheduling. Auditor and Supervisor do not operate the CMS. No new account, login, password, token or agent-access panel is required.

Production URL: https://metricpedia.com/admin. The existing Worker, D1 and R2 are reused; `lab` in internal resource names is historical. Only admin/API/blog/media/article routes are attached to the Worker; existing Pages home and calculators are preserved. The old workers.dev admin URL redirects to the official domain. The cron publishes approved saved versions every minute.

The former experimental CMS is superseded; its source remains in Git history. CI runs the actual production entry point with disposable local storage; no public test environment is deployed.
