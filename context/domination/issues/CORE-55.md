# CORE-55 — Core: Calendar strings to the standard RFC 9557 form, ISO date + `[u-ca=<id>]` (2.0.0)

**Scope:** Replace GMT's calendar-annotated grammar (coding-standards E1), which carries calendar-native year/month/day digits, with the standard representation of a non-ISO date: the ISO 8601 / RFC 3339 date, followed by an RFC 9557 `[u-ca=<id>]` suffix. That is exactly what `Temporal.PlainDate#toString()` emits. Eras and calendar fields become read values, never string content. Every shipped calendar string changes, so this ships only in a major release.

## Gap

The CORE-6 standards research ([calendar-standards-decisions.md](../research/calendar-standards-decisions.md) Q1) found that:

- **No standard defines a machine-readable date string with calendar-native digits.** Temporal's `TemporalDateToString` always writes the ISO year, month and day, then `FormatCalendarAnnotation`. RFC 9557 §3.3 says `u-ca` marks the calendar a date is *preferably presented* in, and the digits stay ISO. CLDR/UTS 35 defines only localized display patterns.
- **E1 strings are ambiguous with the standard.** `5785-01-01[u-ca=hebrew]` is also a valid RFC 9557 string, meaning ISO year 5785. Any standard parser (Temporal included) reads a GMT string as a different date, with no error.
- **`;era=<code>` is not RFC 9557 syntax.** The suffix value grammar is `1*alphanum *("-" 1*alphanum)`.
- **The zoned grammar orders `[u-ca=…]` before `[timeZone]`,** the reverse of RFC 9557. Coding-standards E1 calls this "not re-openable" because, with calendar-native digits, the RFC-legal order let `Temporal.ZonedDateTime.from` silently read a Hebrew year as an ISO year. With ISO digits that hazard is gone: the RFC order then means exactly what it says. This story re-opens the ordering on that basis.

Owner decision 1 (2026-09-14): adopt the standard form as its own major-version story, not in CORE-6.

## Scope

- **Grammar.** `regex/calendar-date.ts` and `regex/calendar-zoned-date-time.ts` accept the Temporal/RFC 9557 grammar:
  - date year `DecimalDigit{4} | ASCIISign DecimalDigit{6}`, with `-000000` rejected;
  - zoned order `<date>T<time><offset>[<timeZone>][u-ca=<id>]`;
  - decide, from Temporal's `ParseTemporalCalendarString` and RFC 9557 §3.3, whether the critical flag `[!u-ca=…]` is accepted, and record the decision here.
- **Parsing.** `internal/calendarDateString.ts`, `internal/calendarZonedString.ts` and `internal/ethiopicFamilyCalendar.ts` hand the ISO string to `Temporal.PlainDate.from` / `ZonedDateTime.from` and read the calendar from the annotation. Fields→ISO construction (`calendarDateFromFields`) is no longer on the parse path.
- **Formatting.** Every calendar output is `date.toString()`-shaped: ISO digits, `PadISOYear`, then `[u-ca=<id>]`. No `;era=`.
- **Calendar identifiers in the annotation.** RFC 9557's `u-ca` value is a BCP 47 `ca` key value. GMT's public ids `gregorian`, `taiwan`, `islamic-tabular` and `ethiopic-amete-alem` differ from the CLDR `bcp47/calendar.xml` types (`gregory`, `roc`, `islamic-tbla`, `ethioaa`). In the red step, verify each id against `calendar.xml` (types and aliases) and Temporal's `CanonicalizeCalendar`. Then decide:
  - whether the annotation carries the canonical BCP 47 id;
  - whether the GMT `CalendarSystem` names stay as the function-argument vocabulary.
  Record both decisions here.
- **Calendar fields.** Callers who read the year, month code, era or era year from the string today need a read function instead. Check `formatDateInCalendar` / `formatZonedInCalendar` and the existing calendar readers before adding one.
- **Remove the deprecated inputs** that CORE-6 kept for one major:
  - the `japanese` era input alias;
  - the E1 negative-year `PadISOYear` rule, which is now simply ISO `PadISOYear`.
- **Documentation.**
  - Rewrite coding-standards "Scoped exception … (E1)", including the ordering paragraph.
  - Rewrite the `convertDateToCalendar` / `convertZonedToCalendar` JSDoc.
  - Rewrite `packages/gmt/README.md` § calendar systems. That section argues for native digits, and several of its examples are affected.
  - Rewrite the dox calendar guides and the `packages/gmt/skills` calendar sections.
- **Changeset:** `major`. **Ask the owner first**, per [coding-standards § Changesets](../../coding-standards.md#changesets).

### Functions whose strings change

- `plain/`:
  - `convertDateToCalendar` and `isValidCalendarDate`;
  - `addDate`, `subtractDate`, `diffDate` and `diffDateAsDuration`;
  - `isValidDateInterval`, and the calendar-accepting `plain/interval/*Date` functions: `intervalAbuts`, `intervalContains`, `intervalCount`, `intervalDifference`, `intervalDivideEqually`, `intervalEngulfs`, `intervalFromDuration`, `intervalIntersection`, `intervalLength`, `intervalOverlappingDays`, `intervalSplitAt`, `intervalUnion`, `intervalXor`, `intervalXorAll`, `intervalsOverlap`, `mergeIntervals`, `splitIntervalByUnit`.
- `zoned/`:
  - `convertZonedToCalendar`, `isValidCalendarZonedDateTime` and `isValidCalendarZonedInterval`;
  - `addZoned`, `subtractZoned`, `diffZoned` and `diffZonedAsDuration`;
  - the `zoned/interval/*Zoned` twins of the list above.
- `duration/`: `durationAs`, `normalizeDuration` and `compareDurations`, through a calendared `relativeTo`.

Re-derive the list in the red step with a grep for the parse and format helpers. Do not rely on this list alone.

## Old → new output

The "Today" column is the shipped `@example` or README value, after CORE-6's calendar correctness fixes. The "After" column is `Temporal.PlainDate#toString()` / `ZonedDateTime#toString()` for the same date, shown with GMT's current public id. The id decision above may replace `taiwan` and the other ids. Re-derive every cell in this story's red step, from native Temporal (Chromium) and test262, never from GMT.

| Call | Today (E1) | After (RFC 9557) |
| --- | --- | --- |
| `convertDateToCalendar("2024-10-03", "hebrew")` | `"5785-01-01[u-ca=hebrew]"` | `"2024-10-03[u-ca=hebrew]"` |
| `convertDateToCalendar("2024-10-03", "japanese")` | `"0006-10-03[u-ca=japanese;era=reiwa]"` | `"2024-10-03[u-ca=japanese]"` |
| `convertDateToCalendar("2024-10-03", "ethiopic")` | `"2017-01-23[u-ca=ethiopic;era=ethiopic]"` | `"2024-10-03[u-ca=ethiopic]"` |
| `convertDateToCalendar("1000-01-01", "taiwan")` | `"-000911-01-01[u-ca=taiwan]"` | `"1000-01-01[u-ca=taiwan]"` |
| `convertDateToCalendar("+275760-09-13", "hebrew")` | `"279517-10-11[u-ca=hebrew]"` | `"+275760-09-13[u-ca=hebrew]"` |
| `convertDateToCalendar("5785-01-01[u-ca=hebrew]", "gregorian")` | `"2024-10-03"` | `"5785-01-01"`: read as ISO year 5785, a different date with no error. See the migration hazard below |
| `convertZonedToCalendar("2024-10-03T14:30:45-04:00[America/New_York]", "hebrew")` | `"5785-01-01T14:30:45-04:00[u-ca=hebrew][America/New_York]"` | `"2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew]"` |
| `addDate("5784-06-15[u-ca=hebrew]", { months: 1 })` | `"5784-07-15[u-ca=hebrew]"` | the input is re-read as ISO 5784-06-15; re-derive |

## Migration hazard: silent reinterpretation

Most E1 strings are also valid RFC 9557 strings, so an old stored value parses under the new grammar as a **different date, with no error**. `5785-01-01[u-ca=hebrew]` goes from 2024-10-03 to 5785-01-01. A 5- or 6-digit unsigned year (`279517-10-11[u-ca=hebrew]`) is the only E1 shape the new grammar rejects.

The story must answer this before the red step, and record the answer here:

- The changeset and README carry a migration section: how to convert stored E1 strings with the last 1.x release before upgrading.
- Decide whether 1.x ships a converter (E1 → standard) in its final minor, so users can migrate data while both readings are available. The decision goes to the owner, framed as a data-migration question.
- No heuristic detection of "old" strings in 2.0.0. The two readings cannot be told apart.

## Relationship to CORE-6

CORE-6's calendar correctness work keeps E1, and changes it only where correctness requires:

- signed 6-digit negative years;
- proposal era codes (`ce`, `bce`, `meiji` from 1873 at year 6);
- proleptic buddhist;
- Hebrew years ≤ 0 and Indian dates before ISO year 1.

Its `internal/temporalCompat/` layer and test rows carry over: the ISO dates and calendar fields they assert stay correct, and only the string shape changes. Fields→ISO parsing near the range limits (D1-W) leaves the parse path in this story. The `calendarDateFromFields` fallback may become removable earlier than the polyfill release, so check `pnpm compat` and the compat README's removal steps.

## What gmt provides (do not re-implement)

- `internal/temporalCompat/` from CORE-6: calendar reads, add and until that are correct at the range limits and in the far past
- `convertDateToCalendar` / `convertZonedToCalendar`: keep the functions and change only their string contract
- `isValidCalendarDate` / `isValidCalendarZonedDateTime`: the gates every calendar-accepting function uses

## Verification

- Every "After" cell in the table above is asserted in the owning function's suite, with its value taken from native Temporal or test262.
- For every supported calendar, `convertDateToCalendar(iso, cal)` equals `Temporal.PlainDate.from(iso).withCalendar(<temporal id>).toString()`, with only the id substitution the story decides. The same holds for zoned output.
- The test262 `intl402/Temporal/PlainDate/from/extreme-dates.js` rows round-trip through the new strings at both range limits.
- No source, README, dox page or skill still documents calendar-native digits, `;era=`, or the `[u-ca=…][timeZone]` ordering.
- The `major` changeset carries the migration table and the hazard note.
- `pnpm run validate` stays green.
