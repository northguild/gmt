# Testing Standards

Core rules for every test. Other files: [writing-tests.md](./writing-tests.md) (`it.each`, option tables, zoned fixtures, mocks, canonical fixtures), [locale-tests.md](./locale-tests.md) (locale matrix, ICU/CLDR variance) and [test-matrix.md](./test-matrix.md) (canonical values).

## Know the Correct Value Before Writing the Assertion

**A test states what the function SHOULD return. It never records what some code DOES return.** Before writing an expected value, you must be able to say why it is correct, from a source other than the code under test. Code is written to meet the expectation; the expectation is never adjusted to meet the code.

1. **Derive from the rule first.** Work the value out from the spec, the story's decisions, the [coding standards](../../coding-standards/index.md) and the authoritative standard (TC39 Temporal, ISO 8601, RFC 9557, the relevant RFC or law). Choose inputs whose arithmetic is obvious (whole hours on one UTC day), so the derivation fits on one line. When the value isn't self-evident, put that derivation in the row name or a comment.
2. **Then check the arithmetic against real Temporal.** This is the independent check below. The polyfill confirms arithmetic and Temporal semantics; it cannot confirm GMT-defined rules (sentinels, half-open boundaries, tie-breaks), because Temporal has no opinion on them.
3. **A disagreement is a finding, not a value to copy.** When your derivation, the polyfill, a spec table and the implementation don't all agree, stop and find out which one is wrong. Never settle it by pasting whichever output makes the test pass. If the rule itself looks wrong, escalate; do not decide silently.
4. **Forbidden sources of an expected value:**
   - output of the function under test, or of a "reference implementation" written for the same task;
   - a spec table's value you have not re-derived yourself;
   - an existing test row or JSDoc example taken on trust;
   - recomputing the value the same way the implementation does (tautological).
5. **Existing behaviour is not automatically correct.** Before pinning an existing function's current output (for example, ahead of a doc fix or refactor), classify it:
   - **Intended:** its documented contract says so. Pin it.
   - **Defect:** it breaks the function's own contract, the coding standards or the governing standard. Do **not** assert the wrong value. Write the correct expectation as a normal `it`. It fails, which is the red step, and you fix the code in the same story. See [Zero known bugs](#zero-known-bugs).
   - **Unsure:** treat it as a defect.
6. **Report what you checked.** Handoffs state how each expected value was established (rule derivation, polyfill check) and list every disagreement found, and how it was resolved.

## Zero Known Bugs

**GMT never ships a known bug.** A defect found during a story, in new or existing code and by any agent or review, is fixed in that story, before the work moves on. It is never deferred to a later issue, pinned, skipped or documented around.

- **The only acceptable failing test is the red step of a TDD slice:** a normal `it` with the correct expectation, turned green by fixing the code in the same slice.
- **Forbidden in any handoff, finished code or PR:** `it.fails`, `it.skip`, `it.todo`, `it.only`, `describe.skip`/`.only`, `xit`/`xdescribe`, `skipIf`/`runIf`, and any "known defect" or "known bug" note. They may appear for a moment while working and must never be left behind.
- **When you find a bug, widen the search.** Fix the whole class (every function with the same cause), not just the instance that surfaced.
- **Enforced:** `node scripts/test-markers.mjs check` runs in `pnpm run validate` and fails on any marker or known-defect note. It is a backstop, not the definition of the rule: its checks are lexical, so it catches `it.skip` / `it.fails` reliably but cannot see a carried defect worded any other way, and a green check is never on its own evidence that the rule was met. [AGENTS.md Core Rule 12](../../../AGENTS.md#core-rules-quick-reference) states the rule, and `finalizer` refuses to close a story that carries one.

## Test Cost

**Keep each test under 0.3 s on a dev machine.** CI legs run up to 5× slower than a laptop, and the default timeout is 5 s, so a 1 s test lands on the timeout. A test that takes 1.2 s locally has taken 4.9 s on CI and timed out on others. Run the file with `--reporter=verbose` and read the time on each row before handing it off.

- **Under 0.3 s:** no timeout. It stays under 1.5 s on CI.
- **0.3 s to 1 s:** a timeout is allowed. Its comment gives the worst CI time, or the load, that needs it.
- **Over 1 s:** only when the work cannot shrink, such as a sweep over every zone the runtime knows. Its comment says why.

- **Call an expensive oracle only where the answer can differ.** A sweep over a year of rows needs `classifyLocal` or a Temporal resolution only near a zone transition. Elsewhere every wall time is unique, and the row can be checked against that directly. Find the transitions with Temporal's `getTimeZoneTransition`, never with GMT.
- **Assert once per case, not once per row.** Collect the rows that are wrong and `expect` the count and the first 20 of them to equal `{ count: 0, first: [] }`. Thousands of `expect` calls are gone, and a failure shows how many rows broke and enough of them to see why. Never print the whole list: when every row of a large sweep breaks, it runs to megabytes and buries the cause.
- **Prefer fewer, sharper rows to more random ones.** Seeded rounds earn their cost only when each one covers a case no other row does.
- **Make the work smaller before you raise a timeout.** A timeout on a test under 0.3 s, or one without its comment, is a finding.

## Never Pass a Path to `vitest list --json`

`npx vitest list --json <file>` does **not** list that file's tests: Vitest 5 treats the argument as the JSON **output** path and overwrites the file with the entire suite listing. It destroyed two test files during CORE-6.

- **To see test names:** run `npx vitest run <file> --reporter=verbose`.
- **`scripts/stats.mjs` is safe:** it calls `vitest list --json --no-staticParse` with no file argument. Without `--no-staticParse`, Vitest 5 reads the files statically and counts an `it.each` table as one test.

## Shared Modules and Isolated Files

Vitest runs the suite as two projects (`packages/gmt/vitest.config.ts`). Test files share modules unless they replace a module or a global, so most files skip a fresh import of the library.

- A file that calls `vi.mock`, `vi.doMock`, `vi.stubGlobal` or `vi.stubEnv` joins the isolated project automatically (`src/test/isolationGroups.ts`). You choose nothing.
- `src/test/setupTests.ts` restores spies and fake timers after each test, so `vi.spyOn` and `vi.useFakeTimers()` are safe in the shared project.
- Any other module-level state a test changes (a cache, a registry) must be reset in the test, or in `setupTests.ts` when many files need it.
- A direct global assignment such as `Intl.DateTimeFormat = ...` must be undone in a `finally` block. After each shared file, `src/test/setupTests.ts` compares `Intl`, `Temporal`, `Temporal.Now`, `Date`, the keys of `globalThis` and the names in `process.env` with what they were before, and fails the file that left a difference.
- Watch mode reads the split once, at start. After you add a `vi.mock` (or the other three calls) to a file, restart `vitest --watch`.
- Prefer `vi.spyOn` over `vi.mock` where it works: it keeps the file in the faster shared project.

## Test Name Standards

Every `it.each` name must interpolate the distinguishing variables (`$aEnd`, `$bStart`, `$timeZone`, etc.) so a Vitest failure report is self-debugging:

- Good: `"returns merged interval when $aEnd equals $bStart (adjacent)"`
- Bad: `"returns $expected for adjacent intervals"`

For error-path blocks where all inputs produce the same sentinel, the name should list the _type_ of bad input: `"returns null when $input is non-string"`.

**Every test in a file has a full name of its own.** The full name is the `describe` titles plus the test title. Two tests that share one cannot be told apart in a report, and a canary tag in `scripts/lib/native-suite-tags.mjs` that names one of them names both. Where table rows differ only by an input the title leaves out, put that input in the title, or add a `label` column and use `$label`. A loop that registers a test interpolates its loop variable. Vitest 5 cuts an interpolated value at 40 characters, so two long values that share a prefix print the same; name those rows with a short `label`. A title column never hides a repeat: two rows with the same inputs are one test run twice, so drop one, and build a list that can repeat an entry through `new Set`. `node scripts/stats.mjs check` fails on a repeated full name and lists each one.

**An empty string in a title is `''`.** Vitest 5 prints a string `$key` as it is, with no quotes, so `""` leaves a blank: `returns $expected for $value` reads `returns  for 2024-13-01`. Write the placeholder in single quotes when its column holds only strings: `'$value'` prints `''` and `'abc'`. Fixed text uses the same form: `"returns '' for a malformed date"`. A column that mixes strings with `null`, `undefined` or numbers is not quoted, since `'$value'` would print `'null'` for `null`. Give that table a `label` column that writes each value as a JavaScript literal (`''`, `'abc'`, `null`, `42`) and use `$label` in the title. Each label cell is itself a string, `${"''"}` or `${"null"}`; a bare `${""}` prints a blank again. The title then uses a bare `$label`, never `'$label'`, and every string-valued cell carries its own quotes (`${"'hour'"}`, not `${"hour"}`), so a string and a non-string spelt alike, `'null'` and `null`, read differently. Quotes in a title promise a string: a quoted placeholder over `null` prints `'null'`, which reads as the four-letter string. `%s` follows the same two rules. In Vitest 5 every `%` specifier, `%%` and `%c` included, takes the next row item; `%#` and `%$` print the row number.

`packages/gmt/src/test/titleGuard.ts` enforces the second rule. It wraps `each` and `for` on `it`, `test` and `describe`, reads each title the way Vitest 5 does, and fails the file at collection, naming the row, when a `$key`, `%s` or `%%` outside quotes would print an empty string, or a `$key` or `%s` inside quotes holds a value that is not a string. It cannot see a label cell that spells a string without its quotes; review catches that.

## Priority Tiers

Test only what applies to the function under test. `tdd-dev` uses these to decide what to write; `tester` uses them to audit.

- **P0 (always):** Happy path with default options. Invalid input → sentinel (one collapsed row). Zero/identity case if the function takes a numeric or array parameter.
- **P1 (options/params):** Each explicit option value that changes behaviour. Default-vs-explicit-equal case. Option on an input where it has no effect.
- **P2 (timezone-aware):** `battleTestTimeZones` matrix via `battleTestTimeZones.map(...)`, plus the probe-zone transition rows for boundary functions (see above). Extreme-offset zones (`Pacific/Apia`, `Pacific/Niue`).
- **P3 (locale-aware):** All 17 locales from `MustTestLocales` with explicit rows. ICU-variant assertions where CLDR wording differs across Node versions.
- **P4 (calendar/date arithmetic):** Month-end, year-end and leap-day boundaries (clamp per TC39). Negative amounts. Empty/no-op inputs. Repeated steps checked against the anchor (Jan 31 by month → Mar 31, Apr 30).

Rules that keep the permutation count sane:

- **Invalid input = ONE row.** Collapse `null`/`undefined`/`123`/`true`/`[]`/`{}` into a single `"non-string input"` row unless a type has distinct behaviour (say why).
- **No irrelevant edge cases.** A pure string formatter needs no DST rows; duration addition needs no locale rows. Ask whether the case exercises a real code path in *this* function.
- **One `it.each` table per category** (see the taxonomy below).

## Edge-Case Taxonomy

Define the permutation space for every function explicitly:

- **Valid input** — default options and each explicit option value.
- **Invalid input** — sentinel return, not throw — collapse `null`/`undefined`/`123`/`true`/`[]`/`{}` into a single `"non-string input"` row unless a specific type has distinct behavior.
- **Boundary units** — month-end, year-end, leap day.
- **Negative/zero amounts** — zero is the identity case; negative values must round-trip correctly.
- **Empty/no-op inputs** — zero-length intervals, empty arrays, identity transforms.
- **Zoned/unix** — full `battleTestTimeZones` matrix via `battleTestTimeZones.map(...)`, plus probe-zone transition rows for boundary functions.
- **Locale-aware** — all 17 locales from `MustTestLocales` with explicit rows.

When an `it.each` block covers more than one permutation category (valid + invalid + boundary), split into separate named tables so failures are debuggable.
