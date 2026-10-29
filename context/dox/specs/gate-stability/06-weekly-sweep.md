# Slice 6 — weekly sweep, and close-out

The sweep runs once a week. It files one issue per finding, keyed on slice 1's `target`, and
labels each issue `dox-gate` only. The workflow stays disabled after merge. Only the owner turns
it back on.

## Workflow

Rename `.github/workflows/dox-gates-nightly.yml` → `.github/workflows/dox-gates-weekly.yml`. In the
renamed file:

- `name: Dox gates weekly`; concurrency group `dox-gates-weekly`.
- `schedule:` keeps one cron, the Sunday one (`"41 4 * * 0"`). Delete the daily `"23 4 * * *"`.
- Delete the `decide` job.
  - The `sweep` job loses `needs: decide` and its `if:`.
  - The `report` job becomes `needs: [sweep]` with `if: ${{ !cancelled() }}`.
- Delete the `force` dispatch input, which only the skip rule read. Keep `force_finding`.
- Rewrite the header comment for a weekly run with no skip rule. Keep the leg, shard and
  `missingSummary` paragraphs. The step names `issue-plan.mjs` reads stay byte-identical.
- `--tier nightly` → `--tier weekly` in the legs' command.
- Delete `apps/dox/scripts/gates/nightly-decide.mjs` and `nightly-decide.test.ts`. Delete any
  import of them: `grep -rn 'nightly-decide' apps .github scripts`.

**Keeping it disabled.** GitHub tracks a workflow by its path, so the renamed file registers as
a new workflow, and a new workflow is enabled. The disabled `Dox gates nightly` entry
(`disabled_manually`) goes with the old path. So the **first post-merge step** is
`gh workflow disable dox-gates-weekly.yml`. If the merge lands on a Sunday before 04:41 UTC, run
it before then. The definition of done lists this step for the main session. Claude runs it
after the owner merges, as part of the post-merge checks. Claude never re-enables the workflow.

## Tier rename

- `apps/dox/scripts/gates/registry.mjs`:
  - `TIERS = ["pr", "weekly", "local"]`;
  - the JSDoc type and the comment on line 6;
  - the three `tier: "nightly"` gates (`canada-clock-still`, `canada-stored-still`,
    `table-fit`).
- `registry.test.ts`: "nests the tiers: pr < weekly < local", and `at("weekly")`.
- `apps/dox/scripts/gates.mjs`: the usage text (lines 8 and 70). `--tier nightly` is no longer
  accepted and exits through `usage()`; add a test.
- Comments in `findings.mjs`, `issue-plan.mjs` and `file-issues.mjs`: "nightly" → "weekly".
  Change the issue titles at `issue-plan.mjs:287-289` to "Dox weekly …", and the label
  descriptions in `file-issues.mjs:44-52`.
- `file-issues.test.ts:239` and the workflow-name constants comment at `issue-plan.mjs:36` point
  at `dox-gates-weekly.yml`.
- `.github/workflows/ci.yml`:
  - line 33: delete the clause about the change check, which no longer exists;
  - line 279: "covered by the weekly sweep".
- Then `grep -rn 'nightly' apps/dox/scripts .github context/dox` prints nothing. Lines in this
  spec folder are the exception; the spec folder is deleted at close.

## Labels: `dox-gate` only

- `issue-plan.mjs`:
  - delete `BUG_LABEL`;
  - every `labels: [BUG_LABEL, GATE_LABEL]` becomes `[GATE_LABEL]`, at lines 308 and 382;
  - the dry run stays `[DRY_RUN_LABEL, GATE_LABEL]`;
  - fix the comment on line 22.
- `file-issues.mjs`:
  - drop `BUG_LABEL` from the import and from `LABEL_SPECS`;
  - line 3: "as `dox-gate` issues".
- Tests:
  - `file-issues.test.ts:156` expects `["dox-gate"]`;
  - add an assertion that no planned action ever carries `bug`.
- `ISSUE_TYPE` is removed as well (the GitHub issue type `Bug`). A weekly-sweep issue carries only
  the `dox-gate` label and no type; `file-issues.mjs` passes no `--type`.
- The one-issue-per-finding behaviour, `FLOOD_LIMIT` and the dedupe by `marker()` stay. The dedupe
  now matches on `keyOf`'s `target` key (slice 1).

## Close-out

Update `context/dox/built.md`. Write it in present tense, with no dates and no "this PR". Give
each change its decision plus a one-line reason.

- **Gates** (lines 1848–1953):
  - locators by role and name inside `[data-widget]`;
  - the `data-testid` list from slice 3, and why it exists;
  - `--resolve-only`;
  - `table-fit` finding unbreakable pieces by computed style;
  - the tier names `pr` < `weekly` < `local`, at lines 1889, 1893 and 1909;
  - the content-table `table-layout` scope.
- **A11y gates** (around line 2998):
  - the identity key replaces CSS paths;
  - `emulation-not-applied`;
  - the full `focus-obscured` facts;
  - `data-starter`.
- **Run the gates** (around line 3027):
  - `--tier pr|weekly|local`;
  - local runs are Chromium on macOS; WebKit, Firefox and Linux come from the weekly run.
- **The weekly gate sweep** (replaces "The nightly gate sweep", around line 3081):
  - Sundays only, with no skip rule;
  - the key is `<gate>:<rule>:<page>:<target>` in the identity grammar;
  - the label is `dox-gate` only;
  - the workflow is disabled until the owner enables it;
  - Claude dispatches and triages a run after a merge.
- **Owed verification** (around line 3189): the Firefox and WebKit legs, and the Linux
  `contrast-measure` run, are owed to the first weekly run after merge.
- **Tier 2:** every widget root carries `data-widget` and a named region.

Update `context/dox/reference/verification-and-risks.md`:

- lines 27, 33 and 35: weekly, `dox-gates-weekly.yml`, and the renamed Runbooks entry;
- the Keyboard, Contrast and a11y bullets name the identity key;
- add a live risk: a widget root without `data-widget` breaks scoping. The slice-2 test guards
  it.

No `tracker.md` row. Run `pnpm deps:sync` only if a tracked file changed.

## Done

- `pnpm test` passes.
- `node scripts/gates.mjs --plan --tier weekly --all --no-build` lists `canada-clock-still`,
  `canada-stored-still` and `table-fit`.
- `--tier nightly` exits 2.
- `node apps/dox/scripts/gates/file-issues.mjs --print <a summary.json from the slice runs>`
  shows `labels: ["dox-gate"]` and `target`-based markers.
- `actionlint` (if installed) or `gh workflow view` parses the YAML locally. Do not push to test
  it.
