# RepoVerity V1.4.0: Developer Analytics Pro

## Included

- Rebuilt Insights as a three-tab Developer Analytics Pro workspace.
- Clear account-wide and sample-only metric labels.
- Six-month distribution of latest push dates for the loaded repositories.
- Safe portfolio CSV export.
- Second public GitHub profile comparison with separate API loading and errors.
- Opt-in repository activity inspection with contributor, release, issue and pull request samples.
- Median days between published stable releases in the returned sample.
- Per-endpoint failure messages, N/A for unavailable data, abortable requests and bounded in-memory cache.
- Responsive charts and panels with reduced-motion handling.
- Unit tests for scope, time buckets, release intervals, CSV safety and API behavior.

## Compatibility

- Requires the deployed V1.3.0 baseline.
- Existing V1.3 Explorer, V1.2 Motion and GSAP modules, Growth History, Achievement Lab, Repository Advisor, Contribution Finder and privacy controls stay in place.
- No new runtime packages, user account, backend or authentication needed.
- Version numbers become 1.4.0 in the package and lockfile.

## Known limitations

This is not a commit-history scraper, vulnerability scanner, full historical activity report or ranking system. API outputs are deliberately limited by page size, and requests are user-triggered. See [Analytics methodology](ANALYTICS_V1_4.md).

## Release verification

1. Run `npm ci && npm test && npm run typecheck && npm run lint:text && npm run build:pages`.
2. Verify Portfolio, Compare and Repository Activity in desktop and narrow mobile views.
3. Test both ordinary and failed GitHub API responses.
4. Review the Pull Request and CI results before merging to main.
5. Confirm the GitHub Pages deployment and open the canonical URL in a private tab.
