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
- [ ] All Temporal method calls wrapped in `try-catch` — the only exception is the [UTC clock readers](./coding-standards.md#scoped-exception-the-utc-clock-readers); a read of the system time zone still needs one
- [ ] New functions follow the existing directory structure (`calendar/`, `duration/`, `instant/`, `interval/`, `plain/`, `precision/`, `regex/`, `span/`, `transport/`, `unix/`, `utc/`, `zoned/`) and the `get/` vs `calculate/` rule
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
- [ ] Every public type, member of a public object type and option property has its own JSDoc description, and every optional input property has `@defaultValue` ([jsdoc standards § Options and members](./jsdoc-standards.md#options-and-members)); `pnpm dox:docs-check` reports no gaps
- [ ] Every new public type is reached by a public function; a type used only by private code is not exported
- [ ] Each namespace README (`packages/gmt/src/<namespace>/README.md`) is still a one-line stub that points at the docs site; a new namespace has one
- [ ] The READMEs are up to date. `README.md` and `packages/gmt/README.md` are one short landing page, kept as two identical files. Check each of these:
  - [ ] `node scripts/stats.mjs check` passes, and every figure in the four fact lines and the comparison table matches `apps/dox/src/data/gmt-stats.json` and `apps/dox/src/data/library-measurements.json`
  - [ ] The comparison table has GMT's row first, then one row per library in `library-measurements.json`, by tests, most first
  - [ ] `node scripts/api-surface.mjs check` passes, and one sampled call run by hand returns the result its line shows
  - [ ] The namespace links name every namespace that exports functions and no other, the industry namespaces sit on the "By industry:" line, and each link resolves to `/reference/<namespace>/` on the docs site
  - [ ] The agent prompt equals `AGENT_PROMPT` in `apps/dox/src/lib/agent-prompt.ts` in both READMEs and in `CONTRIBUTING.md`
  - [ ] The two files are identical: `cmp README.md packages/gmt/README.md` prints nothing
  - [ ] Neither README holds a section for one function or one feature; that content is in a docs guide and the generated reference
  - [ ] The review reports the `measuredOn` date of each other library's figures in `library-measurements.json`
- [ ] TanStack Intent skills in `packages/gmt/skills/` updated if a public function was added, renamed, removed, or gained/changed an option (see `/tanstack-intent` skill, `CONTRIBUTING.md` § Keeping agent skills current) — check the relevant `SKILL.md`'s code examples and `_artifacts/domain_map.yaml`'s `covers:` list actually name the new/changed function
- [ ] Published figures are derived, not typed. GMT's figures count `packages/gmt` only. `pnpm stats:sync` writes them into both READMEs with the other libraries' rows, and regenerates `apps/dox/src/data/gmt-stats.json`, which also holds the function count of each namespace. `pnpm run validate` fails on drift. In `apps/dox`, flag any GMT figure typed into copy instead of imported from `src/data/gmt-stats.ts`. `sync` rewrites digits and the comparison table's padding only. `stats check` also reports what `sync` cannot fix: a comparison-table row to add, delete or move, a count word that is wrong, a namespace link that is missing, extra or on the wrong line, and a guarded README line that was reworded so its figure is no longer checked. Each needs a hand edit
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
