# RepoVerity V2.1 release checklist

- [ ] Confirm the release PR is based on the merged V2.0 partial commit `4bbfd8f9217cf08cdf4ddfb2328fef41e26b6a6b`.
- [ ] Verify `node -p "require('./package.json').version"` prints `2.1.0`.
- [ ] Run `npm ci`, `npm run test:release`, `npm run test:toolkit`, `npm test`, `npm run typecheck`, `npm run typecheck:cloud`, `npm run test:cloud`.
- [ ] Run `npm run lint:text`, `npm run build:pages`, `npm run test:e2e`, `npm run build:cloud`.
- [ ] Confirm the production bundle gate detects oversized assets and private config artifacts.
- [ ] In Chrome, check `#/launch` and `#/tools` at 390px and desktop widths, including copy and download controls.
- [ ] Confirm the generated workflow is **not** automatically committed or installed.
- [ ] Test `node tools/workflow.mjs --help`, plus generation of a manual read-only workflow.
- [ ] Review all npm advisories and do not upgrade major dependencies blindly.
- [ ] Review changes, wait for green PR CI, merge after human review.
- [ ] Wait for green GitHub Pages deployment on main and check the live site manually.
- [ ] Review optional Cloudflare Worker and D1 separately if deployed.
- [ ] Only then create the `v2.1.0` tag and GitHub Release, unless the tag already exists.
- [ ] Marketplace publication and Developer Agreement are a separate manual action, not proof of security certification.

There is no completed V2.0.0 release tag in the audited repository baseline. Do not label the previous partial PR a fully verified V2.0 release. See `docs/RELEASE_V2_1.md`.
