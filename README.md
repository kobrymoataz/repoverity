# RepoVerity

**A focused workspace for public GitHub research and repository maintenance.**

[![Quality checks](https://github.com/kobrymoataz/repoverity/actions/workflows/ci.yml/badge.svg)](https://github.com/kobrymoataz/repoverity/actions/workflows/ci.yml)
[![GitHub Pages](https://github.com/kobrymoataz/repoverity/actions/workflows/deploy.yml/badge.svg)](https://github.com/kobrymoataz/repoverity/actions/workflows/deploy.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-informational?style=flat-square)

[Live application](https://kobrymoataz.github.io/repoverity/) | [Source](https://github.com/kobrymoataz/repoverity) | [Issues](https://github.com/kobrymoataz/repoverity/issues) | [Contributing](CONTRIBUTING.md)

RepoVerity turns public GitHub metadata into a structured, read-only developer workspace. V1.1 replaced the long dashboard with focused workspaces. V1.2 added restrained motion and a keyboard-first quick switch. V1.3 added Repository Explorer Pro with on-demand pagination, comparisons and saved views. V1.4 added developer analytics, public profile comparisons and optional activity inspection. V1.5 adds an evidence-based repository audit workbench with public file, workflow and documentation checks. V1.6 adds optional same-origin cloud workspaces using GitHub OAuth, Cloudflare Workers and D1. V1.7 adds opt-in scheduled public profile and repository snapshots for cloud users, with measured charts and on-site milestones. V1.8 introduces a public maintainer desk and private planning queues with optional per-user cloud syncing. V1.9 adds a public evidence report engine shared by the web, CLI, and optional GitHub Action. V2.1 completes missing production quality gates from the partially merged V2.0 and adds a safe GitHub Actions workflow builder. Public GitHub Pages remains available without sign-in.

## Workspaces

| View | What it does |
| --- | --- |
| Overview | Public account summary, sample statistics, metadata coverage and recent repositories |
| Repositories | On-demand paginated explorer with language/topic filters, table/card views, comparisons, saved views and CSV export |
| Analytics Pro | Latest-push distribution, portfolio sampling, second-profile comparisons and on-demand contributor, release, issue and PR views |
| Growth history | Local browser observations, plus optional cloud-backed profile and repository readings with measured charts, in-app milestones and CSV export |
| Repository audit | Evidence Audit 2.0 for README, community files, workflow activity and a root manifest; previous metadata advisor remains available |
| Developer tools | Public evidence scanner, CLI, Action workflow builder and export tools |
| Launch readiness | Opt-in browser-local release checklist, public-only signals and verifiable deployment preflight |
| Maintainer desk | Read public issues and pull requests, inspect contributors and plan personal follow-ups with private notes and CSV export |
| Find contributions | Open and unassigned issues labeled by maintainers |
| Achievements | Educational requirements and a manual progress checklist |
| Cloud workspaces | Optional GitHub sign-in, saved workspaces and repo watchlists, synced display preferences and account deletion |
| Data & privacy | JSON backup, restore and deletion of locally recorded data |
| About RepoVerity | Product scope, links, methodology and limitations |

### Important limits

- Developer Analytics Pro inspects the initial sample and never claims to reconstruct commit histories or entire lifetimes. Activity requests for contributors, releases, issues and PRs are optional, bounded and rate-limited.
- Up to 100 recently updated owned public repositories are initially loaded per account. The Explorer can request further pages on demand. Overview, Analytics Pro, Growth and Advisor still use the first-page sample, so their numbers are not full-account totals.
- The static application records growth only when tracking is enabled and an account is viewed. It cannot retrieve missing historical snapshots or run background checks.
- GitHub achievement states are self-reported, not verified or awarded by RepoVerity.
- Repository Audit 2.0 fetches up to five public GitHub API endpoints only when requested. It reviews available README content, community profile metadata, workflows, sampled recent runs and one optional root manifest. Results are evidence observations, not a security score, vulnerability scan, legal review or compliance certificate. Missing API access is labeled unknown.
- Saved Explorer filter views stay in local browser storage and are not included in the existing JSON backup.
- Additional GitHub API pagination is manual and anonymous rate limits still apply.
- V1.7 cloud records include only explicitly tracked public targets, their measured snapshots and on-site milestones, alongside V1.6 workspaces, watchlists and preferences. Earlier browser-local history, achievements and Explorer presets are not uploaded.
- V1.8 triage notes are personal and do not edit GitHub issues, pull requests or repository permissions. The local queue is separate from the older JSON backup, and the optional cloud queue requires a configured Worker and D1 migration.
- V1.9 checks recognized public evidence, not source-code security. Only up to 3 or 4 requests are used per scan. Its optional GitHub Action is advisory by default and requires a version tag before external workflows can reference it. HTML reports can be printed to PDF; the CLI does not create binary PDF directly.
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
npm run test:toolkit
npm run lint:text
npm run build:pages
```

The Pages build verifies that output paths use `/repoverity/` and point to compiled files. GitHub Pages must use **GitHub Actions** as the source. The hosted app is available at [kobrymoataz.github.io/repoverity](https://kobrymoataz.github.io/repoverity/).

## RepoVerity CLI and GitHub Action

Run `node tools/cli.mjs --help` for a read-only public evidence report. The report engine is shared with the Developer Tools workspace at `#/tools` and the optional Node 24 GitHub Action. See [V1.9 Developer Tools](docs/TOOLS_V1_9.md) for examples, limitations, and tag publication requirements.


## V2.1 Release Assurance and Workflow Builder

V2.1 repairs the partial V2.0 release pipeline: full browser smoke tests and production build budgets now run in CI. The Launch Readiness page remains read-only. The Developer Tools page includes a workflow builder for RepoVerity Action with explicit trigger, permission, report and review-gate options.

The default generated workflow uses published `kobrymoataz/repoverity@v1.9.0`, reads only public repository evidence and does not activate automatically. When `v2.1.0` has been published, maintainers may opt into that reference after testing. A SHA-pinned reference is available for deployments that require immutable action code. See [V2.1 workflow guide](docs/MARKETPLACE_V2_1.md).

```bash
npm run workflow -- --help
npm run workflow -- --repo octocat/Hello-World --artifact --output repoverity-audit.yml
npm run test:release
npm run build:pages
npm run test:e2e
```

V2.1 requires no new npm dependencies and no changes to Cloudflare Worker, OAuth, or D1 migrations. GitHub Pages remains an unauthenticated public experience. The 2.0.0 tag was not published when this release kit was prepared; the previous partial merge was not a complete V2.0 release. See [release and rollback guide](docs/RELEASE_V2_1.md).

## Optional Cloudflare deployment

V1.6 includes a Cloudflare Worker that serves the frontend and JSON API together. Run `npm run typecheck:cloud`, `npm run test:cloud` and `npm run build:cloud` before provisioning. The maintained public GitHub Pages site remains anonymous with cloud features disabled by default. To enable secure sign-in, create a Cloudflare D1 database, a GitHub OAuth App and the required secret yourself. Follow the [Cloud setup guide](docs/CLOUD_V1_6.md). No real cloud service or credentials are shipped with the source. For V1.7 scheduled observations, apply the second D1 migration, configure the private Cron Trigger at 07:15 UTC and deploy the updated Worker. See [Historical Growth Intelligence](docs/HISTORY_V1_7.md). For V1.8 private worklists, apply the third D1 migration before deploying the updated Worker. See [Maintainer desk](docs/MAINTAINER_V1_8.md).

## Design, motion and navigation

V1.1 introduced hash-routed workspaces and a neutral design system. V1.2 adds Motion for React and GSAP for purposeful transitions and charts, with no looping visual decoration. Press Command K or Control K to open the searchable Quick switch. Use the top-bar Motion control to reduce animations. Operating system reduced-motion preferences are always respected. Bookmark a view using a URL such as `#/repositories` or `#/growth`, and share the account context using `?user=USERNAME`. Press `/` outside an input to focus the account search. Saved data remains compatible with V1.0.

See [V1.8 release notes](docs/V1_8_RELEASE_NOTES.md), [Maintainer desk](docs/MAINTAINER_V1_8.md), [V1.7 release notes](docs/V1_7_RELEASE_NOTES.md), [cloud history methodology](docs/HISTORY_V1_7.md), [Cloud V1.6 release notes](docs/V1_6_RELEASE_NOTES.md), [Cloud setup](docs/CLOUD_V1_6.md), [Evidence audit methodology](docs/AUDIT_V1_5.md), [V1.5 release notes](docs/V1_5_RELEASE_NOTES.md), [Analytics methodology](docs/ANALYTICS_V1_4.md), [V1.4 release notes](docs/V1_4_RELEASE_NOTES.md), [Explorer methodology](docs/EXPLORER_V1_3.md), [V1.3 release notes](docs/V1_3_RELEASE_NOTES.md), [motion policy](docs/MOTION_SYSTEM.md), [design system](docs/DESIGN_SYSTEM.md), [architecture](docs/ARCHITECTURE.md), [privacy](docs/PRIVACY.md), [V1.2 release notes](docs/V1_2_RELEASE_NOTES.md) and [changelog](CHANGELOG.md).

## Contribute

Issues and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [SECURITY.md](SECURITY.md). Never include exported browser tracking data or tokens in public issues.

Maintained by [@kobrymoataz](https://github.com/kobrymoataz). Licensed under [MIT](LICENSE).
