# RepoVerity

**Public GitHub intelligence. Real growth. Better repositories.**

[![Quality checks](https://github.com/kobrymoataz/repoverity/actions/workflows/ci.yml/badge.svg)](https://github.com/kobrymoataz/repoverity/actions/workflows/ci.yml)
[![Deploy GitHub Pages](https://github.com/kobrymoataz/repoverity/actions/workflows/deploy.yml/badge.svg)](https://github.com/kobrymoataz/repoverity/actions/workflows/deploy.yml)
![Release](https://img.shields.io/badge/release-v1.0.0-8FF0CF?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-7294A0?style=flat-square)

[**Open the live dashboard**](https://kobrymoataz.github.io/repoverity/) · [GitHub Issues](https://github.com/kobrymoataz/repoverity/issues) · [Contribution guide](CONTRIBUTING.md) · [Privacy](docs/PRIVACY.md)

RepoVerity is an MIT-licensed, open-source web dashboard for understanding public GitHub profiles, exploring repositories, finding real beginner-friendly issues, keeping an *optional* personal history of follower growth, and receiving explainable repository improvement suggestions.

**No GitHub account sign-in, personal access token, automated followers, fake stars or manufactured contribution activity.** The live dashboard uses public GitHub REST API endpoints. V1.0 runs as a static site without a tracking server.

## Features

| Workspace | What it offers | Important limit |
| --- | --- | --- |
| Profile insights | Followers, GitHub-reported public repository count, languages and metadata signals | Stars and forks cover **up to 100 recently updated owned public repositories** |
| Growth analytics | Opt-in observations, goal tracking, time-aware SVG charts and CSV export | **No historical backfill or background monitoring**; observations appear when you visit |
| Achievement Lab | Educational criteria and manual checklist for GitHub Achievements | Self-reported checklists do **not** verify or award GitHub badges |
| Contribution finder | Read-only discovery of labeled, open, unassigned GitHub Issues | Anonymous search API limits apply |
| Repository advisor | Explainable metadata recommendations and on-demand public file-presence checks | **Not an AI-generated security scan, code audit or certification** |
| Privacy & portability | Export, inspect and import versioned local JSON backups; delete local records | Saved locally **per browser/device**; replacing an import needs confirmation |

## Start locally

Requirements: Node.js **22.12+** (Node 24 recommended), npm and Git.

```bash
git clone https://github.com/kobrymoataz/repoverity.git
cd repoverity
npm ci
npm run dev
```

Open <http://127.0.0.1:5173/>.

## Quality checks and deployment

```bash
npm run typecheck
npm test
npm run build
npm run build:pages
```

`npm run build:pages` builds with the required `/repoverity/` base path **and** verifies that production HTML references the compiled JavaScript, stylesheets and real files. This catches a common cause of blank GitHub Pages sites. GitHub Actions runs the same checks before uploading `dist/`.

- GitHub Pages source: **GitHub Actions**, not "Deploy from a branch".
- Website: <https://kobrymoataz.github.io/repoverity/>.
- Read [deployment checks and release steps](docs/RELEASE_CHECKLIST.md).

## How the information works

- **GitHub API**: User and repository metadata come from public REST endpoints; the in-memory profile cache lasts two minutes. Unauthenticated requests are rate limited, typically to 60 requests/hour/IP. Errors and limits are shown rather than turned into fabricated results.
- **Sampling**: The dashboard loads a maximum of 100 recently updated *owned* public repositories. Sampled stars or forks must not be interpreted as whole-account totals, and their changes may reflect a different sample on subsequent visits.
- **Growth**: A chart point represents a real observation, at most one per UTC day per GitHub profile. Tracking is disabled until the visitor opts in. The static site does not perform background checks.
- **Storage**: `localStorage` holds separate growth and manual-badge records. Only these two records are included in the opt-in JSON backup. Other storage keys, credentials and API tokens are not exported.
- **Advisor**: File presence is checked on demand via public GitHub directory listings; finding a security policy or CI file is not proof of security or successful automation.

Read [privacy and backups](docs/PRIVACY.md), [architecture](docs/ARCHITECTURE.md), [growth methodology](docs/GROWTH_DATA.md), [achievement criteria](docs/ACHIEVEMENTS.md), [issue finder documentation](docs/CONTRIBUTIONS.md) and [repository advisor methodology](docs/REPOSITORY_ADVISOR.md).

## Contribute

The project accepts reproducible bug reports, accessibility feedback, tests, documentation improvements and meaningful pull requests. Start with [CONTRIBUTING.md](CONTRIBUTING.md), [the Code of Conduct](CODE_OF_CONDUCT.md), and our [security reporting policy](SECURITY.md). Please do not post exported tracking backups in public Issues.

### Release history

See [CHANGELOG.md](CHANGELOG.md) for version details and [V1.0 release notes](docs/V1_RELEASE_NOTES.md) for the stable release scope. A GitHub Release and tag can be created after CI and Pages deployment succeed.

**Maintained by [@kobrymoataz](https://github.com/kobrymoataz).** MIT License.
