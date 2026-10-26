# RepoVerity V2.1.0 | Release Assurance and Action Distribution

V2.1 completes unfinished production checks from the partially merged V2.0 branch and adds a deterministic GitHub Action workflow builder to the existing Developer Tools workspace. The new release preserves public GitHub Pages, earlier dashboards, analytics, local history, the optional cloud backend and the previously published Action.

## New

- Generate an optional read-only GitHub Actions workflow for a selected public repository.
- Choose manual or main-push triggers, sample recent Actions runs, optionally fail on review findings and optionally preserve a JSON report artifact.
- Select the stable published `v1.9.0` Action, the future `v2.1.0` tag after release, or a reviewed 40-character SHA.
- Copy or download YAML from the web interface, or produce it offline using `node tools/workflow.mjs`.
- Validate repository slugs, action versions and output paths, refusing unsafe input, overwrite attempts and symlink escape paths.

## Quality improvements

- Restore missing Chrome/Chromium browser smoke tests and production asset budget checks from the unfinished V2.0 release plan.
- Expand browser checks to cover the workflow wizard and mobile layout.
- Run release tests, frontend tests, cloud backend tests, toolkit tests and real browser checks in CI before merge.
- Sync package metadata and lockfile to `2.1.0` without changing dependencies.

## Explicit boundaries

RepoVerity remains advisory and read-only by default. It does not modify GitHub repositories, scan for source-code vulnerabilities or confer a security certification. The Action generator never activates workflows remotely. Cloudflare provisioning, Marketplace publication and external release creation require separate user actions.

No npm dependency additions, new OAuth permissions or D1 migrations are introduced in V2.1.
