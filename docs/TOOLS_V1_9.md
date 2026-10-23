# RepoVerity V1.9 | Developer Tools and Integrations

## Scope

V1.9 adds a single public-evidence report engine that can be used in three places:

1. The existing React workspace at `#/tools`.
2. The dependency-free Node.js CLI at `tools/cli.mjs`.
3. The optional GitHub Action at the repository root `action.yml`.

The engine lives in `src/lib/scanCore.mjs`, with TypeScript declarations in `scanCore.d.mts`. The three entry points share check names, states, formatting, and coverage limits. No login is required to inspect public repositories. Cloudflare OAuth sessions, D1, local history, and existing audit scores are unchanged.

## What the scan verifies

The scan reads public GitHub REST responses for the repository, community profile, and first 50 workflows. Optionally it requests the most recent 10 workflow runs. It checks:

- Whether a description, license metadata, README, contribution guide, code of conduct, security policy and issue template are reported.
- Whether any active GitHub Actions workflows are listed within the bounded first page.
- Whether the most recent sampled workflow run was successful, if the optional run sample is enabled.
- Whether GitHub marks the repository archived.

Evidence states are `pass`, `review`, `unknown`, and `info`. The word `pass` means only that specific metadata was reported. The `review` state is a recommendation to inspect or improve repository maintenance, not a security failure. `unknown` is used for inaccessible, malformed or missing API evidence. These states are not a vulnerability score or certification. Account-wide activity or historical growth is not inferred.

### Request budget and privacy

The scan makes 3 requests by default, 4 when run inspection is enabled, each with a 12-second timeout. Requests go only to `https://api.github.com`. Anonymous use is subject to GitHub limits. A GitHub token can be supplied as a process environment variable for the CLI, or as an action input for CI; it is not logged, stored in reports, or sent to another host. Private repositories are rejected by the scanner even when a token permits access.

The GitHub Pages edition uses browser requests and requires no token. A report download is generated entirely on the user's device. The CLI and GitHub Action generate local files. The V1.9 scanner does not write to GitHub or D1.

## CLI usage

Requires Node.js 22 or later, from the checked-out repository:

```bash
node tools/cli.mjs --help
node tools/cli.mjs scan octocat/Hello-World
node tools/cli.mjs scan octocat/Hello-World --format json --output report.json
node tools/cli.mjs scan octocat/Hello-World --format csv --output report.csv
node tools/cli.mjs scan octocat/Hello-World --format html --output report.html
node tools/cli.mjs scan octocat/Hello-World --format markdown --output report.md --include-runs
```

Open the generated HTML in a browser and select Print, then Save as PDF. This is an HTML-to-PDF print workflow, not a native CLI PDF renderer. CLI outputs are only written to the specified file, or to stdout if no file is set. `--fail-on-review` exits with code 2 on review findings, after writing the report. Network, parsing, or validation failures exit with code 1. Normal execution exits with code 0.

CLI reports contain the repository name, scan timestamp, scoped findings, data source links, and a disclaimer. The CSV exporter escapes formulas to mitigate spreadsheet formula injection. HTML escapes untrusted strings and includes a restrictive content security policy.

## GitHub Actions integration

`action.yml` is a GitHub JavaScript Action using the GitHub-supported `node24` runtime. It requires no package installation. It writes JSON to a path under `GITHUB_WORKSPACE`, appends Markdown findings to `GITHUB_STEP_SUMMARY`, and emits `review_count`, `unknown_count`, and `report_path` outputs.

Inputs:

- `repository`: public `owner/repository`, defaults to `GITHUB_REPOSITORY`.
- `github_token`: optional, read-only. Use `${{ github.token }}` with `permissions: contents: read`.
- `include_runs`: `'true'` to inspect recent Actions runs.
- `fail_on_review`: `'true'` to fail when review findings exist; default is `'false'`.
- `output_path`: JSON file under `GITHUB_WORKSPACE`, default `repoverity-report.json`.

The example workflow lives in `examples/repoverity-audit.yml`. It is *not* automatically installed or activated. The public `uses: kobrymoataz/repoverity@v1.9.0` reference will work only after this version has been merged and the `v1.9.0` Git tag published. A version tag is not included in the ZIP and has not been created remotely. For security, pin the action to a full commit SHA in sensitive workflows once a version has been reviewed.

Default action behavior is advisory only. Action failures indicate a scanner error or an explicitly enabled `fail_on_review` gate, not a proved vulnerability. The optional generated JSON file can be uploaded through `actions/upload-artifact` if the consuming workflow needs persistence.

## Test and release policy

```bash
npm ci
npm run test:toolkit
npm test
npm run typecheck
npm run typecheck:cloud
npm run test:cloud
npm run lint:text
npm run build:pages
npm run build:cloud
```

The no-long-dash text check still applies to all source, docs, and scripts. The core and action tests can also run without installing dependencies:

```bash
node --test tools/tests/*.test.mjs
```

The new features do not require changes to Cloudflare D1 migrations, OAuth secrets, or the existing Pages deployment. The product CLI needs a local Node install; the GitHub Action needs a runner that supports Node 24 JavaScript actions. This release does not change permissions on GitHub repositories.
