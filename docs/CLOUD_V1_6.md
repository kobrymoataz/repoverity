# RepoVerity Cloud V1.6

V1.6 introduces an optional same-origin Cloudflare Workers deployment. The existing GitHub Pages deployment remains functional for public browsing, anonymous repository analysis and browser-local growth history.

## Included

- GitHub OAuth web application sign-in for **public user identity** with `read:user` scope.
- Server-side user session records in Cloudflare D1. Only SHA-256 hashes of random session tokens are stored. The browser receives a Secure, HttpOnly, SameSite=Lax cookie.
- Up to 12 named workspaces and 100 repository references per workspace.
- Cross-device sync of repository watchlists, display density and quick-launch view.
- Account sign-out and explicit server-side account-data deletion.
- Per-user SQL access controls, prepared query bindings, length validation, strict same-origin writes and no third-party API cookies.
- No stored GitHub OAuth access tokens. No private repository access, background snapshots or user activity automation.

**Not included:** Cloud sync of growth history, manually reported achievement progress, Explorer saved filters or exported local backups. Those records stay local and are not silently uploaded. Background history is planned for V1.7.

## Architecture and hosting

Cloudflare serves the built Vite frontend and the Worker API under **the same origin**. D1 stores user data. This avoids third-party cookies and means the original `github.io` page continues as a separate public-only deployment. A GitHub Pages page cannot directly host the Worker or its OAuth secrets. Use a `workers.dev` address initially or configure your own domain later.

- `worker/index.ts`: JSON API routes with session and origin validation.
- `worker/auth.ts`: GitHub authorization redirect, OAuth callback, secure cookies and session resolution.
- `worker/db.ts`: parameterized D1 queries scoped by GitHub numeric user ID.
- `worker/validation.ts`: input limits, repository validation and strict cloud preferences.
- `src/lib/cloudApi.ts` and `src/components/CloudWorkspace.tsx`: optional client-side account workspace.
- `migrations/0001_initial.sql`: schema with foreign keys and indexes.
- `wrangler.example.jsonc`: deployment template, with non-secret placeholders.
- `scripts/init-cloud-config.mjs`: creates a local, gitignored `wrangler.jsonc` with your non-secret identifiers.

## Setup on Mac

Requirements: Node.js 24, npm, a Cloudflare account with Workers and D1 access, and an OAuth App created under your GitHub Developer Settings. **The Cloudflare deployment and GitHub OAuth App require your own accounts and actions.** Nothing is provisioned or enabled automatically by this source release.

1. Install dependencies and verify:

```bash
npm ci
npm run typecheck
npm test
npm run typecheck:cloud
npm run test:cloud
npm run build:pages
```

2. Authenticate with Cloudflare and create the D1 database:

```bash
npx wrangler login
npx wrangler d1 create repoverity-cloud
```

Copy the exact `database_id` from the output. Determine your `https://...workers.dev` hostname from the Cloudflare account's Workers subdomain settings. You can configure a custom domain instead. The hostname must be known before configuring GitHub's OAuth callback.

3. Create a **GitHub OAuth App** under <https://github.com/settings/developers>. Set its Homepage URL to your intended `https://...workers.dev` address and Authorization callback URL to `https://YOUR_HOST/api/auth/callback`. Copy the Client ID. This is a GitHub OAuth App, not a personal access token. Treat the Client Secret as private.

4. Generate the Wrangler configuration with the non-secret values:

```bash
node scripts/init-cloud-config.mjs YOUR_DATABASE_UUID https://YOUR_HOST YOUR_GITHUB_CLIENT_ID
```

The script refuses to overwrite an existing `wrangler.jsonc`. Review that file. **Never put `GITHUB_CLIENT_SECRET` in `wrangler.jsonc`, client code, GitHub Actions, or Git commits.**

5. Apply the remote schema before allowing sign-ins:

```bash
npm run cloud:migrate:remote
```

6. Add the OAuth secret to Cloudflare (interactive prompt):

```bash
npx wrangler secret put GITHUB_CLIENT_SECRET
```

7. Deploy your Cloudflare-hosted application:

```bash
npm run cloud:deploy
```

8. Visit your Cloudflare URL, open **Cloud workspaces**, and test sign-in, one saved workspace, a watchlist entry, sign-out, and deletion. Verify HTTPS and the cookie flags using the browser developer tools. GitHub Pages remains at `https://kobrymoataz.github.io/repoverity/` for public use and is not automatically redirected.

## Local API development

Run `npm run cloud:dev` for a local Worker at `http://localhost:8787`, with a local D1 instance. To use local OAuth, create a **separate GitHub OAuth App** whose callback is `http://localhost:8787/api/auth/callback`. Add its Client ID to your local Wrangler config and store its Client Secret in `.dev.vars` (copy `.dev.vars.example`). Set `APP_ORIGIN="http://localhost:8787"` in `.dev.vars` for local development. These files are gitignored. Apply the local migration before signing in:

```bash
npm run cloud:migrate:local
npm run cloud:dev
```

Do not use the production OAuth Client Secret in local development. Ensure that the Wrangler variables actually resolve to your local callback origin.

## Threat model and boundaries

- The Worker validates a 256-bit OAuth state value against a short-lived HttpOnly state cookie before code exchange. It clears the state cookie after callback.
- It requests `read:user` only; token exchange happens on the server, and the GitHub token is discarded after retrieving the signed-in user's public identity. The token is not sent to the frontend or written to D1.
- Random 256-bit session tokens are stored **only as SHA-256 hashes** in D1, with a 14-day expiration. Up to five device sessions per user are retained.
- Mutating API calls require an exact `Origin` match and a custom `X-RepoVerity-Action: 1` header, and all cookies are `SameSite=Lax`. This is a defense against cross-site request forgery, not a complete substitute for other browser security defenses.
- Endpoints do not enable CORS. Responses containing account information use `Cache-Control: no-store`.
- All write inputs are bounded and SQL parameters are bound. Workspace and watchlist queries are scoped to the session user; no arbitrary repository source code is fetched in the cloud backend.
- Users can remove cloud data and sessions. The GitHub Pages site's browser-local data is independent and is never removed by cloud account deletion.
- The app does not support private GitHub data or claiming official GitHub achievement status.
- **Before broad public adoption**, perform an independent security review, external OAuth deployment tests, Cloudflare production logging and abuse monitoring, rate limiting, session lifecycle testing and database backup/recovery exercises. This release is not a security certification.

## Operational notes

Cloudflare Workers and D1 have free and paid allowances, usage limits and storage rules. Check the current Cloudflare plan and pricing before launching publicly. Consider Cloudflare WAF rate rules on `/api/auth/*` and write routes. Back up D1 regularly and test restore procedures. Rotate compromised OAuth secrets through GitHub and Cloudflare.

## Official references

- [Cloudflare Worker static asset binding and routing](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Cloudflare D1 migrations](https://developers.cloudflare.com/workers/wrangler/commands/d1/)
- [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [GitHub OAuth authorization flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
