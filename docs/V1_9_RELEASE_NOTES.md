# RepoVerity V1.9.0 | Developer Tools and Integrations

## Added

- Unified read-only public evidence scan engine for CLI, web UI and GitHub Action.
- A new Developer Tools workspace with report status, underlying evidence, recommended next steps, downloads and integration snippets.
- Dependency-free Node CLI supporting JSON, Markdown, CSV and print-ready HTML.
- GitHub JavaScript Action (Node 24) with read-only reports, optional review gate and workflow summary.
- Example workflow for manual and weekly audits, not automatically installed.
- 16 deterministic Node tests for request bounds, invalid input, reporting, API failures, private repo rejection and action safety.

## Compatibility

- Builds directly on the merged V1.8 main commit.
- Existing browser data, growth history, OAuth sessions, cloud workspaces and D1 records are not modified.
- GitHub Pages remains fully usable without a login.
- No new npm dependencies. Version 1.9.0 is synchronized into the existing lockfile metadata.

## Limits

- GitHub's public metadata and community profile endpoints do not prove security or compliance.
- The scanner inspects a bounded sample of workflow runs, not all actions and build history.
- Unknown means not observable, not a negative result.
- A browser can print the HTML report to PDF; the CLI does not generate binary PDF files.
- The GitHub Action only works via a version tag after that tag is published. No remote repository was changed by generating this release.

## Release validation

Run `npm run test:toolkit`, `npm test`, both TypeScript checks, both production builds, and `npm run lint:text` before review and merge. Verify the GitHub Actions job and Pages deployment after merge. Tag only after those checks succeed.
