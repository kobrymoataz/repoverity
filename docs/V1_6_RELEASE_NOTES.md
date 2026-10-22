# RepoVerity V1.6: Cloud workspaces

## New capabilities

Optional GitHub sign-in to save up to 12 named workspaces, repository references and cloud display preferences across devices. Backend and frontend are served on the same origin through Cloudflare Workers. D1 provides per-user storage. Public GitHub Pages stays anonymous and unaffected.

## Controls and boundaries

The backend uses OAuth state cookies, short-lived consent exchange, no persisted GitHub OAuth tokens, SHA-256-hashed sessions, secure cookie options, scoped SQL access and explicit account deletion. The app only handles public GitHub identity. Growth history, achievements and Explorer presets remain browser-local. Backend rate limiting and independent security review are required before a large public launch.

## Validation

- `npm run typecheck:cloud`
- `npm run test:cloud`
- `npm test`
- `npm run typecheck`
- `npm run lint:text`
- `npm run build:pages`
- `npm run build:cloud`

Cloudflare credentials, GitHub OAuth App registration, remote migrations and deployment must be completed by the maintainer. Passing unit tests does not prove a successful real-world OAuth flow.

See [Cloud setup and threat model](CLOUD_V1_6.md).
