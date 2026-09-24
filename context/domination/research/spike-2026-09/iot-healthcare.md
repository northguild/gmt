# IoT and Healthcare realm — primary-source verification

Verified 2026-09-23. Every quote is at most 125 characters and copied from the source text as fetched
(HTML pages via curl, PDFs via pypdf text extraction; archived copies via web.archive.org raw `id_`
mode where the publisher blocks fetches). Items marked NOT FOUND list what was tried.

---

## 1. RFC 5905 (NTPv4) — offset, delay, root distance, correctness interval

Source: https://www.rfc-editor.org/rfc/rfc5905.txt (Mills, Martin, Burbank, Kasch, June 2010)

| Claim | Quote | Clause |
| --- | --- | --- |
| Offset formula | `theta = T(B) - T(A) = 1/2 * [(T2-T1) + (T3-T4)]` | §8 On-Wire Protocol |
| Delay formula | `delta = T(ABA) = (T4-T1) - (T3-T2).` | §8 On-Wire Protocol |
| Synchronization distance definition | "synchronization distance (LAMBDA) equal to EPSILON + DELTA / 2 represents the maximum error due to all causes" | §4 Definitions |
| Peer synchronization distance | `lambda = (delta / 2) + epsilon.` | §10 Peer Process (clock filter variables) |
| Root synchronization distance | "LAMBDA = EPSILON + DELTA / 2, which represents the maximum error due all causes and is designated the root synchronization distance." | §11.2 System Process Operations (clock update), p.45–46 |
| Correctness interval is centred on theta with half-width lambda | "lowpoint (p, -1, theta - lambda), midpoint (p, 0, theta), and highpoint (p, +1, theta + lambda)" | §11.2.1 Selection Algorithm |
| ...where lambda is the root distance, not delta/2 | "where lambda is the root synchronization distance" | §11.2.1 Selection Algorithm |

Note for the spec: RFC 5905 never writes the bound as `[theta - delta/2, theta + delta/2]`. The
correctness interval is `[theta - LAMBDA, theta + LAMBDA]` with `LAMBDA = EPSILON + DELTA/2`
(root dispersion plus half the root delay). `delta/2` alone is only the delay component; using it
as the interval half-width understates the bound whenever dispersion is non-zero. The reference
implementation is `rootdist()` in Appendix A.5.1.1 (not quoted here — code, not normative text).

---

## 2. Hybrid Logical Clocks — Kulkarni, Demirbas, Madappa, Avva, Leone (2014)

Source: https://cse.buffalo.edu/tech-reports/2014-04.pdf (UB CSE Technical Report 2014-04, per URL;
the PDF title page carries no report number). Title on p.1: "Logical Physical Clocks and Consistent
Snapshots in Globally Distributed Databases"; authors "Sandeep Kulkarni*, Murat Demirbas**, Deepak
Madeppa**, Bharadwaj Avva**, and Marcelo Leone*" (sic — "Madeppa" in the PDF).

In this tech-report version the HLC algorithm is **Figure 5** in §3.3 "HLC Algorithm" (p.5), not
"Algorithm 2" — that label belongs to the OPODIS 2014 camera-ready, which was not fetched.

| Claim | Quote | Clause |
| --- | --- | --- |
| Initial state | `Initially l.j := 0; c.j := 0` | Fig. 5, p.5 |
| Send / local event, l rule | `l′.j := l.j; l.j := max(l′.j, pt.j);` | Fig. 5, p.5 |
| Send / local event, c rule | `If (l.j = l′.j) then c.j := c.j + 1 Else c.j := 0;` | Fig. 5, p.5 |
| Receive of message m, l rule | `l′.j := l.j; l.j := max(l′.j, l.m, pt.j);` | Fig. 5, p.5 |
| Receive, c rule (all four cases) | `If (l.j = l′.j = l.m) then c.j := max(c.j, c.m)+1 Elseif (l.j = l′.j) then c.j := c.j + 1` | Fig. 5, p.5 |
| Receive, c rule (cont.) | `Elseif (l.j = l.m) then c.j := c.m + 1 Else c.j := 0` | Fig. 5, p.5 |
| l never lags physical time | "Theorem 2. For any event f, l.f ≥ pt.f" | §3.3, p.5 |
| Bounded drift from physical time | "Corollary 1. For any event f, |l.f − pt.f| ≤ ϵ" | §3.3, p.6 |
| Bounded counter | "Corollary 3. For any event f, c.f ≤ N ∗ (ϵ + 1)" | §3.3, p.6 |
| Tighter counter bound under a message-delay assumption | "Corollary 4. Under the assumption made above, c.f is at most ϵ/d + 1." | §3.3, p.6 |
| Causality | "Theorem 1. For any two events e and f, e hb f ⇒ (l.e, c.e) < (l.f, c.f)" | §3.3, p.5 |

Here ϵ is the clock-synchronisation uncertainty (NTP offset bound) and N the number of nodes.

---

## 3. Spanner TrueTime — Corbett et al., OSDI 2012

Source: https://static.googleusercontent.com/media/research.google.com/en//archive/spanner-osdi2012.pdf

| Claim | Quote | Clause |
| --- | --- | --- |
| TT.now() returns an interval | "TT.now() TTinterval: [earliest, latest]" | §3 TrueTime, Table 1 |
| TT.after / TT.before | "TT.after(t) true if t has definitely passed TT.before(t) true if t has definitely not arrived" | §3, Table 1 |
| Interval contains absolute time | "TT.now() method returns a TTinterval that is guaranteed to contain the absolute time during which TT.now() was invoked" | §3 |
| Formal guarantee | "for an invocation tt = TT.now(), tt.earliest ≤ tabs(enow) ≤ tt.latest, where enow is the invocation event" | §3 |
| ϵ is half the width | "Define the instantaneous error bound as ϵ, which is half of the interval's width" | §3 |
| Start rule | "coordinator leader for a write Ti assigns a commit timestamp si no less than the value of TT.now().latest" | §4.1.2 Assigning Timestamps to RW Transactions |
| Commit-wait rule | "The coordinator leader ensures that clients cannot see any data committed by Ti until TT.after(si) is true." | §4.1.2 |
| What commit wait guarantees | "Commit wait ensures that si is less than the absolute commit time of Ti, or si < tabs(ecommit i)." | §4.1.2 |
| Expected wait | "waits until that timestamp is guaranteed to be in the past, the expected wait is at least 2∗ϵ" | §4.2.1 Read-Write Transactions |

---

## 4. The Dataflow Model — Akidau et al., PVLDB 8(12), 2015; Apache Beam `Sessions`

Source: https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf

The window definitions are in **§1.2 Windowing** (pp.2–3), not §2.2 (§2.2 covers window assignment
and merging). Watermarks are introduced in **§1.3 Time Domains** (p.3).

| Claim | Quote | Clause |
| --- | --- | --- |
| Fixed windows | "Fixed windows (sometimes called tumbling windows) are defined by a static window size, e.g. hourly windows or daily windows." | §1.2 |
| Fixed windows are aligned | "They are generally aligned, i.e. every window applies across all of the data for the corresponding period of time." | §1.2 |
| Sliding windows | "Sliding windows are defined by a window size and slide period, e.g. hourly windows starting every minute." | §1.2 |
| Overlap | "The period may be less than the size, which means the windows may overlap." | §1.2 |
| Fixed is a special case | "Fixed windows are really a special case of sliding windows where size equals period." | §1.2 |
| Sessions | "Sessions are windows that capture some period of activity over a subset of the data, in this case per key." | §1.2 |
| Session gap | "Typically they are defined by a timeout gap. Any events that occur within a span of time less than the timeout are grouped" | §1.2 |
| Sessions are unaligned | "Sessions are unaligned windows." | §1.2 |
| Watermark | "MillWheel's watermark, which is a lower bound (often heuristically established) on event times that have been processed by the" | §1.3 (sentence runs on past a footnote; the next word is "pipeline" in the PDF layout but could not be confirmed in extraction) |
| Watermarks are heuristic | "most watermarks must be heuristically defined based on limited knowledge available" | §1.3 footnote 6 |
| Watermark trigger | "The watermark trigger fires when the watermark passes the end of the window in question." | §2.4 Examples |
| Session merging example | "windowed by session, with a 30-minute session timeout" | §2.2.2 Window Merging |

Apache Beam `Sessions` javadoc (Apache Beam 2.76.0, "current" at fetch time):
https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/transforms/windowing/Sessions.html

| Claim | Quote | Clause |
| --- | --- | --- |
| Gap-duration semantics | "windows values into sessions separated by periods with no input for at least the duration specified by getGapDuration()" | class description |
| Factory | "Creates a Sessions WindowFn with the specified gap duration." | `withGapDuration(Duration)` |

---

## 5. HL7 v2.5.1 Chapter 2A — DTM, TS, DT, TM

Source: https://www.hl7.eu/HL7v2x/v251/std251/ch02a.html (HL7 v2.5.1, Chapter 2A Data Types).
Section numbers as printed in the body: 2.A.21 DT, 2.A.22 DTM, 2.A.75 TM, 2.A.77 TS (the TOC
prefixes them "2.A.1.nn").

| Claim | Quote | Clause |
| --- | --- | --- |
| DTM format | `YYYY[MM[DD[HH[MM[SS[.S[S[S[S]]]]]]]]][+/-ZZZZ]` | 2.A.22 Format |
| DTM definition | "Specifies a point in time using a 24-hour clock notation." | 2.A.22 Definition |
| DTM precision rule | "The number of characters populated (excluding the time zone specification) specifies the precision." | 2.A.22 |
| DTM precision ladder (first/last rungs) | "only the first four are used to specify a precision of "year"" ... "the first nineteen are used to specify a precision of " one ten thousandths of a second"" | 2.A.22 |
| DTM offset semantics | "The time zone (+/-ZZZZ) is represented as +/-HHMM offset from Co-ordinated Universal Time (UTC)" | 2.A.22 |
| Both zero offsets are UTC | "where +0000 or -0000 both represent UTC (without offset)" | 2.A.22 |
| Default zone | "if the time zone is not included, the time zone defaults to that of the local time zone of the sender" | 2.A.22 |
| 0000 means preceding midnight | "a DTM or TS valued field with the HHMM part set to "0000" represents midnight of the night extending from the previous day" | 2.A.22 |
| TS components | Component 1 "Time" DTM, R, ref 2.A.22; component 2 "Degree of Precision" ID, B, table 0529 | 2.A.77 component table |
| TS format | `YYYY[MM[DD[HH[MM[SS[.S[S[S[S]]]]]]]]][+/-ZZZZ]^<degree of precision>` | 2.A.77 Format |
| TS.2 is legacy | "Retained only for purposes of backward compatibility as of v 2.3. Refer to component 1 for current method of designating degree" | 2.A.77.2 |
| TS.2 may only lower precision | "the Degree of Precision is either the same as or overrides the precision indicated by the first component. It may not indicate greater" | 2.A.77.2 |
| Table 0529 values | "Y year", "L month", "D day", "H hour", "M minute", "S second" — each "Retained for backward compatibility only" | HL7 Table 0529 |
| DT format | `YYYY[MM[DD]]` | 2.A.21 Format |
| DT definition | "Specifies the century and year with optional precision to month and day." | 2.A.21 |
| DT precision rule | "As of v 2.3, the number of digits populated specifies the precision using the format specification YYYY[MM[DD]]." | 2.A.21 |
| TM format | `HH[MM[SS[.S[S[S[S]]]]]][+/-ZZZZ]` | 2.A.75 Format |
| TM definition | "Specifies the hour of the day with optional minutes, seconds, fraction of second using a 24-hour clock notation and time zone." | 2.A.75 |
| TM precision rule | "As of v 2.3, the number of characters populated (excluding the time zone specification) specifies the precision." | 2.A.75 |
| TM fractional units | "Fractional representations of minutes, hours or other higher-order units of time are not permitted." | 2.A.75 |
| TM zone restriction | "The time zone [+/-ZZZZ], when used, is restricted to legally-defined time zones and is represented in HHMM format." | 2.A.75 Note |
| TM default zone (MSH fallback) | "Where the time zone is not present in a particular TM field but is included as part of the date/time field in the MSH segment" | 2.A.75 |
| TM example with offset | "|235959+1100| 1 second before midnight in a time zone eleven hours ahead of Universal Coordinated Time" | 2.A.75 Examples |

TS withdrawal in v2.6 — source: https://www.hl7.eu/HL7v2x/v26/std26/ch02a.html

| Claim | Quote | Clause |
| --- | --- | --- |
| TS replaced by DTM | "The TS data type has been replaced by the DTM data type and the detail was withdrawn and removed from the standard as of v 2.6." | v2.6 ch02a, 2.A.77 TS |

---

## 6. FHIRPath — Equality and Comparison with differing precision

Current published release: **FHIRPath Specification v3.0.0 (R3)**, https://hl7.org/fhirpath/en/index.html
(the root URL https://hl7.org/fhirpath/ is a language-redirect stub whose publish-box reads "This page is
part of the FHIRPath Specification (v3.0.0: R3) ... This is the current published version").
Normative Release N1 = v2.0.0 (R2), https://hl7.org/fhirpath/N1/ — numbered §6.1 Equality, §6.1.1 = (Equals),
§6.2 Comparison. The v3.0.0 page uses the same heading names without printed numbers.

Both versions carry identical wording for the rule below (v3.0.0 adds inline comments to the examples).

| Claim | Quote | Clause |
| --- | --- | --- |
| Precision-by-precision equality | "the comparison is performed by considering each precision in order, beginning with years (or hours for time values)" | §6.1.1 = (Equals), "Date/Time Equality" |
| Stop on difference | "if the values are different, the comparison stops and the result is false" | §6.1.1 |
| Empty when one side lacks the precision | "If one input has a value for the precision and the other does not, the comparison stops and the result is empty ({ })" | §6.1.1 |
| True when both run out | "if neither input has a value for the precision, or the last precision has been reached, the comparison stops and the result is true" | §6.1.1 |
| Seconds + ms one precision | "seconds and milliseconds are considered a single precision using a decimal, with decimal equality semantics" | §6.1.1 |
| Example (N1) | `@2012-01 = @2012 // returns empty ({ })` | §6.1.1 examples |
| Example (v3.0.0) | `@2012-01 = @2012 // empty ({ }) ; different date precision` | Equality examples |
| Example | `@2012 = @2013 // false` | Equality examples (both versions) |
| Example | `@2012-01-01T10:30:31 = @2012-01-01T10:30 // empty ({ }) ; different datetime precision` | Equality examples (v3.0.0) |
| Example | `@2012-01-01T10:30:31.0 = @2012-01-01T10:30:31 // true` | Equality examples |
| Comparison operators, differing precision | "If one value is specified to a different level of precision than the other, the result is empty ({ })" | §6.2 Comparison |
| Comparison walks to finest precision of either | "beginning with years, and proceeding to the finest precision specified in either input, and respecting timezone offsets" | §6.2 Comparison |
| Default offset is a policy decision | "For DateTime values that do not have a timezone offsets, whether or not to provide a default timezone offset is a policy decision." | §6.1.1 |

`@2012-01 = @2012-02` — NOT FOUND as a printed example in either N1 or v3.0.0. The nearest printed
example is `@2012 = @2013 // false`. Under the stated rule (year equal, month differs → "the comparison
stops and the result is false") the value is `false`, but that is a derivation, not a quote.

---

## 7. CQL — precision comparison, `same as` / `same or before`, timezone normalisation

Source: Clinical Quality Language Specification **v2.0.0**, Appendix B – CQL Reference,
https://cql.hl7.org/09-b-cqlreference.html, section "Date and Time Operators".

| Claim | Quote | Clause |
| --- | --- | --- |
| `same as` signature | `same _precision_ as(left DateTime, right DateTime) Boolean` | Same As — Signature |
| Precision walk | "The comparison is performed by considering each precision in order, beginning with years (or hours for time values)." | Same As — Description |
| Difference → false | "if the values are different, the comparison stops and the result is false" | Same As |
| Missing component → null | "if either input has no value for the precision, the comparison stops and the result is null" | Same As |
| Reached precision → true | "if the specified precision has been reached, the comparison stops and the result is true" | Same As |
| No precision given | "performed beginning with years (or hours for time values) and proceeding to the finest precision specified in either input" | Same As |
| Weeks unsupported | "due to variability in the way week numbers are determined, comparisons involving weeks are not supported" | Same As |
| Timezone normalisation, hours or finer only | "normalized to the timezone offset of the evaluation request timestamp, but only when the comparison precision is hours, minutes" | Same As (sentence continues "seconds, or milliseconds") |
| Example, null on mixed precision | `define "UncertainSameAsIsNull": @2012-01-01 same day as @2012-01` | Same As — examples |
| Example, false | `define "SameAsFalse": @2012-01-01 same day as @2012-01-02` | Same As — examples |
| `same or before` signature | `same _precision_ or before(left DateTime, right DateTime) Boolean` | Same Or Before — Signature |
| `same or before` semantics | "if the first value is less than the second, the result is true; if the first value is greater than the second, the result is false" | Same Or Before |
| `same or before`, missing component | "if either input has no value for the precision, the comparison stops and the result is null" | Same Or Before |
| `same or before`, reached precision | "if the specified precision has been reached, the comparison stops and the result is true" | Same Or Before |
| `after` reached precision → false | "if the specified precision has been reached, the comparison stops and the result is false" | After — Description |
| Date mixed with DateTime | "the Date values will be implicitly converted to DateTime as defined by the ToDateTime operator" | Same As / Same Or Before |

US CQL IG — "Common CQL Assets for FHIR (US-Based) v2.0.0: Informative 2", page "Patient Patterns",
https://hl7.org/fhir/us/cql/en/patterns-patient.html (the un-suffixed URL is a language-redirect stub).

| Claim | Quote | Clause |
| --- | --- | --- |
| Age functions are duration shorthand | "CQL supports age calculation functions using both Date and DateTime values. In both cases the function is shorthand for a" | "Patient age", NOTE |
| DateTime overloads consider offset | "If the DateTime overloads are used, note that the timezone offset is considered and there may be edge cases that result in" | "Patient age", NOTE |
| Recommended fix | "best practice is to use the date from extractor on the asOf value to ensure the Date calculation is used" | "Patient age", NOTE |
| Library helpers already do it | "The ageInYears() and ageInYearsAt() functions listed above already apply this extractor" | "Patient age", NOTE |

Correction for the spec: the "offsets normalised only when comparison precision is hours or finer" rule
is **not** on the US CQL IG patterns-patient page; it is the CQL Appendix B sentence quoted above (Same As
and the other precision-based comparison operators). The IG page only warns that DateTime age overloads
"consider" the offset and recommends `date from`.

---

## 8. AAP — "Age Terminology During the Perinatal Period", Pediatrics 2004;114(5):1362–1364

Source: publisher page blocked (HTTP 403 at publications.aap.org, both article ids 67552 and 67715;
PubMed efetch returns abstract only). Verified from the publisher's own page as archived:
https://web.archive.org/web/20191010002136id_/https://pediatrics.aappublications.org/content/114/5/1362
DOI 10.1542/peds.2004-1915 (PubMed efetch). The archived page lists reaffirmation notices at
"123(1):188 127(5):e1367 123(5):1421 134(3):e920".

| Claim | Quote | Clause |
| --- | --- | --- |
| Gestational age definition | ""Gestational age" (or "menstrual age") is the time elapsed between the first day of the last normal menstrual period and the day of" | Definitions (sentence ends "delivery") |
| Completed weeks | "Gestational age is conventionally expressed as completed weeks." | Definitions |
| Recommended term | "Gestational age (completed weeks): time elapsed between the first day of the last menstrual period and the day of delivery." | Recommendations, Table 1 |
| ART rule | "If pregnancy was achieved using assisted reproductive technology, gestational age is calculated by adding 2 weeks to the" | Recommendations (ends "conceptional age") |
| ART worked example | "a preterm infant conceived using assisted reproductive technology who has a conceptional age of 25 weeks has a gestational age of 27" | Definitions (ends "weeks") |
| Chronological age | "Chronological age (days, weeks, months, or years): time elapsed from birth." | Recommendations, Table 1 |
| Postmenstrual age | "Postmenstrual age (weeks): gestational age plus chronological age." | Recommendations, Table 1 |
| Corrected age | "Corrected age (weeks or months): chronological age reduced by the number of weeks born before 40 weeks of gestation" | Recommendations, Table 1 |
| Corrected age, 3-year limit | "the term should be used only for children up to 3 years of age who were born preterm" | Recommendations, Table 1 |
| Corrected age example | "a 24-month-old, former 28-week gestational age infant has a corrected age of 21 months" | Definitions |
| Best obstetric estimate | "based on a combination of the first day of last menstrual period, physical examination of the mother, prenatal ultrasonography" | Definitions |

"Not rounded" wording — NOT FOUND on the archived page (no sentence containing "round"). The page
says only "conventionally expressed as completed weeks".

---

## 9. ACOG Committee Opinion 700 (May 2017), "Methods for Estimating the Due Date"

Source: acog.org returns HTTP 402 and journals.lww.com HTTP 402 to this client. Verified from ACOG's own
page as archived: https://web.archive.org/web/20240102074028id_/https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/05/methods-for-estimating-the-due-date

| Claim | Quote | Clause |
| --- | --- | --- |
| Naegele's rule / 280 days | "By convention, the EDD is 280 days after the first day of the LMP." | Background |
| First-trimester ultrasound most accurate | "in the first trimester (up to and including 13 6/7 weeks of gestation) is the most accurate method to establish or confirm" | Recommendations (first bullet) and Clinical Considerations in the First Trimester |
| CRL accuracy | "gestational age assessment based on measurement of the crown–rump length (CRL) has an accuracy of ±5–7 days" | Clinical Considerations in the First Trimester |
| ART dating | "If pregnancy resulted from assisted reproductive technology (ART), the ART-derived gestational age should be used to assign" | Recommendations |
| IVF dating rule | "the EDD for a pregnancy that resulted from in vitro fertilization should be assigned using the age of the embryo and the date of" | Recommendations / ART section (ends "transfer") |
| IVF day-5 example | "for a day-5 embryo, the EDD would be 261 days from the embryo replacement date" | ART section |
| IVF day-3 example | "the EDD for a day-3 embryo would be 263 days from the embryo replacement date" | ART section |
| Unsure LMP | "dating should be based on ultrasound examination estimates (ideally obtained before or at 13 6/7 weeks of gestation)" | Clinical Considerations |

The first bullet is issued jointly: "The American College of Obstetricians and Gynecologists, the
American Institute of Ultrasound in Medicine, and the Society for Maternal–Fetal Medicine".

---

## 10. FHIR R4 `Timing.repeat` and EventTiming

Source: https://hl7.org/fhir/R4/datatypes.html#Timing — heading "2.24.0.16 Timing" (R4 4.0.1).

Elements of `Timing.repeat`, as listed (cardinality, type):

| Element | Card. | Type |
| --- | --- | --- |
| bounds[x] (boundsDuration, boundsRange, boundsPeriod) | 0..1 | Duration, Range, Period |
| count | 0..1 | positiveInt |
| countMax | 0..1 | positiveInt |
| duration | 0..1 | decimal |
| durationMax | 0..1 | decimal |
| durationUnit | 0..1 | code (s, min, h, d, wk, mo, a) |
| frequency | 0..1 | positiveInt |
| frequencyMax | 0..1 | positiveInt |
| period | 0..1 | decimal |
| periodMax | 0..1 | decimal |
| periodUnit | 0..1 | code (s, min, h, d, wk, mo, a) |
| dayOfWeek | 0..* | code |
| timeOfDay | 0..* | time |
| when | 0..* | code (EventTiming) |
| offset | 0..1 | unsignedInt |

| Claim | Quote | Clause |
| --- | --- | --- |
| `when` short description | "An approximate time period during the day, potentially linked to an event of daily living that indicates when the action" | Timing.repeat.when |
| `offset` semantics | "The number of minutes from the event. If the event code does not indicate whether the minutes is before or after the event" | Timing.repeat.offset (ends "then the offset is assumed to be after the event") |

EventTiming value set — http://hl7.org/fhir/ValueSet/event-timing, version 4.0.1,
https://hl7.org/fhir/R4/valueset-event-timing.html. 26 codes:

- FHIR `event-timing` code system: MORN, MORN.early, MORN.late, NOON, AFT, AFT.early, AFT.late, EVE,
  EVE.early, EVE.late, NIGHT, PHS. Definition pattern: "Event occurs during the morning. The exact time is
  unspecified and established by institution convention or patient interpretation." NOON: "Event occurs
  around 12:00pm." PHS: "Event occurs [offset] after subject goes to sleep."
- v3 TimingEvent codes: HS "Prior to beginning a regular period of extended sleep (this would exclude
  naps)."; WAKE "Upon waking up from a regular period of sleep, in order to start regular activities.";
  C "meal (from lat. ante cibus)"; CM "breakfast (from lat. cibus matutinus)"; CD "lunch (from lat. cibus
  diurnus)"; CV "dinner (from lat. cibus vespertinus)"; AC "before meal (from lat. ante cibus)"; ACM
  "before breakfast (from lat. ante cibus matutinus)"; ACD "before lunch (from lat. cibus diurnus)"; ACV
  "before dinner (from lat. ante cibus vespertinus)"; PC "after meal (from lat. post cibus)"; PCM "after
  breakfast (from lat. post cibus matutinus)"; PCD "after lunch (from lat. post cibus diurnus)"; PCV
  "after dinner (from lat. post cibus vespertinus)".

The item's list omitted AFT.early, AFT.late, EVE.early, EVE.late — they are in the R4 value set.

---

## 11. CDC ACIP General Best Practice Guidelines — Timing and Spacing; CDSi Logic Specification

Source: https://www.cdc.gov/vaccines/hcp/imz-best-practices/timing-spacing-immunobiologics.html
Page metadata: `cdc:last_updated` "July 24, 2024", `cdc:last_reviewed` "August 1, 2023".

| Claim | Quote | Clause |
| --- | --- | --- |
| 4-day grace period | "Known as the "grace period", vaccine doses administered ≤4 days before the minimum interval or age are considered valid" | Spacing of multiple doses of the same antigen |
| Local mandates may override | "however, local or state mandates might supersede this 4-day guideline" | same paragraph |
| Day-count convention | "(Day 1 is the day before the day that marks the minimum age or minimum interval for a vaccine.)" | footnote (b) |
| ≥5 days early is invalid | "Doses of any vaccine administered ≥5 days earlier than the minimum interval or age should not be counted as valid doses" | same section (ends "and should be repeated as age appropriate") |
| Repeat spacing | "The repeat dose should be spaced after the invalid dose by the recommended minimum interval (Table 3-2)." | same section |
| Live-vaccine repeat spacing | "If the vaccine is a live vaccine, ensuring that a minimum interval of 28 days has elapsed from the invalid dose is recommended" | same section |
| Rabies / Twinrix exception | "Because of the unique schedule for rabies vaccine and the accelerated Twinrix schedule, the 4-day guideline does not apply" | same section |
| Live parenteral spacing | "Two or more injectable or nasally administered live vaccines not administered on the same day should be separated by at least 4 weeks" | Non-simultaneous administration |
| No grace on live-live interval | "should not be applied to this 4-week interval between 2 different live vaccines" | Non-simultaneous administration |
| Table 3-4 row | "Two or more live injectable (d) 28 days minimum interval, if not administered simultaneously" | Table 3-4 |
| Retrospective vs prospective (DTaP-4) | "The 4-day grace period can be applied when validating past doses and can be applied to the minimum age of 12 months" | Table 3-2 footnote (f) |
| Planning ahead uses the stricter values | "can be used when planning doses ahead of time but should be applied to the minimum age of 15 months and the minimum interval" | Table 3-2 footnote (f) |
| Special 2-month grace, no extra 4 days | "An additional 4 days should not be added on to this grace period." | Table 3-2 footnotes (bb), (cc) |

"The grace period must not be used for scheduling" — NOT FOUND as a general statement on this page.
Every sentence containing "grace period", "4-day", "schedul" or "planning" was enumerated; the only
prospective-vs-retrospective distinction is footnote (f) quoted above, which permits prospective use
against the *routine* minimums. Do not cite the page for a blanket "never schedule with the grace
period" rule.

CDSi Logic Specification — source index https://www.cdc.gov/iis/cdsi/index.html; PDF
https://www.cdc.gov/iis/downloads/logic-spec-acip-rec-4.6.pdf (151 pages).

| Claim | Quote | Clause |
| --- | --- | --- |
| Current version | "Version 4.6 December 13, 2024" | title page, p.1 |
| Absolute minimum age (glossary) | "an age which may be earlier than the minimum age and allows for a vaccine dose administered to be considered valid when" | Glossary, Table A-7, p.107 (ends "administered abnormally early (e.g. grace period)") |
| Absolute minimum interval (glossary) | "an interval which maybe shorter than the minimum interval and allows for a vaccine dose administered to be considered valid" | Glossary, Table A-7, p.107 |
| Minimum age date rule | "CALCDTAGE-4 A patient's minimum age date must be calculated as the patient's date of birth plus the minimum age." | Table 3-7 Logical Component Date Rules, p.28 |
| Absolute minimum age date rule | "CALCDTAGE-5 A patient's absolute minimum age date must be calculated as the patient's date of birth plus the absolute minimum" | Table 3-7, p.28 |
| Absolute minimum interval date rule | "CALCDTINT-3 A patient's absolute minimum interval date must be calculated as the patient's reference dose date plus the" | Table 3-7, p.29 |
| Minimum interval date rule | "CALCDTINT-4 A patient's minimum interval date must be calculated as the patient's reference dose date plus the minimum interval." | Table 3-7, p.29 |
| Where they are applied | §6.4 Evaluate Age (pp.52–54) and §6.5 Evaluate Preferable Interval (pp.54–58) reuse CALCDTAGE-4/5 and CALCDTINT-3/4 | ch.6 Evaluate Vaccine Dose Administered |

---

## 12. PQA Proportion of Days Covered (PDC) — counting rules

Sources (all PQA-authored text):
- PQA, "Frequently Asked Questions for PQA Measures in the Health Insurance Marketplace Quality Rating
  System", 2020-04-03 — https://pqa.memberclicks.net/assets/Measures/QRS%20Measures%20FAQs%2020200403.pdf
- PQA adherence-measures page — https://www.pqa.org/adherence-measures (301 from pqaalliance.org)
- PQA PDC-STA measure tip sheet, "Copyright 2022 Pharmacy Quality Alliance, Inc." —
  https://files.guidewell.com/m/56dd3b4c0ea92f/original/providers-programs-quality-pqa-pdc-sta.pdf
- NH Medicaid Appendix V reproducing "Pharmacy Quality Alliance (PQA) Technical Specifications for PQA
  Approved Measures July 2017" — https://medicaidquality.nh.gov/sites/default/files/user-uploads/11/Appendix_V__Proportion_of_Days_Covered_(PDC)_Calculations%20(2).pdf
  (TLS certificate does not validate; fetched with verification disabled)

| Claim | Quote | Clause |
| --- | --- | --- |
| PDC definition | "the percentage of days within the measurement year that individuals covered by prescription claims for the same medication or" | pqa.org/adherence-measures (ends "another medication in the same therapeutic class") |
| Treatment period | "from the index prescription start date (IPSD) (i.e., the date of the first prescription claim for any target medication)" | PQA QRS FAQ, PDC-3 Rates, "When does an individual's treatment period begin and end?" |
| Treatment period end | "through the last day of the measurement year, or until death or disenrollment, whichever occurs first" | PQA QRS FAQ, same answer |
| 91-day minimum | "The treatment period must be at least 91 days long for the individual to be included in the measure denominator." | PQA QRS FAQ, same answer |
| Overlapping same-drug fills | "dispensed on the same day or different days where the days' supply overlap, adjust the prescription start date to be the day" | PQA QRS FAQ, "How are "days covered" calculated..." (ends "after the days' supply for the previous fill has ended") |
| Same generic ingredient | "same target medication (i.e., one or more products with the same generic ingredient)" | PQA QRS FAQ, same answer |
| Single + combination overlap | "Overlap adjustment should also occur when there is an overlap of a single target drug product with a combination product" | PQA QRS FAQ |
| Different drugs in class: any one covers the day | "count the days the patient was covered by at least one drug in the class based on the prescription fill date and days of supply" | NH Appendix V Step 2 (PQA Tech Specs July 2017) |
| Same-drug overlap (2017 wording) | "If prescriptions for the same target drug (generic ingredient) overlap, then adjust the prescription start date to be the day after" | NH Appendix V Step 2 |
| PDC arithmetic | "Divide the number of covered days found in Step 2 by the number of days found in Step 1." | NH Appendix V Step 3 |
| 80% threshold | "The PDC threshold is 80% for each rate; therefore, individuals with a PDC of 80% or greater are included in the numerator." | PQA QRS FAQ |
| 80% standard, 90% ARV | "Clinical evidence supports a standard threshold of 80%, except for the Proportion of Days Covered: Antiretroviral Medications" | pqa.org/adherence-measures |
| ≥2 fills eligibility | "Individuals with prescription claims for AT LEAST TWO target medications during the treatment period are included in the measure" | PQA QRS FAQ, "Are individuals included... one prescription" |
| Different dates of service | "must have at least two prescription claims for a statin medication on different dates of service during the treatment period" | PQA QRS FAQ (PDC-Statins bullet) |
| Episode starts at first fill | "Persons qualify for the measure with the second fill, but the adherence measurement episode starts with the date of the first fill" | PQA PDC-STA tip sheet, Denominator |
| Continuous enrolment | "Individuals must be continuously enrolled during the treatment period." | PQA QRS FAQ |

Caveat: the full current PQA measure specification is sold ("To purchase copies of the publication,
including the full measures and specifications, visit NCQA.org/Publications" — tip sheet footer). The
rules above are PQA's own public restatements; the NH appendix reproduces the July 2017 technical
specification. PQA_PDC-CMP-PH_Rationale.pdf on pqaalliance.org returned an HTML page, not a PDF.

---

## 13. Counting inpatient days — Medicare Benefit Policy Manual ch. 3 §20.1

Source: CMS Pub. 100-02, Medicare Benefit Policy Manual, Chapter 3 "Duration of Covered Inpatient
Services" (chapter Rev. 261, issued 10-04-19; §20.1 Rev. 1, 10-01-03) —
https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/Downloads/bp102c03pdf.pdf
(note the file name `bp102c03pdf.pdf`; `bp102c03.pdf` in either case returns 404).

| Claim | Quote | Clause |
| --- | --- | --- |
| Full-day units | "The number of days of care charged to a beneficiary for inpatient hospital or skilled nursing facility (SNF) care services is" | §20.1 (ends "always in units of full days") |
| Midnight-to-midnight | "A day begins at midnight and ends 24 hours later. The midnight-to-midnight method is to be used in counting days of care" | §20.1 |
| Admission day counts | "A part of a day, including the day of admission and day on which a patient returns from leave of absence, counts as a full day." | §20.1 |
| Discharge day does not | "the day of discharge, death, or a day on which a patient begins a leave of absence is not counted as a day unless discharge or" | §20.1 (ends "death occur on the day of admission") |
| Same-day admit and discharge = 1 day | "If admission and discharge or death occur on the same day, the day is considered a day of admission and counts as one inpatient" | §20.1 |
| Leave of absence start | "The day on which the patient began a leave of absence is treated as a day of discharge, and is not counted as an inpatient day" | §20.1.2 |
| Leave of absence return | "treated as a day of admission and is counted as an inpatient day if the patient is present at midnight of that day" | §20.1.2 |
| SNF discharge day | "For SNF services, Medicare does not pay for accommodations on the day of discharge or" | §20.1.3 |

"Midnight census" as a phrase — NOT FOUND; the manual's wording is "midnight-to-midnight method" and
"present at midnight of that day".

42 CFR 409.10 (https://www.law.cornell.edu/cfr/text/42/409.10) — checked: it lists included/excluded
inpatient hospital services and contains no day-counting text. Do not cite it for the admission/discharge
day rule.

---

## 14. ACGME Common Program Requirements (Residency) — Section VI.F / §6.20–6.28

The requested URL https://www.acgme.org/globalassets/pfassets/programrequirements/cprresidency_2025.pdf
returns 404. Two ACGME documents were verified:

- **2025 reformatted**: https://www.acgme.org/globalassets/pfassets/programrequirements/2025-reformatted-requirements/cprresidency_2025_reformatted.pdf
  — "ACGME-approved interim revision September 3, 2025; effective September 3, 2025". It renumbers the
  section as **6.20–6.28** (no Roman numerals) under the heading "Clinical Experience and Education".
- **2023 v3** (VI.F numbering): https://www.acgme.org/globalassets/pfassets/programrequirements/cprresidency_2023v3.pdf

The requirement text is identical between the two apart from one word ("inclusive of" → "including" in
6.20). Mapping and quotes:

| 2023v3 no. | 2025 no. | Quote | Type |
| --- | --- | --- | --- |
| VI.F.1. | 6.20. | "limited to no more than 80 hours per week, averaged over a four-week period, inclusive of all in-house clinical and" | Core |
| (cont.) | | "...educational activities, clinical work done from home, and all moonlighting." | |
| VI.F.2.a) | 6.21. | "Residents should have eight hours off between scheduled clinical work and education periods." | Detail |
| VI.F.2.b) | 6.21.a. | "Residents must have at least 14 hours free of clinical work and education after 24 hours of in-house call." | Core |
| VI.F.2.c) | 6.21.b. | "must be scheduled for a minimum of one day in seven free of clinical work and required education (when averaged over four weeks)" | Core |
| (cont.) | | "At-home call cannot be assigned on these free days." | |
| VI.F.3.a) | 6.22. | "Clinical and educational work periods for residents must not exceed 24 hours of continuous scheduled clinical assignments." | Core |
| VI.F.3.a).(1) | 6.22.a. | "Up to four hours of additional time may be used for activities related to patient safety, such as providing effective" | Core |
| (cont.) | | "...transitions of care, and/or resident education. Additional patient care responsibilities must not be assigned" | |
| VI.F.4.a) | 6.23. | "In rare circumstances, after handing off all other responsibilities, a resident, on their own initiative, may elect to remain" | Detail |
| VI.F.4.b) | 6.23.a. | "These additional hours of care or education must be counted toward the 80-hour weekly limit." | Detail |
| VI.F.4.c) | 6.24. | "may grant rotation-specific exceptions for up to 10 percent or a maximum of 88 clinical and educational work hours" | — |
| VI.F.5.b) | 6.25.a. | "Time spent by residents in internal and external moonlighting (as defined in the ACGME Glossary of Terms) must be counted" | Core |
| VI.F.5.c) | 6.25.b. | "PGY-1 residents are not permitted to moonlight." | Core |
| VI.F.6. | 6.26. | "Night float must occur within the context of the 80-hour and one-day-off-in-seven requirements." | Core |
| VI.F.7. | 6.27. | "Residents must be scheduled for in-house call no more frequently than every third night (when averaged over a four-week period)." | Core |
| VI.F.8.a) | 6.28. | "The frequency of at-home call is not subject to the every-third-night limitation, but must satisfy the requirement for one day" | Core |
| VI.F.8.a).(1) | 6.28.a. | "At-home call must not be so frequent or taxing as to preclude rest or reasonable personal time for each resident." | Core |

Definition used by 6.21.b/VI.F.2.c: "a day off is defined in the ACGME Glossary of Terms as "one (1)
continuous 24-hour period free from all administrative, clinical, and educational activities."" (Background
and Intent). Background to 6.22.a/VI.F.3.a).(1): "This 24 hours and up to an additional four hours must occur
within the context of 80-hour weekly limit, averaged over four weeks."

Corrections to the item as posed: the 8-hours-off rule is a "should" (Detail), not a "must"; the one-in-seven
rule sits under Mandatory Time Free (VI.F.2.c / 6.21.b), and the every-third-night rule is its own
requirement (VI.F.7 / 6.27), not VI.F.4/5.

---

## Not found / uncertain

1. **RFC 5905 "[θ − δ/2, θ + δ/2]"** — not in the RFC. The stated interval is `[theta − lambda, theta + lambda]`
   with `lambda = epsilon + delta/2` (§11.2.1, §11.2). Fix the spec wording before it becomes a rule.
2. **HLC "Algorithm 2"** — the Buffalo tech report labels the HLC algorithm "Figure 5" (§3.3, p.5). The OPODIS
   2014 version (where it may be Algorithm 2) was not fetched; cite the tech report figure or fetch the
   Springer LNCS version before citing an "Algorithm 2".
3. **Dataflow watermark sentence** — the extracted sentence is cut by footnote 6 after "processed by the";
   the closing word could not be confirmed from the extraction. The meaning (lower bound on event times
   processed by the pipeline) is unambiguous from §1.3 and footnote 6.
4. **FHIRPath `@2012-01 = @2012-02`** — not a printed example in N1 (v2.0.0) or v3.0.0. Result `false` follows
   from the stated rule; record it as derived.
5. **CQL timezone rule location** — the "hours or finer" normalisation sentence is in CQL Appendix B (Same As
   and sibling operators), not on the US CQL IG patterns-patient page. The IG page only warns about DateTime
   age overloads and recommends `date from`.
6. **AAP "not rounded"** — no sentence about rounding on the archived policy page; only "conventionally
   expressed as completed weeks". The publisher's live page (publications.aap.org) returns 403; PubMed
   gives abstract only. Quotes above come from the archived publisher page (2019-10-10 capture).
7. **ACOG CO 700 live text** — acog.org and journals.lww.com both return 402 to this client; quotes come from
   the archived acog.org page (2024-01-02 capture). SMFM's page only links to the LWW full text.
8. **CDC blanket "grace period not for scheduling"** — not on the current page. Only Table 3-2 footnote (f)
   distinguishes "validating past doses" from "planning doses ahead of time", and it permits prospective use
   against the routine minimums. If the roadmap needs a "never schedule with the grace period" rule it must
   come from another primary source (e.g. an ACIP MMWR edition), not this page.
9. **CDSi version** — the CDC index page and PDF both say Version 4.6 (December 13, 2024) as of 2026-09-23;
   no later version was listed. Re-check before release since CDSi is revised roughly yearly.
10. **PQA full specification** — paywalled (sold via NCQA Publications). Rules are sourced from PQA's public
    FAQ (2020), PQA's adherence-measures page, a PQA-copyright 2022 tip sheet, and a state appendix reproducing
    the July 2017 technical specification. "Different drugs in the class count as covered on any day" is
    supported by the 2017 Step 2 wording ("at least one drug in the class"), not by a current-year PQA
    document.
11. **"Midnight census"** — the CMS manual says "midnight-to-midnight method" and "present at midnight of that
    day"; the phrase "midnight census" does not appear. 42 CFR 409.10 has no day-counting text.
12. **ACGME 2025 URL** — `cprresidency_2025.pdf` is 404. The 2025 document that exists is the reformatted
    interim revision (numbered 6.20–6.28); VI.F numbering is verified from the 2023v3 PDF. A 2026 CPR
    (`2026-prs/cprresidency_2026.pdf`, 61 pages) also exists and carries the same 6.20–6.28 text.
13. **FHIR R4 Timing section number** — "2.24.0.16 Timing" per the R4 datatypes page heading; an earlier
    automated summary said 2.24.0.2, which is wrong.

