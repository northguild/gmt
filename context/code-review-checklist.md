# Code Review Checklist

For every PR, verify all of the following before approving.

## API Contract

- [ ] No `Date` objects anywhere (search for `Date`, `new Date`, `.getTime()`)
- [ ] All public inputs/outputs are strings, numbers, booleans, or arrays — no Temporal objects leaking out
- [ ] Invalid input returns the correct sentinel (`""` / `null` / `false` / `[]`), never throws

## Architecture

- [ ] Plain/zoned separation maintained — no `PlainDateTime`/`ZonedDateTime` mixing in the same function
- [ ] All Temporal method calls wrapped in `try-catch`
- [ ] New functions follow the existing directory structure (`plain/`, `zoned/`, `unix/`, `utc/`, `regex/`)

## Tests

- [ ] `it.each` uses template literal syntax, not array syntax
- [ ] Full locale matrix covered for any locale-aware function (17 locales via `MustTestLocales`)
- [ ] Error paths tested using pre-built mocks from `@gmt/test/mocks`
- [ ] `hasFullIcu` ternaries used for locale rows that differ between full/partial ICU runtimes
- [ ] Edge cases covered: invalid input, empty arrays, boundary values (leap years, DST transitions, midnight, etc.)

## Documentation

- [ ] JSDoc on all new public functions with `@example` for valid, invalid, and edge-case inputs
- [ ] Relevant namespace README updated (`packages/gmt/src/<namespace>/README.md`)
- [ ] `packages/gmt/README.md` quick-start updated if new concept-level functions were added
- [ ] Changeset file present in `.changeset/` with accurate description and correct bump type

## Long-Term Impact (flag for senior review)

- [ ] New Temporal API adoption patterns introduced
- [ ] Cross-plain/zoned type mixing (should be rejected)
- [ ] Public API signature changes (breaking or additive)
- [ ] New locale support requirements

## Tone

- Be polite and empathetic. Phrase uncertainty as questions: "Have you considered…?"
- Approve when only minor issues remain. Don't block PRs for stylistic preferences.
- Goal is risk reduction, not perfect code.
