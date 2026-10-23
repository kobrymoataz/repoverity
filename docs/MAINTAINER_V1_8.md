# V1.8 Maintainer and Community Workspace

RepoVerity V1.8 introduces a personal maintainer desk without requesting permission to modify anyone's GitHub repository.

## Features

- Inspect public open issues and pull requests for an owner/repository selected by the user.
- Read up to 3 pages of 40 issues and 3 pages of 40 PRs, requested on demand. GitHub's Issues API includes PR entries; RepoVerity excludes these from its Issues view.
- Search loaded titles, authors and labels; filter by label, unassigned status or 30-day inactivity.
- Inspect up to 40 contributors from a separate public GitHub REST call. GitHub-reported contribution counts do not imply current maintainer availability.
- Queue issue and PR references in four personal planning stages: Inbox, Next, Waiting and Done.
- Save a private note of at most 600 characters per queued reference, and export a worklist CSV with spreadsheet formula protection.
- Open GitHub links for permitted actions. Local planning states do not edit labels, assign people, post comments, merge PRs or change GitHub issues.

## Storage modes

On static GitHub Pages, planning notes live in the browser's `localStorage` at `repoverity:maintainer-queue:v1`. Up to 150 entries can be saved per browser across repositories. This is independent of the application's original data backup feature. Clearing site storage deletes the notes.

In a configured, same-origin Cloudflare deployment, a user who signs in via GitHub stores the queue in D1. Only that user's GitHub ID may retrieve, update or remove the entries. A signed-out user uses local storage instead. If the cloud API cannot be reached, the app reports the error and does not silently fall back to the local mode for a signed-in user. Cloud entries are removed when the user deletes their cloud account.

The queue is **personal**, not a multi-user board. There is no organization administration, invitation model, shared-note ACL, role management or GitHub write authorization in V1.8. This is a deliberate security boundary, not a hidden or unfinished feature.

## Deployment

The static public build works without any Cloudflare resources. To enable synchronized notes on the separate cloud deployment:

1. Configure V1.6 Cloudflare Worker, GitHub OAuth App, and D1 before deploying.
2. Apply the additive migration: `npm run cloud:migrate:remote` (migration `0003_maintainer_queue.sql`).
3. Deploy with `npm run cloud:deploy`.
4. Test sign-in, private notes, cross-account isolation and deletion in a nonproduction Worker before public use.

Existing `0001_initial.sql` and `0002_growth_history.sql` migrations remain intact. Scheduled growth tracking from V1.7 is unchanged.

## API access and limits

The public maintainer client calls three GitHub REST endpoints by request:

- `GET /repos/{owner}/{repo}/issues?state=open&sort=updated&direction=desc&per_page=40&page=N`
- `GET /repos/{owner}/{repo}/pulls?state=open&sort=updated&direction=desc&per_page=40&page=N`
- `GET /repos/{owner}/{repo}/contributors?per_page=40&page=1`

The issue and PR lists are not complete history, and the client does not collect closed or private records. `429` and `403` access or rate-limit errors are shown as unavailable, not as zero observations. Pagination is capped at three pages to limit anonymous calls. There is no background scraping.

Private Cloud API endpoints:

- `GET /api/v1/maintainer/queue?repo=owner%2Frepo`
- `POST /api/v1/maintainer/queue` with `{repo,kind,number,stage,note}`
- `DELETE /api/v1/maintainer/queue` with `{repo,kind,number}`

All private endpoints require the existing same-origin GitHub session. Mutations require the existing Origin and `X-RepoVerity-Action: 1` checks. The database enforces user-scoped unique keys and cascade deletion. A single atomic insert statement enforces the global maximum of 150 entries per user.

## Data deletion and export

The personal worklist supports CSV export and explicit per-item removal. It is not automatically included in the older JSON backup. Cloud account deletion cascades to every queue entry; local storage is independent and must be cleared separately.

## Future upgrades

A true multi-user collaboration service and direct GitHub issue/PR modification would require GitHub App installation authorization, explicit fine-grained scopes, a permission and organization model, audit logs, and comprehensive security testing. These are intentionally out of scope.

Official GitHub references:

- [List repository issues](https://docs.github.com/en/rest/issues/issues#list-repository-issues)
- [List pull requests](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests)
- [List repository contributors](https://docs.github.com/en/rest/repos/repos#list-repository-contributors)
