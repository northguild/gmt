## C. Generator fixes the new API needs

### C1. A union of `number` and a string literal is source text, not an enum

**The defect.** `classifyTypeAsPrinted` (`scripts/build-utils/build-utils.ts`, line 528) treats a
union of string literals and any `NumberLike` member as an enum of literals. `RolloverEra` is
`number | "rolling"`, and `number` is `NumberLike`, so the choices become `["number",
"rolling"]` (or the other order). `gnssWeekToUtc`'s first `@example` passes an integer era, which
is not a quoted choice, so `fieldForParam` returns `null` and the function loses its form; a
scenario that uses it as `fixedSpecId` gets a textarea. No function has hit this before.

**The fix, for the whole class:**

- The mixed branch counts only `TypeFlags.NumberLiteral` members. A union of string literals and
  number literals stays an enum.
- A union that holds the non-literal `number` (or `bigint`), or an object type, beside one or
  more string literals classifies as a new `ParamType` `"expr"`. `fieldForParam` gives it
  `{ kind: "expr", seed: raw }`, the example's argument as written (`0`, `2`, `"rolling"`,
  `{ notBefore: "2020-01-01T00:00:00Z" }`), so the reader can type any form.
- `classifyTypeFromString` agrees: `number | "rolling"` and
  `number | "rolling" | { notBefore: string }` give `expr`.
- `buildChoiceSeeds` loads an `expr` field from an example as it loads any other field.

**Tests** (`build-utils.test.ts`, synthetic programs): `number | "rolling"` and
`number | "rolling" | { notBefore: string }` are `expr`;
`1 | 2 | "x"` is still an enum; `string | number` is unchanged. After the library lands:
`LIVE_PLAYGROUND_TEMPLATES.gnssWeekToUtc` has fields `counter` (enum, the eight counters), `week`
and `timeOfWeekSeconds` (number) and `rolloverEra` (expr, seed `0`), and choosing `"BDT"` loads
`939`, `86404`, `0`.

### C2. The rename redirect

`scripts/build-utils/renamed-functions.ts` gains
`{ from: "plain/validate/isLeapSecond", to: "plain/validate/hasSecond60" }`. The function shipped
in `@northguild/gmt@1.19.0` (verified with `git grep` at the tag), so its old URL has inbound
links. `redirects.test.ts` expects the three `301` rules. The new
`/reference/timescale/validate/isLeapSecond` is a different page and needs nothing.

No other Dox file names `isLeapSecond` (verified: only the generated manifest and corpus, which
regenerate).
