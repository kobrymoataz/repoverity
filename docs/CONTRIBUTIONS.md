# V0.4 public contribution finder

The issue finder is **read-only**. It helps developers discover open, unassigned public issues for genuine contributions.

## Search behavior

- Data source: GitHub REST API `GET https://api.github.com/search/issues`.
- A request happens **only when someone clicks “Find issues”**; the app does not crawl GitHub in the background.
- Search for `is:issue is:open archived:false no:assignee`, with one of these labels:
  - `label:"good first issue"`
  - `label:"help wanted"`
- Optionally filter the repository's primary language (TypeScript, JavaScript, Python, Java, Go, Rust, PHP) and a safe, bounded search phrase.
- Sort by last update; show up to 18 results. This is not a curated ranking of issue quality, and one issue may already be claimed by the time you open it.
- Direct GitHub search links are provided even if anonymous API calls are rate-limited.

The browser never asks for a GitHub token or receives one from RepoVerity. No search results are stored persistently, and a short-lived in-memory cache reduces duplicate requests.

## Accuracy and privacy

GitHub reports a count for the whole search, while the dashboard shows up to 18 recent matching issues. Search may be incomplete. Results are parsed and links limited to valid `https://github.com/OWNER/REPO/issues/NUMBER` URLs.

**Anonymous GitHub Search API is rate-limited**, and limits can change. The app reports HTTP 403/429 as rate-limited. Do not repeatedly retry; wait or open the query directly on GitHub.

## Working with maintainers

1. Read the issue and `CONTRIBUTING.md` for that repository.
2. Check if there is an existing PR or someone already working on the issue.
3. Discuss the proposed approach if appropriate.
4. Make a focused change with clear tests and reproducible steps.
5. Submit a genuine PR and respond thoughtfully to review feedback.

RepoVerity **does not** automatically open issues, submit PRs, post comments, follow accounts or manipulate stars.

## GitHub references

- [Search issues and pull requests](https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests)
- [Search REST API](https://docs.github.com/en/rest/search/search)
- [REST API rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
