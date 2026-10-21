# V1.0 Release Checklist

- [ ] Merge or safely incorporate the V0.5 advisor into the release branch (V0.4 is still the last published version at package preparation time).
- [ ] `npm ci` completes on Node 24 without changing the lockfile unexpectedly.
- [ ] `npm test` passes every existing and new test.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build:pages` passes, including asset URL verification.
- [ ] Test `?user=kobrymoataz`, a known GitHub account, and an invalid username.
- [ ] Check all workspaces, on-demand repository inspector, and low/no-repository cases.
- [ ] Test backup export, import review, cancel, confirmed restore and confirmed local delete. Use a disposable/private browser session.
- [ ] Confirm keyboard-only navigation, skip link, focus rings and reduced-motion preference.
- [ ] Check desktop and narrow mobile layout; use browser DevTools to inspect console/network errors.
- [ ] Open PR, review code, wait for green GitHub Actions CI, merge into `main`.
- [ ] Confirm the **Deploy GitHub Pages** workflow is green with the compiled site.
- [ ] Open the bare URL `https://kobrymoataz.github.io/repoverity/` with a private browsing window and normal reload.
- [ ] Review docs and security reporting contact before public announcements.
- [ ] Create release tag `v1.0.0` only after successful deployment.

**Publishing is manual**; creating the ZIP, branch or pull request does not constitute a published V1.0 release.
