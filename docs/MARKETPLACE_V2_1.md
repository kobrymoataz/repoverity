# RepoVerity V2.1 | Action Workflow Builder

The V2.1 workflow generator helps a developer create an optional `.github/workflows/repoverity-audit.yml` file for a **public** GitHub repository. It does not install, run, publish, or deploy any workflow on its own. The GitHub Action checks observable repository maintenance evidence, not source-code vulnerabilities or compliance.

## Use the visual builder

Open `https://kobrymoataz.github.io/repoverity/#/tools`, find **GitHub Action workflow builder**, then select:

- Current repository or a specific public `owner/repo` slug.
- The previously published `v1.9.0` Action tag, the future `v2.1.0` tag only after publication, or a reviewed full 40-character commit SHA.
- A manual `workflow_dispatch` trigger by default, or both manual and pushes to the `main` branch.
- Optional sampling of recent Actions runs, with `actions: read` permission.
- An optional failing review gate. By default findings remain advisory.
- An optional JSON report artifact with 7-day retention.

Select **Copy workflow** or **Download YAML**. Review the exact generated file and add it to your chosen repository under `.github/workflows/`. Do not grant the workflow write permissions without independently reviewing the integration. Untrusted repository text is rejected as a YAML input.

## Use the Terminal generator

Node.js 22.12 or newer is required.

```bash
node tools/workflow.mjs --help
node tools/workflow.mjs
node tools/workflow.mjs --repo octocat/Hello-World --include-runs --artifact
node tools/workflow.mjs --repo octocat/Hello-World --trigger main-push --strict --output repoverity-audit.yml
```

By default, output is printed to stdout. `--output` creates a new relative `.yml` or `.yaml` file beneath the current working directory, refusing overwrites, traversal and symlinked escape paths. The parent directory must already exist. All input values are validated before a file can be opened.

## Example generated workflow

```yaml
name: RepoVerity public repository audit
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  audit:
    runs-on: ubuntu-24.04
    timeout-minutes: 8
    steps:
      - name: RepoVerity evidence audit
        uses: kobrymoataz/repoverity@v1.9.0
        with:
          repository: ${{ github.repository }}
          github_token: ${{ github.token }}
          include_runs: 'false'
          fail_on_review: 'false'
          output_path: repoverity-report.json
```

## Tagging and Marketplace publication

The audited source includes a published `v1.9.0` Action tag and release. At V2.1 package generation time, `v2.1.0` **does not exist**, so consumers should use the stable tag until a new reviewed release is published. GitHub recommends SHA pinning for stricter action immutability, and semantic tags for regular release management. Do not re-point published immutable release tags.

GitHub Marketplace publication remains a separate owner-controlled process requiring Developer Agreement acceptance, a valid unique action name, and two-factor authentication. The primary repository includes a full web platform, not only an Action. Consider isolating the Action into a dedicated repository long term, after planning backwards compatibility for existing `uses:` references.

Official docs: [Publishing actions](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace) and [Release and maintain actions](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/release-and-maintain-actions).
