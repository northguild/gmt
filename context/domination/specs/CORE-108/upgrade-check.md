# Slice 4 — The swap job becomes the upgrade check

CORE-92's weekly job ran the suite on `@js-temporal/polyfill` (control) and `temporal-polyfill`
(swap). After slice 2 the control *is* `temporal-polyfill` at the pinned version, so the job checks
the newest `temporal-polyfill` release (the candidate) against the pin, on Node, Chromium, Firefox
and WebKit, and opens one issue when the candidate passes every leg. Mechanism and verdict rules stay
CORE-92's ([CORE-92 index](../CORE-92/index.md), Corrections 2–3); this slice changes what is compared.

**Names stay.** `scripts/polyfill-swap.mjs`, `vitest.swap.config.ts`, the verdict sources
`temporal-polyfill-swap-<leg>` and the issue key `temporal-polyfill-swap/ready` keep their names: the
job still swaps the implementation behind the seam, and a stable key keeps an open issue matched.
Only behaviour and text change.

## Candidate install (job only, never committed)

The candidate cannot be installed as `temporal-polyfill`: that would replace the pinned control.
Install it under an npm alias in the job's checkout:

```sh
npm pkg set --prefix packages/gmt \
  "devDependencies.temporal-polyfill-candidate=npm:temporal-polyfill@$VERSION"
pnpm install --no-runtime --no-frozen-lockfile
```

`CANDIDATE_ENTRY = "temporal-polyfill-candidate/full/implementation"` replaces `SWAP_ENTRY` in
`polyfill-swap.mjs`, `vitest.swap.config.ts` (alias `^temporal-polyfill\/full\/implementation$` →
`CANDIDATE_ENTRY`, env `GMT_SWAP_ENTRY: CANDIDATE_ENTRY`), `vitest.browser.config.ts`, and
`src/test/boundedChild.ts` (its resolve hook maps the seam's specifier to `GMT_SWAP_ENTRY`). Keep
`--fsModuleCache=false` on every pass (research § 7).

`src/test/swapEntry.ts` imports `CANDIDATE_ENTRY` to prove the swap pass ran the candidate's own
`Temporal` object. Outside the job that module does not resolve, so `src/test/hostModules.d.ts` gains
`declare module "temporal-polyfill-candidate/full/implementation"` (a name no real package uses, so,
unlike CORE-92's block deleted in slice 2, it hides nothing). `optimizeDeps.exclude` keeps excluding it
outside the swap pass.

## Browser modes

`vitest.browser.config.ts` `MODES`: `""` (native), `"polyfill"` (control: the pinned package, no
alias), `"candidate"` (was `"temporal-polyfill"`, which is now ambiguous). `native-suite.mjs`
`passSetup` and its tests follow. The error message lists the three modes.

## Version pick (`swap-version` job)

- No input: `npm view temporal-polyfill version`. Read the pin from `packages/gmt/package.json`
  (`dependencies["temporal-polyfill"]`). Equal → output `skip=true`; the four legs skip and the
  report files nothing (nothing to upgrade). The job summary says "pinned X is the newest release".
- `swap_version` input set: use it even when it equals the pin (a manual self-test of the job).
- Keep the `x.y.z` check.

## Compat check in the browser (`scripts/lib/native-suite-compat.mjs`)

The compat page loads `dist/internal/temporalCompat/{repros,capabilities}.js`, which import the seam,
which imports `temporal-polyfill/full/implementation`. That entry imports `../chunks/*.js` and
`temporal-utils/protected*`. Replace the `@js-temporal/polyfill` + `jsbi` import map with one entry:
bundle `temporal-polyfill/full/implementation` (resolved from `packages/gmt`) with esbuild into a
single ESM file in memory (`bundle: true, format: "esm", write: false`), serve it at `/polyfill.js`,
and map `{ "temporal-polyfill/full/implementation": "/polyfill.js" }`. No `jsbi`. Update
`apps/dox/scripts/canary/native-suite-compat.test.ts` (it names `jsbi` and the old map).
This part is needed by slice 3 Step 1; do it first if slice 3 runs before the rest of this slice.

## Text

| File | Change |
| ---- | ------ |
| `.github/workflows/temporal-oracle.yml` | Header comment and step names: "upgrade check: newest `temporal-polyfill` against the pin"; the install step uses the alias above; `swap-version` gains the skip output and `if:` on the legs |
| `scripts/polyfill-swap.mjs` | Header: control = pinned `temporal-polyfill`, swap = candidate; usage unchanged |
| `scripts/native-suite.mjs` | Header line 8 ("once on @js-temporal/polyfill (the control)") and the compat summary line name `temporal-polyfill` |
| `scripts/lib/canary-issues.mjs` | Swap-ready issue (≈ lines 1069–1251): title and body say "`temporal-polyfill` X passes on every runtime against the pinned Y: raise the pin in `packages/gmt/package.json`", with the steps (edit pin, `pnpm install`, `pnpm compat`, remove what turns removable, budgets). Line 110 and every other "@js-temporal/polyfill" that describes GMT's runtime → `temporal-polyfill`. The research link stays (history) |
| `scripts/lib/canary-summary.mjs`, `scripts/lib/canary-verdict.mjs` | Same wording |
| `apps/dox/scripts/canary/*.test.ts` | Expected strings follow; no assertion is dropped |
| `scripts/upstream.mjs` | No change: it keeps tracking `js-temporal/temporal-polyfill`, `tc39/proposal-temporal` and `fullcalendar/temporal-polyfill`, so every filing stays listed |

`scripts/lib/offset-sweep.mjs` runs on the candidate on the Node leg, unchanged.

## Tests

- `native-suite.mjs` `passSetup` rows: `("chromium","swap")` → `{ GMT_TEMPORAL: "candidate" }`;
  `("node","swap")` → `vitest.swap.config.ts`.
- `vitest.browser.config.ts` with `GMT_TEMPORAL=temporal-polyfill` throws the mode error.
- canary-issues: the swap-ready fixture produces the new title and body; `--force-swap-ready` still works.
- version pick: a script-level unit (or the workflow's shell) for pin == newest → skip; input given →
  no skip.
- After merge (post-merge CI checks): dispatch `temporal-oracle.yml` with `swap_version` = the pin.
  Every leg must run and report swap-ready; then close the issue it opens, which says the pin is
  already that version.

## Done when

CI green; the four `polyfill-swap` legs run locally (`node scripts/polyfill-swap.mjs node --version=1.0.8`
after the alias install, reverted afterwards) with the candidate equal to the pin and report swap-ready.
