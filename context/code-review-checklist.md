# Code Review Checklist

For every PR, verify all of the following before approving.

This is the mechanical layer. Standards conformance and domain-convention correctness are
[`gmt-reviewer`](../.agents/gmt-reviewer.md)'s layer; it applies this file first.

## API Contract

- [ ] No `Date` objects anywhere (search for `Date`, `new Date`, `.getTime()`)
- [ ] Public inputs/outputs are strings, numbers, booleans, arrays, `bigint` or plain objects — no Temporal objects leaking out
- [ ] Invalid input returns the correct sentinel per the [sentinel table](./coding-standards.md#api-contract), never throws

## Architecture

- [ ] Plain/zoned separation maintained — no `PlainDateTime`/`ZonedDateTime` mixing in the same function
- [ ] All Temporal method calls wrapped in `try-catch`
- [ ] New functions follow the existing directory structure (`calendar/`, `duration/`, `instant/`, `plain/`, `precision/`, `regex/`, `span/`, `unix/`, `utc/`, `zoned/`) and the `get/` vs `calculate/` rule
- [ ] Zoned unit boundaries are not computed by truncating the wall clock and re-resolving it (`round({ roundingMode: "trunc" })`, `.with()` + `"compatible"`) — see [§ Calendar & zone semantics](./coding-standards.md#calendar--zone-semantics)
- [ ] Bounded loops (walkers, steppers, caps) return the sentinel on exhaustion, never a partial value
- [ ] Repeated calendar steps are computed from the anchor (`start.add(amount × k)`), not by compounding the previous result
- [ ] Calendar arithmetic clamps (TC39 `overflow: "constrain"`) unless the function is a parser

## Tests

- [ ] `it.each` uses template literal syntax, not array syntax
- [ ] Full locale matrix covered for any locale-aware function (17 locales via `MustTestLocales`)
- [ ] Error paths tested using pre-built mocks from `packages/gmt/src/test/mocks` (imported relatively, e.g. `../../test/mocks`)
- [ ] `expectOneOfIcu` / `expectDateTimeEqual` / `expectOneOfDateTimeIcu` (from `src/test/icuVariants.ts`) used only for verified CLDR wording variants
- [ ] Timezone coverage uses `battleTestTimeZones` / `MustTestDstTimeZones` — no hand-copied literal zone tables — plus the probe-zone transition rows for boundary functions (see [testing standards](./testing-standards/references/index.md#zoned-and-unix-functions-must-use-the-battle-test-timezone-fixtures))
- [ ] Edge cases covered: invalid input, empty arrays, boundary values (leap years, DST transitions, midnight, etc.)
- [ ] Zero known bugs: no `it.fails` / `.skip` / `.todo` / `.only` / `xit` / `describe.skip`, and no "known defect" note anywhere. A defect found in review blocks the PR until it is fixed ([Core Rule 12](../AGENTS.md#core-rules-quick-reference); `node scripts/test-markers.mjs check`)

## Documentation

- [ ] JSDoc on all new public functions with `@example` for valid, invalid, and edge-case inputs
- [ ] Relevant namespace README updated (`packages/gmt/src/<namespace>/README.md`)
- [ ] `packages/gmt/README.md` quick-start updated if new concept-level functions were added
- [ ] TanStack Intent skills in `packages/gmt/skills/` updated if a public function was added, renamed, removed, or gained/changed an option (see `/tanstack-intent` skill, `CONTRIBUTING.md` § Keeping agent skills current) — check the relevant `SKILL.md`'s code examples and `_artifacts/domain_map.yaml`'s `covers:` list actually name the new/changed function
- [ ] Published figures still true — the test counts, CI execution totals and per-namespace function counts are derived from `packages/gmt` only, not typed. `pnpm stats:sync` rewrites them in both READMEs and regenerates `apps/dox/src/data/gmt-stats.json`, and `pnpm run validate` fails on drift. In `apps/dox`, flag any GMT figure typed into copy instead of imported from `src/data/gmt-stats.ts`. Otherwise this needs a reviewer's eye only when `stats check` reports something it cannot fix itself: a new namespace that the api-surface sentence does not name yet, or a README rule that "matched nothing" because guarded prose was reworded
- [ ] Changeset present with the bump the [changeset rule](./coding-standards.md#changesets) requires

## Intentional — do not flag

- **Validate-then-parse.** An `isValid*` guard followed by a second parse inside `try` is deliberate.
- **Parsers use `overflow: "reject"`.** Arithmetic clamps; parsers must not invent dates.
- **`roundZoned` / `roundUnix` pass TC39 `ZonedDateTime.round` through**, transitions included. Callers who need a floor use `floorToZone`.
- **Cross-family clones** (`plain/` / `zoned/` / `utc/` / `unix/` variants of one function). Different Temporal types stay separate by design (core rule 5).

## Long-Term Impact (flag for senior review)

- [ ] New Temporal API adoption patterns introduced
- [ ] Cross-plain/zoned type mixing (should be rejected)
- [ ] Public API signature changes (breaking or additive)
- [ ] New locale support requirements

## Tone

- Be polite and empathetic. Phrase uncertainty as questions: "Have you considered…?"
- Approve when only minor issues remain. Don't block PRs for stylistic preferences.
- Goal is risk reduction, not perfect code.
