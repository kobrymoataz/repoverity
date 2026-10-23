# RepoVerity V1.8.0 | Maintainer Desk

## Added

- A dedicated Maintainer desk view at `#/maintainers` with a professional dark interface and keyboard-switch navigation.
- User-triggered read-only public issue, PR and contributor inspection for selected repositories.
- On-demand pagination, search, label filters, unassigned and 30-day inactivity views.
- A personal worklist with Inbox, Next, Waiting and Done stages, notes, CSV export and direct GitHub links.
- Local browser storage for anonymous users and optional, private D1 synchronization for signed-in users.
- D1 migration `0003_maintainer_queue.sql`, user-scoped API handlers and validation, 150-entry ceiling and cascade deletion.
- Functional tests for GitHub API failure paths, storage limits and cross-account isolation.

## Explicit boundaries

- No GitHub issue, label, assignment, comment, review or merge is performed by RepoVerity.
- Not a shared organization board. Notes are private per browser or authenticated account.
- No fake counts and no lifetime or comprehensive repository totals. Failed API calls remain unavailable.
- Existing V1.7 scheduled growth, V1.6 workspaces, V1.5 audit, public site and browser-local history remain unchanged.

## Release validation

Run `npm ci`, `npm test`, `npm run typecheck`, `npm run typecheck:cloud`, `npm run test:cloud`, `npm run lint:text`, `npm run build:pages` and `npm run build:cloud` before merging. Apply D1 migrations before deploying a cloud-enabled build.

See [Maintainer methodology](MAINTAINER_V1_8.md).
