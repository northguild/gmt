# Road, Rail and Aviation realms — primary-source verification

Research spike for `@northguild/gmt` (ROAD, RAI, AV). Verified 2026-09-23.

Method: WebFetch/WebSearch only. Where a site returned a PDF, the file WebFetch saved was
text-extracted locally with `pypdf` in a throwaway venv  (nothing under the
repository was touched). Every quote below is at most 125 characters and is verbatim from the
source unless marked *paraphrase*. Blocked hosts: `eurocontrol.int` (403 on every path tried),
`regulatorylibrary.caa.co.uk` (403), `weather.gov` directives (403), `navcanada.ca` (404),
`acl-uk.org` (403), `manuals.plus` (403).

Format per item: **Claim** — "quote" — clause — URL.

---

## 1. 49 CFR 395.1 exceptions

Sources: Cornell LII <https://www.law.cornell.edu/cfr/text/49/395.1> and the 2024 annual edition XML
<https://www.govinfo.gov/content/pkg/CFR-2024-title49-vol5/xml/CFR-2024-title49-vol5-sec395-1.xml>.

### (b)(1) Adverse driving conditions

- **Extension is two hours beyond the maximum.** — "for not more than two additional hours beyond the maximum allowable hours" — § 395.1(b)(1)(i).
- **It applies to both the driving limit and the driving window.** The trigger clause reads:
  "cannot, because of those conditions, safely complete the run within the maximum driving time or duty time during which driving is permitted" — § 395.1(b)(1)(i), continuing "under § 395.3(a) or § 395.5(a)". The "+2 hours on the 14-hour window" reading follows from "duty time during which driving is permitted under § 395.3(a)"; the paragraph does not itself say "14" or "16". Treat "16-hour window under adverse conditions" as a derived value, not a quoted one.

### (e)(1) Short-haul, 150 air-mile radius

- **Radius.** — "The driver operates within a 150 air-mile radius (172.6 statute miles) of the normal work reporting location" — § 395.1(e)(1)(i).
- **14-hour release.** — "returns to the work reporting location and is released from work within 14 consecutive hours" — § 395.1(e)(1)(ii).
- **Off-duty separation.** — "A property-carrying commercial motor vehicle driver has at least 10 consecutive hours off-duty separating each 14 hours on-duty" — § 395.1(e)(1)(iii)(A); passenger-carrying: "at least 8 consecutive hours off-duty separating each 14 hours on-duty" — (iii)(B).
- **Time records instead of RODS.** — "maintains and retains for a period of 6 months accurate and true time records" — § 395.1(e)(1)(iv).
- The lead-in sentence exempting such drivers from §§ 395.8/395.11 (RODS/ELD) was not returned verbatim by the fetch tool. **Verbatim text of the exemption lead-in: NOT VERIFIED** — confirm by eye before quoting it. Sub-paragraph letters for (ii)/(iii) were also reported inconsistently between the two fetches; the numbering above follows the govinfo XML.

### (g)(1) Sleeper-berth provision (property-carrying)

- **Five ways to accumulate the required 10 hours.** § 395.1(g)(1)(i)(A)–(E):
  (A) "At least 10 consecutive hours off-duty"; (B) "At least 10 consecutive hours of sleeper berth time"; (C) "A combination of consecutive sleeper berth and off-duty time amounting to at least 10 hours"; (D) "sleeper berth time of at least 7 consecutive hours and up to 3 hours riding in the passenger seat" (team drivers); (E) "The equivalent of at least 10 consecutive hours off-duty calculated under paragraphs (g)(1)(ii) and (iii)".
- **Split-berth conditions (this is where 7/3 and 8/2 come from).** § 395.1(g)(1)(ii)(A)–(C):
  "Neither rest period is shorter than 2 consecutive hours" · "One rest period is at least 7 consecutive hours in the sleeper berth" · "The total of the two periods is at least 10 hours". The rule never names "7/3" or "8/2"; those are the two integer-hour pairs that satisfy (A)–(C). Any pair meeting the three constraints (e.g. 7.5/2.5) is also valid.
- **Driving around the split.** — "Does not exceed 11 hours under § 395.3(a)(3); and (2) Does not violate the 14-hour duty-period limit under § 395.3(a)(2)" — § 395.1(g)(1)(ii)(D).
- **Neither period counts against the 14-hour window.** — "The 14-hour driving window for purposes of § 395.3(a)(2) does not include qualifying rest periods under paragraph (g)(1)(ii)" — § 395.1(g)(1)(iii). Also: "must be re-calculated from the end of the first of the two periods" — (g)(1)(iii).

### (o) 16-hour short-haul exception

- **Release within 16 hours.** — "releases the driver from duty within 16 hours after coming on duty following 10 consecutive hours off duty" — § 395.1(o)(2).
- **Five prior duty tours at the same location.** — "released the driver from duty at that location for the previous five duty tours the driver has worked" — § 395.1(o)(1).
- **Frequency.** The text is not "once per 7 days"; it is: "has not taken this exemption within the previous 6 consecutive days, except when the driver has begun a new 7- or 8-consecutive day period" — § 395.1(o)(3), continuing "with the beginning of any off-duty period of 34 or more consecutive hours". Model it as "not within the previous 6 days, reset by a 34-hour restart".
- § 395.1(o)(4) exists but was not returned; **NOT VERIFIED**.

## 2. 49 CFR 395.5 (passenger) and 395.3 (property)

Sources: <https://www.law.cornell.edu/cfr/text/49/395.5>, <https://www.law.cornell.edu/cfr/text/49/395.3>.

### 395.5 passenger-carrying

- **10 hours driving after 8 off.** — "More than 10 hours following 8 consecutive hours off duty" — § 395.5(a)(1).
- **No driving after 15 hours on duty.** — "For any period after having been on duty 15 hours following 8 consecutive hours off duty" — § 395.5(a)(2).
- **60/7 and 70/8 cycles.** — "Having been on duty 60 hours in any 7 consecutive days if the employing motor carrier does not operate" (…every day) — § 395.5(b)(1); "Having been on duty 70 hours in any period of 8 consecutive days" — § 395.5(b)(2). Note the 70-hour cycle is **8** days, not 7.
- § 395.5 has **no 34-hour restart paragraph**; the restart exists only in § 395.3(c).

### 395.3 property-carrying

- **10 hours off to start.** — "A driver may not drive without first taking 10 consecutive hours off duty" — § 395.3(a)(1).
- **14-hour window.** — "A driver may not drive after a period of 14 consecutive hours after coming on-duty following 10 consecutive hours off-duty" — § 395.3(a)(2).
- **11 hours driving.** — "A driver may drive a total of 11 hours during the period specified in paragraph (a)(2)" — § 395.3(a)(3)(i).
- **30-minute break after 8 hours driving.** — "if more than 8 hours of driving time have passed without at least a consecutive 30-minute interruption in driving status" — § 395.3(a)(3)(ii).
- **60/7, 70/8.** — § 395.3(b)(1), (b)(2) (same wording as 395.5(b)).
- **34-hour restart.** — "the beginning of an off-duty period of 34 or more consecutive hours" — § 395.3(c)(1) and (c)(2).

## 3. Canada — Commercial Vehicle Drivers Hours of Service Regulations, SOR/2005-313

Source: Justice Laws <https://laws-lois.justice.gc.ca/eng/regulations/SOR-2005-313/> (site states "current to 2026-09-03 and last amended on 2021-06-12"); per-section pages `.../section-NN.html` and `FullText.html`.

### Definition of "day" (s. 1)

- "means a 24-hour period that begins at the hour designated by the motor carrier for the duration of the driver's cycle" — s. 1, "day".

### South of latitude 60°N (ss. 12–29)

- **13 h driving / 14 h on duty per day.** — "no driver shall drive after the driver has accumulated 13 hours of driving time in a day" — s. 12(1); "…14 hours of on-duty time in a day" — s. 12(2).
- **8 consecutive hours off after 13/14.** — "unless the driver takes at least 8 consecutive hours of off-duty time before driving again" — s. 13(1) (after 13 h driving), s. 13(2) (after 14 h on duty).
- **16-hour elapsed window.** — "after 16 hours of time have elapsed between the conclusion of the most recent period of 8 or more consecutive hours of off-duty" — s. 13(3), continuing "time and the beginning of the next period of 8 or more consecutive hours of off-duty time".
- **10 h off per day, 8 consecutive + 2 in blocks ≥ 30 min.** — "at least 10 hours of off-duty time in a day" — s. 14(1); "may be distributed throughout the day in blocks of no less than 30 minutes" — s. 14(2); "at least 2 hours of off-duty time that does not form part of a period of 8 consecutive hours of off-duty time" — s. 14(3) (…"required by section 13").
- **24 h off in any 14 days.** — "unless the driver has taken at least 24 consecutive hours of off-duty time in the preceding 14 days" — s. 25 ("Subject to section 28").
- **Cycle 1: 70 h / 7 days.** — "after the driver has accumulated 70 hours of on-duty time during any period of 7 days" — s. 26.
- **Cycle 2: 120 h / 14 days, and 24 h off before passing 70 h.** — "(a) 120 hours of on-duty time during any period of 14 days; or" · "(b) 70 hours of on-duty time without having taken at least 24 consecutive hours of off-duty time" — s. 27.
- **Cycle reset.** — "(a) for cycle 1, at least 36 consecutive hours; or (b) for cycle 2, at least 72 consecutive hours" — s. 28(1); "the accumulated hours are set back to zero" — s. 28(2).
- **Cycle switching.** — "to switch from cycle 1 to cycle 2, at least 36 consecutive hours; or (b) to switch from cycle 2 to cycle 1, at least 72 consecutive hours" — s. 29(1).

### North of latitude 60°N — the section numbers in the brief are wrong

- **Scope.** — "Sections 39 to 54 apply in respect of driving north of latitude 60°N." — s. 37. Sections 38 and 40 are "[Repealed, SOR/2019-165, s. 10]" / "[Repealed, SOR/2019-165, s. 11]". There is no separate north-of-60 "daily off-duty" section any more.
- **15 h driving / 18 h on duty, then 8 off.** — "after the driver has accumulated more than 15 hours of driving time or 18 hours of on-duty time" · "unless they take at least 8 consecutive hours of off-duty time before driving again" — s. 39(1).
- **20-hour elapsed window.** — "if more than 20 hours of time has elapsed between the conclusion of the most recent period of 8 or more consecutive hours" — s. 39(2) (…"of off-duty time and the beginning of the next period of 8 or more consecutive hours of off-duty time").
- **Cycle 1: 80 h / 7 days.** — "after the driver has accumulated 80 hours of on-duty time during any period of 7 days" — s. 51 ("Subject to section 53").
- **Cycle 2: 120 h / 14 days; 24 h off before passing 80 h.** — "(a) 120 hours of on-duty time in any period of 14 days; or" · "(b) 80 hours of on-duty time, without having taken at least 24 consecutive hours of off-duty time" — s. 52.
- **Cycle reset north.** — same 36 h / 72 h wording as s. 28 — s. 53(1)–(2).
- The north-of-60 "24 h off in preceding 14 days" analogue (expected around s. 50) was **not fetched**; do not cite a section number for it without checking.

## 4. Regulation (EC) 561/2006, consolidated 2020-08-20 (CELEX 02006R0561-20200820)

Source: EUR-Lex <https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02006R0561-20200820> (includes Regulation (EU) 2020/1054 "Mobility Package" amendments). legislation.gov.uk was not needed.

- **Week.** — "'a week' means the period of time between 00.00 on Monday and 24.00 on Sunday" — Art. 4(i).
- **Regular/reduced daily rest.** — "any period of rest of at least 11 hours" (regular; alternatively "at least 3 hours" + "at least nine hours"); "at least nine hours but less than 11 hours" (reduced) — Art. 4(g).
- **Regular/reduced weekly rest.** — "any period of rest of at least 45 hours" / "less than 45 hours, which may … be shortened to a minimum of 24 consecutive hours" — Art. 4(h).
- **Daily driving 9 h, 10 h twice a week.** — "The daily driving time shall not exceed nine hours." · "may be extended to at most 10 hours not more than twice during the week" — Art. 6(1).
- **Weekly 56 h.** — "The weekly driving time shall not exceed 56 hours" — Art. 6(2).
- **Fortnightly 90 h.** — "The total accumulated driving time during any two consecutive weeks shall not exceed 90 hours." — Art. 6(3).
- **Break 45 min after 4½ h; or 15 + 30.** — "After a driving period of four and a half hours a driver shall take an uninterrupted break of not less than 45 minutes" — Art. 7 first para; "a break of at least 15 minutes followed by a break of at least 30 minutes" — Art. 7 second para (order is fixed: 15 then 30).
- **New daily rest within each 24 h.** — "Within each period of 24 hours after the end of the previous daily rest period or weekly rest period a driver shall have taken a new" (…"daily rest period.") — Art. 8(2); "at least nine hours but less than 11 hours … shall be regarded as a reduced daily rest period" — Art. 8(2) second sub-para.
- **Daily rest may extend into weekly rest.** — "A daily rest period may be extended to make a regular weekly rest period or a reduced weekly rest period." — Art. 8(3).
- **Max three reduced daily rests.** — "A driver may have at most three reduced daily rest periods between any two weekly rest periods." — Art. 8(4).
- **Multi-manning: 30 h.** — "within 30 hours of the end of a daily or weekly rest period, a driver engaged in multi-manning must have taken a new daily rest period of at least nine hours" — Art. 8(5).
- **Two weekly rests per fortnight; start within six 24-hour periods.** — "two regular weekly rest periods; or one regular weekly rest period and one reduced weekly rest period of at least 24 hours" — Art. 8(6) first sub-para; "A weekly rest period shall start no later than at the end of six 24-hour periods from the end of the previous weekly rest period." — Art. 8(6) second sub-para.
- **Two consecutive reduced weekly rests, international goods only.** — "may, outside the Member State of establishment, take two consecutive reduced weekly rest periods provided that the driver" — Art. 8(6) third sub-para, continuing "in any four consecutive weeks takes at least four weekly rest periods, of which at least two shall be regular weekly rest periods". (The brief called this "8(6)(b)"; it is the third sub-paragraph of 8(6), not a lettered point.)
- **Coach derogation, 12 × 24 h.** — "may postpone the weekly rest period for up to 12 consecutive 24-hour periods following a previous regular weekly rest period" — Art. 8(6a).
- **Compensation by end of third week, en bloc.** — "compensated by an equivalent period of rest taken en bloc before the end of the third week following the week in question" — Art. 8(6b) first sub-para; "the next weekly rest period shall be preceded by a rest period taken as compensation for those two reduced weekly rest periods" — Art. 8(6b) second sub-para.
- **Compensation attached to ≥ 9 h rest.** — "shall be attached to another rest period of at least nine hours" — Art. 8(7).
- **Not in the vehicle.** — "shall not be taken in a vehicle. They shall be taken in suitable gender-friendly accommodation" — Art. 8(8).
- **Return home every four weeks; three weeks after two reduced.** — "within each period of four consecutive weeks, in order to spend at least one regular weekly rest period" — Art. 8(8a) first sub-para; "the driver is able to return before the start of the regular weekly rest period of more than 45 hours taken in compensation" — Art. 8(8a) second sub-para. "Three weeks" is not stated; it is the consequence of 8(6) third sub-para + 8(6b) + 8(8a). Documentation duty: "The undertaking shall document how it fulfils that obligation" — Art. 8(8a) third sub-para.
- **There is no Article 8(8b).** Article 8 contains paragraphs 1, 2, 3, 4, 5, 6, 6a, 6b, 7, 8, 8a, 9, 10. The brief's "8(8b)" should be dropped.
- **Ferry/train interruption.** — "may be interrupted not more than twice by other activities not exceeding one hour in total" — Art. 9(1) first sentence (regular daily or reduced weekly rest); for regular weekly rest: "(a) the journey is scheduled for 8 hours or more; and (b) the driver has access to a sleeper cabin in the ferry or on the train" — Art. 9(1).

## 5. Commission Delegated Decision (EU) 2017/2075 — new Annex VII to Directive 2012/34/EU

Source: EUR-Lex <https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32017D2075>, Annex.

- **Once per calendar year.** — "The working timetable shall be established once per calendar year." — point 1.
- **December change.** — "The change of working timetable shall take place at midnight on the second Saturday in December." — point 2.
- **June adjustment.** — "it shall take place at midnight on the second Saturday in June and at such other intervals between these dates as are required" — point 2. IMs "may agree on different dates and in this case they shall inform the Commission if international traffic may be affected" — point 2.
- **Capacity requests: deadline no more than 12 months before.** — "shall be no more than 12 months in advance of the change of the working timetable" — point 3 (late requests "shall also be considered").
- **Provisional international paths: 11 months before.** — "No later than 11 months before the change of the working timetable, the infrastructure managers shall ensure that provisional international train paths" — point 4.
- **Draft timetable: 4 months after the request deadline.** — "publish a draft working timetable at the latest four months after the deadline referred to in point (3)" — point 5.
- **Final update: 1 month before the change.** — "update the draft working timetable no later than one month before the change of the working timetable" — point 6.
- **Cross-network delay tolerance.** — "a presumed delay of not more than 10 hours and, from 14 December 2019, 18 hours" — point 7.
- **Major TCRs published 24 and 12 months before.** Threshold: "of a duration of more than seven consecutive days and for which more than 30 % of the estimated traffic volume" — point 8 (…"on a railway line per day is cancelled, re-routed or replaced by other modes of transport"); deadlines: "for a first time at least 24 months" and "in an updated form, for a second time at least 12 months before the change of the working timetable" — point 8.
- **Coordination deadlines.** — "no later than 18 months before the change of the working timetable if more than 50 % of the estimated traffic volume" (…"for a duration of more than 30 consecutive days") — point 11(a); "no later than 13 months and 15 days before the change of the working timetable period if more than 30 %" (…"more than seven consecutive days") — point 11(b); "no later than 13 months and 15 days" … "more than 50 %" … "for a duration of seven consecutive days or less" — point 11(c).
- **Minor TCRs.** — "capacity restrictions of a duration of seven consecutive days or less that need not be published in accordance with point (8)" — point 12; "more than 10 % of the estimated traffic volume on a railway line per day" — point 12; "becomes aware of no later than 6 months and 15 days before the change of the working timetable" — point 12; "communicate the updated capacity restrictions at least four months before the change of the working timetable" — point 12.
- Points 9, 10, 13, 14 (*paraphrase*): cross-network joint discussion; first consultation with applicants; IMs may set stricter thresholds via the network statement; publication periods may be waived for safety, force majeure, cost or with applicants' agreement.

## 6. railML `operatingPeriod` / bitmask

- **railML 2.x** — <https://wiki2.railml.org/wiki/TT:operatingPeriod>: "a 1 is given for each day on which the train runs and a 0 for each day on which it does not" — `@bitMask`; "The length of the @bitMask depends on the number of days described by `<timetablePeriod>`@startDate and `<timetablePeriod>`@endDate"; "If @startDate is not given, it must be assumed that the information encoded in `<operatingPeriod>` begins with the start of `<timetablePeriod>`" (and likewise `@endDate` → end of `timetablePeriod`; backticks added for Markdown only). First character = first day of the period.
- **railML 3.2/3.3** — <https://wiki3.railml.org/wiki/Generic:bitmaskValidity> (child of `TT:validities:validity`, which exists only in 3.3): "This is a bit mask with 0 or 1 for every day it describes. A 0 indicates a non-operating day, while a 1 indicates an operating day." — `@bitmask`; "Specifies the first day when this validities bitmask is to be applied." — `@fromDate` (obligatory); `@timePeriodRef` optional. Note the attribute is lower-case `bitmask` in railML 3 versus `bitMask` in railML 2, and there is no `endDate` — the length of the string defines the span.

## 7. UIC Leaflet 406 (Capacity, 2nd ed. 2013) — blocking-time components

- **Primary text: NOT FOUND (paywalled).** The UIC shop lists "Capacity", Ed. no. 2, edition date 01/06/2013, publication 09/07/2013, 56 pages, €389.00 excl. tax — <https://shop.uic.org/en/40-general-organisation-of-operations/492-capacity.html>. Its public abstract does not mention blocking time or its components.
- Tried: uic.org search; Scribd/pdfcoffee copies (not primary, not fetched); ResearchGate/ScienceDirect papers (secondary). Secondary literature (Landex; Weik et al.) lists the components as route-formation time, sighting/reaction time, approach time, running time in the block section, clearing time and release time — **this list is unverified against the leaflet and must not be cited as UIC 406 text**.

## 8. 49 U.S.C. §§ 21103 and 21104

Sources: <https://www.law.cornell.edu/uscode/text/49/21103>, <https://www.law.cornell.edu/uscode/text/49/21104>.

- **276 hours per calendar month** (on duty + limbo + other mandatory service) — § 21103(a)(1).
- **12 consecutive hours on duty max.** — "remain or go on duty for a period in excess of 12 consecutive hours" — § 21103(a)(2).
- **10 consecutive hours off in prior 24.** — "unless that employee has had at least 10 consecutive hours off duty during the prior 24 hours" — § 21103(a)(3).
- **6 days → 48 h; 7 days → 72 h off at home terminal.** — § 21103(a)(4)(A), (B).
- **Limbo-time caps are in (c)(1), not (c)(4).** — "a total of 40 hours per calendar month spent—(i) waiting for deadhead transportation; or (ii) in deadhead transportation" — § 21103(c)(1)(A); "a total of 30 hours per calendar month spent" — § 21103(c)(1)(B). The transition wording between (A) and (B) (which period after the 2008 enactment each applies to) was reported inconsistently by the fetch tool — **NOT VERIFIED verbatim**.
- **§ 21103(c)(4)** is the make-up rule: "additional time off duty equal to the number of hours by which such sum exceeds 12 hours" — § 21103(c)(4).
- **Signal employees.** — "for a period in excess of 12 consecutive hours; or … unless that employee has had at least 10 consecutive hours off duty during the prior 24 hours" — § 21104(a)(1)–(2); emergency: "not more than 4 additional hours in any period of 24 consecutive hours when an emergency exists" — § 21104(c).

## 9. 14 CFR 117.3 definitions and 117.25 rest

Sources: <https://www.law.cornell.edu/cfr/text/14/117.3>, <https://www.law.cornell.edu/cfr/text/14/117.25>.

- **Acclimated.** — "a flightcrew member has been in a theater for 72 hours or has been given at least 36 consecutive hours free from duty" — § 117.3.
- **Theater.** — "the distance between the flightcrew member's flight duty period departure point and arrival point differs by no more than 60 degrees longitude" — § 117.3.
- **Window of circadian low.** — "a period of maximum sleepiness that occurs between 0200 and 0559 during a physiological night" — § 117.3.
- **Physiological night's rest.** — "10 hours of rest that encompasses the hours of 0100 and 0700 at the flightcrew member's home base" — § 117.3 (continues: "unless the individual has acclimated to a different theater").
- **Flight duty period.** — "begins when a flightcrew member is required to report for duty with the intention of conducting a flight" — § 117.3; ends "when the aircraft is parked after the last flight and there is no intention for further aircraft movement by the same flightcrew member".
- **Report time.** — "the time that the certificate holder requires a flightcrew member to report for an assignment" — § 117.3.
- **Rest period.** — "a continuous period determined prospectively during which the flightcrew member is free from all restraint by the certificate holder" — § 117.3.
- **30 in 168.** — "at least 30 consecutive hours free from all duty within the past 168 consecutive hour period" — § 117.25(b).
- **36 h → acclimated in new theater.** — § 117.25(c).
- **56 h / 3 physiological nights after > 60° and > 168 h away.** — "a minimum of 56 consecutive hours rest" … "must encompass three physiological nights' rest based on local time" — § 117.25(d).
- **10 h rest, 8 h sleep opportunity.** — "a rest period of at least 10 consecutive hours immediately before beginning the reserve or flight duty period" — § 117.25(e); "a minimum of 8 uninterrupted hours of sleep opportunity" — § 117.25(e).
- **Deadhead longer than rest.** — "equal to the length of the deadhead transportation but not less than the required rest" — § 117.25(g).

## 10. EASA ORO.FTL.105 / ORO.FTL.235

Source: Commission Regulation (EU) No 83/2014 (inserts Subpart FTL into Annex III of 965/2012), EUR-Lex <https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32014R0083>. This is the *amending* regulation text, not a later consolidation; UK CAA library was blocked (403). Definitions are ORO.FTL.105 numbered points; the numbers are not reproduced here because the fetch returned text without them.

- **Acclimatised.** — "a state in which a crew member's circadian biological clock is synchronised to the time zone where the crew member is" — ORO.FTL.105; "considered to be acclimatised to a 2-hour wide time zone surrounding the local time at the point of departure" — same point; when "differs by more than 2 hours", acclimatisation follows "the values in the Table 1".
- **Reference time.** — "the local time at the reporting point situated in a 2-hour wide time zone band around the local time where a crew member" — ORO.FTL.105 (continues "is acclimatised").
- **Local night.** — "a period of 8 hours falling between 22:00 and 08:00 local time" — ORO.FTL.105.
- **Early start.** — "a duty period starting in the period between 05:00 and 05:59" (early type); "between 05:00 and 06:59" (late type) — ORO.FTL.105 'disruptive schedule'.
- **Late finish.** — "a duty period finishing in the period between 23:00 and 01:59" (early type); "between 00:00 and 01:59" (late type) — ORO.FTL.105.
- **Night duty.** — "a duty period encroaching any portion of the period between 02:00 and 04:59 in the time zone to which the crew is acclimatised" — ORO.FTL.105 (same for both types).
- **Disruptive schedule.** — "a crew member's roster which disrupts the sleep opportunity during the optimal sleep time window by comprising an FDP or a" — ORO.FTL.105 (continues "combination of FDPs which encroach, start or finish during any portion of the day or of the night where a crew member is acclimatised").
- **WOCL.** — "the period between 02:00 and 05:59 hours in the time zone to which a crew member is acclimatised" — ORO.FTL.105.
- **Rest period.** — "a continuous, uninterrupted and defined period of time, following duty or prior to duty, during which a crew member is free" — ORO.FTL.105.
- **Rest at home base: max(preceding duty, 12 h).** — "at least as long as the preceding duty period, or 12 hours, whichever is greater" — ORO.FTL.235(a)(1); (a)(2) lets (b) apply if "the operator provides suitable accommodation to the crew member at home base".
- **Away from base: max(preceding duty, 10 h) incl. 8 h sleep opportunity.** — "at least as long as the preceding duty period, or 10 hours, whichever is greater" — ORO.FTL.235(b); "This period shall include an 8-hour sleep opportunity in addition to the time for travelling and physiological needs." — (b).
- **Reduced rest via CS.** — ORO.FTL.235(c).
- **Recurrent extended recovery: 36 h incl. 2 local nights, ≤ 168 h apart, 2 local days twice a month.** — "shall be 36 hours, including 2 local nights" … "shall not be more than 168 hours" … "shall be increased to 2 local days twice every month" — ORO.FTL.235(d).
- **Additional rest** for time-zone effects, disruptive schedules, change of home base — ORO.FTL.235(e).

## 11. ICAO Annex 15 Chapter 6 (AIRAC) and AIRAC dates 2025–2027

Source: ICAO-hosted extract of Annex 15, 16th edition, Chapter 6 (page header "ANNEX 15 6-1 8/11/18") <https://www.icao.int/sites/default/files/safety/CAPSCA/PublishingImages/Pages/ICAO-SARPs-(Annexes-and-PANS)/an15_1.pdf> (PDF; text extracted locally).

- **28-day common effective dates.** — "upon a series of common effective dates at intervals of 28 days, including 8 November 2018" — 6.2.1 (the sentence opens "basing establishment, withdrawal or significant changes").
- **No further change for 28 days.** — "shall not be changed further for at least another 28 days after the effective date" — 6.2.2 (…"unless the circumstance notified is of a temporary nature and would not persist for the full period").
- **Reach recipients 28 days ahead; AIS distributes 42 days ahead.** — "so as to reach recipients at least 28 days in advance of the effective date" — 6.2.3 (Standard); "AIRAC information is distributed by the AIS unit at least 42 days in advance of the AIRAC effective dates" — Note to 6.2.3. The 42 days is a *Note*, not a Standard, in the 16th edition.
- **NIL notification one cycle before.** — "a NIL notification shall be distributed not later than one cycle before the AIRAC effective date concerned" — 6.2.4.
- **Only AIRAC dates for pre-planned significant changes.** — "Implementation dates other than AIRAC effective dates shall not be used for pre-planned operationally significant changes" — 6.2.5.
- **56 days for major changes (Recommendation).** — "information should be made available by the AIS so as to reach recipients at least 56 days in advance of the effective date" — 6.2.7.
- **Identifier convention (e.g. "2501"): NOT FOUND in Annex 15 Chapter 6.** State AIS calendars differ: Uganda CAA uses "2601"; ENNA Algeria uses "01-26"; Sakaeronavigatsia numbers cycles 0–13 within a year. Treat `YYNN` as a widely used convention, not an ICAO rule, unless Doc 8126 (not fetched, paywalled) is checked.

### AIRAC effective dates (EUROCONTROL page returned 403; three state AIS calendars agree)

Sources: ENNA/AIS Algeria <https://www.sia-enna.dz/airac-calendar.html> (2025–2027 complete); Uganda CAA AIC A17/25 of 10 NOV 2025 <https://aim.caa.co.ug/pdf/airac-dates.pdf> (2601–2703 with 42/56-day publication columns); Sakaeronavigatsia <https://ais.airnav.ge/en/airac-cycles> (2026–2027); Avinor <https://partner.avinor.no/en/ais/airac-dates/> (Norwegian AMDT subset, consistent).

- 2025 (13 cycles): 23 Jan, 20 Feb, 20 Mar, 17 Apr, 15 May, 12 Jun, 10 Jul, 07 Aug, 04 Sep, 02 Oct, 30 Oct, 27 Nov, 25 Dec.
- 2026 (13 cycles): 22 Jan, 19 Feb, 19 Mar, 16 Apr, 14 May, 11 Jun, 09 Jul, 06 Aug, 03 Sep, 01 Oct, 29 Oct, 26 Nov, 24 Dec.
- 2027 (13 cycles): 21 Jan, 18 Feb, 18 Mar, 15 Apr, 13 May, 10 Jun, 08 Jul, 05 Aug, 02 Sep, 30 Sep, 28 Oct, 25 Nov, 23 Dec.
- Confirmed anchors: **2025-01-23 = first cycle of 2025 ("01-25" ENNA)**; **2026-01-22 = 2601** ("2601 … Effective date 22 Jan 2026", Uganda AIC); **2027-01-21 = 2701** ("2701 … 21 Jan 2027", Uganda AIC). All dates are Thursdays 28 days apart, and 2025-01-23 is 28 × n days from Annex 15's 8 November 2018 anchor (n = 81).
- Uganda's table also shows the 6.2.3/6.2.7 lead times as dates, e.g. for 2601: "Publication date for major changes 30 Oct 2025" (84 days), "normal changes 11 Dec 2025" (42 days), effective 22 Jan 2026.

## 12. IATA SSIM Chapter 7, Record Type 3 (Flight Leg Record)

- **The manual itself: NOT FETCHED (paywalled).** IATA product page <https://www.iata.org/en/publications/manuals/standard-schedules-information/>. ACL-UK "Introductory guide to SSIM" (403) and the manuals.plus copy (403) were unreachable.
- **Layout derived from two independent public parsers**, which agree on every field (label as *secondary — verify against the manual before hard-coding*):
  CRAN `ssimparser` R source <https://rdrr.io/cran/ssimparser/src/R/ssimparser.R> and `rok/ssim` regex widths <https://raw.githubusercontent.com/rok/ssim/main/ssim/regexes.py>.

  | Cols (1-based) | Field |
  | --- | --- |
  | 1 | Record type ("3") |
  | 2 | Operational suffix |
  | 3–5 | Airline designator |
  | 6–9 | Flight number |
  | 10–11 | Itinerary variation identifier |
  | 12–13 | Leg sequence number |
  | 14 | Service type |
  | 15–21 | Period of operation — from (DDMMMYY) |
  | 22–28 | Period of operation — to (DDMMMYY) |
  | 29–35 | Days of operation (7 chars) |
  | 36 | Frequency rate |
  | 37–39 | Departure station |
  | 40–43 | Scheduled time of passenger departure (STD) |
  | 44–47 | Scheduled time of aircraft departure |
  | 48–52 | UTC/Local time variation, departure (5 chars) |
  | 53–54 | Passenger terminal, departure |
  | 55–57 | Arrival station |
  | 58–61 | Scheduled time of aircraft arrival |
  | 62–65 | Scheduled time of passenger arrival (STA) |
  | 66–70 | UTC/Local time variation, arrival (5 chars) |
  | 71–72 | Passenger terminal, arrival |
  | 193–194 | Date variation (departure / arrival day offset, one char each) |
  | 195–200 | Record serial number |

- **Days-of-operation encoding (Monday = 1, 0 = no operation).** Verified only for SSIM *Chapter 6* slot messages, from the Spanish coordinator AECFA's "Quick Guide to Using the IATA SSIM format" <https://www.slotcoordination.es/sites/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1576865330896&ssbinary=true>: "7 digit sequence which represents the days of the week for which the request is made. Monday is indicated by 1, Tuesday by 2, etc." and "The days on which there is no operation are represented by a 0 in the corresponding position". The same guide states seasons: "The summer season runs from the last Sunday in March to the Saturday before the last Sunday in October" and "slot requests must be made using the UTC time". Whether Chapter 7 pads non-operating days with "0" or blank is **NOT VERIFIED** against the manual.
- The UTC/Local time variation format (`±HHMM`) is inferred from the 5-character width only — **NOT VERIFIED**.

## 13. NOTAM Item D) schedule syntax — EUROCONTROL OPADD Edition 4.1

Source: OPADD Edition 4.1 (07/12/2020), ICAO APAC-hosted copy <https://www.icao.int/sites/default/files/sp-files/APAC/Documents/EUROCONTROL%20Operating%20Procedures%20for%20AIS%20Dynamic%20Data%20(OPADD)%20Edition%204.1.pdf> (PDF; text extracted locally). The eurocontrol.int copies returned 403. Section numbers below are reconstructed from the document's own cross-references ("detailed in paragraph 2.3.18 till 2.3.21", "paragraph 2.3.19.5 for the recommended syntax", "2.3.21 Examples"); the heading numerals themselves did not survive extraction. ICAO Doc 8126 was not fetched (paywalled).

- **Item D) sits inside B)–C).** — "relevant for users only at certain periods within the overall 'in force' period, i.e. between the dates and times given in" (…"Items B) and C)") — 2.3.18 (General rules). Glossary: "A NOTAM is active between the dates and times stated in Items B) and C) subject to the time schedule in Item D)." — Appendix A2.
- **First activity = B); last activity = C).** — "The start of the first activity in Item D) shall always correspond to the Item B) date and time." — 2.3.18; "shall always correspond to the end of the validity of the NOTAM given in Item C)" — 2.3.18.
- **Days or dates, not both.** — "Item D) shall contain either days of the week (MON, TUE,...) or dates (01 02 03...)." — 2.3.18.
- **200-character cap.** — "Item D) shall not exceed 200 characters. If it exceeds 200 characters, additional NOTAM shall be issued." — 2.3.18.
- **Gap cap.** — "The maximum time period between two consecutive activity periods shall not exceed 7 days." — 2.3.18.
- **EST in C) excluded when D) has dates.** — "If dates are used in Item D), 'EST' in Item C) shall not be used." — 2.3.17 (Item C).
- **Tokens (2.3.19 Abbreviations and symbols):** "Months: JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC"; "Dates: 01 02 03 .... 29 30 31"; "Days: MON TUE WED THU FRI SAT SUN"; "Times: Written as 4 digits (e.g.: 1030)"; "'DAILY' is optional, but recommended for activities applied every day from Item B) to Item C) inclusive."; "'EVERY' for a schedule on fixed days."; "'H24' for the period 0000-2359 on the day/dates concerned. Not to be used as a single entry."; "'SR' and/or 'SS' if appropriate to indicate Sunrise or Sunset."; "'EXC' for designating a full day or a series of full days when the NOTAM is NOT active."; "' - ' (hyphen) means 'TO' or 'FROM-TO'"; "Note: ' / ' (oblique) shall not be used in Item D)."; "The year shall not be inserted in Item D), as it is stated in Items B) and C)."
- **Day ranges are used.** — "Example: D) MON-FRI 0600-1700 EXC DEC 05" — 2.3.18; "D) MON WED FRI H24, SAT SUN 0600-1700" — 2.3.18 illustration.
- **Twilight offsets.** — "'SR MINUS**mm' and 'SS PLUS**mm' (** mm= number of minutes up to a maximum of 99)" — 2.3.20 (Special cases); "There shall be a blank space after 'SR' and 'SS' and the number of minutes shall be inserted immediately after 'MINUS' or 'PLUS'." Example: "B) 1405110413 C) 1405211701 D) SR MINUS30-SS PLUS30". Also "Example: B) 1405151920 C) 1405200437 D) SS-SR" (B/C carry the actual SR/SS times).
- **Recommended syntax.** — "(start date) (start time)-(end date) (end time), (start date) (start time)-(end date) (end time)" — 2.3.19.5; "Example: D) 04 1000-06 1200, 08 1200-10 0700".
- **Changed operating hours go in E), not D).** — "The new schedule shall be presented in Item E) and not in Item D)." — 2.3.18.20.

## 14. TAF time groups — WMO-No. 306 Manual on Codes, Vol. I.1 Part A, FM 51–XV TAF

Source: WMO-No. 306 Vol. I.1 Part A, "2011 edition, Updated in 2013" (UBC-hosted copy) <https://www.eoas.ubc.ca/courses/atsc303/Instruments/wmo_guides/wmo_306-vI1_en-2013.pdf> (PDF; text extracted locally). The 2019/2025 editions were not fetched; the FM 51 regulations quoted have been stable since the 2008 change to the `DDHH/DDHH` form, but re-check against the current edition before citing an edition year. NWS Instruction 10-813 was 403; aviationweather.gov decoder was 403.

- **Code form.** Validity: "Y1Y1G1G1/Y2Y2G2G2" (i.e. DDHH/DDHH); change groups: "PROB C2C2 or PROB C2C2 TTTTT or TTTTT or TTYYGGgg" followed by "YYGG/YeYeGeGe" — FM 51 CODE FORM.
- **Validity period and FM subdivision.** — "The forecast shall cover the period Y1Y1G1G1 to Y2Y2G2G2." — 51.1.4; "divided into two or more self-contained parts by the use of the time indicator group TTYYGGgg in the form of FMYYGGgg" — 51.1.4.
- **FM supersedes.** — "When the group FMYYGGgg is used, all forecast conditions given before the group FMYYGGgg are superseded" — 51.8.2.
- **BECMG DDHH/DDHH, ≤ 2 h normally, ≤ 4 h always.** — "in the form of BECMG YYGG/YeYeGeGe shall indicate a change … at an unspecified time within the period YYGG to YeYeGeGe" — 51.8.3; "shall normally not exceed two hours and in any case shall not exceed four hours" — 51.8.3.
- **TEMPO DDHH/DDHH, < 1 h each, < half the period.** — "expected to last less than one hour in each instance and, in the aggregate cover, less than half of the period" — 51.8.4 (…"indicated by YYGG/YeYeGeGe").
- **Midnight end encodes as hour 24.** — "If the end of the forecast period is midnight, YeYe should be the date before midnight and GeGe should be indicated as 24." — Note (1) to 51.8.1. Parsers must accept `DD24`.
- **PROB30/PROB40 only.** — "For C2C2, only the values 30 and 40 shall be used to indicate the probabilities 30 and 40%, respectively." — 51.9.1; "PROB30 TEMPO 2922/3001" — 51.9.2 example; "shall not be used in combination with the change indicator group BECMG or the time indicator group FMYYGGgg" — 51.9.3.
- **Issue time.** — "The group YYGGggZ shall be included in each individual forecast to report the date and time of origin of forecast." — 51.1.2.

## 15. 14 CFR 234.2 and 234.4 (OOOI reporting)

Sources: <https://www.law.cornell.edu/cfr/text/14/234.2>, <https://www.law.cornell.edu/cfr/text/14/234.4>.

- **On-time.** — "a flight that arrives less than 15 minutes after its published arrival time" — § 234.2 (already verified by caller; note the fetched page rendered "mintues" — check for a source typo before quoting).
- **On-time performance.** — "the percentage of scheduled operations of a specific flight that an air carrier operates on-time during a month" — § 234.2.
- **Reportable flight (2018 onward).** — "any domestic nonstop scheduled passenger flight, including a mechanically delayed flight, held out to the public" — § 234.2 (…"under the reporting carrier's code, to or from any U.S. large, medium, small, or non-hub airport").
- § 234.2 does **not** define "gate departure time", "gate arrival time", "wheels-off" or "wheels-on".
- **Reporting fields (§ 234.4(a)):** "(4) Published OAG departure and arrival times for each scheduled operation"; "(5) CRS scheduled arrival and departure time for each scheduled operation"; "(6) Actual departure and arrival time for each operation of the flight"; "(9) Actual wheels-off and wheels-on times for each operation of the flight"; "(10) Date and day of week of scheduled flight operation"; "(11) Scheduled elapsed time, according to CRS schedule"; "(12) Actual elapsed time".
- **Gate is the measurement point.** — "shall be measured by the times at which the aircraft arrived at and departed from the gate or passenger loading area" — § 234.4(f). So OOOI = Out (6, gate), Off (9), On (9), In (6, gate).

---

## Not found / uncertain

1. **49 CFR 395.1(e)(1) lead-in** (the words exempting short-haul drivers from §§ 395.8/395.11) and **§ 395.1(o)(4)** — not returned verbatim; fetch tool's sub-paragraph lettering for (e)(1)(ii)/(iii) was inconsistent between two fetches. Verify by eye.
2. **49 CFR 395.1(b)(1) "+2 hours on the 14-hour window"** — follows from the reference to "duty time during which driving is permitted under § 395.3(a)"; the paragraph does not state "16 hours".
3. **Canada north-of-60 "24 hours off in preceding 14 days"** analogue (probably in ss. 49–50) — not fetched. Also note the brief's section numbers for north-of-60 were wrong: it is ss. 39, 51, 52, 53 (s. 37 is the scope clause; ss. 38 and 40 are repealed).
4. **Regulation 561/2006 Article 8(8b)** — does not exist; Article 8 has paragraphs 1–6, 6a, 6b, 7, 8, 8a, 9, 10. "Return within 3 weeks" is a derived consequence, not a stated rule.
5. **UIC Leaflet 406 (2013) blocking-time components** — primary text paywalled (€389); only shop metadata verified. Component list available only from secondary papers.
6. **49 U.S.C. § 21103(c)(1)(A)/(B) transition wording** (which months after the 2008 Act the 40-hour and 30-hour caps each govern) — reported inconsistently; verify. The caps are in (c)(1), not (c)(4).
7. **ORO.FTL.105 point numbers** — not reproduced (text extracted without numbering); quotes are from the original 83/2014 text, not a later consolidation (2014 onwards there were minor amendments, e.g. 2018/1042 for ORO.FTL.240/… — not checked).
8. **AIRAC identifier convention ("2501")** — not in Annex 15 Ch. 6; state AIS calendars use different identifier styles; Doc 8126 not fetched. EUROCONTROL's own AIRAC page (403) could not be used; dates are corroborated by three state AIS calendars instead.
9. **IATA SSIM Chapter 7 Record Type 3** — manual paywalled; the column table is from two public parsers that agree with each other, not from IATA. Days-of-operation "0 vs blank" padding and `±HHMM` format are not verified for Chapter 7.
10. **OPADD section numbers** — reconstructed from internal cross-references (2.3.18–2.3.21); heading numerals did not survive PDF extraction. ICAO Doc 8126 not fetched.
11. **WMO-No. 306 edition** — quotes are from the 2011 edition updated 2013; current (2019 / 2025) edition not fetched.
12. **UK CAA regulatory library, NWS directives, NAV CANADA, ACL-UK, EUROCONTROL** — all unreachable from this environment; alternative primary or official-body sources were used as noted per item.
