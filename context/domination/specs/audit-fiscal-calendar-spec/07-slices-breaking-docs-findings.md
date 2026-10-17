# Fiscal calendar spec — TDD slices, breaking changes, doc impact, findings

Part of [the index](../audit-fiscal-calendar-spec.md).

## 7. TDD slices

Each slice is red → green → refactor, and the suite stays green between slices.

1. **Types and validators.** Add `FiscalExtraWeek` and `FiscalYearLabel`, then
   `isValidFiscalExtraWeek`, `isValidFiscalYearLabel` and `isValidFiscalCalendar` (§6.6). Do
   not change `FiscalCalendar` yet. Write `isValidFiscalCalendar` against an inline type until
   slice 3, so this slice compiles alone.
2. **Internal.** `fiscalYearLabel` (§3.2), tested directly: the start, end and majority
   values for ONS 2025, ONS 2020, NRF 2023, the `J` year (2023-06-26 to 2024-06-30) and the
   tie year. Then `gregorianCycleShift` (§6.7). Then `fiscalPeriodOfWeek` gains `extraWeek` (§3.1, §6.2 internal walk). Update its current call site to pass
   `"lastPeriod"`, which keeps behaviour unchanged.
3. **`getFiscalPeriod`.** Make both fields required on `FiscalCalendar`. Validate with
   `isValidFiscalCalendar`, then wire the label and the placement. Add
   `extraWeek: "lastPeriod", yearLabel: "startYear"` to every existing test row; their
   expectations do not change. Then add §6.1, §6.2, §6.3 and the `getFiscalPeriod` rows of
   §6.5. Replace the JSDoc (§4.2).
4. **`getQuarter`.** Make both option fields required and route through `fiscalYearLabel`. Add
   `yearLabel: "startYear"` to every existing test that passes options; their expectations do
   not change, except the "default stated" and `{}` rows, which now expect `null`. Then add
   §6.4 and the `getQuarter` rows of §6.5. Replace the JSDoc (§4.3).
5. **Surface.** Barrels (§5), the `isValidFiscalPattern` JSDoc edits (§4.4), the
   `internal/fiscalCalendar.ts` JSDoc (§4.5). Run `node scripts/api-surface.mjs check`,
   `pnpm --filter @northguild/gmt test`, the type check and lint.
6. **Docs and release (finalizer, plus dox-architect for §9.1).** Everything in §8 and §9.

Slices 1–5 belong to tdd-dev, and tester audits them after slice 5. Slice 6 belongs to the
finalizer, except the Dox page, which goes to dox-architect.

---

## 8. Breaking change inventory

### 8.1 What breaks

| Call that compiled in 1.19                                            | 1.20 result               | Migration                                                                  |
| --------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------- |
| `getFiscalPeriod(v, { pattern, yearEndsOn })`                          | type error; `null` at run time | add `extraWeek: "lastPeriod", yearLabel: "startYear"` for identical results |
| `getQuarter(v, { fiscalYearStartMonth: m })`                           | type error; `null`        | add `yearLabel: "startYear"` for identical results                         |
| `getQuarter(v, {})`                                                    | type error; `null`        | drop the options for calendar quarters                                     |
| `fiscalPeriodOfWeek(week, weeks, pattern)` (internal)                  | type error                | pass `"lastPeriod"`                                                        |

The migration column reproduces 1.19 exactly. A caller who used 1.19's advice ("add one" to get
an end-year label) should switch to `yearLabel: "endYear"` and remove the `+ 1`.

### 8.2 Call sites, examples and skills that must change

Source and tests (slices 2–5):

- `packages/gmt/src/types/fiscal-calendar.ts`: the interface, two new types, NRF wording.
- `packages/gmt/src/internal/fiscalCalendar.ts`: `fiscalPeriodOfWeek` signature and JSDoc;
  new `fiscalYearLabel`.
- `packages/gmt/src/internal/index.ts`: export line.
- `packages/gmt/src/internal/fiscalCalendar.test.ts`: `fiscalPeriodOfWeek` calls at lines 170,
  186, 190, 203 and 218.
- `packages/gmt/src/calendar/calculate/getFiscalPeriod.ts`: body, return-field JSDoc, all 7
  `@example` lines.
- `packages/gmt/src/calendar/calculate/getFiscalPeriod.test.ts`: the `nrf` fixture and the
  inline calendars at lines 76, 90, 105, 118, 131, 145, 165, 190, 217, 239 and 255.
- `packages/gmt/src/calendar/calculate/getQuarter.ts`: options type, body, JSDoc, all 8
  `@example` lines (the `{ fiscalYearStartMonth: 1 }` "the default, stated" example is removed).
- `packages/gmt/src/calendar/calculate/getQuarter.test.ts`: calls at lines 26, 47, 68, 81, 91
  and 112.
- `packages/gmt/src/calendar/validate/isValidFiscalPattern.ts`: one bullet and one example note.
- `packages/gmt/src/calendar/validate/index.ts`: three exports.
- No change: `calendar/validate/isValidZoneBucketUnit.ts` line 14,
  `types/zone-bucket-unit.ts` lines 6–7 and `calendar/calculate/floorToZone.test.ts` line 266.
  They name the functions in prose only.

Skills (finalizer, via `/tanstack-intent`):

- `packages/gmt/skills/gmt-basics/SKILL.md` lines 165–169: replace "GMT rule: `year` is the
  calendar year a fiscal year starts in; add one if you label by the year it ends in" with the
  two required fields and their values. Fix the NRF quote. Add `isValidFiscalCalendar` where
  line 81 lists the identifier functions, if validators are listed there.
- `packages/gmt/skills/_artifacts/domain_map.yaml` lines 100–101 and 119: add the three
  validators beside `getFiscalPeriod`. Line 36 does not change.
- `packages/gmt/skills/contributor/new-method-implementation/SKILL.md`: no change. It names
  `getQuarterForDate` and others as naming examples only.

### 8.3 Changeset (finalizer)

`minor`. Lead sentence: `getFiscalPeriod` and `getQuarter` now take the 53rd-week placement and
the year label from the caller. Breaking changes: the table in §8.1, with one before and after
pair each:

```ts
// 1.19
getFiscalPeriod("2024-01-28", { pattern: "4-5-4", yearEndsOn: "2026-01-31" }); // { year: 2023, period: 12, week: 53 }
// 1.20, the same result
getFiscalPeriod("2024-01-28", { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" }); // { year: 2023, period: 12, week: 53 }

// 1.19
getQuarter("2024-03-31", { fiscalYearStartMonth: 4 }); // { year: 2023, quarter: 4 }
// 1.20, the same result
getQuarter("2024-03-31", { fiscalYearStartMonth: 4, yearLabel: "startYear" }); // { year: 2023, quarter: 4 }
```

Also exported: `FiscalExtraWeek`, `FiscalYearLabel`, `isValidFiscalExtraWeek`,
`isValidFiscalYearLabel`, `isValidFiscalCalendar`. The changeset must not cite a statute or a
government fiscal year (GMT tracks no law).

---

## 9. Doc impact

### 9.1 For dox-architect (apps/dox)

| Page / tool                                                                                  | What changes                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/dox/src/content/docs/guides/zoned-date-operations/calendar-boundaries.mdx` lines 20–42 | The `getQuarter` call (line 28) needs `yearLabel`. The `nrf` const (line 31) needs both fields. The comment "stated as its published rule: 'the Saturday nearest to January 31'" is not NRF's wording: quote "four or more days left in January". Lines 37–38 ("lands in the final period") become "lands in the period `extraWeek` names". Add a short paragraph and one `ONS`-style example showing that published calendars disagree on both choices, which is why the fields are required. Name the peers by country. No law, no statute. |
| same page, lines 107–114                                                                      | Add `isValidFiscalCalendar` beside `isValidFiscalPattern`. Change the `"4-5-5"` comment to "a 53-week year's last quarter under `lastPeriod`".                                                                                                                                                 |
| `apps/dox/src/content/docs/reference/calendar/calculate/getFiscalPeriod.mdx`                 | Generated from JSDoc. Regenerate it.                                                                                                                                                                                                                                                             |
| `apps/dox/src/content/docs/reference/calendar/calculate/getQuarter.mdx`                      | Generated. Regenerate it.                                                                                                                                                                                                                                                                        |
| `apps/dox/src/content/docs/reference/calendar/validate/isValidFiscalPattern.mdx`             | Generated. Regenerate it.                                                                                                                                                                                                                                                                        |
| new: `reference/calendar/validate/isValidFiscalExtraWeek.mdx`, `isValidFiscalYearLabel.mdx`, `isValidFiscalCalendar.mdx` | Generated by the reference build.                                                                                                                                                                                                                           |
| `reference/types/…/FiscalPattern.mdx` and new `FiscalExtraWeek` / `FiscalYearLabel` type pages | Generated.                                                                                                                                                                                                                                                                                        |
| `apps/dox/src/generated/reference/gmt-corpus.json`, `route-manifest.ts`                      | Regenerated by the reference build. The playground is seeded from the corpus examples, so it picks up the new examples.                                                                                                                                                                         |
| Dox tools and chat starters                                                                   | None exist for fiscal periods, and this spec proposes none. The Dox chat grounding reads the corpus, so it updates with the regeneration.                                                                                                                                                       |

Remember that `pnpm dox:dev` reads `packages/gmt/dist`. Build once, at the end, and warn the
owner first.

### 9.2 Context files (finalizer)

- `context/domination/issues/CORE-5.md` lines 18–20 (signatures) and the decisions at lines 106–131: add a
  `## Corrections` entry. It says that the 53rd-week placement and the year label are now
  required caller parameters, cites IFRS 18 ¶29 and ¶27(c) (formerly IAS 1 ¶37 and ¶51(c)) and the two peers (NRF, ONS), and records the GMT rules for
  the day-count majority and the tie. Leave the original decision text standing; the
  Corrections entry supersedes it. Line 64 ("places the 53rd week correctly for a known NRF
  53-week year") stays true under `"lastPeriod"`.
- `context/coding-standards.md` lines 15 and 261: no change.
- `context/domination/issues/INT-58.md` and `context/dox/specs/int-58-billing-deadlines.md`
  state that the fiscal JSDoc carries no tax-law citation, which matches `getFiscalPeriod.ts`
  and `internal/fiscalCalendar.ts`. This spec does not add any.
- The tracker: the owner decides whether this change gets its own story id. If it does, add a
  row with `Blocked by` empty. Otherwise it ships under CORE-5's Corrections.

---

## 10. Findings to report

1. **ONS changed its year-end rule.** The `ONS` calendar reproduces every sheet from 2004 to
   2026, but not 1991, 1992, 1996, 1997, 2002 or 2003. GMT models one rule per calendar, which
   is correct. A caller spanning the change uses two calendars.
2. **NRF no longer publishes "Saturday nearest January 31".** Its page states the 53rd-week
   test as "four or more days left in January". That test is equivalent, and CORE-5 verified it
   against every NRF year from 2017 to 2028. The JSDoc, the skill and the Dox guide quote the
   current wording.
3. **IFRS 18 replaces IAS 1 for reporting periods beginning on or after 2027-01-01.** The
   IASB's IFRS 18 reference material maps IAS 1 ¶37 to IFRS 18 ¶29 and IAS 1 ¶51(c) to IFRS 18
   ¶27(c), so GMT cites "IFRS 18 ¶29 (formerly IAS 1 ¶37)" and "IFRS 18 ¶27(c) (formerly IAS 1
   ¶51(c))". The IAS 1 wording quoted in §0 is read from the XRB reproduction.
