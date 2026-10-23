# RepoVerity privacy and local records

RepoVerity has two independent deployment modes. The public GitHub Pages build uses public GitHub API requests and browser-local storage without sign-in. The optional Cloudflare Worker build adds GitHub OAuth, a same-origin API and Cloudflare D1.

## Public GitHub Pages

- Public profile and repository metadata are requested from GitHub.
- Browser-local `repoverity:growth:v1` observations are created only after the user enables tracking, and only when the page is visited.
- `repoverity:achievements:v1` contains manual, self-reported badge progress.
- Browser-local storage and existing backup files are not automatically uploaded to the cloud.
- The static host has no Worker Cron Trigger and cannot run background collection.

## Optional Cloudflare account

- GitHub OAuth is used to verify your identity. Access tokens are used only during login and are not saved by RepoVerity.
- A secure, HttpOnly session cookie identifies your signed-in browser; D1 stores a hash of the session token.
- Workspaces, repository watchlists and display preferences are saved per GitHub numeric user ID.
- Starting with V1.7, tracking a public target is **explicit opt-in**. D1 stores the target, its public measurements, collection status and in-app milestone records.
- Collection uses GitHub's public API. An optional Worker-only token may be configured by the site operator and must never reach browser code.
- Scheduled collection is limited to up to 18 due targets per run. Observations are kept for up to 730 days and are not backfilled.
- Removing a target deletes its cloud observations and milestone records. Deleting your cloud account deletes all your workspace, watchlist, preference and cloud growth rows through database foreign-key cascades.
- No marketing emails, push alerts, automatic followers, private repository analysis, or storage of private GitHub tokens are implemented.

## Browser backup and deletion

Open Data & privacy to export or import supported local backup data. Import explicitly replaces supported browser-local records after review. Deleting local data affects only RepoVerity keys in this browser. It does **not** delete your cloud account. Conversely, deleting a cloud account does not erase an exported JSON file or local browser observations.

GitHub, Cloudflare and your host may process requests under their own policies. Never post exported backups, GitHub access tokens, OAuth secrets, or session cookies in public issues.

See [Cloud V1.6](CLOUD_V1_6.md), [Growth History V1.7](HISTORY_V1_7.md) and [local growth methodology](GROWTH_DATA.md).

## V1.8 personal maintainer notes

The new Maintainer desk saves personal triage stages, issue/PR references and notes either in device local storage or, after signing into a configured Cloudflare deployment, in user-scoped D1 records. Notes are not posted to GitHub or shared with other users. They are not included in the original browser JSON backup. Cloud deletion cascades to all associated personal queue records; local notes must be cleared separately. See [Maintainer V1.8](MAINTAINER_V1_8.md).
