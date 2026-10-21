# Architecture and engineering boundaries

## Application stack
- React 19, TypeScript, Vite 8, Tailwind CSS 4.
- Static GitHub Pages deployment at `/repoverity/`.
- Public GitHub REST API over HTTPS. No OAuth, token storage or proprietary API keys.
- Local-only `localStorage` for optional growth observations and manual badge checklists.
- SVG growth chart, with timestamps based on real observations.

## Entry points
- `src/App.tsx`: dashboard shell, public profile lookup, section-level deferred workspaces.
- `src/lib/github.ts`: user and repository loading with short-lived capped in-memory cache.
- `src/hooks/useGithubProfile.ts`: profile loading/cancellation/error state.
- `src/lib/growth.ts`: observed points, goals, UTC dates, CSV export.
- `src/lib/achievements.ts`: educational criteria and manual checklist model.
- `src/lib/contributions.ts`: open-source issue discovery.
- `src/lib/advisor.ts` and `src/lib/repositoryAudit.ts`: metadata advice and on-demand public file checks.
- `src/lib/portability.ts`: bounded, versioned browser storage backup/restore.
- `scripts/verify-pages.mjs`: compiled Pages asset verification.

## Boundaries
A sample of the 100 most recently updated owned public repositories is not a comprehensive account report. The app cannot infer historical follower count or past star gains. Achievement states are educational/self-reported, not GitHub verified. The repository advisor does not read private code or perform a vulnerability scan.

## Storage migrations
Versioned JSON backup is designed for records from V0.3+ / V0.4+. Invalid or newer backup formats are rejected instead of silently replacing local browser data. Update the import format and tests before adding new stored fields.

## Reliability
- Each public profile request is abortable and exposes an error state.
- Sections are loaded lazily after the primary shell becomes available.
- Unexpected React rendering errors show a user-facing fallback instead of a silent blank page.
- GitHub Pages build is tested for the correct project subpath and assets before deployment.
- No fake traffic, stars, followers or automated code contributions.
