# RepoVerity 1.1 interface and design system

## Visual direction

An editorial developer workspace with a practical hierarchy. Use neutral surfaces, readable tables and restrained blue-gray accents. The visual language should support navigation and comparison, not imitate a promotional dashboard.

### Tokens

| Purpose | CSS token | Value |
| --- | --- | --- |
| Background | `--rv-canvas` | `#0b0d11` |
| Navigation | `--rv-sidebar` | `#0e1116` |
| Header | `--rv-header` | `#101318` |
| Panel | `--rv-panel` | `#15191f` |
| Border | `--rv-border` | `#2a3039` |
| Primary text | `--rv-text` | `#ebedf1` |
| Secondary text | `--rv-secondary` | `#a0a9b6` |
| Accent | `--rv-accent` | `#a7bee0` |

### Layout

- Persistent left navigation on desktop, accessible overlay navigation on mobile.
- Workspaces have their own URL fragment, such as `#/repositories`.
- Project base URL remains compatible with `/repoverity/` on GitHub Pages.
- Avoid content smaller than 11 px except compact supplemental labels.
- Use data tables where repositories need side-by-side comparison.
- Maintain clear loading, empty and API error states.

### Interaction

- Keyboard shortcut `/` focuses the account lookup, except when typing in another field.
- Escape closes mobile navigation.
- All actions use visible focus states and accessible labels.
- Only subtle entrance and hover transitions are included in V1.1. A coordinated Motion-based system is planned for V1.2, with support for reduced motion.
- Avoid continuous animations, exaggerated glow, or ornamental pulsing states.

### Component strategy

The new shell lives in `src/App.tsx`, with hash parsing isolated in `src/lib/navigation.ts`. The previous feature modules keep their individual logic and styles, neutralized for this design. Future releases will extract shell components and migrate each workspace to shared primitives in stages.

## Product language

Use action-oriented labels and explain data limitations near their values. Do not describe public metadata heuristics as vulnerability scans, security scores or machine-learning conclusions. Avoid generic filler headings and excessive marketing labels.
