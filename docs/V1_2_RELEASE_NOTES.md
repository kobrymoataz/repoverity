# RepoVerity V1.2 | Professional motion and interaction

## Scope

V1.2 builds on the V1.1 workspace redesign. It adds controlled animations and keyboard-first interaction without creating background data collection, artificial followers or automatic GitHub contributions.

## Included

- Motion for React page transitions and shared selected-navigation indicator.
- Animated repository status filter selection and mobile navigation scrim.
- GSAP context-scoped, one-time Overview reveal for actual loaded profile sections.
- Animated growth chart paths, using the real locally recorded UTC observations.
- Quick switch command interface with Command K and Control K shortcuts, search, arrow-key selection, focus management and accessible labels.
- Preference to reduce animations, stored on this device, while always respecting the operating system preference.
- Unit tests for motion preferences and quick workspace search, plus documentation on timings and accessibility.

## Explicit boundaries

- The release does not add an AI assistant, OAuth login, background monitoring, private-repository access, or complete historical growth reconstruction.
- Motion does not change data sampling. Stars and forks still cover up to 100 recently updated owned public repositories.
- The presence of GSAP and Motion is not a guarantee of high frame rates. Use Chrome and WebKit performance tools for device-specific validation.

## Required release checks

```bash
npm ci
npm run typecheck
npm test
npm run lint:text
npm run build:pages
```

Before merging, manually verify that animations never hide controls or block input, that the command palette is usable by keyboard only, that reduced motion has immediate effect, and that GitHub Pages loads without a query parameter.
