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

## V1.8 personal maintainer desk

The `#/maintainers` workspace lazy-loads `src/components/MaintainerWorkspace.tsx`. `src/lib/maintainerGithub.ts` calls only three bounded public GitHub endpoints, returning separate unavailable states and filtering GitHub PR entries out of the Issues endpoint. `src/lib/maintainer.ts` contains deterministic filtering, normalized repository and worklist keys, local storage guards and safe CSV export. `src/lib/maintainerCloud.ts` delegates private saves to the existing same-origin Cloud API only when sign-in is available. `migrations/0003_maintainer_queue.sql` and `worker/maintainerQueue.ts` add private, user-owned D1 records that never mutate GitHub. See [Maintainer V1.8](MAINTAINER_V1_8.md).

## V1.9 shared developer-tool engine

`src/lib/scanCore.mjs` is a bounded, read-only GitHub REST scanning core imported both by the browser and the standalone Node CLI / action. The `scanCore.d.mts` file declares types for React and TypeScript. The UI component `src/components/DeveloperTools.tsx` uses the same parser and formatting functions as `tools/cli.mjs` and `action/index.mjs`. No D1 migrations, OAuth scope changes, or repository write actions were added.

For limits and rollout, see [V1.9 Developer Tools](TOOLS_V1_9.md).

## V2.1 release pipeline and workflows

The public static Pages application, optional Cloudflare Worker, and read-only GitHub Action remain separate deployable surfaces. V2.1 restores a Chromium CDP smoke runner to the Node 24 Ubuntu CI job after the Pages production build. The smoke runner does not take screenshots or read cloud credentials. It covers Launch Readiness, Developer Tools Action workflow generation, known-offline evidence, local checklist state and a 390px viewport.

The new pure workflow generator `src/lib/actionWorkflow.mjs` is shared by the optional web wizard and the local CLI `tools/workflow.mjs`. Inputs accept only a bounded public `owner/repo`, a strictly validated semver tag or full SHA, and enumerated controls. No workflow is committed, triggered, or uploaded from the web app. The CLI refuses absolute paths, path traversal, symlinked parent escapes, and existing output files. The generated action uses minimal `contents: read`, plus `actions: read` only when run sampling is selected.

No V2.1 database migration, OAuth change, background job, or elevated GitHub token is introduced. Browser-local release checklist state is not shared or backed up by the Action builder.
