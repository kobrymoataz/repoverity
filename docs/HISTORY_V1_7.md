# V1.7 Historical Growth Intelligence

RepoVerity V1.7 adds **explicitly enabled, cloud-side observations** for public GitHub profiles and repositories. It builds on the optional Cloudflare Worker and D1 deployment introduced in V1.6. The original GitHub Pages app and all local growth records continue working without an account.

## Scope

- Up to 20 tracked public targets per signed-in account, each intentionally added in the Cloud Growth section.
- Profile readings: public follower count and public repository count.
- Repository readings: public Star and fork counts.
- One stored observation per UTC day and target, with no invented history, backdating, interpolated events, or synthetic growth.
- A 730-day sliding retention period for observations. Earlier observations are permanently deleted as part of successful captures.
- In-app milestones when two actual observations cross thresholds such as 25, 50 or 100 followers or Stars.
- A user-triggered capture with a six-hour minimum gap per target, plus one scheduled collection opportunity daily.
- CSV export and explicit deletion of a target, its readings, and associated milestones.

The UI's **browser-local** history remains under the existing storage key. V1.7 does not silently import or upload local data. Deleting local data does not delete cloud data; deleting a cloud target does not change browser-local history.

## Deployment requirements

This feature **does not run on GitHub Pages alone**. It needs a Cloudflare Worker, a D1 database and GitHub OAuth sign-in already configured for the same origin. A merged source release is not a deployed cloud service.

1. Deploy or update V1.6 infrastructure using [Cloud setup](CLOUD_V1_6.md), including `wrangler.jsonc` (gitignored) and the `DB` binding.
2. Apply the database migration before deploying the new Worker:

   ```bash
   npm run cloud:migrate:remote
   ```

3. Configure the Worker Cron Trigger in your private `wrangler.jsonc`. New configs built from `wrangler.example.jsonc` already include it. For an existing config use:

   ```bash
   node scripts/enable-growth-cron.mjs
   ```

   This utility preserves other cron entries, refuses files it cannot safely parse, and does not modify your GitHub repository or secrets.

4. Validate before deploying:

   ```bash
   npm ci
   npm run typecheck
   npm test
   npm run typecheck:cloud
   npm run test:cloud
   npm run lint:text
   npm run build:pages
   npm run build:cloud
   ```

5. Deploy the updated Worker:

   ```bash
   npm run cloud:deploy
   ```

6. Verify `/api/v1/status` on the Cloudflare origin reports version `1.7.0`. Sign in, add one public profile or repository, capture the first value, and inspect the measured history. A new trend requires a second UTC date.

### Scheduled handler

`worker/index.ts` exports both `fetch()` and `scheduled()`. The Cron Trigger `15 7 * * *` runs daily at **07:15 UTC**. Cloudflare Cron Trigger propagation may take several minutes. It is not an exact guarantee of an observation every day.

The scheduler selects at most **18 due targets per run** across all accounts and attempts requests sequentially. Due targets are claimed in D1 before making an outbound request. On rate limits it stops for that run; unavailable targets are rescheduled without inserting false values. This cap limits cost and API pressure, but it also means not every opted-in user receives a fresh reading every day when demand exceeds capacity. A later release could introduce sharding or a dedicated queue.

A GitHub API token is **not required** for public data, but optional `GITHUB_PUBLIC_READ_TOKEN` in Cloudflare Worker Secrets can increase available API quota. If supplied, it must be read-only and scoped only as needed. Never put it in `wrangler.jsonc`, browser code, CI logs, or commit history. Tokens are never sent to the browser or stored in D1.

### Testing Cron locally

After `npm run cloud:migrate:local`, run `npm run cloud:dev`. In another terminal, invoke the documented local scheduled endpoint:

```bash
curl 'http://127.0.0.1:8787/cdn-cgi/local/scheduled?cron=15%207%20%2A%20%2A%20%2A'
```

Local testing should use separate OAuth credentials and a local D1 database, never production credentials.

## Schema and privacy

Migration `migrations/0002_growth_history.sql` adds:

| Table | Purpose |
| --- | --- |
| `growth_targets` | Per-account, opt-in profile or repository reference, due time and status |
| `growth_observations` | One observed UTC day per target, actual public counts |
| `growth_milestones` | On-site threshold crossings derived from two measured values |

All foreign keys cascade when the parent target or user account is deleted. The endpoints check the signed-in numeric GitHub user ID before exposing or modifying history. The same exact-origin and session rules from V1.6 still apply.

### API endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/growth/targets` | List your targets and their status |
| `POST` | `/api/v1/growth/targets` | Opt in to tracking a `{kind, resource}` |
| `GET` | `/api/v1/growth/targets/{id}/history` | Your observations and in-app milestones |
| `POST` | `/api/v1/growth/targets/{id}/capture` | Manual capture, six-hour cooldown |
| `DELETE` | `/api/v1/growth/targets/{id}` | Stop tracking and erase that target's records |

Mutations require an authenticated session, valid `Origin`, JSON where relevant, and `X-RepoVerity-Action: 1`. Only permitted fixed GitHub REST endpoints are called. Clients never submit an arbitrary outbound URL.

### Data integrity and limitations

- Profile follower figures are GitHub's **publicly visible counts**. GitHub may show zero for profiles configured as private, which is not proof of zero private followers.
- A missing or inaccessible public target is marked `not_found`; denied, malformed or unavailable requests do not add readings.
- Rate-limited collection is marked `limited`. It does not substitute a zero, estimate, or cached point.
- A single date may have multiple successful captures, but only its latest measured point remains. In-app milestones are unique by target, metric, and threshold.
- Deltas compare the first and last **recorded** values. They do not represent cumulative daily change, total lifetime activity, new subscribers, organic growth, or a complete event stream.
- There are no emails, push notifications, automatic GitHub stars, or automated followers in V1.7. "Milestone" means an in-app record, not a message sent to an external service.

Official reference: [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/), [GitHub public user API](https://docs.github.com/en/rest/users/users).

## Rollback

Removing the Cron Trigger stops scheduled captures. Deploying an earlier Worker will not erase V1.7 D1 rows, but it will make the new endpoints unavailable. **Do not delete migration tables when rolling back application code.** Users can delete individual targets and their histories through the app; account deletion cascades across all V1.6 and V1.7 records.
