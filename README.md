# RepoVerity

**Public GitHub intelligence, without the noise.**

RepoVerity is an open-source dashboard for exploring public GitHub profiles and repository metadata. Enter a username to see a live profile snapshot, sample repository engagement, language distribution, and a few transparent quality signals.

![RepoVerity status](https://img.shields.io/badge/version-0.2.0-7BE6C5?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-7294A0?style=flat-square)

[Live dashboard](https://kobrymoataz.github.io/repoverity/) · [Source code](https://github.com/kobrymoataz/repoverity) · [Report an issue](https://github.com/kobrymoataz/repoverity/issues)

> The live dashboard link becomes active after enabling GitHub Pages and successfully running the deployment workflow.

## What V0.2 includes

- Public profile lookup by username, `@handle` or a full GitHub profile link
- Followers and GitHub-reported public repository count
- Stars and forks **from up to 100 recently updated public repositories**
- Language mix and four inspectable portfolio indicators (descriptions, topics, licenses, recent pushes)
- Repository search, filtering, sorting and links to the source
- Mobile-responsive dashboard, error states and loading feedback
- Shareable profile URLs (`?user=...`)

V0.2 includes the redesigned dashboard, contributor documentation, automated tests, a CI workflow, and GitHub Pages deployment.

Data comes directly from the public GitHub REST API. There is no login, tracking database, engagement bot, or follower automation.

## Run locally

Requirements: Node.js 22.12+ (Node.js 24 LTS recommended) and npm.

```bash
git clone https://github.com/kobrymoataz/repoverity.git
cd repoverity
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

For a production check:

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

## Data accuracy and limits

The profile's follower/public repository counts come from GitHub's user endpoint. Stars, forks, languages and portfolio indicators are calculated from at most **100 of the most recently updated owned public repositories**, not a full account history. Empty samples are shown as empty, not scored as failures. No security rating is implied by the metadata indicators.

Unauthenticated API access is limited by GitHub to **60 requests per hour per IP** (subject to GitHub's rules). To keep V0.2 simple, the app does not request or store personal access tokens. It also caches successful lookups for two minutes in memory.

## Deployment

The project includes a GitHub Actions workflow for GitHub Pages. Select **GitHub Actions** as the Pages source in this repository's Settings → Pages. The app then deploys automatically after changes to `main`, using the `/repoverity/` base path.

Expected address after a successful deployment: `https://kobrymoataz.github.io/repoverity/`.

## Roadmap (not shipped yet)

Follower history (tracked prospectively), an educational GitHub achievements guide, repository improvement suggestions and contributor discovery.

## Contributing

Issues and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md). For security concerns, read [SECURITY.md](SECURITY.md).

## License

[MIT License](LICENSE) · Maintained by [@kobrymoataz](https://github.com/kobrymoataz).
