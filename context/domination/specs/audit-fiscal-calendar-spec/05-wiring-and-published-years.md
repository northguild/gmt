# Fiscal calendar spec — wiring and published-year tests

Part of [the index](../audit-fiscal-calendar-spec.md).

## 5. Wiring

- `types/index.ts` already re-exports `./fiscal-calendar`, which now also exports
  `FiscalExtraWeek` and `FiscalYearLabel`.
- `calendar/validate/index.ts`: add the three new validators, in alphabetical order.
- `internal/index.ts`: `export { fiscalPeriodOfWeek, fiscalYearLabel, fiscalYearOf } from "./fiscalCalendar";`
- No new namespace and no new subpath. The `calendar/validate` subpath picks up the validators
  through its barrel.
- `node scripts/api-surface.mjs check` must pass. It runs every `@example` in §4.

---

## 6. Test matrix

Every expected value below came from running the reference implementation. Rows under §6.1 cite
the published value they reproduce in the row name.

Shorthand used in the tables:

```ts
const NRF = { pattern: "4-5-4", yearEndsOn: "2026-01-31", extraWeek: "lastPeriod", yearLabel: "startYear" } as const;
const ONS = { pattern: "4-4-5", yearEndsOn: "2022-12-31", extraWeek: "firstPeriod", yearLabel: "majorityYear" } as const;
const J   = { pattern: "4-4-5", yearEndsOn: "2021-06-27", extraWeek: "lastPeriod", yearLabel: "endYear" } as const; // a late-June year end, no published source
```

### 6.1 Published years (NRF and ONS)

**NRF (US), fiscal 2023 (53 weeks) and 2017.** Sources: NRF FAQ ("January 29 – February 4,
2017" is week 1 of 2017, not restated) and the NRF 2023–2025 PDF (week 53 = 2024-01-28 to
2024-02-03). **Verified.**

| value        | expected                                | published fact                      |
| ------------ | --------------------------------------- | ----------------------------------- |
| `2017-01-29` | `{ year: 2017, period: 1, week: 1 }`    | 2017 week 1 opens January 29        |
| `2023-01-29` | `{ year: 2023, period: 1, week: 1 }`    | fiscal 2023 opens                   |
| `2024-01-27` | `{ year: 2023, period: 12, week: 52 }`  |                                     |
| `2024-01-28` | `{ year: 2023, period: 12, week: 53 }`  | week 53 opens, in January (period 12) |
| `2024-02-03` | `{ year: 2023, period: 12, week: 53 }`  | week 53 closes                      |
| `2024-02-04` | `{ year: 2024, period: 1, week: 1 }`    | fiscal 2024 opens                   |

**ONS (UK), 2025 (53 weeks).** Source: `tradingperiods2026.xlsx`, sheet "Trading Periods for
2025": January 2024-12-29 to 2025-02-01 (5 weeks), February 2025-02-02 to 2025-03-01, March
2025-03-02 to 2025-04-05, December ends 2026-01-03; sheet 2026 opens 2026-01-04. **Verified.**

| value        | expected                               | published fact                          |
| ------------ | -------------------------------------- | --------------------------------------- |
| `2024-12-29` | `{ year: 2025, period: 1, week: 1 }`   | 2025 opens in 2024; labelled 2025       |
| `2025-02-01` | `{ year: 2025, period: 1, week: 5 }`   | the five-week January ends              |
| `2025-02-02` | `{ year: 2025, period: 2, week: 6 }`   | February opens                          |
| `2025-03-01` | `{ year: 2025, period: 2, week: 9 }`   | February ends (4 weeks)                 |
| `2025-03-02` | `{ year: 2025, period: 3, week: 10 }`  | March opens                             |
| `2025-04-05` | `{ year: 2025, period: 3, week: 14 }`  | March ends (5 weeks); Q1 = 14 weeks     |
| `2026-01-03` | `{ year: 2025, period: 12, week: 53 }` | 2025 ends in 2026; still labelled 2025  |
| `2026-01-04` | `{ year: 2026, period: 1, week: 1 }`   | 2026 opens                              |

The same `ONS` calendar reproduces the start, end and weeks per period of every ONS sheet from
2004 to 2026, and 35 of the 41 sheets from 1986 to 2026. The other six (1991, 1992, 1996, 1997,
2002, 2003) are years where 31 December fell on a Tuesday. In those years ONS ended the year on
the Saturday four days later, not the Saturday three days earlier. That is a different
year-end rule, used before 2004. A caller covering those years states it as a second
`FiscalCalendar`. Tests cover 2025 only. The full scan is evidence for this spec, not a test.

**ONS (UK), 2020 (53 weeks).** Source: the same workbook, sheet "Trading Periods for 2020":
January 2019-12-29 to 2020-02-01 (5 weeks); sheet 2019 ends 2019-12-28; sheet 2021 opens
2021-01-03. **Verified.** A second ONS year, so the majority label is pinned for a year that
starts in December and ends in January.

| value        | expected                               | published fact                          |
| ------------ | -------------------------------------- | --------------------------------------- |
| `2019-12-28` | `{ year: 2019, period: 12, week: 52 }` | 2019 ends                               |
| `2019-12-29` | `{ year: 2020, period: 1, week: 1 }`   | 2020 opens in 2019; labelled 2020       |
| `2020-02-01` | `{ year: 2020, period: 1, week: 5 }`   | the five-week January ends              |
| `2020-02-02` | `{ year: 2020, period: 2, week: 6 }`   | February opens                          |
| `2021-01-02` | `{ year: 2020, period: 12, week: 53 }` | 2020 ends in 2021; still labelled 2020  |
| `2021-01-03` | `{ year: 2021, period: 1, week: 1 }`   | 2021 opens                              |

### 6.2 `extraWeek` placement (53-week year: NRF fiscal 2023, `4-5-4`)

| value        | `extraWeek`     | expected                               | note                                |
| ------------ | --------------- | -------------------------------------- | ----------------------------------- |
| `2023-02-25` | `"firstPeriod"` | `{ year: 2023, period: 1, week: 4 }`   |                                     |
| `2023-02-26` | `"firstPeriod"` | `{ year: 2023, period: 1, week: 5 }`   | period 1 is 5 weeks                 |
| `2023-03-04` | `"firstPeriod"` | `{ year: 2023, period: 1, week: 5 }`   |                                     |
| `2023-03-05` | `"firstPeriod"` | `{ year: 2023, period: 2, week: 6 }`   |                                     |
| `2023-02-26` | `"lastPeriod"`  | `{ year: 2023, period: 2, week: 5 }`   | same week, period 2                 |
| `2024-01-28` | `"firstPeriod"` | `{ year: 2023, period: 12, week: 53 }` | week 53 is in period 12 either way  |
| `2025-02-01` | ONS, `"lastPeriod"` | `{ year: 2025, period: 2, week: 5 }` | ONS week 5 moves to February        |
| `2026-01-03` | ONS, `"lastPeriod"` | `{ year: 2025, period: 12, week: 53 }` |                                   |
| `2024-06-15` | NRF (52 weeks), each value | `{ year: 2024, period: 5, week: 19 }` | no effect in a 52-week year |

`internal/fiscalCalendar.test.ts`: extend the existing whole-year walk to run each pattern under
both values. Assert that the 53-week walk gives the shapes listed in §3.1, and that the 52-week
walk is identical under both values.

