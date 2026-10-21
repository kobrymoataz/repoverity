# RepoVerity V1.1 | Workspace redesign

## Scope

The first post-V1 release replaces the promotional, single-page dashboard layout with a professional developer workspace. All existing V1.0 tools remain available without requiring GitHub login.

## Included

- Restructured desktop and mobile navigation with distinct workspaces.
- Refresh-safe hash routes for GitHub Pages and support for old bookmarks.
- New visual identity, icon, typographic hierarchy and neutral color system.
- Clear account lookup with keyboard access and query-param sharing.
- Public profile identity, sampling information and consistent metric layout.
- Responsive repository table with filters and sorting.
- Dedicated insights, growth, advisor, contributions, achievements and privacy pages.
- Preserved local growth and achievements data formats.
- Test coverage for hash navigation and CI text-quality checks.
- Updated README, release history and design documentation.

## Not included

- Cloud storage, OAuth, private repository access or scheduled data collection.
- Complete repository pagination beyond the current 100-item sample.
- A new motion library. A focused animation system belongs to V1.2 after this layout is validated.

## Validation required before merging

```bash
npm ci
npm run typecheck
npm test
npm run lint:text
npm run build:pages
```

Manual QA should include 1440 px desktop, 768 px tablet and 390 px mobile widths, keyboard navigation, the public API error state, and all nine workspaces. Check direct entry to `#/growth`, `#/advisor` and URLs with `?user=...`. Verify GitHub Pages at the exact project path and ensure data backups can still be restored.

## Upgrade policy

V1.1 changes UI structure and text only. It does not migrate or clear browser storage. No new credential storage or backend API is introduced.
