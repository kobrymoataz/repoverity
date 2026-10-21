# Repository Advisor V0.5

**Scope: explainable recommendations about public repository metadata, with an optional, read-only inspection of common file locations.** This is not a vulnerability scanner, security audit, compliance assessment, license review, generative AI system or endorsement.

## How to use it

1. Enter a GitHub username and wait for the public portfolio to load.
2. Open **Repository advisor**, then select an eligible repository. Filter the list to those needing improvement if useful.
3. Review the **four metadata checks** and their specific recommendations.
4. Optionally select **Inspect repository files**. This triggers public GitHub Contents API calls for the selected project only.
5. Copy or download the Markdown improvement plan, then make substantive, real changes in GitHub.

No repository is modified by RepoVerity. RepoVerity cannot create stars, commits or badges.

## What the percentages mean

The indicator named **metadata coverage** is `25 × number of checks passed` and uses only four indicators:

| Check | Pass condition |
| --- | --- |
| Useful description | Trimmed public description is at least 25 characters |
| Discovery topics | At least two repository topics are published |
| Recognized license metadata | GitHub returns a non-null `license` field |
| Recent push | `pushed_at` is a valid timestamp in the previous 365 days, not in the future |

Equal weighting is a product choice, **not a statistically validated quality score**. A mature, stable repository can be excellent without recent commits or a website; these flags should be reviewed in context. Forks and archived repositories are excluded from aggregate assessment to avoid misleading comparisons. Aggregates are for **at most 100 recently updated owned public repositories** returned by the existing profile endpoint. Private projects and older public repositories outside the sample are not counted. Missing license metadata does not by itself prove that material is unlicensed or insecure.

## Optional structural checks

A file-presence check reads directory listings using up to **four** unauthenticated public REST requests:

- Repository root (`/contents`)
- `.github` directory, only if present
- `docs` directory, only if present
- `.github/workflows` directory, only if present

It detects common file names such as README, LICENSE/COPYING, CONTRIBUTING, SECURITY.md, CODE_OF_CONDUCT.md, CHANGELOG, .gitignore, Dependabot configuration and basic CI configuration. This is a **small heuristic over visible file and directory names only**; it does not read file contents or nested paths outside the locations specified above.

A positive result proves only that a *recognized file name was visible*. For example, a workflow file could be broken or disabled, a Dependabot config could be ineffective, and a SECURITY.md could contain bad guidance. A negative result can be a false negative if the project uses a different path or name. Some document-only or research projects have no reason to run CI or use a dependency updater. Suggestions are conditional advice, **not mandates**.

Failures, missing permissions, API rate limits or network errors do **not** produce a fabricated list of missing files. The UI explicitly shows the error and leaves structural recommendations unavailable. Results cache in memory for 10 minutes (up to 30 inspected repositories); the **Recheck structure** control refreshes the public API data. Nothing is written to your GitHub account. Inspections do not require a GitHub token.

## Privacy and trust

- Only data publicly accessible from GitHub is read.
- No credentials, telemetry server, backend, local account sync or background scan are added in V0.5.
- Inspection is **on demand**, not automatic for every repository listed on a profile.
- GitHub's unauthenticated API limits can interrupt the review.
- Exported Markdown is derived from the selected public snapshot, along with optional confirmed directory listing results. It is not a security report.
- Reported scores do not predict stars, follower growth or achievement eligibility.

## Roadmap

V1.0 will focus on reliability, accessibility, clearer error states and documented release processes. Any future model-assisted recommendations would require separate, explicitly disclosed integration and should never be presented as security findings without evidence.
