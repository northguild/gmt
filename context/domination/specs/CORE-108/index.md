---
story: CORE-108
issue: 460
status: approved
dox: context/dox/specs/core-108/index.md
---

# CORE-108 — Move GMT onto `temporal-polyfill`

## Scope

Story: [`issues/CORE-108.md`](../../issues/CORE-108.md) (#460). Evidence:
[`research/temporal-polyfill-swap.md`](../../research/temporal-polyfill-swap.md) § 5 (cost) and § 7
(design notes). Prior art: [CORE-92](../CORE-92/index.md) (the swap job this story turns into an
upgrade check).

`@northguild/gmt` depends on `temporal-polyfill` 1.0.8 (exact pin) instead of
`@js-temporal/polyfill` 0.5.1. No public function is added or removed. Public **types** change:
every `Temporal.*` type GMT re-exports or names in a signature now comes from `temporal-spec`
(slice 2). `apps/dox` moves in the same change, so Dox never mixes objects from two polyfills.

Seven slices, in order. Each leaves `pnpm run validate` and the whole `packages/gmt` suite green.
Slice 1 runs on 0.5.1; slices 2–7 on 1.0.8.

Out of scope: #440 (native Node 26 `normalizeDuration`), #462 (browser legs running Node-only
files). The Dox `/bundle-size` page and its charts are a separate dox-architect spec; this spec
fixes only the JSON that page reads (slice 6).

### Corrections to the issue's Scope wording (decided here)

1. **Scope 6, lint plugins.** `gmt-oxlint`, `gmt-eslint` and `gmt-biome` name no polyfill outside
   their CHANGELOGs (checked: `grep -rl polyfill packages/gmt-{oxlint,eslint,biome}` minus
   `node_modules`, `dist`, `CHANGELOG.md` is empty). The polyfill is named only in the repo's own
   oxlint configs. Slice 5 edits those; the three plugins get no change and no changeset.
2. **Scope 4, "removed with its sentinel".** Workaround groups have no sentinels; a group is
   removed with its repros, its `WORKAROUNDS` entry, its README rows and its removal steps.
3. **Research § 5 says keep zoned.E.** The 1.0.8 Node canary calls it removable. Slice 3 decides
   every group by its canary on every engine in scope, not by the research list.

## What ships

| Part | Where | Slice |
| ---- | ----- | ----- |
| Month-range guard: an out-of-range month amount throws before any polyfill arithmetic | `packages/gmt/src/internal/temporalCompat/monthRange.ts` (new) + call sites | 1 |
| D9 retargeted: out-of-range month amount throws only after work linear in the amount | `repros.ts`, `scripts/lib/workarounds.mjs`, temporalCompat README | 1, 3 |
| Seam on `temporal-polyfill/full/implementation`; exact dependency pin | `src/internal/temporal.ts`, `packages/gmt/package.json` | 2 |
| Helper type aliases `temporal-spec` does not export | `src/internal/temporalTypes.ts` (new) | 2 |
| Dox imports `Temporal` from `@northguild/gmt` | 57 files under `apps/dox/src` | 2 |
| Workaround groups judged on 1.0.8 on every engine, removed or retargeted | `src/internal/temporalCompat/**`, `scripts/lib/workarounds.mjs` | 3 |
| Weekly upgrade check: newest `temporal-polyfill` vs the pinned one | `temporal-oracle.yml`, `polyfill-swap.mjs`, swap configs | 4 |
| Import restrictions name both polyfill packages | `oxlint.config.mts` (root, `packages/gmt`, `apps/dox`) | 5 |
| Bundle sizes of both polyfills, generated; budgets reset | `scripts/bundle-size.mjs`, `bundle-size.budgets.json` | 6 |
| Docs, context files, READMEs, changeset | see slice | 7 |

## Signatures

Internal only. Nothing new is exported from a public entry point.

```ts
// packages/gmt/src/internal/temporalCompat/monthRange.ts
/** The largest month count between any two dates Temporal can represent, in any GMT calendar. */
export const MAX_MONTHS_IN_RANGE: number; // 7_365_462 — derivation in slice 1
/** Throws RangeError when |months| > MAX_MONTHS_IN_RANGE. Calls nothing on Temporal. */
export function assertMonthsInRange(months: number): void;
```

The public functions keep their signatures and sentinels; a guarded call returns the sentinel it
already returns for an out-of-range result ([coding-standards § API Contract](../../../coding-standards.md#api-contract)).

## Authority — what each rule rests on

| Rule | Source |
| ---- | ------ |
| PlainDate range −271821-04-19 … +275760-09-13 (epoch days −100,000,001 … +100,000,000) | TC39 Temporal, abstract operation `ISODateWithinLimits` |
| A date + months result outside that range throws RangeError | TC39 Temporal, `CalendarDateAdd` (last step: `ISODateWithinLimits` false → throw RangeError); Intl era/monthCode proposal `NonISODateAdd` returns through the same check |
| A ZonedDateTime result outside the instant range throws RangeError | TC39 Temporal, `IsValidEpochNanoseconds` (limit ±10^8 days × 8.64 × 10^13 ns) |
| All non-zero Duration fields share one sign; \|years\|, \|months\|, \|weeks\| < 2^32 | TC39 Temporal, `IsValidDuration` |
| At most 13 months in any year of a GMT calendar | Intl era/monthCode proposal § 4.1.4 Table 3 (largest month code `M13`; hebrew's leap year adds `M05L` to 12) |
| Shortest year in a GMT calendar: 353 days (hebrew deficient common year) | Dershowitz & Reingold, *Calendrical Calculations* (Hebrew year lengths 353–355, 383–385), the source `largeMonthArithmetic.test.ts` already cites; checked by the runtime in slice 1 |
| `MAX_MONTHS_IN_RANGE = 13 × (⌈200,000,001 / 353⌉ + 1)` | **GMT rule.** An upper bound from the two rows above; slice 1's test proves it exceeds the real full-range month count of every calendar in `calendarSystemIds.ts` |
| The guard is always on, not probe-gated | **GMT rule.** A probe would cost the time the guard saves (1.0.8: up to 5 s on Node). It fires only where the spec throws, so every result equals the spec's |
| The seam imports `/full/implementation`, never `/full` or the default entry | **GMT rule** from research § 7: `/full` returns the runtime's built-in `Temporal`; the default entry supports only `iso8601` and `gregory` |
| A workaround group is removed only when its repros pass on every engine in its scope | **GMT rule:** [temporalCompat README § Rules](../../../../packages/gmt/src/internal/temporalCompat/README.md#rules) 2–3; [`native-suite.mjs`](../../../../scripts/native-suite.mjs) header |
| D9 repro: first call over 5,000 ms fails at once; else 10× the amount must throw in under 3× the time, + 10 ms | **GMT rule.** A ratio is independent of engine speed (linear ~10×, bounded ~1×); the ceiling caps 0.5.1 (~12-30 s a call) |
| The old figures come from the last GMT release on `@js-temporal/polyfill`, as published | **GMT rule.** It is the configuration users ran; GMT's new source on the old polyfill never shipped and lacks the workarounds it needs |
| Sentinels | [coding-standards § API Contract](../../../coding-standards.md#api-contract) |

## Slices

| # | Slice | Leaves green |
| - | ----- | ------------ |
| 1 | [Month-range guard and D9 retarget](./range-check.md) | on 0.5.1 |
| 2 | [Seam, dependency and types](./seam-and-types.md) | on 1.0.8, all workarounds still in |
| 3 | [Workaround removals](./workarounds.md) | on 1.0.8, compat snapshot regenerated |
| 4 | [Swap job becomes the upgrade check](./upgrade-check.md) | CI + `temporal-oracle` dry run |
| 5 | [Import restrictions](./lint.md) | `pnpm lint` |
| 6 | [Bundle-size script, JSON and budgets](./bundle-size.md) | `node scripts/bundle-size.mjs check` |
| 7 | [Docs, READMEs, changeset](./docs-readmes-changeset.md) | `pnpm run validate` |

## CI and cron jobs after the swap

| Job | Effect | Handled in |
| --- | ------ | ---------- |
| `ci.yml` `compat`: `temporal-compat.mjs snapshot --check` | Fails until `apps/dox/src/data/temporal-compat.json` is regenerated on 1.0.8 | 3 |
| `ci.yml`: `bundle-size.mjs check` | Fails until budgets are reset (sizes fall ~21 kB gzipped) | 6 |
| `temporal-oracle.yml` `native-suite` | Control pass is now 1.0.8; browser compat page needs the new import map | 4 |
| `temporal-oracle.yml` `swap-version` / `polyfill-swap` / `report` | Retargeted to the upgrade check | 4 |
| `deploy-dox.yml` | `generate` runs `bundle-size.mjs report --json`; needs the old release installed (root devDependency, `pnpm install` already runs) | 6 |
| `dox-gates-weekly.yml`, `leap-seconds.yml`, `release.yml` | No polyfill reference; lockfile change only | — |

## Decisions (owner-approved)

1. Old bundle figures come from the published `@northguild/gmt@1.21.0`, root devDependency alias
   `gmt-js-temporal-release` (slice 6).
2. The month-range guard is always on with the fixed bound above, and covers year-months (slice 1).
3. The D9 canary is the timing-ratio repro (slice 1).
4. Dox imports `Temporal` from `@northguild/gmt` (slice 2), with a lint ban in Dox (slice 5).
5. D10 is removed if its repros pass on every engine, with the then-unused `guard` mechanism (slice 3).
6. D17, D18 and D19 are each judged only in their own browser (slice 3).
7. The swap job keeps its file names, verdict sources and issue key; the browser mode becomes
   `"candidate"` (slice 4).
8. `scripts/behaviour-matrix` keeps its `@js-temporal/polyfill` 0.5.1 pin (slices 2, 7).
9. Upstream filings and the #460 body: the implementing session drafts the exact text, the owner
   approves it, and only then is anything filed or edited (slice 7, Owner-approved steps).
10. `.agents` persona and skill edits: exact diff to the owner, applied on his word (slice 7).
11. Changeset: minor, with a note on the type change (slice 7).

## Verification

Story § Verification, plus: `node scripts/temporal-compat.mjs check` and `snapshot --check` pass;
`node scripts/bundle-size.mjs check` passes; `node scripts/native-suite.mjs <leg>` passes on all four
legs with 1.0.8 as the control; `largeMonthArithmetic.test.ts` passes in Firefox and WebKit.
Build `packages/gmt/dist` only in the CORE-108 worktree, never in the main checkout.
