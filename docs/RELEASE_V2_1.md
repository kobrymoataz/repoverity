# RepoVerity V2.1 | Release and Rollback Guide

## Why V2.1 includes V2.0 recovery

PR #22 was merged from `feat/v2.0-professional-launch` on 24 October 2026, but the merged source includes only the release engine and Launch Readiness UI, not the browser smoke script, final release metadata or npm version update. Its package remained `1.9.0`, and no `v2.0.0` tag was observed at kit preparation time. The V2.1 branch starts from actual GitHub `main` commit `4bbfd8f9217cf08cdf4ddfb2328fef41e26b6a6b` and restores the missing release gates before publishing new functionality. Do not retroactively represent the partial V2.0 merge as having passed browser E2E.

## Test before merging

```bash
npm ci
npm run test:release
npm run test:toolkit
npm test
npm run typecheck
npm run typecheck:cloud
npm run test:cloud
npm run lint:text
npm run build:pages
npm run test:e2e
npm run build:cloud
npm audit --omit=dev
```

`npm run test:e2e` requires Google Chrome or Chromium. If detection fails, set `CHROME_BIN` to its actual executable path. The headless test uses a temporary browser profile and a local HTTP server, checks offline handling, browser-local checklist persistence, Launch page, Developer Tools workflow builder, read-only permissions, keyboard navigation smoke behavior and mobile overflow. This is not a comprehensive WCAG or security audit.

`npm run verify:bundle` is a heuristic build regression gate. Its JS and CSS gzip budgets are not field speed measurements. Private configuration artifacts are disallowed. Review `npm audit` findings rather than claiming that a green CI proves the absence of vulnerabilities.

## GitHub PR and publication

1. Confirm the V2.1 branch has four staged commits and `package.json` and `package-lock.json` both declare `2.1.0`.
2. Push the branch and open a PR to main. Review file diffs and wait for green GitHub Actions, including the browser E2E job.
3. Merge only after human review. Then confirm `Deploy GitHub Pages` succeeds from the merged main commit, and test the live site at desktop and mobile sizes.
4. If using Cloudflare Worker, separately check OAuth, D1 migrations, session lifecycle and scheduled collection. This release does not deploy or change the cloud backend automatically.
5. After all live checks, create the `v2.1.0` tag and release once, if not already present. Publishing an Action to GitHub Marketplace is an additional optional action and is not automatically done by this release.

## Rollback

Open a GitHub PR that reverts the V2.1 merge commit. Do not rewrite or force-push shared `main` history. Verify the Pages deployment for the revert commit. Generated user-owned workflow files are not tracked or modified by RepoVerity. The standalone Cloudflare deployment needs its own reviewed rollback procedure.

## Limits

The public site makes only user-initiated bounded GitHub API requests. The workflow builder operates entirely in the local browser. No auto-follow, engagement manipulation, vulnerability certification, private repo scanning, or unauthorized GitHub writes are added by V2.1.
