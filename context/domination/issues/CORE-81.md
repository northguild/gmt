# CORE-81 — Core: Weekly Temporal oracle and leap-second canary open issues, not just write logs

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

## Decisions

Current rules for the canary reporting, with the reason for each.

- **A guard holds through a released version, never a date.** A `WORKAROUNDS` entry may declare
  `guard: { package, through, reason }`. State per group: any probe fails, `still-needed`; every
  probe passes and the installed `package` is at or before `through` (SemVer 2.0.0 §11 precedence,
  build metadata ignored), `guard`; otherwise `removable`, with a "guard lapsed, confirm the
  release" note. A version that cannot be compared throws, so `check` exits 2: an undecidable
  guard is never reported as removable. Why: D10's probes cannot fail on `@js-temporal/polyfill`
  0.5.1, which predates tc39/proposal-temporal#3292, and no probe tells a pre-#3292 polyfill from
  a fixed one. Only a release fact can. D10's guard holds through 0.5.1, and `through` moves only
  when a person confirms a later release still lacks #3292.
- **A guard or a still-needed workaround is never a finding.** Only a `removable` group opens an
  issue, and `--fail-on-removable` ignores guards.
- **One `canary` issue per finding key, matched by a hidden marker.** The body's first line is
  `<!-- gmt-canary key="<key>" -->`; an open `canary` issue whose first line equals it exactly
  gets a comment, otherwise a new issue opens, and no finding means no action. Whole-line
  equality keeps `D1` from matching `D10`, and real keys from matching `dry-run/` ones. With
  several matches the oldest gets the comment, so the choice is deterministic. A finding whose
  issue a person closed opens a new one. Keys: `temporal-compat/removable/<ids joined by +>`,
  `temporal-oracle/untagged-mismatch` (also labelled `bug`), `leap-seconds/table-difference`,
  `<workflow>/could-not-run`.
- **A finding that persists gets a comment on every run.** An open finding is pending work, and the
  weekly comment is its reminder. Deduplicating by content would also make a second dry run do
  nothing.
- **A canary that cannot run is a finding.** A missing verdict file or exit 2 files one
  could-not-run issue per workflow, listing every source that did not run. A silent failure to run
  hides findings as surely as a silent pass.
- **Dry runs file real issues under `dry-run/` keys.** A forced finding is labelled
  `canary-dry-run`, titled `[dry run]`, and never touches a real issue; a person closes it after
  checking. Only a real issue proves the open-then-comment path end to end. Forcing a source that
  did not run is dropped with a message, so a dry run never hides a real could-not-run finding.
- **An oracle verdict carries at most 50 untagged rows.** That keeps an issue body far below any
  size limit while naming enough rows to start. The full list stays in the dated oracle report.
- **Verdict files are written on every run, before any exit.** Fixed names under `artifacts/`
  (`temporal-compat-check.json`, `temporal-oracle-verdict.json`, `leap-seconds.json`), each
  `{ source, status: "ran" | "could-not-run", … }`, with no timestamp so the files stay
  deterministic. The run link dates them.
- **The snapshot carries the state; the Dox page never derives it.** `temporal-compat.json` keeps
  every field and gains `state` per row and `guard` on a guarded row, from the same
  `workaroundState`, so the `/upstream/` page cannot call D10 "No" while `check` says GUARD.
- **Write scope sits on the reporting job only.** The `oracle` job stays `contents: read`; the
  `report` job has `issues: write` and runs `if: ${{ !cancelled() }}`. Dispatch inputs reach the
  shell only through `env:`. The reporter uses Node built-ins and no `Date`, so
  `leap-seconds.yml` stays install-free.
- **The canary tests run in the Dox Vitest project** (`apps/dox/scripts/canary/`). It already
  includes `scripts/**/*.test.ts`, runs inside `validate` and CI, and its no-network preload proves
  the decision code is offline.

| Rule | Source |
| --- | --- |
| Version order and build metadata | SemVer 2.0.0 §11, §10 |
| Token permissions, `GH_TOKEN` for `gh`, least access per job | GitHub Docs, Use GITHUB_TOKEN for authentication in workflows |
| Inputs through `env:` | GitHub Docs, Script injections |
| `!cancelled()` runs after a failed job | GitHub Docs, Expressions § Status check functions |
| Hidden marker renders nothing; `\|` escaped in a table cell | GFM spec 0.29-gfm §4.6, §4.10 |
| Leap-second difference and header line | IERS `Leap_Second.dat` and Bulletin C |
| Marker match, oldest first, `dry-run/` keys, 50-row cap, weekly comment, could-not-run | **GMT rule** |
