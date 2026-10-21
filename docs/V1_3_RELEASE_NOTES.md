# RepoVerity V1.3 | Repository Explorer Pro

## Scope

- Repository pagination beyond the default 100-item profile sample, requested page by page.
- Multi-filter repository workspace with language, topic, status, text search and four sorting modes.
- Table and card layouts designed for responsive screens.
- Up to three repositories in a side-by-side public metadata comparison.
- Saved filter views per GitHub username in this browser, with a limit of 12 per account.
- CSV export of matching repositories that have actually been loaded.
- Transparent loading, API error, rate-limit and pagination-limit states.
- Unit tests, documentation and release checks.

## Compatibility

V1.3 keeps existing V1.2 motion preferences and V1.0 growth/achievement backup formats. It does not require authentication, tokens or a server. The existing local history remains untouched.

The explorer is deliberately isolated: other workspaces continue using the initial 100-repository snapshot so their measurements are not changed unexpectedly when additional pages load.

## Release checks

1. Install dependencies with `npm ci`.
2. Run `npm test` and `npm run typecheck`.
3. Run `npm run lint:text` and `npm run build:pages`.
4. Verify table/card modes at desktop and mobile widths.
5. Verify comparisons, filter saving and export without a GitHub token.
6. Verify that API failures and exhaustion show clear messages.
7. Merge only after GitHub Actions passes, then confirm GitHub Pages deployment.

This is a read-only research tool, not a security certification or engagement automation service.
