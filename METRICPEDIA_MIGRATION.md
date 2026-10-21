# Metricpedia — controlled domain migration

Status: PREPARATION ONLY. No production deployment or DNS changes authorized.

## Confirmed existing assets
- GitHub repository: `wepubly/wedocalc`
- Source branch approved for visual preview: `work/home-visual-v1`
- Migration preparation branch: `work/metricpedia-migration`
- Existing Cloudflare Pages project: `wedocalc`
- Production branch configured in existing GitHub Actions workflow: `main`
- Existing preview: https://work-home-visual-v1.wedocalc.pages.dev/
- Target domain purchased at Cloudflare Registrar: `metricpedia.com`
- UI is currently a nonfunctional visual prototype and its HTML explicitly says `noindex, nofollow`.

## Migration sequence
1. Preserve `work/home-visual-v1` and existing preview.
2. Inspect Cloudflare Dashboard > Workers & Pages > `wedocalc` > Custom domains.
3. When the user explicitly authorizes a public launch, attach `metricpedia.com` (and optionally `www.metricpedia.com`) to the correct Pages project using the Cloudflare UI. Verify DNS/SSL. Do NOT attach the domain to the visual placeholder until approval.
4. Promote approved implementation to `main` only after real production content has been verified and deployment settings intentionally reviewed.
5. Update metadata/canonical/OG/sitemap/robots settings to the approved domain as part of launch; do not retain prototype `noindex` on public production.
6. Decide separately whether to rename the GitHub repository and/or create a new Cloudflare Pages project. Neither is required for the domain to serve the existing Pages deployment.
7. Update any scripts, secrets names, and Pages project assumptions if a repository or Pages project is renamed. The current workflow explicitly requires Cloudflare Pages project `wedocalc` with production branch `main` and subdomain `wedocalc.pages.dev`.
8. Set a preferred canonical domain and 301 redirects only after go-live and DNS validation.

## Safety boundaries
- Never request a Cloudflare token value in chat.
- Do not merge into `main` automatically.
- Do not change production DNS/routing during preview preparation.
- Keep original preview accessible throughout transition.
