# RepoVerity

**A focused workspace for public GitHub research and repository maintenance.**

[![Quality checks](https://github.com/kobrymoataz/repoverity/actions/workflows/ci.yml/badge.svg)](https://github.com/kobrymoataz/repoverity/actions/workflows/ci.yml)
[![GitHub Pages](https://github.com/kobrymoataz/repoverity/actions/workflows/deploy.yml/badge.svg)](https://github.com/kobrymoataz/repoverity/actions/workflows/deploy.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-informational?style=flat-square)

[Live application](https://kobrymoataz.github.io/repoverity/) | [Source](https://github.com/kobrymoataz/repoverity) | [Issues](https://github.com/kobrymoataz/repoverity/issues) | [Contributing](CONTRIBUTING.md)

RepoVerity turns public GitHub metadata into a structured, read-only developer workspace. Version 1.1 replaces the single long dashboard with dedicated views, compact data tables and a neutral design system. It remains a static application that does not require signing in to GitHub.

## Workspaces

| View | What it does |
| --- | --- |
| Overview | Public account summary, sample statistics, metadata coverage and recent repositories |
| Repositories | Searchable, filterable public repository table with access to GitHub source |
| Insights | Language and metadata analysis with documented sampling limitations |
| Growth history | Optional daily observations stored in this browser, goals and CSV export |
| Repository advisor | Metadata recommendations and optional public file-presence inspection |
| Find contributions | Open and unassigned issues labeled by maintainers |
| Achievements | Educational requirements and a manual progress checklist |
| Data & privacy | JSON backup, restore and deletion of locally recorded data |
| About RepoVerity | Product scope, links, methodology and limitations |

### Important limits

- Up to 100 recently updated owned public repositories are loaded per account. Sampled stars, forks and languages are not full-account totals.
- The static application records growth only when tracking is enabled and an account is viewed. It cannot retrieve missing historical snapshots or run background checks.
- GitHub achievement states are self-reported, not verified or awarded by RepoVerity.
- The repository advisor reviews simple public metadata and file names. It does not perform a vulnerability scan or security certification.
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

## Design and navigation

V1.1 introduces separate hash-routed workspaces, accessible navigation, a new sidebar, responsive repository tables and consistent typography and spacing. Bookmark a view using a URL such as `#/repositories` or `#/growth`, and share the account context using `?user=USERNAME`. Press `/` outside an input to focus the account search. Saved data remains compatible with V1.0.

See [design system](docs/DESIGN_SYSTEM.md), [architecture](docs/ARCHITECTURE.md), [privacy](docs/PRIVACY.md), [release notes](docs/V1_1_RELEASE_NOTES.md) and [changelog](CHANGELOG.md).

## Contribute

Issues and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [SECURITY.md](SECURITY.md). Never include exported browser tracking data or tokens in public issues.

Maintained by [@kobrymoataz](https://github.com/kobrymoataz). Licensed under [MIT](LICENSE).
