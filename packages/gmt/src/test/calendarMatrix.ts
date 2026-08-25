import type { CalendarSystem } from "../types";

/**
 * All 13 `CalendarSystem` members, named for explicit `it.each` rows — E5 (issue #78).
 *
 * Example lookups:
 * - MustTestCalendars.hebrew => "hebrew"
 * - MustTestCalendars.ethiopic => "ethiopic"
 */
export const MustTestCalendars: Record<CalendarSystem, CalendarSystem> = {
  gregorian: "gregorian",
  hebrew: "hebrew",
  "islamic-civil": "islamic-civil",
  "islamic-tabular": "islamic-tabular",
  "islamic-umalqura": "islamic-umalqura",
  japanese: "japanese",
  buddhist: "buddhist",
  taiwan: "taiwan",
  persian: "persian",
  indian: "indian",
  ethiopic: "ethiopic",
  "ethiopic-amete-alem": "ethiopic-amete-alem",
  coptic: "coptic",
};

/**
 * The six-calendar structural sample used for E5 behavior tests — each is the representative
 * of one structural property, so the calendar x function matrix is sampled rather than
 * exhausted (13 calendars x every touched function would be a five-figure test count for
 * negligible additional signal — see the roadmap's E5 test-plan notes).
 *
 * - `gregorian` — identity/no-op control.
 * - `hebrew` — leap **month** (13-month year), the only supported calendar with this property.
 * - `islamic-tabular` — lunar 354/355-day year; representative of the three Islamic variants,
 *   which genuinely diverge from each other by 1-2 days (see `islamicVariantDivergence` below).
 * - `japanese` — era reset mid-arithmetic, `;era=` in the annotated string.
 * - `ethiopic` — 13-month + Pagumen (short 13th month), and the one calendar that cannot use
 *   Temporal's own calendar id (routes through "ethioaa" — see `internal/ethiopicFamilyCalendar.ts`).
 * - `persian` — independent solar leap-year cycle (not Gregorian-aligned, unlike Buddhist/Taiwan/Indian).
 */
export const SampledCalendars = {
  gregorian: "gregorian",
  hebrew: "hebrew",
  islamicTabular: "islamic-tabular",
  japanese: "japanese",
  ethiopic: "ethiopic",
  persian: "persian",
} as const satisfies Record<string, CalendarSystem>;

/**
 * Hebrew leap year 5784 (13 months, Adar I inserted at ordinal month 6) — the canonical
 * leap-month fixture for E5 tests. All values verified against `@js-temporal/polyfill@0.5.1`.
 *
 * - `adarI15` (5784-06-15, ISO 2024-02-24): 15 Adar I.
 * - `adar15` (5784-07-15, ISO 2024-03-25): 15 Adar (the "regular", non-leap-only month).
 * - `tishri1_5784` (5784-01-01, ISO 2023-09-16) / `tishri1_5785` (5785-01-01, ISO 2024-10-03):
 *   the leap year's own start/end boundary — spans 13 month boundaries, not 12.
 * - `tevet15_5785` (5785-04-15, ISO 2025-01-15): a 29-day month in the following, non-leap year
 *   5785 — used where a non-30-day month matters (e.g. `compareDurations`/`durationAs` goldens).
 */
export const hebrewLeapYear5784 = {
  adarI15: "5784-06-15[u-ca=hebrew]",
  adar15: "5784-07-15[u-ca=hebrew]",
  tishri1_5784: "5784-01-01[u-ca=hebrew]",
  tishri1_5785: "5785-01-01[u-ca=hebrew]",
  tevet15_5785: "5785-04-15[u-ca=hebrew]",
} as const;

/**
 * Ethiopic-family (via GMT-owned "ethioaa" arithmetic) Pagumen (13th month) boundary fixtures —
 * verified against `@js-temporal/polyfill@0.5.1`'s "ethioaa" calendar id (the ICU-independent
 * carrier `ethiopicFamilyCalendar.ts` uses for all three Ethiopic-family variants).
 *
 * - Ethiopic-Amete-Alem year 7515 has a 6-day Pagumen (leap); 7516 has a 5-day Pagumen.
 * - `m12d30_7515` (2023-08-12 ISO): the last day of the 30-day 12th month, immediately before
 *   Pagumen — `+1 month` under `overflow: "reject"` THROWS (`Day 30 does not exist in
 *   resulting calendar month`), the sharpest overflow case in the whole library.
 */
export const ethiopicPagumenFixture = {
  m12d30_7515: "7515-12-30[u-ca=ethiopic-amete-alem]",
  pagumen6_7515: "7515-13-06[u-ca=ethiopic-amete-alem]",
  pagumen5_7516: "7516-13-05[u-ca=ethiopic-amete-alem]",
} as const;

/**
 * Japanese era-transition fixtures spanning the 2019-05-01 Heisei -> Reiwa boundary — verified
 * against `@js-temporal/polyfill@0.5.1`. Era transitions are a non-event for ordering and
 * arithmetic (`compare`/`.add`/`.until` all behave identically across the boundary); only the
 * *string representation* (era name + era-relative year) changes.
 *
 * - `heisei31_0430` (2019-04-30, the last day of Heisei) `+ 1 day` re-derives to
 *   `reiwa1_0501` (2019-05-01, the first day of Reiwa) — the era/eraYear must be re-computed
 *   from the arithmetic result, never copied from the input's tag.
 */
export const japaneseEraBoundary = {
  heisei31_0430: "0031-04-30[u-ca=japanese;era=heisei]",
  reiwa1_0501: "0001-05-01[u-ca=japanese;era=reiwa]",
} as const;

/**
 * Islamic-variant divergence on the same Gregorian date (2020-02-24), verified against
 * `@js-temporal/polyfill@0.5.1` — the three Islamic (Hijri) calendars are NOT interchangeable:
 * `convertDateToCalendar("2020-02-24", "islamic-civil")` -> `"1441-06-29[u-ca=islamic-civil]"`,
 * `"islamic-tabular")` -> `"1441-07-01[u-ca=islamic-tabular]"`,
 * `"islamic-umalqura")` -> `"1441-06-30[u-ca=islamic-umalqura]"` — a genuine 1-2 day divergence,
 * not a rounding difference (see `packages/gmt/README.md`'s calendar-systems section).
 */
export const islamicVariantDivergence = {
  civil: "1441-06-29[u-ca=islamic-civil]",
  tabular: "1441-07-01[u-ca=islamic-tabular]",
  umalqura: "1441-06-30[u-ca=islamic-umalqura]",
} as const;

/**
 * Persian leap-year fixture — Persian year 1403 is leap (366 days; month 12 has 30 days
 * instead of 29). Verified against `@js-temporal/polyfill@0.5.1`.
 *
 * - `month12day30_1403` (2025-03-20 ISO) `+ 1 year` -> `1404-12-29[u-ca=persian]` (1404 is not
 *   leap, so month 12 constrains from 30 to 29 days).
 */
export const persianLeapYearFixture = {
  month12day30_1403: "1403-12-30[u-ca=persian]",
} as const;
