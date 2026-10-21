# Repository Explorer Pro (V1.3)

Repository Explorer Pro extends the existing read-only GitHub workspace with deliberate pagination, saved filters, local comparison and CSV export.

## Data coverage

- Opening a public account still loads up to 100 of its most recently updated owned public repositories.
- The Repositories workspace can request additional pages of 100 through the public GitHub REST API. Subsequent pages are requested **only when the visitor selects Load next 100**.
- GitHub pagination begins with page 2 because page 1 is already included in the existing profile snapshot. Page results are deduplicated by repository ID in case projects change during pagination.
- A short page or an empty page signals no more pages. A duplicate-only full page stops pagination to prevent repeated identical API calls.
- A maximum of 100 pages is supported. This is a safety bound, not a promise that all accounts can be fully enumerated.
- Counts distinguish repositories *loaded* by the explorer from GitHub's *reported public repository count*. The latter is separate from the loaded data and can briefly differ.
- Sorting and filtering operate on **loaded repositories**, never on pages not yet retrieved.
- The other workspaces, including Overview, Insights, Growth and Advisor, intentionally retain their existing sample of up to 100. Expanding Explorer pages does not silently change their metrics.

## Working with the explorer

1. Search a GitHub username and navigate to Repositories.
2. Filter loaded projects by name, description, language, topic, status or recent activity.
3. Sort by last push, name, Stars or forks, and switch between table and card layouts.
4. Save a set of filters using Save current filters. Up to 12 views per account are retained locally.
5. Select up to three repositories and choose Compare selected for a side-by-side metadata comparison.
6. Export the matching loaded repository rows to CSV. CSV text is quoted and prefixed where appropriate to reduce spreadsheet formula risks.
7. Select Load next 100 to request an additional GitHub page. More API requests can run into anonymous GitHub rate limits.

## Data and privacy

Saved views are stored only in this browser under `repoverity:explorer-views:v1`. They are isolated by account username and are not uploaded anywhere. Browser storage can be unavailable or full, in which case an error is displayed. The V1.0 backup format intentionally covers only growth history and manual achievement checklists. **Saved Explorer views are not included in that backup**. Do not rely on them for important long-term data.

Comparison includes public repository name, URL, language, license metadata, topics, latest push, Stars, forks, and archived/fork flags. It does not read private data, assess code quality or certify software security. Metadata can be incomplete or stale.

GitHub pages may shift if someone pushes to an account while pagination is underway. RepoVerity de-duplicates IDs but cannot guarantee a consistent snapshot over multiple API calls. Refresh the account to begin a new pagination session.

## Quality gates

V1.3 includes unit tests for filtering, stable sorts, CSV sanitization, saved-view validation, comparison limits, page de-duplication, rate-limit responses and unexpected payloads. Validate with `npm test`, `npm run typecheck`, `npm run lint:text` and `npm run build:pages` before merging.
