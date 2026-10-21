# RepoVerity application architecture

## Stack

- React 19, TypeScript and Vite 8.
- Tailwind CSS 4 and a dedicated product stylesheet.
- Static GitHub Pages deployment under `/repoverity/`.
- GitHub public REST API with no browser-held access tokens.
- Browser local storage for optional growth observations and the personal achievement checklist.

## Interface organization

The app uses hash routing to keep individual workspace views directly linkable on a static host. `src/lib/navigation.ts` owns the list of supported views and resolves unknown fragments to Overview. `src/App.tsx` renders the navigation shell, profile lookup, summary, repository table and overview components. Existing feature modules are lazy loaded per view.

The supported workspaces are Overview, Repositories, Insights, Growth, Repository Advisor, Contributions, Achievements, Data & Privacy and About. Navigating between views does not create a new GitHub API request. Searching another profile updates the `user` URL parameter and returns to Overview.

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
