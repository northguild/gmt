# Slice 5 — workflow-and-docs: the swap jobs and the Dox section

Index: [index.md](index.md). Needs slice 3 (CLI, verdict paths) and slice 4 (`--force-swap-ready`).
Issue Scope 1, 5 and 6, and the design notes ("nothing joins ci.yml", "a failing swap job does
not fail the workflow", "CI opens an issue, never a pull request").

## `.github/workflows/temporal-oracle.yml`

### Header comment

Add one paragraph after the native-suite paragraph:

> The polyfill-swap job (CORE-92) runs the same suite on the newest `temporal-polyfill` release,
> through `temporal-polyfill/full/implementation`, beside a control pass on
> `@js-temporal/polyfill` in the same runtime. The Node leg also compares every zone's offset with
> `Intl.DateTimeFormat`, once a day from 1970 to ten years ahead. When every leg passes and no zone
> differs, the report job opens one issue saying the swap is due. A failing swap leg never fails
> the workflow.

### Dispatch inputs

```yaml
swap_version:
  description: "Run the swap check on this exact temporal-polyfill version (e.g. 1.0.7) instead of the latest"
  type: string
  required: false
  default: ""
force_swap_ready:
  description: "Dry run: file a [dry run] issue as if the temporal-polyfill swap were ready"
  type: boolean
  required: false
  default: false
```

### Job `swap-version`

`name: Temporal polyfill version`, `runs-on: ubuntu-latest`, `timeout-minutes: 5`, no checkout
needed. One step with `id: pick`. If `inputs.swap_version` is not empty, use it; otherwise use
`npm view temporal-polyfill version`. Reject anything not matching `^[0-9]+\.[0-9]+\.[0-9]+$`
(the step exits 1). Write `version=<x.y.z>` to `$GITHUB_OUTPUT`. Job output
`version: ${{ steps.pick.outputs.version }}`. Pass the input through `env:`, never inline
`${{ }}` in `run:` (script-injection rule, as the report job already does).

### Job `polyfill-swap`

```yaml
polyfill-swap:
  name: Temporal polyfill swap (${{ matrix.leg }})
  needs: swap-version
  runs-on: ubuntu-latest
  timeout-minutes: 45
  continue-on-error: true
  strategy:
    fail-fast: false
    matrix:
      leg: [node, chromium, firefox, webkit]
```

Steps, in the same order and with the same actions and versions as `native-suite`:

1. `actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v7` (Node 26,
   `check-latest`, pnpm cache).
2. `pnpm install --frozen-lockfile --no-runtime`.
3. **Install temporal-polyfill**:
   `pnpm --filter @northguild/gmt add -D --save-exact "temporal-polyfill@$VERSION"`, with
   `VERSION` from `needs.swap-version.outputs.version` through `env:`. This changes
   `package.json` and the lockfile only in the job's checkout. Nothing commits or pushes them.
4. Install Playwright for browser legs (the `native-suite` step, unchanged).
5. **No build step.** The native suite builds only for its compat check, which this job does
   not run. There is no `tsc` (issue Scope 3).
6. `node scripts/polyfill-swap.mjs "$LEG" --version="$VERSION"`. Copy the resource-logging
   wrapper from `native-suite` for browser legs, since the same browsers can outgrow the runner.
7. Job summary (`if: always()`): `node scripts/polyfill-swap.mjs summary "$LEG" >> "$GITHUB_STEP_SUMMARY"`.
8. Upload the verdict (`if: always()`): name `temporal-polyfill-swap-${{ matrix.leg }}-${{ github.run_id }}`,
   path `artifacts/temporal-polyfill-swap-*.json`, `if-no-files-found: warn`.
9. Upload the pass reports (`if: always()`): name `temporal-polyfill-swap-${{ matrix.leg }}-reports`
   (no run-id suffix, so the report job's download skips it, like `native-suite-<leg>-reports`),
   path `artifacts/native-suite-*.vitest.json`, `retention-days: 14`,
   `if-no-files-found: ignore` (owner question 4).

The job's `permissions` match `native-suite` (read only).

### Job `report`

- `needs: [oracle, native-suite, polyfill-swap]`. `if: ${{ !cancelled() }}` already lets it run
  after a failed or skipped job. If `swap-version` fails, `polyfill-swap` is skipped, the report
  runs, and the four swap verdicts are missing. They are listed in the workflow's existing
  `temporal-oracle/could-not-run` issue (slice 4), the same as a missing native-suite verdict.
  A swap leg that ran and is not swap-ready files nothing; `continue-on-error` keeps the job
  green either way, so the verdict and that issue are the only signals.
- **Download verdicts**: extend the first `awk` with
  ```awk
  /^Temporal polyfill swap \(/ {
    leg = $1; sub(/^Temporal polyfill swap \(/, "", leg); sub(/\)$/, "", leg)
    print "temporal-polyfill-swap-" leg "-" run, $2
  }
  ```
  and the comment above it ("the `name:` fields of the oracle, native-suite and polyfill-swap
  jobs"). The rerun rules (skip an artifact uploaded before its job started; newest artifact per
  name when the job list is unavailable) then apply to the swap artifacts unchanged.
- **Open or update canary issues**: add `FORCE_SWAP_READY: ${{ inputs.force_swap_ready }}` to
  `env` and `if [ "$FORCE_SWAP_READY" = "true" ]; then args+=(--force-swap-ready); fi`.

### Must not change

`ci.yml`, the `validate` gate, the cron (`17 6 * * 1`), the `oracle` and `native-suite` jobs, and
the report job's permissions.

### Check

`actionlint` on the file, if the repo runs it (look for it in `package.json` scripts or
`ci.yml`). Otherwise `node -e` YAML parse through the repo's existing YAML dependency.
Check every job `name:` the awk matches, character for character.

## `apps/dox/src/content/docs/upstream.mdx` (issue Scope 6)

Replace the body of "Why this polyfill" (from "There are two Temporal polyfills" to the research
link) with the text below. Today it describes 1.0.6 and says the reports are pending; both are
out of date. Facts: research §1, §3, §4 and §4.4.

> There are two Temporal polyfills: [`@js-temporal/polyfill`](https://github.com/js-temporal/temporal-polyfill),
> which GMT uses, and [`temporal-polyfill`](https://github.com/fullcalendar/temporal-polyfill) from
> FullCalendar, which is smaller and publishes releases more often. We ran GMT's whole test suite on
> `temporal-polyfill` to see whether GMT should switch.
>
> Release 1.0.7 fixes most of the bugs in the table above, and the three bugs we reported in 1.0.6.
> Its UTC offsets match `Intl.DateTimeFormat` in every time zone, on every day from 1970 to ten
> years ahead. Two bugs are left, and we have reported both:
>
> - **Looking back from far ahead.** Asked for the last clock change before a date more than about
>   three years from today, it returns an older one. From June 2030 in `America/New_York`, it
>   returns the change in November 2029, not the one in March 2030. Twelve of GMT's tests fail on
>   this.
> - **Before 1847.** It does not find clock changes before 1847, such as `Asia/Manila` on
>   31 December 1844. GMT already works around the same bug in `@js-temporal/polyfill`.
>
> So GMT stays on `@js-temporal/polyfill`. Every week, GMT runs its whole test suite on the newest
> `temporal-polyfill` release in Node and three browsers, and checks every zone's offsets against
> `Intl.DateTimeFormat`. A release that passes both opens an issue in GMT's repository, and that
> issue starts the switch. See the
> [weekly runs](https://github.com/northguild/gmt/actions/workflows/temporal-oracle.yml). The full
> comparison is in GMT's repository:
> [`temporal-polyfill-swap.md`](https://github.com/northguild/gmt/blob/main/context/domination/research/temporal-polyfill-swap.md).

Keep the heading and the link targets. The text names release 1.0.7, so it stays true when a
later release appears; the weekly check is present tense, because the job exists from the moment
this change merges. No date, no "currently", no "for now". Run `/plain-english` over it. The
reports themselves appear in the tracker below the section (slice 6); do not list them here.
"We sent them to two places" further down is about the `@js-temporal/polyfill` bugs and stays.

This is the only Dox page change: no tool and no generated file, so the spec stays `dox: none`.
The Dox build and link check must pass (`pnpm --filter @gmt/dox check` or the repo's equivalent).

## Acceptance (owner, after merge)

Dispatch the workflow with `swap_version: 1.0.7`. Expect every swap leg to be green as a job
(`continue-on-error`), and the Node summary to show 12 swap-only failures (research §4.4, #125)
and 0 zones. Each browser leg should show the same 12, because #125 is in the polyfill's own
code. Only the probes, not the suite, have run in browsers on 1.0.7 (research §3), so explain any
other swap-only failure there. No swap issue and no could-not-run issue should be filed. Dispatch once with
`swap_version: 1.0.6`: the Node summary lists research §4.3's 11 zones, which proves the sweep
still finds a real defect. Then dispatch with `force_swap_ready: true`, which should file one
`[dry run]` issue to close by hand.
