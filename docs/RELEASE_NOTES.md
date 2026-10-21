# RepoVerity V0.4 release notes

## Included
- GitHub Achievements educational guide: seven commonly available badges plus two historical recognitions.
- Manually confirmed, per-profile badge checklist in local browser storage; no fake award verification.
- Real, read-only public contribution finder using GitHub's issue search API.
- Filters for language, `good first issue` / `help wanted` and a safe text phrase.
- Fallback links to GitHub when anonymous API searches are limited.
- New unit tests and transparent documentation explaining badge and issue-search limitations.

## Important limits
- This release does not access private GitHub data, and cannot grant or verify official badges.
- GitHub rate limits apply; search is on demand.
- No automated engagement, follows, PRs, fake issues or stars.

## Next
- V0.5: repository advisor and optional structural security checks.
- V1.0: accessibility, reliability, documentation, packaging, public launch.

---

# Release notes

## V0.3: Growth analytics

### Added
- Explicit opt-in browser-local follower and sampled-star tracking per account.
- One newest observation per UTC date; no extrapolation, interpolation or historical backfill.
- Time-accurate 7D / 30D / All SVG charts, observed change metrics and empty states.
- Selectable follower milestones (default: 1,000 followers).
- Refresh API, pause/resume tracking, CSV export and per-profile history deletion.
- Defensive localStorage validation and dedicated growth unit tests.
- Growth privacy and accuracy documentation.

### Known limitations
- No background monitoring on static GitHub Pages. Check-ins happen when the tracked profile is opened.
- Growth history is not synchronized between devices or private browsing sessions.
- No historical follower or star data before opt-in.
- Stars/forks are based on a rotating sample of up to 100 public repositories.
- GitHub unauthenticated API rate limits still apply.

## V0.2: Public dashboard

- New responsive dashboard and repository explorer.
- Profile statistics from the public GitHub REST API.
- Repository language overview and metadata coverage indicators.
- README, contributor and security policies.
- Automated quality checks and GitHub Pages deployment workflow.

## V0.1: Foundation

- React, TypeScript, Vite and the first dark application shell.
