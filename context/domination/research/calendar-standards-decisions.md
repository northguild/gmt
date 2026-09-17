# Calendar Standards Decisions (CORE-6 calendar correctness)

**Research Date:** 2026-09-14  
**Purpose:** Decide the four open calendar questions from the CORE-6 calendar spec (§9) by authority, not preference, following the owner rule "use the absolute authoritative way".

**Authority order (highest first):**

1. TC39 Temporal specification
2. TC39 Intl Era and Month Code proposal and ECMA-402
3. RFC 9557, RFC 3339 and ISO 8601
4. CLDR
5. test262
6. Native engines (Chromium 152), as corroboration only

---

## Q1. Negative and expanded years, and the calendar string grammar

**Sources**

- **Temporal**
  - The grammar defines `DateYear ::: DecimalDigit{4} | ASCIISign DecimalDigit{6}`. An early error rejects `-000000`.
  - `PadISOYear` writes 4 digits for years 0–9999. Every other year gets a sign and 6 digits.
  - `TemporalDateToString` always writes the **ISO** year, month and day, followed by `FormatCalendarAnnotation`, which is `[u-ca=<id>]`. No era ever appears in a string.
- **RFC 3339 §5.6:** `date-fullyear = 4DIGIT`, limited to years 0000–9999.
- **RFC 9557:** it uses RFC 3339's date syntax unchanged. `u-ca` marks the calendar the date is *preferably presented* in, and the digits stay ISO. The suffix value syntax is `1*alphanum *("-" 1*alphanum)`, so `;era=…` is not RFC 9557 syntax.
- **No standard defines a machine-readable date string with calendar-native year digits.** CLDR/UTS 35 defines only localized display patterns.
- **Chromium 152** (corroboration):
  - Taiwan `1000-01-01` gives `"1000-01-01[u-ca=roc]"`.
  - `-000911-01-01[u-ca=roc]` parses.
  - `-0911-01-01` and `-000000-01-01` both throw.

**Decision**

- **GMT's calendar-annotated grammar (coding-standards E1) is not a standard.** The standard representation of a non-ISO date is the RFC 9557 ISO date plus `[u-ca=<id>]`, exactly what `Temporal.PlainDate#toString()` emits. Eras are fields, never string content.
- **E1 strings are also ambiguous.** `5785-01-01[u-ca=hebrew]` is a valid RFC 9557 string meaning ISO year 5785.
- **If E1 is kept,** the only standard that says how to write its year digits is `PadISOYear`:
  - 4 digits for years 0–9999, otherwise a sign plus 6 digits, with `-000000` forbidden;
  - so ISO year −911 is `-000911-01-01`, and Taiwan year −911 is `-000911-01-01[u-ca=taiwan]`;
  - the Hebrew edge rows are `-268058-11-04[u-ca=hebrew]` and `+279517-10-11[u-ca=hebrew]`.
- **The current regexes accept non-standard input.** `regex/calendar-date.ts` and `regex/calendar-zoned-date-time.ts` accept unsigned `\d{4,6}` years, which lets in 5-digit years that Temporal forbids. They accept no sign. A standard-conforming year pattern is `(\d{4}|[+-]\d{6})`.
- **This is a breaking change.** The standard form changes every shipped calendar string. Keeping E1 with `PadISOYear` changes shipped years above 9999, e.g. `279517-…` becomes `+279517-…`.

## Q2. Japanese era codes

**Sources**

- **Intl Era/Month Code proposal, `table-eras`:**

  | Era | Earliest era year | Latest era year | Offset |
  |---|---|---|---|
  | reiwa | 1 | ∞ | 2019 |
  | heisei | 1 | 31 | 1989 |
  | showa | 1 | 64 | 1926 |
  | taisho | 1 | 15 | 1912 |
  | meiji | **6** | 45 | 1868 |
  | ce (alias `ad`) | 1 | **1872** | epoch |
  | bce (alias `bc`) | 1 | ∞ | negative |

- **Calendar types table:** "For dates up to and including 1872-12-31, years and eras identical to `gregory` are used."
- **CLDR** inherits Gregorian `bce`/`ce` plus the Japanese eras. The proposal's 1873 rule outranks CLDR's Meiji start date.
- **test262** `intl402/Temporal/PlainDate/from/japanese-pre-meiji.js`:
  - ISO 1800-06-15 is `ce` year 1800.
  - ISO −99-01-01 is `bce` year 100.
  - The `extreme-dates.js` minimum row is `bce` 271822.
- **Chromium 152:**
  - 1868-10-23 is `ce` 1868, and 1872-12-31 is `ce` 1872.
  - 1873-01-01 is `meiji` 6.
  - 0000-12-31 is `bce` 1.
  - `japanese-inverse` throws "Unknown era".
- **Polyfill 0.5.1:**
  - 1800-01-01 is `japanese` 1800.
  - 1872-12-31 is `meiji` 5.
  - 0000-12-31 is `japanese-inverse` 1.

**Decision**

- **GMT emits only the proposal's era codes:**
  - ISO dates up to 1872-12-31 get `ce`, with era year = ISO year for years ≥ 1;
  - ISO years ≤ 0 get `bce`, with era year = 1 − ISO year;
  - from 1873-01-01, `meiji` (starting at year 6), then `taisho`, `showa`, `heisei` and `reiwa`.
- **Rows:**

  | ISO date | GMT string |
  |---|---|
  | `1800-01-01` | `1800-01-01[u-ca=japanese;era=ce]` |
  | `1872-12-31` | `1872-12-31[u-ca=japanese;era=ce]` |
  | `1873-01-01` | `0006-01-01[u-ca=japanese;era=meiji]` |
  | `-000500-06-15` | `0501-06-15[u-ca=japanese;era=bce]` |

- **The workaround must also remap polyfill `meiji` years 1–5** (1868-10-23 to 1872-12-31) to `ce`. GMT never emits `japanese-inverse`.
- **This is a breaking change.** The shipped `;era=japanese` output (documented in the README) becomes `;era=ce`, and pre-1873 `meiji` becomes `ce`.

## Q3. Buddhist before 1582-10-15

**Sources**

- **Intl Era/Month Code proposal:**
  - "All calendar types must use a proleptic reckoning … ignoring dates when historical calendar reforms happened."
  - Buddhist month numbers, month codes and days are "identical to ISO 8601".
  - Era `be` covers −∞ to +∞; the epoch year is −543.
- **CLDR:** era `be` starts at −542-01-01, which is an offset of +543. There is no Julian cutover.
- **test262:**
  - `extreme-dates.js` has buddhist −271278-M04-19 and 276303-M09-13, i.e. ISO year + 543 with the same month and day.
  - `add/proleptic-buddhist.js` has 2125-M10-04 + 3 days = 2125-M10-07, so there is no cutover gap.
- **Chromium 152:** 1000-01-01 is `be` 1543-M01-01, and 1582-10-04 is 2125-M10-04.
- **Polyfill 0.5.1** uses the Julian hybrid: 1000-01-01 gives 1542-M12-27 and 1582-10-04 gives 2125-M09-24. Polyfill `main` (`2bb6ba1`) is proleptic.

**Decision**

- **Buddhist is proleptic Gregorian,** with year = ISO year + 543 for every date and no cutover. Era year 0 and negative years are valid.
- **Rows:**

  | ISO date | GMT string |
  |---|---|
  | `1000-01-01` | `1543-01-01[u-ca=buddhist]` |
  | `1582-10-04` | `2125-10-04[u-ca=buddhist]` |
  | `-000544-01-01` | `-000001-01-01[u-ca=buddhist]` |

- **Breaking:** none beyond the Q1 year format. The +543 offset is normative, not CLDR data, and pre-1582 values change only as a bug fix.

## Q4. Hebrew years ≤ 0 and Indian before ISO year 1

**Sources**

- **Temporal:** `ISODateWithinLimits` covers −271821-04-19 to +275760-09-13. All rows below are in range, so a throw or a sentinel is not a conforming outcome.
- **Intl Era/Month Code proposal:**
  - Hebrew `am` and Indian `shaka` both cover −∞ to +∞. Their epoch ISO years are −3761 and 78.
  - The proleptic rule applies to every calendar.
  - Only persian, chinese and dangi get an "implementation-defined approximation outside that range". Hebrew and Indian do not.
  - "Implementation-defined processing" in `CalendarDateArithmeticYear` leaves the method to the engine. It does not permit wrong results.
- **test262:**
  - `non-positive-single-era-year.js` accepts `am` and `shaka` era years −1, 0 and 1.
  - `extreme-dates.js` has hebrew −268058-M11-04 `am` and indian −271899-M01-29 `shaka`.
- **Chromium 152:**

  | ISO date | Calendar | Result |
  |---|---|---|
  | −3761-09-01 | hebrew | am 0-M01-13 |
  | −100000-01-01 | hebrew | −96239-M06-23 |
  | −271821-11-05 | hebrew | −268057-M05-28 |
  | −500-06-15 | indian | −578-M03-25 |
  | 0000-01-01 | indian | −79-M10-11 |

- **Polyfill 0.5.1:**
  - Hebrew is one day off for years ≤ 0 (D4, a Node ICU bug fixed in ICU `5267bb5778`, ICU-23007).
  - It throws "Missing month" for negative leap years (D3).
  - Indian throws for every ISO year < 1 (D5).

**Decision**

- **GMT must return correct proleptic values** for Hebrew years ≤ 0 and Indian dates before ISO year 1, with `am`/`shaka` and signed years. A sentinel is not conforming.
- **Rows:**

  | ISO date | Calendar | GMT string |
  |---|---|---|
  | `-003761-09-01` | hebrew | `0000-01-13[u-ca=hebrew]` |
  | `-100000-01-01` | hebrew | `-096239-06-23[u-ca=hebrew]` |
  | `-000500-06-15` | indian | `-000578-03-25[u-ca=indian]` |

- **This conflicts with the owner's future-proofing rule** ("never own calendar rules or data"). A conforming result needs GMT to own the Hebrew arithmetic rule (Dershowitz–Reingold) and the Indian leap-year rule (tied to Gregorian leap years; the proposal does not state it, but Chromium matches it).
- **ICU bug D4 has no exemption.** Standards do not excuse it, so returning Node's ICU result is non-conforming until Node ships the fixed ICU.

---

## Owner decisions (2026-09-14)

1. **Q1: adopt the standard form,** an ISO date plus `[u-ca=<id>]`. It is a breaking change to every shipped calendar string, so it ships as its own story, not in CORE-6. (Delivered with CORE-8 in 1.16.0 after the owner ruled out a major release on 2026-09-17.)
2. **Q2: emit the proposal era codes** (`ce`, `bce`, `meiji` from 1873 at year 6, …). (Superseded 2026-09-17: 1.16.0 removed `;era=` from the grammar, and the `japanese` alias with it.)
3. **Q4: the standard wins over the future-proofing rule.** GMT implements the published Hebrew and Indian arithmetic rules in its compat layer. They stay dormant unless the runtime is wrong, and are removed once Node's ICU and the polyfill are fixed.

## Owner decisions that were required

1. **Q1 grammar.**
   - Move to the standard `ISO date + [u-ca=<id>]` form, which changes every shipped calendar string.
   - Or keep E1 with `PadISOYear`, which changes shipped years above 9999, and decide whether unsigned 5–6 digit years stay accepted as legacy input.
2. **Q2 era output.** `japanese` becomes `ce`, and pre-1873 `meiji` becomes `ce`. Decide whether `japanese` stays accepted as a legacy input token.
3. **Q4 policy conflict.** Correct Hebrew ≤ 0 and Indian < 1 values require GMT-owned calendar rules, against the future-proofing rule.

## Sources

- TC39 Temporal: https://tc39.es/proposal-temporal/ (`DateYear`, `PadISOYear`, `TemporalDateToString`, `FormatCalendarAnnotation`, `ISODateWithinLimits`)
- TC39 Intl Era and Month Code proposal: https://github.com/tc39/proposal-intl-era-monthcode/blob/main/spec.emu (`table-calendar-types`, `table-eras`, epoch years)
- RFC 3339 §1, §5.6: https://www.rfc-editor.org/rfc/rfc3339
- RFC 9557 §3.3, §4.1, §5: https://www.rfc-editor.org/rfc/rfc9557
- CLDR `supplementalData.xml` `<calendarData>`: https://github.com/unicode-org/cldr/blob/main/common/supplemental/supplementalData.xml
- test262 `intl402/Temporal/PlainDate/from/{extreme-dates,japanese-pre-meiji,non-positive-single-era-year}.js` and `prototype/add/proleptic-buddhist.js`: https://github.com/tc39/test262/tree/main/test/intl402/Temporal/PlainDate
- Related: [CORE-6 calendar correctness spec](../specs/CORE-6-calendar-correctness-spec.md), [range-edge correctness audit](./range-edge-correctness-audit.md)
