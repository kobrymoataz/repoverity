# Motion system | RepoVerity V1.2

This release adds deliberate movement to the V1.1 workspace without introducing animated decorative backgrounds or changing how GitHub data is calculated.

## Tools

- **Motion for React** manages workspace entry and exit, shared navigation indicators, filter selection, command palette presentation, and growth chart drawing.
- **GSAP** is used for one controlled Overview reveal after real profile data has loaded. The sequence animates the existing profile and portfolio sections, not invented numbers. The sequence is scoped to the component and reverted on unmount.
- Ordinary CSS retains basic hover and focus treatment. We avoid competing transforms on the same animated element.

## Durations and limits

| Interaction | Approximate duration |
| --- | --- |
| Press and hover feedback | 140 ms |
| Workspace transition | 220 ms |
| Exit and scrim | 130 ms |
| Overview GSAP reveal | 500 ms per entry with a short stagger |
| Growth chart drawing | 750 ms |

No continuously running parallax, particles, flashing gradients, or randomized animations are included. The animation durations are not a performance or accessibility guarantee.

## Accessible controls

- The user's operating system `prefers-reduced-motion` request always takes precedence.
- Visitors can also click the Motion control in the top bar to disable interface animations.
- Only `repoverity:motion:v1` is stored locally. This preference is not part of growth-history backup exports.
- A nonmodal transition does not replace focus management. The quick switch provides a keyboard focus loop and returns focus after closing.
- Press **Command K** on macOS or **Control K** elsewhere to open Quick switch. Use Up, Down, Enter, Escape, and Tab.
- The interface still works if no growth history exists, if a repository has no Stars, or if GitHub API access is rate limited.

## Dependency management

The stage 01 installer adds these exact packages and lets npm update the lockfile on the developer's machine:

```bash
npm install --save-exact motion@12.23.24 gsap@3.13.0
```

Do not copy `node_modules` or a hand-crafted dependency lockfile into Git. Commit the package manifest and npm-generated lockfile together. Run production Pages checks after the dependency change.

## Verify

```bash
npm test
npm run typecheck
npm run lint:text
npm run build:pages
```

Manual checks: switch all nine workspaces, use Quick switch with keyboard and pointer, test the navigation on a narrow viewport, switch charts on two or more actual local snapshots, change the OS Reduced Motion setting, and check the persisted preference after reload. Measure with browser performance tools rather than claiming every device runs at a particular frame rate.
