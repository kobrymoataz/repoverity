# Privacy and local backup (V1.0)

RepoVerity is a static, browser-based web application. It does not operate a backend tracking database and does not ask for GitHub login credentials or personal access tokens.

## Network requests
- Public profile and recent repository metadata: `https://api.github.com`.
- Optional issue discovery: GitHub public Search API.
- Optional advisor file-presence checks: GitHub public repository directory listing API.
- User avatars: `avatars.githubusercontent.com` URLs returned by GitHub.

GitHub and the host (GitHub Pages) may process requests according to their respective policies. RepoVerity does not operate an independent analytics collector.

## Data stored in your browser
- `repoverity:growth:v1`: opt-in growth observations, tracked GitHub usernames and follower milestones.
- `repoverity:achievements:v1`: manual, self-reported achievement checklist states.

The two records remain in the current browser/device unless you export them. Private/incognito mode or clearing site data can remove them. No new records are created by opening another user's shareable profile URL unless you deliberately start tracking.

## Portable backup
1. Open **Privacy & portability** and choose **Export JSON backup**.
2. Save the downloaded file securely. It contains your tracked public usernames, timestamps, personal goals and self-reported badge checklist.
3. On another device, choose **Choose JSON backup**, review the counts, and explicitly confirm replacing the local records.
4. Reload happens automatically after a successful import so the existing workspaces read the restored records.

Backups use version `1`, are checked for supported fields, usernames and size (maximum 2.5 MB), and do not include GitHub tokens, browser cookies, unrelated storage or actual Github-issued badge verification. Badges marked "earned" are always self-reported.

**Import replaces both existing app records.** Export the current browser data first if you need to keep it. A failed write attempts to restore the previous records. Do not upload backup files to public issues.

**Delete local data** removes only these two keys and reloads the page. It does not touch your GitHub account or unrelated site storage.

For precise growth sampling and time limitations see [GROWTH_DATA.md](GROWTH_DATA.md).
