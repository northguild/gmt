# CORE-92 — Core: Weekly check for a `temporal-polyfill` release GMT can swap to

**Scope:** Add a job to the weekly Temporal oracle run that tests the latest `temporal-polyfill` release
against the whole `packages/gmt` suite, on Node and in the native suite's browsers, and opens an
issue when it passes everywhere. Adds no function and
changes no output. The findings behind it are in
[research/temporal-polyfill-swap.md](../research/temporal-polyfill-swap.md).

## Gap

GMT stays on `@js-temporal/polyfill` because `temporal-polyfill` 1.0.6 fails 102 GMT tests in three
defect classes (research § 4), and has D19 in WebKit (research § 3). Nothing tells us when a release fixes them, and checking by hand on
every release is the kind of watch nobody keeps.

## Scope

1. **Swap job.** A new job in `.github/workflows/temporal-oracle.yml` installs the latest
   `temporal-polyfill`, points `src/internal/temporal.ts` at `temporal-polyfill/full/implementation`
   in the job's checkout only, and runs the `packages/gmt` suite on Node and in Playwright
   Chromium, Firefox and WebKit, the way the native suite's control pass runs it. It writes a
   `temporal-polyfill-swap` verdict to `artifacts/` as JSON: the version tested, and for each
   runtime the pass and fail counts and the failing test names.
2. **Type errors do not decide.** The suite runs without `tsc`. The missing helper type names
   (research § 5) are swap work, not a sign the release is wrong.
3. **Issue.** The report job turns the verdict into one issue when every test passes in every
   runtime, naming the
   version and linking the research record. While it stays open, a later passing run comments
   instead of opening a duplicate, the way CORE-81's issues do. A failing run files nothing.
4. **Job summary.** Every run writes the version tested and each runtime's fail count to
   `$GITHUB_STEP_SUMMARY`.
5. **Dox.** The "Why this polyfill" section of `/upstream/` says the check runs every week and links
   the workflow.

## Design notes

- **Browsers count.** D17, D18 and D19 show only in a browser, and 1.0.6 passes on Node yet fails
  the D19 probe in WebKit. A Node-only pass would open a wrong issue.

- **Builds stay green whatever upstream does.** Nothing joins `ci.yml` or `validate`, and a failing
  swap job does not fail the workflow.
- **A person makes the swap.** CI opens an issue, never a PR.
- **Reuse CORE-81's issue script.** The verdict is one more finding kind for its pure decision
  function, unit-tested without the network.

## What gmt provides (do not re-implement)

- `.github/workflows/temporal-oracle.yml` and its report job
- The CORE-81 issue script and its finding-key markers
- `src/internal/temporal.ts`, the only file that names the implementation
