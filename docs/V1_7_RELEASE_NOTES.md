# RepoVerity V1.7.0 Release Notes

## Historical Growth Intelligence

V1.7 adds opt-in scheduled public GitHub snapshots to the optional Cloudflare-hosted RepoVerity deployment.

### Added

- D1 migration for cloud tracking targets, observations and milestone history.
- Daily Worker scheduled collection with a capped, sequential queue and rate-limit handling.
- Public profile follower and repository-count readings, or repository Star and fork readings.
- In-app milestone detection from verified threshold crossings.
- A six-hour manual capture cooldown, CSV export and per-target deletion.
- A Cloud Growth section in the existing Growth History workspace.
- Integration tests for account isolation, API routes, fake-zero prevention, cancellation and deletion.

### Preserved

- GitHub Pages public access without login.
- Browser-local growth storage and its backup formats.
- V1.6 account sessions, workspaces, watchlists and preferences.
- V1.5 evidence audits and all earlier developer tools.

### Requirements

GitHub sign-in and background collection work only on a separately deployed Cloudflare Worker with D1, the OAuth secrets and a configured UTC Cron Trigger. A source merge alone does not start collection.

### Boundaries

History starts when a user opts in. No backfilling, guaranteed daily service, automatic Stars, email alerts, or false security claims. At most 18 due targets are attempted per scheduled run; capacity may need expanding as adoption grows. See [full methodology](HISTORY_V1_7.md).
