# RepoVerity

**Understand public GitHub work. Measure real growth.**

[![Quality checks](https://github.com/kobrymoataz/repoverity/actions/workflows/ci.yml/badge.svg)](https://github.com/kobrymoataz/repoverity/actions/workflows/ci.yml)
[![GitHub Pages](https://github.com/kobrymoataz/repoverity/actions/workflows/deploy.yml/badge.svg)](https://github.com/kobrymoataz/repoverity/actions/workflows/deploy.yml)
![Release](https://img.shields.io/badge/version-0.3.0-83E0C3?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-7294A0?style=flat-square)

**[Open live dashboard](https://kobrymoataz.github.io/repoverity/)** · [Report an issue](https://github.com/kobrymoataz/repoverity/issues) · [Contribute](CONTRIBUTING.md)

RepoVerity is a free, open-source dashboard for public GitHub account and repository intelligence. Enter a username or profile URL to see transparent portfolio indicators, explore repositories, and optionally record *real observations* of follower and sampled-star growth over time. No account login or personal access token is required.

## Available in V0.3

### Profile and repository intelligence

- Look up GitHub users by username, `@handle`, or profile URL.
- View GitHub-reported followers and number of public repositories.
- See **sampled** stars, forks, and primary repository languages.
- Inspect profile signals: descriptions, topics, licenses, and pushes in the last 90 days.
- Search, filter, and sort recently updated public repositories.
- Share the selected profile using the `?user=...` URL.

### Growth analytics (new)

- Opt-in tracking, **separate for each GitHub username in your browser**.
- Store up to one observation per **UTC calendar day**; a newer fetch on the same day replaces that day's observation.
- Compare followers and stars for the sampled repositories using **actual timestamps**, with 7D / 30D / All time filters.
- See change from the first to last **measured** observation in the selected window. No backfilled or inferred values.
- Choose a personal milestone, with **1,000 followers** as the initial default.
- Refresh public API data, export the saved observations as CSV, pause tracking or delete the selected profile's local history.

**Important:** Tracking begins only when you click **Start tracking**. An enabled profile gets a new observation when you visit and fetch it; this static GitHub Pages app does **not** run background jobs. Browser storage is device/profile-specific, and clearing browser data removes the timeline. The CSV export is your backup. Sharing a profile link does not share browser-local history.

**Accuracy:** Account follower count and public repository count come from GitHub's user endpoint. Repository stars/forks are summed from **up to 100 most recently updated owned public repositories**, and the set of sampled repositories may change over time. **Do not interpret sampled-star deltas as the account's total star gains.** Indicators are not a security audit.

## Run locally

Prerequisites: Node.js **22.12+**, npm and Git.

```bash
git clone https://github.com/kobrymoataz/repoverity.git
cd repoverity
npm ci
npm run dev
```

Open <http://127.0.0.1:5173/>. Run quality checks before proposing changes:

```bash
npm run typecheck
npm test
npm run build
```

## Architecture

- React 19 + TypeScript + Vite 8 + Tailwind CSS 4.
- Public GitHub REST API (no tokens and no GitHub login).
- In-memory API response cache (2 minutes).
- Browser `localStorage` for growth observations and follower goals, schema `repoverity:growth:v1`.
- Lightweight SVG charts without a charting service or extra runtime dependency.
- GitHub Actions CI and GitHub Pages deployment on `main`.

The GitHub unauthenticated API rate limit is typically **60 requests per hour per IP**; API errors and rate limits are displayed instead of inventing data. For retention, validation and portability details, read [Growth data and privacy](docs/GROWTH_DATA.md).

## Deployment

GitHub Pages source must be **GitHub Actions**. The workflow builds with `PAGES_BASE=/repoverity/`, then deploys the production `dist/` folder. The published URL is <https://kobrymoataz.github.io/repoverity/>.

## Roadmap

- **V0.1**: Foundation and responsive UI.
- **V0.2**: Public API, repository intelligence, README, tests and Pages.
- **V0.3**: Honest local growth tracking, charts, milestones and CSV export. **Current release.**
- **V0.4**: Educational achievement guide and legitimate contribution discovery.
- **V0.5**: Practical repository advice and transparent security hygiene signals.
- **V1.0**: Stable release with refined security, accessibility, reliability and community support.

## Community

Issues, bug reports and constructive pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). RepoVerity does not generate follows, stars, fake commits or artificial GitHub engagement.

**Maintained by [@kobrymoataz](https://github.com/kobrymoataz).** MIT-licensed under [LICENSE](LICENSE).
