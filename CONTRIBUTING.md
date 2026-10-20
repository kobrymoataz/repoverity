# Contributing to RepoVerity

Thanks for your interest in making developer tools more useful.

## Before contributing

1. Check existing issues and avoid duplicate work.
2. Open a focused issue for changes affecting product behavior or data accuracy.
3. Keep pull requests small enough to review and describe how you tested them.

## Local checks

```bash
npm install
npm run typecheck
npm test
npm run build
```

## Pull request checklist

- [ ] The change solves a clear problem.
- [ ] Any new statistics explain their data source and sampling limitations.
- [ ] Public API failures, missing values and mobile layout are handled.
- [ ] No secrets, access tokens or private information have been committed.

Please do not automate follows, stars, repository spam or other manufactured engagement. RepoVerity exists to make public work easier to understand, not to game GitHub metrics.

## Code conventions

Use TypeScript for application logic; prefer simple components and accessible HTML. Prefer plain, explicit calculations to opaque scores. Keep dependency additions justified and documented.
