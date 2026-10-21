# RepoVerity V1.0 | Stable public release

## Release summary
V1.0 brings together the existing public GitHub profile dashboard, local growth analytics, manual achievements, open-source issue finder, and explainable repository advisor into a stable, self-hosted static experience.

## Improvements since V0.5
- Backup, preview and restore local tracked growth and manually logged achievements, using a strict versioned JSON format.
- Delete only this app's stored data, on user confirmation.
- Keyboard skip link and visible focus, accessible asynchronous loading states, reduced-motion support, and recoverable error fallback.
- Lazy-loaded secondary workspaces and capped public profile cache.
- Automatic verification of GitHub Pages asset URLs and compiled files before publication.
- Maintainer-oriented issue templates, PR template, Code of Conduct, Dependabot suggestion, privacy/security documentation, version history and release checklist.

## Validation and release gates
To be confirmed on a local Mac and in GitHub Actions: `npm ci`, `npm test`, `npm run typecheck`, `npm run build:pages`. The application should load under the exact `/repoverity/` base path, work at mobile width, and preserve previous features. These gates are not claims of formal third-party security certification.

## Limitations
- No real-time/background follower monitoring; tracking runs when you visit and opt in.
- Stars/forks are from up to 100 sampled public repositories.
- No automated badge awarding/verification, followers, stars, or engagement.
- Repository advice is not an AI security audit.

## After merge
1. Confirm CI passes and Pages deployment finishes.
2. Verify `https://kobrymoataz.github.io/repoverity/` in a new/private tab and test without query parameters.
3. Create a `v1.0.0` tag/release only from the tested `main` head.
4. Announce the project only with honest, reproducible capabilities.
