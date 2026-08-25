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
 * - `m12d30_7515` (2023-09-05 ISO): the last day of the 30-day 12th month, immediately before
 *   Pagumen — `+1 month` under `overflow: "reject"` THROWS (`Day 30 does not exist in
 *   resulting calendar month`), the sharpest overflow case in the whole library.
 * - `pagumen6_7515` is 2023-09-11 ISO and `pagumen5_7516` is 2024-09-10 ISO. (An earlier draft of
 *   this comment claimed `m12d30_7515` was "2023-08-12 ISO", which matches none of the three
 *   fixtures — corrected in E7, issue #152. The fixture *strings* were always right.)
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

/**
 * GMT calendar-annotated **zoned** fixtures — E7 (issue #152). Every value was generated by
 * running `convertZonedToCalendar` against `@js-temporal/polyfill@0.5.1`, never hand-written.
 *
 * Grammar: `<calendar-native-date>T<time><offset>[u-ca=<id>[;era=<era>]][<timeZone>]` — note
 * `[u-ca=...]` comes BEFORE `[timeZone]`, the reverse of RFC 9557. See
 * `regex/calendar-zoned-date-time.ts` for why that ordering is load-bearing.
 *
 * Each of the three blocks below pairs a calendar-boundary crossing with a DST transition **in
 * the same operation**, which is the whole point of E7 — no ordering of `plain/` calendar
 * arithmetic and `zoned/` conversion reproduces it.
 *
 * - `hebrewLeapMonth` — Adar I 15, 5784 (ISO 2024-02-24) in `America/New_York`, in EST. `+1 month`
 *   lands on Adar 15 (ISO 2024-03-25) in EDT: the calendar tag, the wall date AND the UTC offset
 *   all move in one call, and the answer is one calendar day away from the ISO control
 *   (2024-02-24 `+1 month` = 2024-03-24).
 * - `ethiopicPagumen` — Ethiopic-Amete-Alem 7517-12-30 (ISO 2025-09-05) in `America/Santiago`.
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
    adarI15NewYork: "5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]",
    adar15NewYork: "5784-07-15T14:30:00-04:00[u-ca=hebrew][America/New_York]",
    isoControl: "2024-02-24T14:30:00-05:00[America/New_York]",
    isoControlPlusMonth: "2024-03-24T14:30:00-04:00[America/New_York]",
  },
  ethiopicPagumen: {
    m12d30_7517Santiago:
      "7517-12-30T00:30:00-04:00[u-ca=ethiopic-amete-alem][America/Santiago]",
    pagumen5_7517Santiago:
      "7517-13-05T00:30:00-03:00[u-ca=ethiopic-amete-alem][America/Santiago]",
  },
  japaneseEraFold: {
    heisei31_0405Casablanca:
      "0031-04-05T02:30:00+01:00[u-ca=japanese;era=heisei][Africa/Casablanca]",
    reiwa1_0505CasablancaEarlier:
      "0001-05-05T02:30:00+01:00[u-ca=japanese;era=reiwa][Africa/Casablanca]",
    reiwa1_0505CasablancaLater:
      "0001-05-05T02:30:00+00:00[u-ca=japanese;era=reiwa][Africa/Casablanca]",
    heisei31_0430Tokyo:
      "0031-04-30T12:00:00+09:00[u-ca=japanese;era=heisei][Asia/Tokyo]",
    reiwa1_0501Tokyo:
      "0001-05-01T12:00:00+09:00[u-ca=japanese;era=reiwa][Asia/Tokyo]",
  },
  /**
   * Israel's 2024-03-29 spring-forward gap (02:00 -> 03:00 local), reached by adding 1 day to
   * Hebrew 5784-07-18 in `Asia/Jerusalem`. Included to pin the documented caveat that
   * `disambiguation` has NO effect on a gap landing — Temporal's arithmetic advances past the gap
   * before disambiguation is ever evaluated — and that a calendar tag does not change that.
   */
  jerusalemGap: {
    beforeGap: "5784-07-18T02:30:00+02:00[u-ca=hebrew][Asia/Jerusalem]",
    afterGap: "5784-07-19T03:30:00+03:00[u-ca=hebrew][Asia/Jerusalem]",
  },
  /**
   * Hebrew leap year 5784's own start/end boundary in `America/New_York`, at local midnight —
   * spans 13 Hebrew month boundaries where the ISO equivalent spans 14 (E7's DoD-11).
   */
  hebrewLeapYearSpan: {
    tishri1_5784NewYork:
      "5784-01-01T00:00:00-04:00[u-ca=hebrew][America/New_York]",
    tishri1_5785NewYork:
      "5785-01-01T00:00:00-04:00[u-ca=hebrew][America/New_York]",
    isoStart: "2023-09-16T00:00:00-04:00[America/New_York]",
    isoEnd: "2024-10-03T00:00:00-04:00[America/New_York]",
  },
} as const;
