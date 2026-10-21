# Repository Audit 2.0: evidence and limitations

RepoVerity V1.5 introduces an opt-in, read-only evidence workbench. This is a repository maintainability review, not a security audit, vulnerability scan, SAST tool, dependency vulnerability database check, license legal review or compliance certificate. The workbench **does not assign a security or quality score**.

## How it works

1. Analyze a public GitHub profile and open **Repository audit**.
2. Choose one of the initially sampled public repositories. Up to 100 recently updated, owned repositories are available from the profile snapshot.
3. Select **Run public audit**. It issues at most five public REST API requests (four for unsupported languages), without requesting user credentials.
4. Review each observation and any suggested manual next step. Links point to the public repository evidence.
5. Filter findings or export a Markdown or JSON report. The former metadata advisor remains available under **Metadata advisor**.

## What is requested

| Public endpoint | Observed data | Limitations |
| --- | --- | --- |
| `/repos/{owner}/{repo}/community/profile` | Presence information for files GitHub recognizes | The `security` property is not guaranteed to exist, so absence of that field is **unknown** |
| `/repos/{owner}/{repo}/readme` | README text and common setup/usage headings | Only one README, bounded to about 82 KB of decoded text; other wording can be missed |
| `/repos/{owner}/{repo}/actions/workflows?per_page=100` | Returned workflow count and active/disabled states | GitHub Actions only; other CI providers are out of scope. Counts of states cover the first page only |
| `/repos/{owner}/{repo}/actions/runs?per_page=10` | Up to ten recent workflow runs | Different branches may appear; no full run history or guarantees about the default branch |
| `/repos/{owner}/{repo}/contents/{manifest}` | One expected root manifest for selected languages | A monorepo may store manifests elsewhere. Declared test scripts do not prove tests pass |

Manifest choices: TypeScript/JavaScript `package.json`, Python `pyproject.toml`, Rust `Cargo.toml`, Go `go.mod`, PHP `composer.json`, Ruby `Gemfile`, Java `pom.xml`. Unsupported language metadata does not trigger a manifest request.

## Finding states

- **Observed**: direct supported evidence is present. It does not prove that the practice is effective or secure.
- **Review**: a pattern, missing recognized file or recent failure deserves manual attention. It is not a confirmed vulnerability.
- **Unknown**: the API denied access, returned malformed or unavailable data, or did not expose a field. It must never be counted as a failed check.
- **Information**: contextual observation, not an action requirement.

### Examples

- A README missing a standard setup heading is a **review** suggestion, not a claim that setup instructions do not exist.
- A missing `package.json` at repository root is **information** only, since it may be a monorepo.
- A failed recent Actions run deserves a **review** and may belong to another branch.
- No `security` field in Community Profile means **unknown**, not a missing policy.
- A declared `test` script is **observed**, not proof of executed or passing tests.

## Privacy, limits and handling

All requests are made from the visitor's browser to public GitHub endpoints. No GitHub OAuth, token storage, backend, source-code search, background polling or telemetry is added. Results are cached in browser memory for eight minutes for up to 24 repositories. Each audit is on demand; retrying will refresh that cache. Exports contain public evidence and should still be handled responsibly.

A public GitHub API rate limit, 403, 429, 404, network error or unexpected JSON never becomes an invented successful finding or a fabricated security warning. A 404 means a missing README or root manifest only for the specific file endpoint, not for the entire repository.

## Developer validation

Run `npm ci`, `npm test`, `npm run typecheck`, `npm run lint:text`, and `npm run build:pages` before merging. Inspect the Audit workspace on a public repository with and without workflows, an empty README, a missing root manifest and a rate-limited request.
