# Contributing to RepoVerity

We welcome reproducible bug fixes, tests, accessibility suggestions, documentation, and improvements that respect user privacy and provide truthful public data. No manufactured stars, followers, artificial activity or badge gaming.

## Setup

Requires Node.js 22.12+ (Node 24 recommended) and npm.

```bash
git clone https://github.com/kobrymoataz/repoverity.git
cd repoverity
npm ci
npm run dev
```

## Development process

1. Open a focused Issue or comment on an existing one before large changes.
2. Create a branch from `main` such as `fix/issue-number-short-description`.
3. Change only relevant files and add tests for logic changes.
4. Run `npm run typecheck`, `npm test`, and `npm run build:pages`.
5. Open a pull request with a summary, test evidence, and screenshots if UI behavior changes.
6. Respond to review comments and avoid pushing secrets, tokens, personal data or local backups.

## Contribution standards

- Prefer clear, explainable rules to unexplained scores.
- Profile stars/forks are sample-based; never label them as account-wide totals.
- Badge status is manually tracked; RepoVerity cannot grant or certify GitHub Achievements.
- Only access public GitHub endpoints; do not add hidden telemetry or API token collection.
- Keep keyboard navigation, mobile accessibility, and reduced motion behavior functional.
- File hygiene checks must never be described as a vulnerability or security audit.
- Maintain local JSON backup compatibility, or clearly version and migrate it.

Respect the [Code of Conduct](CODE_OF_CONDUCT.md). For security reports, see [SECURITY.md](SECURITY.md); do not disclose sensitive vulnerabilities publicly.
