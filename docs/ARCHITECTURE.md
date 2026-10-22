# RepoVerity application architecture

## Stack

- React 19, TypeScript and Vite 8.
- Tailwind CSS 4 and a dedicated product stylesheet.
- Static GitHub Pages deployment under `/repoverity/`.
- GitHub public REST API with no browser-held access tokens.
- Browser local storage for optional growth observations and the personal achievement checklist.

## Interface organization

The app uses hash routing to keep individual workspace views directly linkable on a static host. `src/lib/navigation.ts` owns the list of supported views and resolves unknown fragments to Overview. `src/App.tsx` renders the navigation shell, profile lookup, summary, repository table and overview components. Existing feature modules are lazy loaded per view.

The supported workspaces are Overview, Repositories, Analytics Pro, Growth, Repository Advisor, Contributions, Achievements, Data & Privacy and About. Navigating between views does not create a new GitHub API request. Searching another profile updates the `user` URL parameter and returns to Overview.

## Feature modules

- `src/lib/github.ts` loads public account and repository metadata with an abortable request and a capped in-memory cache.
- `src/hooks/useGithubProfile.ts` controls account loading, error handling and URL updates.
- `src/lib/insights.ts` computes public metadata signals from the loaded sample.
- `src/lib/growth.ts` and `src/hooks/useGrowthHistory.ts` handle observed UTC snapshots and goals.
- `src/lib/achievements.ts` and `src/hooks/useAchievementTracker.ts` support manual achievement progress.
- `src/lib/contributions.ts` powers public issue discovery.
- `src/lib/advisor.ts` and `src/lib/repositoryAudit.ts` provide metadata guidance and read-only file-presence checks.
- `src/lib/portability.ts` validates and restores versioned local data backups.
- `scripts/verify-pages.mjs` validates compiled page asset references.
- `scripts/check-no-emdash.mjs` enforces the requested text convention.

## Data limits

RepoVerity samples at most 100 recently updated public repositories per account. Stars and forks are sample totals. It cannot reconstruct history prior to the start of local tracking. Achievement state is manually set. Repository reviews do not assess source code vulnerabilities.

## Deployment and reliability

The build runs type checks, tests, text validation and a GitHub Pages asset-path check before uploading the compiled `dist` directory. Hash routes do not require server-side fallback configuration. The existing error boundary handles unexpected rendering failures. Avoid storing credentials in local storage or source code.

## V1.3 Explorer pagination

The Repositories workspace mounts `src/components/RepositoryExplorer.tsx`, supported by `src/hooks/useRepositoryPages.ts`, `src/lib/repositoryPages.ts`, and `src/lib/explorer.ts`. The initial GitHub snapshot remains page 1. Each additional page is user-triggered and merged by repository ID. The Explorer maintains its own loaded collection and never silently changes metrics, growth history or repository advisor results in other workspaces. Saved filters are browser-local under a separate versioned key. See [Explorer methodology](EXPLORER_V1_3.md).

## V1.4 Developer Analytics Pro

`src/components/DeveloperAnalytics.tsx` hosts the portfolio, compare and activity tabs inside the existing Analytics workspace. `src/lib/developerAnalytics.ts` contains deterministic sampling calculations, UTC bucket logic, safe CSV output and release-interval summaries. `src/lib/developerActivityApi.ts` provides four independent, user-triggered public REST requests and five-minute bounded in-memory caching. It validates repository paths and public links, supports abort signals, and preserves partial failures rather than inventing zero values. Profile comparison uses `getCachedSnapshot` and the existing GitHub API client. See [Analytics methodology](ANALYTICS_V1_4.md).


## V1.5 public evidence review

- `src/lib/auditProApi.ts` loads at most five independent public GitHub API endpoints after an explicit click. Each section has its own missing or unavailable state.
- `src/lib/auditPro.ts` converts bounded observations into evidence-backed findings and Markdown reports. It never produces a security score.
- `src/components/RepositoryAuditPro.tsx` provides a dedicated Evidence Audit workspace tab and preserves the existing metadata advisor.
- README and one recognized root manifest are decoded from GitHub Contents base64 payloads using bounded UTF-8 conversion. No arbitrary source files are scanned.
- Workflow counts and up to ten recent runs are samples across GitHub Actions, not a CI health certification.
- All data remains in temporary browser memory, with an eight-minute capped cache; reports are exported only by user request. No new stored data or authentication tokens.


## V1.6 optional same-origin Cloud API

The GitHub Pages build remains static and stores prior records locally. An optional Cloudflare Worker deployment combines the frontend assets and `/api/*` endpoints on one origin, with a D1 database for user workspaces, watchlists and display preferences. See [Cloud V1.6](CLOUD_V1_6.md). User OAuth tokens are only exchanged on the server for public identity and are not stored. Session tokens are stored in D1 as SHA-256 hashes and sent as secure HttpOnly cookies. No change is made to public GitHub API metrics or browser-local growth tracking.

## V1.7 scheduled cloud history

`migrations/0002_growth_history.sql` adds user-scoped tracking targets, real UTC daily observations and derived on-site milestone events. `worker/growth.ts` validates fixed public GitHub profile/repository URLs, bounds claims per user, performs rate-limited sequential scheduled collection and updates D1 with prepared queries. The Worker exposes authenticated `/api/v1/growth/*` endpoints and a Cloudflare `scheduled()` handler. `src/components/CloudGrowth.tsx` renders the cloud-only history UI alongside the previous browser-local Growth view, with no silent local data transfer. See [History methodology](HISTORY_V1_7.md).
