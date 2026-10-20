# Growth analytics: data, privacy and limitations

V0.3 is deliberately **local-first**. It does not include a database or background monitoring agent.

## Collection

1. Open a valid public GitHub profile in the RepoVerity dashboard.
2. Click **Start tracking**. The current API response is saved as the first observation.
3. Return on a later UTC date and load the same profile to save another observation. **Refresh** fetches GitHub again, subject to rate limits.
4. At most one observation exists for each UTC calendar date. If the API is refreshed again that day, the most recent observation is kept.
5. Pause tracking to stop collecting without deleting previous observations.

No points are synthesized for days on which the profile was not opened. A 7D or 30D comparison requires observations from at least two distinct dates within that selection. Charts are drawn using actual time spacing, not equally spaced artificial daily records.

## Where data is stored

- Stored in browser `localStorage` under `repoverity:growth:v1`.
- No GitHub personal access token, email address, login session, or external database is used.
- History is **not** synced to other browsers or devices.
- A separate record is maintained per GitHub login (case-insensitive).
- Up to **365 daily observations** are kept per profile, and up to **25 profiles** per browser are supported. When full, the oldest observations are dropped; a new profile cannot be tracked without deleting an existing one.
- Clearing the browser storage deletes the records. Use **CSV** to export a backup. CSV exports are read-only backups; importing is not implemented in V0.3.

## Columns in the CSV file

| Name | Meaning |
| --- | --- |
| utc_date | Observation date, UTC |
| recorded_at_utc | Actual fetch timestamp, ISO 8601 |
| github_username | Profile login |
| followers | GitHub user endpoint's follower count |
| public_repositories | GitHub user endpoint's public repo count |
| sampled_stars | Sum of stars from sampled owned repositories |
| sampled_forks | Sum of forks from sampled owned repositories |
| sampled_repositories | Number of repositories loaded (maximum 100) |

**Sampled-star changes are not a full-account star growth measure.** The set of at most 100 recently updated repositories can change; repository removal or different sampling can alter the sum. Keep this limitation in mind when comparing chart values across dates.

## Storage failures and safety

Invalid browser data is ignored during loading. The app rejects malformed profiles, invalid counts, malformed timestamps and unsupported storage versions. A blocked or full browser storage displays a warning. The chart may still work temporarily in that tab, but it is not persisted and users should export before leaving.

Deleting saved history for one profile requires a confirmation and does not delete records for other profiles. No follower, star, discussion, or contribution actions are automated by RepoVerity.
