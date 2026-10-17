# CORE-81 — Core: Weekly canaries open issues

**Scope:** Make the weekly Temporal oracle and the leap-second canary report through GitHub issues instead of run logs nobody reads, and stop the compat check calling a guard removable. Adds no function and changes no output.

## Gap

`.github/workflows/temporal-oracle.yml` runs every Monday. It runs `pnpm compat`, which reports which `@js-temporal/polyfill` workarounds are still needed, and `pnpm compat:oracle`, which compares about 410,000 GMT results with Chromium's native Temporal. The output is a run log and an uploaded artifact.

- **Nobody is told.** A run fails only on an untagged oracle mismatch, and GitHub then emails only the person who last edited the cron line. A removable workaround never fails the run, by design, so it stays silent.
- **The check reports a false positive.** D10's probes pass on the current polyfill because 0.5.1 predates tc39/proposal-temporal#3292. The group guards against a port of #3292 without the #3329 fix, so it must stay. `check` still prints `REMOVABLE` with its removal steps, and counts it in "N of M workarounds removable".
- **The leap-second canary has the same gap.** `.github/workflows/leap-seconds.yml` fails its run when IERS lists a row GMT does not, and nothing else happens.

## Scope

In build order. Each part leaves `pnpm run validate` green on its own.

1. **Guard state.** A workaround in `scripts/temporal-compat.mjs` can declare that its probes pass by design until an upstream version event. `check` prints it as `GUARD`, with its trigger and no removal steps, and leaves it out of the removable count. D10 is the first.
2. **JSON result.** `check` and `oracle` write their verdicts to `artifacts/` as JSON next to the existing oracle output: per workaround its state and trigger, and per oracle run the untagged mismatches. `scripts/leap-seconds.mjs check` writes its differences the same way.
3. **Issue step.** A script read by a final workflow step (`if: always()`, `issues: write`) turns the JSON into issues:
   - one issue per workaround that becomes removable, with its trigger and removal steps;
   - one `bug` issue for any untagged oracle mismatch, listing the rows;
   - one issue for a leap-second table difference, with the IERS header line;
   - a comment on the matching open issue instead of a duplicate, matched by a label and a hidden marker carrying the defect id;
   - nothing when nothing changed.
4. **Job summary.** Every run writes still needed, removable, guard and mismatch counts to `$GITHUB_STEP_SUMMARY`.
5. **Snapshot reminder.** A removable-workaround issue says when `pnpm compat:snapshot` is due for `apps/dox/src/data/temporal-compat.json`.

## Design notes

- **Builds stay green whatever upstream does.** Nothing joins `ci.yml` or `validate`. The existing exit codes keep their meaning.
- **A person removes a workaround.** CI opens issues, never PRs. Each removal has its own steps and a dependency floor bump.
- **The issue script is a pure function plus a thin `gh` call.** Deciding which issues to open or comment on takes the JSON and the open issues, and returns a list of actions. It is unit-tested without the network.
- **No new service or secret.** The workflow's own `GITHUB_TOKEN` is enough.

## What gmt provides (do not re-implement)

- `scripts/temporal-compat.mjs` — `WORKAROUNDS` with each trigger and removal steps, and the oracle's tagged-mismatch list
- `scripts/leap-seconds.mjs` — the IERS comparison and its header line
- `scripts/lib/format-json.mjs` — the repo's JSON formatting

## Verification

- A manual `workflow_dispatch` run on today's polyfill reports D10 as `GUARD` and opens no issue.
- A dry run with one workaround forced removable opens exactly one issue. A second run comments on it instead of opening another.
- A forced oracle mismatch opens one `bug` issue. A forced leap-second difference opens one issue.
- The decision script's tests cover open, comment and no-op.
- `pnpm run validate` stays green.
