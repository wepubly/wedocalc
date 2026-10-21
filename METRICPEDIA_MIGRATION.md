# Metricpedia — safe rebrand & infrastructure checklist

## Confirmed status
- Cloudflare Registrar: `metricpedia.com` purchased.
- Cloudflare Pages > `wedocalc` > Custom domains: `metricpedia.com` shown **Active** in the user's screenshot (SSL enabled).
- The user opened https://metricpedia.com and confirmed it serves the existing **Coming Soon** production page.
- Existing custom domains `wedocalc.com` and `www.wedocalc.com` remain active; do not delete them.
- GitHub repository currently named `wepubly/wedocalc`.
- Migration preparation branch: `work/metricpedia-migration` (no production merge).
- Approved visual preview branch: `work/home-visual-v1`.
- Preview: https://work-home-visual-v1.wedocalc.pages.dev/
- The visual prototype has a `noindex, nofollow` meta tag and nonfunctional controls.

## Rename the GitHub repository (one manual action)
1. Open https://github.com/wepubly/wedocalc/settings
2. Under **General > Repository name**, replace `wedocalc` with `metricpedia`.
3. Click **Rename**. GitHub commonly redirects old repository links, but CI/scripts should be inspected for hard-coded paths after rename.
4. Verify the repository now opens at https://github.com/wepubly/metricpedia and that the branches `main`, `work/home-visual-v1`, and `work/metricpedia-migration` remain intact.

## Important: do NOT rename the Cloudflare Pages project yet
The current GitHub Actions preview workflow is configured to find project `wedocalc` and enforce:
- project subdomain `wedocalc.pages.dev`
- production branch `main`
- preview branch `work/home-visual-v1`
- deployment target `wrangler pages deploy ... --project-name wedocalc`

This **remains valid after a GitHub repository rename**, provided the GitHub Actions secret `CLOUDFLARE_API_TOKEN` stays available. Renaming/moving the Pages project or changing deployment assumptions without coordinated workflow updates could interrupt deployment. The public domain is already metricpedia.com, so changing internal infrastructure names is unnecessary.

## Follow-up checks after renaming
- Confirm the existing preview GitHub Actions workflow still succeeds on the renamed repository.
- Confirm main still shows **Coming Soon** at metricpedia.com.
- Confirm preview still shows the approved Home.
- Update branding in any future production code as part of launch; the migration branch already uses Metricpedia in page title, footer, and theme storage key.
- Before public release, review actual calculator behavior, canonical domain, OG metadata, sitemap, robots, structured data, privacy pages, and whether to redirect older domains.
- Do not merge visual prototype into main until explicitly authorized.

## Safety
Do not publish to production, change DNS, delete old domains, request token values in chat, or modify `main` during this preparation.
