import type { CalendarSystem } from "../types";

/**
 * All 14 `CalendarSystem` members (canonical calendar ids), named for explicit `it.each` rows.
 *
 * Example lookups:
 * - MustTestCalendars.hebrew => "hebrew"
 * - MustTestCalendars.ethioaa => "ethioaa"
 */
export const MustTestCalendars: Record<CalendarSystem, CalendarSystem> = {
  iso8601: "iso8601",
  gregory: "gregory",
  hebrew: "hebrew",
  "islamic-civil": "islamic-civil",
  "islamic-tbla": "islamic-tbla",
  "islamic-umalqura": "islamic-umalqura",
  japanese: "japanese",
  buddhist: "buddhist",
  roc: "roc",
  persian: "persian",
  indian: "indian",
  ethiopic: "ethiopic",
  ethioaa: "ethioaa",
  coptic: "coptic",
};

/**
 * The six-calendar structural sample used for calendar behavior tests — each is the representative
 * of one structural property, so the calendar x function matrix is sampled rather than
 * exhausted.
 *
 * - `iso8601` — identity/no-op control (a bare ISO string).
 * - `hebrew` — leap **month** (13-month year), the only supported calendar with this property.
 * - `islamicTabular` (`islamic-tbla`) — lunar 354/355-day year; representative of the three
 *   Islamic variants, which genuinely diverge from each other by 1-2 days in their fields.
 * - `japanese` — era reset mid-arithmetic.
 * - `ethiopic` — 13-month + Pagumen (short 13th month), and a calendar that computes through
 *   `"ethioaa"` (see `internal/calendarSystemIds.ts` `computationCalendarId`).
 * - `persian` — independent solar leap-year cycle (not Gregorian-aligned, unlike Buddhist/ROC/Indian).
 */
export const SampledCalendars = {
  iso8601: "iso8601",
  hebrew: "hebrew",
  islamicTabular: "islamic-tbla",
  japanese: "japanese",
  ethiopic: "ethiopic",
  persian: "persian",
} as const satisfies Record<string, CalendarSystem>;

/**
 * Hebrew leap year 5784 (13 months, Adar I inserted at ordinal month 6) — the canonical
 * leap-month fixture. Strings are RFC 9557 (ISO date + `[u-ca=hebrew]`), each from native
 * Temporal (Chromium 153): `Temporal.PlainDate.from({ calendar: "hebrew", year, month, day })`.
 *
 * - `adarI15` (5784-06-15, ISO 2024-02-24): 15 Adar I.
 * - `adar15` (5784-07-15, ISO 2024-03-25): 15 Adar (the "regular", non-leap-only month).
 * - `tishri1_5784` (5784-01-01, ISO 2023-09-16) / `tishri1_5785` (5785-01-01, ISO 2024-10-03):
 *   the leap year's own start/end boundary — spans 13 month boundaries, not 12.
 * - `tevet15_5785` (5785-04-15, ISO 2025-01-15): a 29-day month in the following, non-leap year
 *   5785 — used where a non-30-day month matters (e.g. `compareDurations`/`durationAs` goldens).
 */
export const hebrewLeapYear5784 = {
  adarI15: "2024-02-24[u-ca=hebrew]",
  adar15: "2024-03-25[u-ca=hebrew]",
  tishri1_5784: "2023-09-16[u-ca=hebrew]",
  tishri1_5785: "2024-10-03[u-ca=hebrew]",
  tevet15_5785: "2025-01-15[u-ca=hebrew]",
} as const;

/**
 * Ethiopic Amete Alem (`ethioaa`) Pagumen (13th month) boundary fixtures, from native Temporal
 * (Chromium 153).
 *
 * - Ethiopic Amete Alem year 7515 has a 6-day Pagumen (leap); 7516 has a 5-day Pagumen.
 * - `m12d30_7515` (2023-09-05 ISO): the last day of the 30-day 12th month, immediately before
 *   Pagumen — `+1 month` under `overflow: "reject"` THROWS (`Day 30 does not exist in
 *   resulting calendar month`), the sharpest overflow case in the whole library.
 * - `pagumen6_7515` is 7515-13-06 (2023-09-11 ISO) and `pagumen5_7516` is 7516-13-05 (2024-09-10 ISO).
 */
export const ethiopicPagumenFixture = {
  m12d30_7515: "2023-09-05[u-ca=ethioaa]",
  pagumen6_7515: "2023-09-11[u-ca=ethioaa]",
  pagumen5_7516: "2024-09-10[u-ca=ethioaa]",
} as const;

/**
 * Japanese era-transition fixtures spanning the 2019-05-01 Heisei -> Reiwa boundary. Era
 * transitions are a non-event for ordering, arithmetic and the string (which carries ISO digits);
 * only the era and era year read from the date change.
 *
 * - `heisei31_0430` (2019-04-30, the last day of Heisei) `+ 1 day` re-derives to
 *   `reiwa1_0501` (2019-05-01, the first day of Reiwa).
 */
export const japaneseEraBoundary = {
  heisei31_0430: "2019-04-30[u-ca=japanese]",
  reiwa1_0501: "2019-05-01[u-ca=japanese]",
} as const;

/**
 * Islamic-variant divergence on the same ISO date (2020-02-24). The three Islamic (Hijri) calendars
 * are NOT interchangeable: native Temporal reads that date as islamic-civil 1441-06-29,
 * islamic-tbla 1441-07-01 and islamic-umalqura 1441-06-30, so `+1 month` lands on different ISO
 * dates (2020-03-24, 2020-03-25, 2020-03-24).
 */
export const islamicVariantDivergence = {
  civil: "2020-02-24[u-ca=islamic-civil]",
  tabular: "2020-02-24[u-ca=islamic-tbla]",
  umalqura: "2020-02-24[u-ca=islamic-umalqura]",
} as const;

/**
 * Persian leap-year fixture — Persian year 1403 is leap (366 days; month 12 has 30 days
 * instead of 29). From native Temporal (Chromium 153).
 *
 * - `month12day30_1403` (1403-12-30, 2025-03-20 ISO) `+ 1 year` -> 1404-12-29,
 *   `2026-03-20[u-ca=persian]` (1404 is not
 *   leap, so month 12 constrains from 30 to 29 days).
 */
export const persianLeapYearFixture = {
  month12day30_1403: "2025-03-20[u-ca=persian]",
} as const;

/**
 * Calendar-annotated **zoned** fixtures, RFC 9557 `<date>T<time><offset>[<timeZone>][u-ca=<id>]`,
 * exactly `Temporal.ZonedDateTime#toString()`. Each converted from its calendar fields by native
 * Temporal (Chromium 153).
 *
 * Each of the three blocks below pairs a calendar-boundary crossing with a DST transition **in
 * the same operation**, which is the whole point of E7 — no ordering of `plain/` calendar
 * arithmetic and `zoned/` conversion reproduces it.
 *
 * - `hebrewLeapMonth` — Adar I 15, 5784 (ISO 2024-02-24) in `America/New_York`, in EST. `+1 month`
 *   lands on Adar 15 (ISO 2024-03-25) in EDT: the calendar tag, the wall date AND the UTC offset
 *   all move in one call, and the answer is one calendar day away from the ISO control
 *   (2024-02-24 `+1 month` = 2024-03-24).
 * - `ethiopicPagumen` — Ethiopic-Amete-Alem 7517-12-30 (ISO 2025-09-05) in `America/Santiago` (`ethioaa`).
 *   `+1 month` overflows the 30-day 12th month into the 5-day Pagumen (7517-13-05, ISO
 *   2025-09-10), crossing Chile's 2025-09-07 spring-forward on the way (-04:00 -> -03:00); under
 *   `overflow: "reject"` it throws instead.
 * - `japaneseEraFold` — Japanese Heisei 31-04-05 (ISO 2019-04-05) in `Africa/Casablanca`.
 *   `+1 month` crosses the 2019-05-01 Heisei -> Reiwa boundary AND lands inside Morocco's
 *   2019-05-05 fall-back fold, so the era changes and the offset depends on `disambiguation`
 *   (`compatible`/`earlier` -> +01:00, `later` -> +00:00, `reject` -> the function's sentinel).
 *
 * **Do not "simplify" these zones to `America/New_York`.** `Africa/Casablanca` and
 * `America/Santiago` were chosen because they are the only zones whose DST transitions coincide
 * with, respectively, the Japanese era boundary and the Ethiopic Pagumen window. Swapping either
 * for a more familiar zone silently deletes the DST-interaction coverage while leaving the tests
 * green.
 */
export const calendarZonedFixtures = {
  hebrewLeapMonth: {
    adarI15NewYork: "2024-02-24T14:30:00-05:00[America/New_York][u-ca=hebrew]",
    adar15NewYork: "2024-03-25T14:30:00-04:00[America/New_York][u-ca=hebrew]",
    isoControl: "2024-02-24T14:30:00-05:00[America/New_York]",
    isoControlPlusMonth: "2024-03-24T14:30:00-04:00[America/New_York]",
  },
  ethiopicPagumen: {
    m12d30_7517Santiago:
      "2025-09-05T00:30:00-04:00[America/Santiago][u-ca=ethioaa]",
    pagumen5_7517Santiago:
      "2025-09-10T00:30:00-03:00[America/Santiago][u-ca=ethioaa]",
  },
  japaneseEraFold: {
    heisei31_0405Casablanca:
      "2019-04-05T02:30:00+01:00[Africa/Casablanca][u-ca=japanese]",
    reiwa1_0505CasablancaEarlier:
      "2019-05-05T02:30:00+01:00[Africa/Casablanca][u-ca=japanese]",
    reiwa1_0505CasablancaLater:
      "2019-05-05T02:30:00+00:00[Africa/Casablanca][u-ca=japanese]",
    heisei31_0430Tokyo: "2019-04-30T12:00:00+09:00[Asia/Tokyo][u-ca=japanese]",
    reiwa1_0501Tokyo: "2019-05-01T12:00:00+09:00[Asia/Tokyo][u-ca=japanese]",
  },
  /**
   * Israel's 2024-03-29 spring-forward gap (02:00 -> 03:00 local), reached by adding 1 day to
   * Hebrew 5784-07-18 in `Asia/Jerusalem`. `afterGap` is the "compatible"/"later" resolution of
   * that gap landing (TC39 AddZonedDateTime); a calendar tag does not change how `disambiguation`
   * resolves it.
   */
  jerusalemGap: {
    beforeGap: "2024-03-28T02:30:00+02:00[Asia/Jerusalem][u-ca=hebrew]",
    afterGap: "2024-03-29T03:30:00+03:00[Asia/Jerusalem][u-ca=hebrew]",
  },
  /**
   * Hebrew leap year 5784's own start/end boundary in `America/New_York`, at local midnight —
   * spans 13 Hebrew month boundaries where the ISO equivalent spans 14 (E7's DoD-11).
   */
  hebrewLeapYearSpan: {
    tishri1_5784NewYork:
      "2023-09-16T00:00:00-04:00[America/New_York][u-ca=hebrew]",
    tishri1_5785NewYork:
      "2024-10-03T00:00:00-04:00[America/New_York][u-ca=hebrew]",
    isoStart: "2023-09-16T00:00:00-04:00[America/New_York]",
    isoEnd: "2024-10-03T00:00:00-04:00[America/New_York]",
  },
} as const;
