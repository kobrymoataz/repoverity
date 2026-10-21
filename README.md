# RepoVerity

**A focused workspace for public GitHub research and repository maintenance.**

[![Quality checks](https://github.com/kobrymoataz/repoverity/actions/workflows/ci.yml/badge.svg)](https://github.com/kobrymoataz/repoverity/actions/workflows/ci.yml)
[![GitHub Pages](https://github.com/kobrymoataz/repoverity/actions/workflows/deploy.yml/badge.svg)](https://github.com/kobrymoataz/repoverity/actions/workflows/deploy.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-informational?style=flat-square)

[Live application](https://kobrymoataz.github.io/repoverity/) | [Source](https://github.com/kobrymoataz/repoverity) | [Issues](https://github.com/kobrymoataz/repoverity/issues) | [Contributing](CONTRIBUTING.md)

RepoVerity turns public GitHub metadata into a structured, read-only developer workspace. V1.1 replaced the long dashboard with focused workspaces. V1.2 added restrained motion and a keyboard-first quick switch. V1.3 added Repository Explorer Pro with on-demand pagination, comparisons and saved views. V1.4 adds evidence-based developer analytics, public profile comparisons and optional repository activity inspection. It remains a static application that does not require signing in to GitHub.

## Workspaces

| View | What it does |
| --- | --- |
| Overview | Public account summary, sample statistics, metadata coverage and recent repositories |
| Repositories | On-demand paginated explorer with language/topic filters, table/card views, comparisons, saved views and CSV export |
| Analytics Pro | Latest-push distribution, portfolio sampling, second-profile comparisons and on-demand contributor, release, issue and PR views |
| Growth history | Optional daily observations stored in this browser, goals and CSV export |
| Repository advisor | Metadata recommendations and optional public file-presence inspection |
| Find contributions | Open and unassigned issues labeled by maintainers |
| Achievements | Educational requirements and a manual progress checklist |
| Data & privacy | JSON backup, restore and deletion of locally recorded data |
| About RepoVerity | Product scope, links, methodology and limitations |

### Important limits

- Developer Analytics Pro inspects the initial sample and never claims to reconstruct commit histories or entire lifetimes. Activity requests for contributors, releases, issues and PRs are optional, bounded and rate-limited.
- Up to 100 recently updated owned public repositories are initially loaded per account. The Explorer can request further pages on demand. Overview, Analytics Pro, Growth and Advisor still use the first-page sample, so their numbers are not full-account totals.
- The static application records growth only when tracking is enabled and an account is viewed. It cannot retrieve missing historical snapshots or run background checks.
- GitHub achievement states are self-reported, not verified or awarded by RepoVerity.
- The repository advisor reviews simple public metadata and file names. It does not perform a vulnerability scan or security certification.
- Saved Explorer filter views stay in local browser storage and are not included in the existing JSON backup.
- Additional GitHub API pagination is manual and anonymous rate limits still apply.
- No automated followers, stars or other artificial engagement is provided.

## Run locally

Requires Node.js 22.12 or later, npm and Git.

```bash
git clone https://github.com/kobrymoataz/repoverity.git
cd repoverity
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/`.

## Validate

```bash
npm run typecheck
npm test
npm run lint:text
npm run build:pages
```

The Pages build verifies that output paths use `/repoverity/` and point to compiled files. GitHub Pages must use **GitHub Actions** as the source. The hosted app is available at [kobrymoataz.github.io/repoverity](https://kobrymoataz.github.io/repoverity/).

## Design, motion and navigation

V1.1 introduced hash-routed workspaces and a neutral design system. V1.2 adds Motion for React and GSAP for purposeful transitions and charts, with no looping visual decoration. Press Command K or Control K to open the searchable Quick switch. Use the top-bar Motion control to reduce animations. Operating system reduced-motion preferences are always respected. Bookmark a view using a URL such as `#/repositories` or `#/growth`, and share the account context using `?user=USERNAME`. Press `/` outside an input to focus the account search. Saved data remains compatible with V1.0.

See [Analytics methodology](docs/ANALYTICS_V1_4.md), [V1.4 release notes](docs/V1_4_RELEASE_NOTES.md), [Explorer methodology](docs/EXPLORER_V1_3.md), [V1.3 release notes](docs/V1_3_RELEASE_NOTES.md), [motion policy](docs/MOTION_SYSTEM.md), [design system](docs/DESIGN_SYSTEM.md), [architecture](docs/ARCHITECTURE.md), [privacy](docs/PRIVACY.md), [V1.2 release notes](docs/V1_2_RELEASE_NOTES.md) and [changelog](CHANGELOG.md).

## Contribute

Issues and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [SECURITY.md](SECURITY.md). Never include exported browser tracking data or tokens in public issues.

Maintained by [@kobrymoataz](https://github.com/kobrymoataz). Licensed under [MIT](LICENSE).
