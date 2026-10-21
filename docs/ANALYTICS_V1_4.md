# Developer Analytics Pro, V1.4

RepoVerity is a read-only tool. Analytics Pro helps users interpret public GitHub metadata without requiring an account or asking for a personal access token.

## Three views

1. **Portfolio overview**: Current account followers, total public repositories, and clearly labeled stats from the first 100 recently updated owned public repositories. Six monthly bars show the months in which the *latest push per repository* occurred. They are not a count of commits or daily activity. The chart uses UTC calendar months. CSV exports contain the same observed values, with protection against spreadsheet formula injection.
2. **Compare profiles**: When the user submits another username, RepoVerity makes public requests for that account. Followers, following and public-repository counts are full-account figures reported by GitHub. Stars, forks and recent activity are first-page repository samples. The comparison is not a ranking, performance score, or complete contribution record.
3. **Repository activity**: Select a non-archived repository from the initial loaded sample and choose Inspect activity. This explicitly triggers up to four read-only REST API calls. Nothing is written to GitHub.

## On-demand data scope

| Source | Request | Sample cap | Meaning |
| --- | --- | --- | --- |
| Contributors | `/repos/{owner}/{repo}/contributors?per_page=20` | 20 | GitHub-reported commit contribution counts on its contributors endpoint. Not a measure of all account activity. |
| Releases | `/repos/{owner}/{repo}/releases?per_page=15` | 15 | Recent published releases. Median date gaps exclude prereleases and require at least two stable releases with valid dates. |
| Issues | `/repos/{owner}/{repo}/issues?state=all&sort=updated&direction=desc&per_page=30` | 30 entries before filtering | Issues endpoint includes PRs. RepoVerity filters entries with a `pull_request` attribute. These are not all historic issues. |
| Pull requests | `/repos/{owner}/{repo}/pulls?state=all&sort=updated&direction=desc&per_page=30` | 30 | Recently updated PRs, not all PRs, review metrics, or overall merge rate. |

Each API request can fail independently. Missing data is marked N/A or unavailable rather than treated as zero. A bounded, five-minute in-memory cache helps reduce repeated calls. Refresh activity forces a new request. These public endpoints are subject to GitHub rate limits and service availability.

## Privacy and accuracy

- No browser-side secrets, API tokens, session cookies, cloud database or background monitoring.
- No claim that a repository is secure or that its code has been scanned.
- All external profile, release, and issue links are links to `https://github.com`.
- GitHub's public counters may update asynchronously and the sample can change as repositories are updated.
- Six-month buckets count the last push timestamp for each loaded repository. They do not reconstruct monthly commit histories.
- At most 100 repositories are used by this workspace, even if the V1.3 Explorer has loaded additional pages.
- V1.4 does not change the browser storage formats used for growth history, badge tracking or saved Explorer filters.

## Validation

Run `npm ci`, `npm test`, `npm run typecheck`, `npm run lint:text` and `npm run build:pages`. Review the mobile layout and verify the four failure states by temporarily blocking API requests in browser developer tools.
