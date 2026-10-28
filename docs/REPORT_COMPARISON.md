# RepoVerity 2.1 | Evidence Comparison Studio

This improvement extends V2.1's existing Developer Tools. It does not alter public scan endpoints, OAuth, Cloudflare, the V1.9 Action tag, or the JSON schema produced by `scanCore.mjs`.

## Why compare reports?

A single audit provides an evidence snapshot; comparing two snapshots helps identify maintenance signals that changed. The comparison is intentionally conservative:

- A `pass` to `review` transition is an observed **regression** in this particular metadata check, not proof of a vulnerability.
- A `review` to `pass` transition is a **resolved review finding**, not a security certification.
- A prior `unknown` or `info` transition to `review` is a **new review finding**, not a verified regression.
- Missing or `unknown` evidence is **never an improvement**.
- Added and removed check IDs are reported separately and are never counted as improvement or regression.
- Statuses that remain the same but whose evidence text changes are identified as evidence updates.

## Browser workflow

1. Open **Developer Tools** at `#/tools`.
2. Export a RepoVerity audit as JSON and keep the file locally.
3. On a later date, run the same audit again or export a new JSON report.
4. In **Audit Comparison Studio**, load the previous JSON. The latest on-demand scan is selected automatically when one exists; alternatively import the newer JSON.
5. Examine the regressions and new review findings. Export the comparison as Markdown or JSON.

No report is sent to a third party. Uploaded reports are parsed locally and kept in memory only until the browser page is reloaded. The studio does not write to localStorage, indexedDB, D1 or GitHub. The ordinary on-demand audit, if chosen, still calls the public GitHub REST API, exactly as before.

Reports must use `schemaVersion: 1`, contain 1 to 150 checks with unique identifiers and matching summary counts, refer to the same normalized repository and have ISO UTC timestamps in ascending order. Each imported file is limited to 512 KB.

## CLI

```bash
node tools/compare.mjs previous.json current.json
node tools/compare.mjs previous.json current.json --format json --output comparison.json
node tools/compare.mjs previous.json current.json --format markdown --output comparison.md
node tools/compare.mjs previous.json current.json --fail-on-regressions
```

CLI exit codes: `0` for a valid comparison without an explicitly triggered gate, `1` for invalid input or I/O errors, and `2` for confirmed `pass` to `review` findings **only when** `--fail-on-regressions` is explicitly selected. The default is advisory. An existing output file is never overwritten; output must be inside the working directory.

You can create the two inputs with the existing CLI:

```bash
node tools/cli.mjs scan kobrymoataz/repoverity --format json --output previous.json
# On another date:
node tools/cli.mjs scan kobrymoataz/repoverity --format json --output current.json
node tools/compare.mjs previous.json current.json
```

## Tests and production behavior

`npm run test:release` discovers the new Node.js tests automatically. `npm run test:e2e` opens Chromium, imports two local reports into the browser, verifies the resulting classification and tests the 390px viewport. The browser harness uses an explicit loopback CDP port, reports Chrome stderr when startup fails, terminates processes on failure and limits the CI E2E step to 3 minutes. No third-party JavaScript or new npm dependency is required.

The comparison cannot infer why a status changed, validate source-code security, detect private infrastructure drift or turn incomplete API responses into a score. Comparisons use the evidence fields recorded at each timestamp, not a background monitoring system.
