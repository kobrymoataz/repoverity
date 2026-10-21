# RepoVerity V1.5 | Evidence-based repository audit

## New features

- Redesigned Repository Audit page with Evidence Audit and the existing Metadata Advisor in separate tabs.
- Explicit, user-initiated public GitHub requests to community profile, README, GitHub Actions workflows and recent runs, plus a root manifest when the language is recognized.
- Evidence state model: observed, review, unknown and informational. There is no percentage risk or security score.
- Direct GitHub evidence links and human-readable remediation suggestions.
- Filterable findings and on-demand Markdown and JSON exports.
- Bounded response parsing, network error handling, abortable requests and an eight-minute in-memory cache.
- No new services, GitHub login, database, third-party dependency or local-storage migration.

## Preserved

The V1.4 analytics workspaces, V1.3 explorer, V1.2 motion system, V1.1 navigation, Growth, Achievements, Contributions and browser-local backups remain unchanged.

## Limitations

GitHub API responses are sampled and may be incomplete. Only a small, selected set of metadata and public file contents are checked. README heading detection is heuristic. Presence of a SECURITY.md or CI workflow does not prove security or correctness. A manifest is not checked against known vulnerabilities, licenses or malicious dependencies. No automated security or code compliance conclusion is possible from this inspection.

## Release checks

The maintainer should run `npm ci`, `npm test`, `npm run typecheck`, `npm run lint:text` and `npm run build:pages`. Then test real GitHub API requests in a browser and confirm the GitHub Actions quality and Pages deployment workflows succeed.
