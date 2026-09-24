# Finance and Space realm — primary-source verification

Researched 2026-09-23. Every claim carries a quote (≤125 chars), the URL and the clause. Where the
issuing body's own text could not be reached the item says `NOT FOUND` and what was tried. PDFs
that the fetch tool could not read were downloaded and text-extracted locally (pypdf); quotes come
from that extracted text. Quotes are verbatim except where PDF extraction dropped a space.

Precedence applied: issuing body's text > body-hosted FAQ/notice > reproduction of the body's text
by a third party (marked "reproduction") > implementer guide (OpenGamma, marked "secondary").

---

## 1. Day-count rules — ISDA 2006 Definitions §4.16 (with supplements)

Source: 2006 ISDA Definitions, ISDA text as hosted by Standard Chartered (complete copy, §4.16 on
pp. 11–13). Supplements 14 and 43 from the ISDA supplements compilation hosted by the same bank.
OpenGamma used only as secondary confirmation, marked as such.

- Base text: https://www.sc.com/en/uploads/sites/66/content/docs/2006-ISDA-Definitions.pdf
- Supplements: https://www.sc.com/en/uploads/sites/66/content/docs/Supplements-to-2006-ISDA-Defs_as-of-5-Sept-2019.pdf
- Secondary: OpenGamma, *Interest Rate Instruments and Market Conventions Guide*, ed. 2.0 (2013),
  ch. 3 "Day count conventions" — https://quant.opengamma.io/Interest-Rate-Instruments-and-Market-Conventions.pdf

Shared 30/360 formula, §4.16(f)(g)(h): `[360×(Y2−Y1) + 30×(M2−M1) + (D2−D1)] / 360`. In all three,
Y1/M1/D1 are of "the first day of the Calculation Period" and Y2/M2/D2 of "the day immediately
following the last day included in the Calculation Period".

| Code (FpML) | ISDA 2006 clause | Rule (quote) |
|---|---|---|
| 1/1 | §4.16(a) | "if “1/1” is specified, 1" |
| ACT/ACT.ISDA | §4.16(b) | "the actual number of days in that portion ... falling in a leap year divided by 366 and (ii) ... non-leap year divided by 365" |
| ACT/ACT.ICMA | §4.16(c) | "a fraction equal to “number of days accrued/number of days in year”, as such terms are used in Rule 251" (ICMA Rule Book, bonds issued after 31 Dec 1998) |
| ACT/365.FIXED | §4.16(d) | "the actual number of days in the Calculation Period ... divided by 365" |
| ACT/360 | §4.16(e) | "the actual number of days in the Calculation Period ... divided by 360" |
| 30/360 | §4.16(f) | D1: "unless such number would be 31, in which case D1 will be 30"; D2: "unless such number would be 31 and D1 is greater than 29, in which case D2 will be 30" |
| 30E/360 | §4.16(g) | D1: "unless such number would be 31, in which case D1 will be 30"; D2: "unless such number would be 31, in which case D2 will be 30" |
| 30E/360.ISDA | §4.16(h) | D1: "unless (i) that day is the last day of February or (ii) such number would be 31, in which case D1 will be 30"; D2: "unless (i) that day is the last day of February but not the Termination Date or (ii) such number would be 31, in which case D2 will be 30" |
| ACT/365L | §4.16(i), added by Supplement 14 (published June 5, 2009) | "divided by 365 (or, if the later Period End Date of the Calculation Period or Compounding Period falls in a leap year, divided by 366)" |
| RBA | §4.16(j)(k)(l), added by Supplement 43 (published September 05, 2014) | "(j) if “RBA Bond Basis (quarter)” is specified, 0.25. However, Actual/Actual (ISDA) applies to each of the first ... and the final Calculation Period if ... less than three months" (k) = 0.5 / six months; (l) = 1 / twelve months |

Year-basis choice: ACT/ACT.ISDA splits the period at the calendar-year boundary (366 for the
leap-year portion, 365 otherwise); ACT/365L picks 366 if the *later Period End Date* is in a leap
year; ACT/ACT.ICMA uses the ICMA "days in year" = coupon-period days × frequency (Rule 251, see
OpenGamma §3.13 for the stub adjustments — secondary).

Secondary confirmation (OpenGamma ch. 3): "30/360 ... If D1 is 31, then change D1 to 30. If D2 is
31 and D1 is 30 or 31, then change D2 to 30." (§3.3); "30E/360 (ISDA) ... If D1 is the last day of
the month, then change D1 to 30. If D2 is the last day of February but not the termination date or
D2 is 31, then change D2 to 30." (§3.5). Note OpenGamma paraphrases (h)'s D1 rule as "last day of
the month", which is equivalent (31 or last day of Feb) only for months of 31 days and February;
for a 30-day month "last day = 30" already. Follow the ISDA text.

ISDA Introduction to the 2006 Definitions (same PDF, p. viii): 30E/360 (g) "has been modified ...
to reflect the formulation of 30E/360 used by organizations such as ICMA"; 30E/360 (ISDA) (h) "is
designed to yield the same results in practice as the version of the 30E/360 day count fraction
included in the 2000 Definitions."

## 2. "30/360 US" (SIA / 30U/360) with end-of-February rules

**Primary text: NOT FOUND.** SIFMA/SIA *Standard Securities Calculation Methods* (Mayle, TIPS/SIA,
3rd ed. 2007) is a printed book; no copy is published by SIFMA online. Tried: WebSearch for the
title with the February rule wording — only glossaries (cbonds.com, Wikipedia, blogs) surfaced.
ISDA's own "30/360 Day Count Conventions" page (https://www.isda.org/2008/12/22/30-360-day-count-conventions/)
only links a spreadsheet, "30-360-2006ISDADefs(xls)", with no rule text on the page.

Secondary description (OpenGamma §3.3): "There exists also a version of the day count which
depends on an EOM convention. In that case an extra rule is added: If EOM and D1 is last day of
February and D2 is last day of February, then change D2 to 30 and D1 to 30." and "This day count
convention is also called 30/360 US, 30U/360, Bond basis, 30/360 or 360/360."

Caution: the two-step formulation in the brief (D1 last-Feb → 30 unconditionally; D2 last-Feb → 30
only if D1 was) is *not* what OpenGamma states (it gives a joint EOM condition), and no primary
source was reached that states either form. Do not implement from either paraphrase without the
SIFMA text.

**Does an FpML/ISDA code correspond?** No. ISDA 2006 §4.16(f) "30/360"/"Bond Basis" has no
February rule (quoted above), and OpenGamma: "The ISDA definitions do not refer to the EOM
convention." FpML's `30/360` code points at §4.16(f) / 2021 §4.6.1(vi). The February variant has no
FpML code in day-count-fraction 2-3.

## 3. FpML — calculation period dates, roll/stub enums, payment dates, business centers

FpML 5.12 (Recommendation 4) schema documentation, fpml.org.

**CalculationPeriodDates** (fpml-ird-5-12.xsd), children in order:
https://www.fpml.org/spec/fpml-5-12-4-rec-1/html/confirmation/schemaDocumentation/schemas/fpml-ird-5-12_xsd/complexTypes/CalculationPeriodDates.html
- `effectiveDate` | `relativeEffectiveDate` (choice): "The first day of the term of the trade."
- `terminationDate` | `relativeTerminationDate` (choice): "The last day of the term of the trade."
- `calculationPeriodDatesAdjustments` (1..1): "The business day convention to apply to each calculation period end date"
- `firstPeriodStartDate` (0..1): "The start date of the calculation period if the date falls before the effective date."
- `firstRegularPeriodStartDate` (0..1): "must only be specified if there is an initial stub calculation period."
- `firstCompoundingPeriodEndDate` (0..1)
- `lastRegularPeriodEndDate` (0..1): "must only be specified if there is a final stub calculation period."
- `stubPeriodType` (0..1): "Method to allocate any irregular period remaining after regular periods have been allocated"
- `calculationPeriodFrequency` (1..1): "frequency at which calculation period end dates occur ... and their roll date convention."

**RollConventionEnum** (fpml-enum-5-12.xsd):
https://www.fpml.org/spec/fpml-5-12-4-rec-1/html/confirmation/schemaDocumentation/schemas/fpml-enum-5-12_xsd/simpleTypes/RollConventionEnum.html
- Type doc: "The convention for determining the sequence of calculation period end dates."
- `EOM`: "Rolls on month end dates irrespective of the length of the month and the previous roll day."
- `FRN`: "Roll days are determined according to the FRN Convention or Eurodollar Convention as described in ISDA 2000 definitions."
- `IMM`: "IMM Settlement Dates. The third Wednesday of the (delivery) month."
- `IMMCAD`: "The last trading day/expiration day of the Canadian Derivatives Exchange (Bourse de Montreal Inc) Three-month Canadian..."
- `IMMAUD`: "The last trading day of the Sydney Futures Exchange 90 Day Bank Accepted Bills Futures contract..."
- `IMMNZD`: "The last trading day of the Sydney Futures Exchange NZ 90 Day Bank Bill Futures contract..."
- `SFE`: "Sydney Futures Exchange 90-Day Bank Accepted Bill Futures Settlement Dates. The second Friday of the (delivery) month."
- `NONE`: "The roll convention is not required. For example, in the case of a daily calculation frequency."
- `TBILL`: "13-week and 26-week U.S. Treasury Bill Auction Dates. Each Monday except for U.S. (New York) holidays..."
- `1`…`30`: "Rolls on the 1st day of the month" etc.
- `MON`…`SUN`: "Rolling weekly on a Monday" etc.

**StubPeriodTypeEnum** (fpml-enum-5-12.xsd):
https://www.fpml.org/spec/fpml-5-12-4-rec-1/html/confirmation/schemaDocumentation/schemas/fpml-enum-5-12_xsd/simpleTypes/StubPeriodTypeEnum.html
- `ShortInitial`: "left shorter than the streams calculation period frequency and placed at the start of the stream"
- `ShortFinal`: "left shorter ... and placed at the end of the stream"
- `LongInitial`: "placed at the start of the stream and combined with the adjacent calculation period to give a long first calculation period"
- `LongFinal`: "placed at the end of the stream and combined with the adjacent calculation period to give a long last calculation period"

**PaymentDates** (fpml-ird-5-12.xsd):
https://www.fpml.org/spec/fpml-5-12-4-rec-1/html/confirmation/schemaDocumentation/schemas/fpml-ird-5-12_xsd/complexTypes/PaymentDates.html
- `calculationPeriodDatesReference` | `resetDatesReference` | `valuationDatesReference` (choice)
- `paymentFrequency` (1..1): "If the payment frequency is equal to the frequency defined in the calculation period dates component then one calculation period contributes to each payment amount."
- `firstPaymentDate` (0..1), `lastRegularPaymentDate` (0..1): "unadjusted payment date"
- `payRelativeTo` (1..1): "relative to each adjusted calculation period start date, adjusted calculation period end date or each reset date."
- `paymentDaysOffset` (0..1): "If early payment or delayed payment is required, specifies the number of days offset that the payment occurs"
- `paymentDatesAdjustments` (1..1)

**Business-center coding scheme** — canonical URI `http://www.fpml.org/coding-scheme/business-center`, version 9-4:
https://www.fpml.org/coding-scheme/business-center
- `USNY` "New York, United States" · `GBLO` "London, United Kingdom" · `EUTA` "TARGET Settlement Day" · `JPTO` "Tokyo, Japan"

**Day-count-fraction scheme** — canonical URI `http://www.fpml.org/coding-scheme/day-count-fraction`,
version URI `http://www.fpml.org/coding-scheme/day-count-fraction-2-3` (https://www.fpml.org/coding-scheme/day-count-fraction-2-3.xml).

## 4. ISDA overnight-RFR compounding/averaging conventions

Primary: ISDA memorandum A40393158 v18.0, *Documenting RFR derivatives using different approaches
to compounding/averaging under the 2006 ISDA Definitions* (2021), §1 "Compounding/Averaging
conventions". https://www.isda.org/a/alEgE/A40393158-v18.0-ISDA_Memorandum_Compounding-RFRs-under-2006-Definitions.pdf

- §1.1 **Lookback**: "the rate for each business day in a Calculation Period is determined on the basis of the rate observed for a certain number of business days prior"; weight: "The weighting to be given to the rate depends on the relevant day in the Calculation Period." (holiday in the *calculation* period → weight 2 on the preceding business day's rate).
- §1.2 **Observation Period Shift**: "both the start and end dates are shifted by a certain number of days"; "both the rate and the weighting are determined on the basis of the relevant day in this observation period"; "the rate will be annualized and apply based on the number of days in the Calculation Period".
- §1.3 **Lockout**: "(i) for each day ... up to and including the first day of the lockout period, the level of the rate observed for such day"; "(ii) for each remaining day ... the level of the rate observed for the first day of that lockout period (the ‘lockout date’)"; weights: "there is no change to the weighting during the, or as a result of the inclusion of, a lockout period." Footnote 4: a 5-BD lockout by reference to the Period End Date means "the same fixing being used 5 times but having a lockout period that is strictly only 4 Business Days."
- §1.4 **Payment Delay**: "the rates are observed for each day during the Calculation Period and the Floating Rate Payer Payment Date falls a number of business days after"; "the rate for each business day ... (and the weighting given to such rate ...) is based on the rate observed for that day." Example: "two business days for USD OIS".
- Memo p. 3 table: elections are "OIS formula – Observation Period Shift / Lookback / Lockout" and "Average formula – ..." with "Delayed Payment" for the plain OIS formula.

ARRC, *An Updated User's Guide to SOFR* (2021), §"Models for Using SOFR in Arrears", pp. 17–19:
https://www.newyorkfed.org/medialibrary/Microsites/arrc/files/2021/users-guide-to-sofr2021-update.pdf
- Payment Delay: "interest is paid k days after the start of the next period." (p. 17)
- Lockout/Suspension: "the SOFR rate applied for the last k days of the interest period is frozen at the rate observed k days before the period ends." (p. 17)
- Lookback: "For each day in the interest period, the SOFR rate from k business days earlier is used to accrue interest." (p. 17)
- Lookback without observation shift: weight = "the number of calendar days until the next business day following date t (nt)" (p. 18)
- Lookback with observation shift: "applies that rate for the number of calendar days until next business date following the observation date." (p. 18)
- "Interest-Period Weighted Observation Shift": annualized shifted rate applied "to the number of days in the interest period" (p. 19; detail in Appendix 4).
- Fn. 11 (p. 19): ISDA fallback = "Two-Day Backward Shifted Observation Period and No Lockouts".

## 5. CDS standard roll dates (ISDA, 2015)

- ISDA news release, 8 July 2015: "Under the current convention, market participants roll to a new on-the-run contract each quarter, on March 20, June 20, September 20 and December 20." and "the frequency of this roll be reduced to March and September." https://www.isda.org/a/7qiDE/isda-recommendation-single-name-cds-roll-frequency-final-release.pdf
- ISDA FAQ, revised December 10, 2015, Q1: "This convention will go-live on December 20, 2015." https://www.isda.org/a/vGiDE/amend-single-name-on-the-run-frequency-faq-revised-as-of-12-10.pdf
- Q3 (same FAQ): "Coupon payments will still occur on a quarterly basis" and "Reducing the frequency of when the market considers a contract as the on-the-run is the only change."
- Q7 schedule: "March 20, 2016 - Single Name CDS contracts will ‘roll’ to June 20, 2021 (on-the-run)"; "December 20, 2015 – Single Name CDS contracts Do Not ‘roll’ forward." → on-the-run 5Y maturities are 20 June / 20 December.
- Footnote 1: "December 20, 2015 will be the first time market participants apply the new convention (i.e. not rolling ...)".

**Correction to the brief:** ISDA's own documents give the go-live as **20 December 2015**, not
21 December. Quarterly coupon dates 20 Mar/Jun/Sep/Dec are confirmed as unchanged (Q3).

## 6. CME Globex trade date

**CME Rulebook Chapter 1 / trading-hours page: NOT FOUND (blocked).** cmegroup.com returned
`{"message": "This IP address is blocked due to suspected web scraping activity..."}` to curl and
timed out for the fetch tool on `/rulebook/CME/I/1/1.pdf`, `/rulebook/CBOT/I/1/1.pdf`,
`/trading-hours.html`, the crypto FAQ and every Globex notice; web.archive.org is refused by the
fetch tool. A Wayback copy of one notice was retrievable with curl.

Primary (CME Group, via archived copy): *CME Globex Notice: April 27, 2026*,
https://www.cmegroup.com/notices/electronic-trading/2026/04/20260427.html (Wayback snapshot,
https://web.archive.org/web/2026id_/… — same URL prefix):
- "Effective this Sunday, May 3 (trade date Monday, May 4), CME Group will update the label names..."
- "may be used to trade 7 day products from Sunday at 5:00 p.m. Central Time (CT) through Friday at 4:00 p.m."
- "All holiday or weekend trading from Friday evening through Sunday evening will have a trade date of the following business day"
- "Globex Trade Date Behavior Change - June 19 ... align CME Globex and CME Clearing trade dates when the Globex trade date falls on a Friday U.S. holiday"

This establishes the convention (Sunday 17:00 CT session → Monday trade date; weekend/holiday
sessions → next business day trade date) from CME's own notice, but **not** from a Rulebook
definition of "Trade Date". Treat the Rulebook clause as unverified.

## 7. FIX Protocol data types (FIX Latest)

Source: FIX Trading Community, FIX Latest datatypes (fiximate.fixtrading.org redirects 308 to
https://orchimate.org/fixtrading/fix-latest/datatypes?ref=fiximate).

- **UTCTimestamp**: "in either YYYYMMDD-HH:MM:SS (whole seconds) or YYYYMMDD-HH:MM:SS.sss* format"; fraction: "3 digits to convey milliseconds, 6 digits to convey microseconds, 9 digits to convey nanoseconds, 12 digits to convey picoseconds."; leap second: "a UTCTimestamp field may read '19981231-23:59:59', '19981231-23:59:60', '19990101-00:00:00'."; "SS = 00-60 (60 only if UTC leap second)".
- **UTCTimeOnly**: "in either HH:MM:SS (whole seconds) or HH:MM:SS.sss* (milliseconds) format"
- **UTCDateOnly**: "Date represented in UTC in YYYYMMDD format"
- **LocalMktDate**: "Date of Local Market (as opposed to UTC) in YYYYMMDD format"
- **LocalMktTime**: "Format is HH:MM:SS where HH = 00-23 hours, MM = 00-59 minutes, SS = 00-59 seconds"
- **TZTimeOnly**: "Format is HH:MM[:SS][Z | [ + | - hh[:mm]]]"
- **TZTimestamp**: "Format is YYYYMMDD-HH:MM:SS.sss*[Z | [ + | - hh[:mm]]]"
- **MonthYear**: "Valid formats: YYYYMM, YYYYMMDD, YYYYMMWW. Valid values: YYYY = 0000-9999; MM = 01-12; DD = 01-31; WW = w1, w2, w3, w4, w5."

## 8. SWIFT MT date/time fields

Source: SWIFT *Standards MT* User Handbook (Category 1, Category 9), as mirrored page-for-page at
pinas.synology.me (SWIFT's own text; the swift.com Knowledge Centre copy requires login — tried
`www2.swift.com/knowledgecentre/rest/v1/publications/us9m_20210723/3.0/us9m_20210723.pdf`, got a
login HTML page; iso20022.org UHB pages returned 403).

- **MT 103 field 32A** "Value Date/Currency/Interbank Settled Amount": format "6!n3!a15d" (Date)(Currency)(Amount); NVR: "Date must be a valid date expressed as YYMMDD (Error code(s): T50)." https://pinas.synology.me/Swift_Manual/2015/books/us1m/aih006.htm
- **MT 103 field 13C** "Time Indication": format "/8c/4!n1!x4!n" (Code)(Time indication)(Sign)(Time offset); "Time must follow HHMM"; "Sign must be + or -"; offset hours "00-13", minutes "00-59"; codes CLSTIME, RNCTIME, SNDTIME; usage: "identified by means of the offset against the UTC (Coordinated Universal Time - ISO 8601)." Example `:13C:/CLSTIME/0915+0100`. https://pinas.synology.me/Swift_Manual/2015/books/us1m/aih002.htm
- **MT 900** Confirmation of Debit, format spec: "M | 32A | Value Date, Currency Code, Amount | 6!n3!a15d" and "O | 13D | Date/Time Indication | 6!n4!n1!x4!n". https://pinas.synology.me/Swift_Manual/2015/books/us9m/afc.htm
- **MT 910** Confirmation of Credit, format spec: same two rows. https://pinas.synology.me/Swift_Manual/2015/books/us9m/agc.htm
- MT 202 field 32A shares the 6!n3!a15d format (Category 2 page found by search, not fetched: https://ccsvie.synology.me/Swift_Manual/2017/books/us2m/aig004.htm — unverified).
- Field 13D detail page (NVRs for the YYMMDD date + HHMM + sign + offset): NOT FOUND on the mirror (URL pattern guesses 404). The format string `6!n4!n1!x4!n` itself is verified from both format specs.

## 9. MiFID II RTS 25 — Commission Delegated Regulation (EU) 2017/574

Source: EUR-Lex, CELEX 32017R0574, https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32017R0574

- Art. 3: "business clocks used to record the time of reportable events adhere to the level of accuracy specified in Table 2 of the Annex."
- Annex Table 1 (trading venue operators): gateway latency > 1 ms → divergence 1 millisecond, granularity "1 millisecond or better"; ≤ 1 ms → 100 microseconds, "1 microsecond or better".
- Annex Table 2 (members/participants):
  - "Activity using high frequency algorithmic trading technique" → 100 microseconds / 1 microsecond or better
  - "Activity on voice trading systems" → 1 second / 1 second or better
  - "Activity on request for quote systems where the response requires human intervention or where the system does not allow algorithmic trading" → 1 second / 1 second or better
  - "Activity of concluding negotiated transactions" → 1 second / 1 second or better
  - "Any other trading activity" → 1 millisecond / 1 millisecond or better

## 10. TAI64 / TAI64N / TAI64NA (D. J. Bernstein)

Source: https://cr.yp.to/libtai/tai64.html (fetched with curl; the fetch tool errors on this host).

- "A TAI64 label is an integer between 0 and 2^64 referring to a particular second of real time."
- "the TAI second beginning exactly 2^62 - s seconds before the beginning of 1970 TAI, if s is between 0 inclusive and 2^62 exclusive"
- "the TAI second beginning exactly s - 2^62 seconds after the beginning of 1970 TAI, if s is between 2^62 inclusive and 2^63 exclusive"
- "Integers 2^63 and larger are reserved for future extensions."
- External format: "consisting of eight 8-bit bytes in big-endian format"; "bytes 40 00 00 00 00 00 00 00 hexadecimal represent the second that began 1970 TAI"; "3f ff ff ff ff ff ff ff ... the second that ended 1969 TAI"; "40 00 00 00 2a 2b 2c 2d hexadecimal represent 1992-06-02 08:07:09 TAI, also known as 1992-06-02 08:06:43 UTC."
- TAI64N: "an integer, between 0 and 999999999 inclusive, counting nanoseconds"; "consisting of twelve 8-bit bytes ... The last four bytes are the nanosecond counter in big-endian format."
- TAI64NA: "counting attoseconds from the beginning of the nanosecond"; "consisting of sixteen 8-bit bytes".
- Note: the page defines the binary "external TAI64 format"; the `@4000000...` hex-string spelling is the daemontools/`tai64n` textual rendering (hex of the 12-byte external TAI64N with a leading `@`), not defined on this page. The word "external" here means the byte encoding, not the `@` string.

## 11. IAU time-scale resolutions

**IAU 2006 Resolution B3 (TDB)** — IAU text (iau.org PDF returns 404; IAU archive mirror used):
https://iauarchive.eso.org/static/resolutions/IAU2006_Resol3.pdf (also https://www.iers.org/SharedDocs/Publikationen/EN/IERS/resolutions/IAU/IAU2006_Resolution_B3.pdf)
- "TDB = TCB - LB x ( JDTCB - T0 ) x 86400 + TDB0,"
- "where T0 = 2443144.5003725, and LB = 1.550519768x10-8 and TDB0 = - 6.55 x 10-5 s are defining constants."
- Note 1: "Its value is T0 = 2443144.5003725 for the event 1977 January 1 00h 00m 00s TAI at the geocenter"
- Note 2: "LB is a current estimate of LC + LG - LC x LG, where LG is given in IAU Resolution B1.9 (2000)"

**IAU 2000 Resolution B1.9 (TT)** — official iau.org PDF 404 (`IAU2000_English.pdf` at iau.org and
iauarchive.eso.org both redirect to HTML). Text taken from (a) SYRTE's IAU-resolutions page,
https://syrte.obspm.fr/IAU_resolutions/Resol-UAI.htm, and (b) the IAU WG explanatory supplement
reproducing the resolution, Soffel et al. 2003, Appendix A, https://arxiv.org/pdf/astro-ph/0303376 (reproduction).
- "TT be a time scale differing from TCG by a constant rate: dTT/dTCG = 1-LG, where LG = 6.969290134 × 10-10" (SYRTE)
- Note: "LG was defined by the IAU Resolution A4 (1991) in its Recommendation 4 as equal to UG/c2 ... LG is now used as a defining constant." (arXiv App. A)
- B1.9 itself contains **no** Julian-date formula; it fixes only the rate.

**TT–TCG relation with T0** — IERS Conventions (2010), IERS TN 36, ch. 10, eq. (10.1):
https://iers-conventions.obspm.fr/content/chapter10/tn36_c10.pdf
- "TCG − TT = ( LG / (1 − LG) ) × (JDTT − T0) × 86400 s, (10.1)"; "where JDTT is the TT Julian date and T0 = 2443144.5003725."
- "To within 10−18 in rate, it may be approximated as TCG − TT = LG × (MJD − 43144.0) × 86400 s"
- "TAI is a realization of TT, apart from a constant offset: TT = TAI + 32.184 s."
- Eq. (10.3) restates B3: "TDB = TCB − LB × (JDTCB − T0) × 86400 s + TDB0".
- The form in the brief, TT = TCG − LG (JDTCG − T0) × 86400, is the same relation written in JD_TCG (exact by construction since TT = TCG at T0 and dTT/dTCG = 1 − LG). Cite it as derived from B1.9 + IERS eq. (10.1), not as a quoted equation.

NFA glossary (IAU WG, https://syrte.obspm.fr/iauWGnfa/NFA_Glossary.html): TT "was exactly 1977 January 1.0003725 when TAI reached 1977 January 1.0"; "TT (TAI) = TAI + 32s.184".

## 12. ΔT polynomials (Espenak & Meeus)

Source: NASA GSFC Eclipse site, "Polynomial Expressions for Delta T (ΔT)", Five Millennium Canon
of Solar Eclipses, https://eclipse.gsfc.nasa.gov/SEcat5/deltatpoly.html

- Decimal year: "y = year + (month - 0.5)/12"
- Range: "over the time period covered by of the Five Millennium Canon of Solar Eclipses: -1999 to +3000"
- Pieces (ΔT in seconds):
  - y < −500: `ΔT = −20 + 32u²`, u = (y−1820)/100
  - −500…+500: `ΔT = 10583.6 − 1014.41u + 33.78311u² − 5.952053u³ − 0.1798452u⁴ + 0.022174192u⁵ + 0.0090316521u⁶`, u = y/100. Stated fit error: "reproduces the values in Table 1 with an error not larger than 4 seconds"
  - +500…+1600: `ΔT = 1574.2 − 556.01u + 71.23472u² + 0.319781u³ − 0.8503463u⁴ − 0.005050998u⁵ + 0.0083572073u⁶`, u = (y−1000)/100
  - 1600…1700: `ΔT = 120 − 0.9808t − 0.01532t² + t³/7129`, t = y−1600
  - 1700…1800: `ΔT = 8.83 + 0.1603t − 0.0059285t² + 0.00013336t³ − t⁴/1174000`, t = y−1700
  - 1800…1860: `ΔT = 13.72 − 0.332447t + 0.0068612t² + 0.0041116t³ − 0.00037436t⁴ + 0.0000121272t⁵ − 0.0000001699t⁶ + 0.000000000875t⁷`, t = y−1800
  - 1860…1900: `ΔT = 7.62 + 0.5737t − 0.251754t² + 0.01680668t³ − 0.0004473624t⁴ + t⁵/233174`, t = y−1860
  - 1900…1920: `ΔT = −2.79 + 1.494119t − 0.0598939t² + 0.0061966t³ − 0.000197t⁴`, t = y−1900
  - 1920…1941: `ΔT = 21.20 + 0.84493t − 0.076100t² + 0.0020936t³`, t = y−1920
  - 1941…1961: `ΔT = 29.07 + 0.407t − t²/233 + t³/2547`, t = y−1950
  - 1961…1986: `ΔT = 45.45 + 1.067t − t²/260 − t³/718`, t = y−1975
  - 1986…2005: `ΔT = 63.86 + 0.3345t − 0.060374t² + 0.0017275t³ + 0.000651814t⁴ + 0.00002373599t⁵`, t = y−2000
  - 2005…2050: `ΔT = 62.92 + 0.32217t + 0.005589t²`, t = y−2000 (fit to "estimated values of ΔT in the years 2010 and 2050", 66.9 s and 93 s)
  - 2050…2150: `ΔT = −20 + 32((y−1820)/100)² − 0.5628(2150 − y)` ("introduced to eliminate the discontinuity at 2050")
  - y > 2150: `ΔT = −20 + 32u²`, u = (y−1820)/100
- Uncertainty statements on the page: only the ≤ 4 s fit error for −500…+500 is numeric; otherwise "The uncertainty in ΔT over this period can be estimated from scatter in the measurements." The page gives no per-segment σ for other ranges. (Morrison & Stephenson 2004 is cited as the source of the historical values.)
- Canon-specific correction: "c = -0.000012932 (y - 1955)^2" (secular-acceleration adjustment; not needed 1955–2005).

## 13. NAIF / DSN vocabulary

- NAIF, *CHRONOS User's Guide* (SPICE utility), "UTC Time Types":
  https://naif.jpl.nasa.gov/pub/naif/MER/misc/chronos/ver2/Sun_Solaris/chronos.ug
  - SCET: "SCET is the time of an event on-board a spacecraft"
  - ERT: "ERT is the time of an event measured on the ground, such as the time when a signal about an event on-board of a spacecraft was received on the Earth"
  - ETT: "ETT is the time when a signal received on-board a spacecraft, was transmitted from the Earth"
  - LT: "LT is the one-way light time between the Earth center of mass and a spacecraft"; "computed using only Newtonian assumptions about the propagation of light"
- NASA, *Basics of Space Flight*, Glossary: https://science.nasa.gov/learn/basics-of-space-flight/glossary/
  - ERT: "Earth-received time, UTC of an event at DSN receive-time, equal to SCET plus OWLT."
  - SCET: "Spacecraft Event Time, equal to ERT minus OWLT."
  - OWLT: "One-Way Light Time, elapsed time between Earth and spacecraft or solar system body."
  - RTLT: "Round-Trip Light Time, elapsed time roughly equal to 2 x OWLT."
  - TRM: "Transmission Time, UTC Earth time of uplink."
- DSN 810-005 Glossary (module 901, Rev. H), https://deepspace.jpl.nasa.gov/dsndocs/810-005/901/901H.pdf: lists the abbreviation "RTLT round-trip light time" only; no ERT/SCET definitions there.
- Naming note: NAIF calls the uplink time **ETT**; NASA BSF calls it **TRM**. "SCET = ERT − OWLT" is quoted from NASA BSF, not from a NAIF document.

## 14. Sunrise/sunset standard altitudes and twilight

- NOAA GML, *Solar Calculation Details*, https://gml.noaa.gov/grad/solcalc/calcdetails.html
  - "based on equations from Astronomical Algorithms, by Jean Meeus."
  - "For sunrise and sunset calculations, we assume 0.833° of atmospheric refraction."
  - "accurate to within a minute for locations between +/- 72° latitude, and within 10 minutes outside of those latitudes."
- USNO Astronomical Applications Dept., *Rise, Set, and Twilight Definitions*, https://aa.usno.navy.mil/faq/RST_defs
  - "sunrise or sunset is defined to occur when the geometric zenith distance of center of the Sun is 90.8333 degrees."
  - 34′ refraction + 16′ semidiameter: "the upper limb of the Sun will then appear to be tangent to the horizon."
  - Civil: "when the center of the Sun is geometrically 6 degrees below the horizon."
  - Nautical: "when the center of the sun is geometrically 12 degrees below the horizon."
  - Astronomical: "when the center of the Sun is geometrically 18 degrees below the horizon."
  - High latitudes: "there may be several transits between rise and set" and phenomena may not "be observed to occur at all."
- Meeus, *Astronomical Algorithms* 2nd ed., ch. 15 (h0 = −0°50′) and ch. 25 (0.01° low-accuracy solar position): **NOT FETCHED** — printed book, no publisher text online. The h0 = −0.8333° figure is confirmed by NOAA (0.833°) and USNO (90.8333° zenith distance) above. The 0.01° accuracy claim for ch. 25 is **unverified** here.
- Polar day/night condition (cos H0 outside [−1, 1]): not present on the fetched NOAA page text and not stated numerically by USNO; treat as an algorithmic consequence of the hour-angle formula, not a quoted rule. NREL SPA report (TP-560-34302) could not be reached (`docs.nrel.gov` / `www.nrel.gov` DNS failure from this sandbox).

## 15. ISDA 2021 Definitions §4.6.1 paragraph numbering

The 2021 ISDA Interest Rate Derivatives Definitions are published only on ISDA MyLibrary (paywalled);
no public copy of §4.6.1 was reachable. Numbering below is from two ISDA-aligned machine-readable
sources that cite the paragraphs:

- FpML day-count-fraction 2-3 (https://www.fpml.org/coding-scheme/day-count-fraction-2-3.xml): `1/1` "(i)"; `ACT/ACT.ISDA` "(ii)"; `ACT/ACT.ICMA` "(iii)"; `ACT/365.FIXED` "(iv)"; `ACT/360` "(v)"; `30/360` "(vi)"; `30E/360` "(vii)"; `30E/360.ISDA` "(viii)"; `ACT/365L` "(ix)"; `RBA` "(xi)"; `BUS/252`: "Per 2021 ISDA Definitions, Section 4.6.1 Day Count Fractions, paragraph (v) - Calculation/252".
- FINOS/ISDA CDM `DayCountFractionEnum` (https://raw.githubusercontent.com/finos/common-domain-model/master/rosetta-source/src/main/rosetta/base-datetime-daycount-enum.rosetta): `CAL/252` "Per 2021 ISDA Definitions, Section 4.6.1 Day Count Fraction, paragraph (x). Supercedes BUS/252, the number of Business Days in the Calculation Period or Compounding Period ... divided by 252."; `RBA Bond Basis` "(xi) ... 0.25 if it is three months, 0.5 if it is 6 months, 1 if it is a year"; `ACT/365L` "(ix)".
- ISDA *Key Changes in the 2021 ISDA Interest Rate Derivatives Definitions* (June 2021), "Day Count Fractions (Section 4.6)": "The following additional Day Count Fraction has been included in the 2021 Definitions: • Calculation/252" — https://www.isda.org/a/BNEgE/Key-Changes-in-the-2021-ISDA-Interest-Rate-Derivatives-Definitions-June-2021.pdf

**Answer: paragraph (x) = Calculation/252** (per the CDM, which was authored by ISDA). The FpML
2-3 description of BUS/252 says "(v)", which collides with ACT/360 = (v) in the same scheme — an
FpML scheme error, not a real paragraph number. Consistent ordering (i)–(xi): 1/1, ACT/ACT.ISDA,
ACT/ACT.ICMA, ACT/365.FIXED, ACT/360, 30/360, 30E/360, 30E/360.ISDA, ACT/365L, Calculation/252,
RBA Bond Basis. Not verified against the ISDA text itself.

---

## Not found / uncertain

| Item | Status | What was tried |
|---|---|---|
| 2 — SIFMA *Standard Securities Calculation Methods* text for 30/360 US Feb rules | NOT FOUND (book not online) | WebSearch for title + rule wording; ISDA 30/360 page (only an .xls link). Only OpenGamma (secondary) states an EOM Feb rule, and in a different form from the brief. |
| 6 — CME Rulebook Ch. 1 "Trade Date"/"Trading Day" definition | NOT FOUND (IP blocked by cmegroup.com; fetch tool timeouts; archive.org refused by fetch tool) | Rulebook CME/CBOT ch. 1 PDFs, trading-hours page, crypto FAQ, 4 Globex notices, CFTC filings. Convention itself confirmed from an archived CME Globex notice (Apr 27, 2026). |
| 8 — SWIFT field 13D detail page (NVRs) for MT 900/910 | NOT FOUND on the UHB mirror (URL guesses 404); swift.com PDF requires login; iso20022.org UHB 403 | Format `6!n4!n1!x4!n` verified from both format-spec pages. 13C rules verified for MT 103. |
| 11 — IAU 2000 B1.9 official PDF | iau.org / iauarchive PDFs 404 or HTML | Text taken from SYRTE and the IAU WG explanatory supplement (arXiv astro-ph/0303376 App. A). The TT–TCG JD formula is IERS Conventions 2010 eq. (10.1), not resolution text. |
| 14 — Meeus ch. 15 / ch. 25 quotes; NREL SPA report | Book not online; nrel.gov DNS failure | h0 = −0.8333° confirmed via NOAA + USNO; 0.01° accuracy for Meeus ch. 25 and the cos H0 ∉ [−1,1] polar rule remain unquoted. |
| 15 — ISDA 2021 §4.6.1 text | Paywalled (MyLibrary) | Numbering inferred from CDM + FpML; FpML's "(v)" for BUS/252 is internally inconsistent. |
| 5 — effective date | Brief said 21 Dec 2015 | ISDA FAQ and press release say go-live **20 December 2015**. |
| 13 — "SCET = ERT − OWLT" | Not in a NAIF document | Quoted from NASA Basics of Space Flight glossary; NAIF CHRONOS defines the terms but states no formula. |
| 10 — `@4000000…` hex-string form | Not on tai64.html | Page defines only the 8/12/16-byte big-endian external formats; the `@`-prefixed hex string is the daemontools `tai64n` textual rendering. |
| 1 — ACT/ACT.ICMA stub mechanics | ISDA §4.16(c) delegates to ICMA Rule 251 | ICMA Rule Book is members-only; stub handling described only in OpenGamma §3.13 (secondary). |
