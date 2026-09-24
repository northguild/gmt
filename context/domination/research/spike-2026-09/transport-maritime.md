# Transport / Intermodal / Maritime — primary-source verification

Date: 2026-09-23. Tools: WebFetch and WebSearch. Where WebFetch's summariser could not read a PDF, the
PDF it had already saved was text-extracted locally with pypdf; nothing
under the repository tree was touched. Two exceptions to "WebFetch only", both disclosed: Bowditch Vol. 1
2019 (37 MB, above WebFetch's 10 MB cap) was downloaded with curl locally; a curl attempt on
the STCW/CONF.2/34 PDF returned 403 and was abandoned. Quotes are at most 125 characters; longer passages
are split. Extracted texts were working files and are not kept.

Legend for source rank: **PRIMARY** = issuing body's own text; **MIRROR** = verbatim copy of the primary
document on another host; **REPRODUCTION** = a third party quoting the primary text; **NOT FOUND** = not
reached.

---

## 1. BIMCO Laytime Definitions for Charter Parties 2013

- Source: https://www.bimco.org/media/qy2neqim/laytime-definitions-for-charter-parties-2013-v2.pdf (PRIMARY, BIMCO's own PDF, 4 pages, 33 numbered definitions)
- Preamble: the definitions apply "for the purposes of Laytime only" and only "when any or all such definitions are expressly incorporated into the Charter Party" (Preamble, p. 1).
- Not present as numbered terms: **STRIKE** (no definition in the 2013 set), **TURN TIME** (appears only as the phrase "turn-time" inside definitions 20 and 21), **AVERAGE** (the 2013 term is "TO AVERAGE LAYTIME", no. 23), **REVERSIBLE** (the term is "REVERSIBLE LAYTIME", no. 24).

| No. | Term | Paraphrase (own words) |
|---|---|---|
| 1 | PORT | Any area where vessels load or discharge, including berths, anchorages, buoys, offshore facilities and the places outside the legal/fiscal area where a vessel is ordered to wait its turn, whatever the distance. |
| 2 | BERTH | The specific place where the vessel loads or discharges, including a wharf, anchorage or offshore facility used for that purpose. |
| 3 | REACHABLE ON ARRIVAL | Charterer undertakes that an available berth is provided on arrival at the port which the vessel can reach safely without delay. |
| 4 | ALWAYS ACCESSIBLE | As 3, plus the charterer undertakes the vessel can also leave the berth safely and without delay at any time. |
| 5 | LAYTIME | The agreed period during which the owner keeps the vessel available for loading/discharging without payment beyond the freight. |
| 6 | PER HATCH PER DAY | Laytime = cargo quantity ÷ (daily rate per hatch × number of hatches); twin parallel hatches count as one, a hatch workable by two gangs counts as two. |
| 7 | PER WORKING HATCH PER DAY / PER WORKABLE HATCH PER DAY | Laytime = largest quantity in one hold ÷ (daily rate per hatch × hatches serving that hold); same twin-hatch rule. |
| 8 | DAY | 24 consecutive hours; part of a day counts pro rata. |
| 9 | CALENDAR DAY | 24 consecutive hours from 0000 to 2400; part counts pro rata. |
| 10 | CONVENTIONAL DAY | 24 consecutive hours running from any identified time; part counts pro rata. |
| 11 | WORKING DAY | A day when, by local law or practice, work is normally carried out. |
| 12 | RUNNING DAYS / CONSECUTIVE DAYS | Days following one immediately after another. |
| 13 | RUNNING HOURS / CONSECUTIVE HOURS | Hours following one immediately after another. |
| 14 | HOLIDAY | A day (other than the normal weekly rest day), or part of one, when by local law or practice work is not normally done in ordinary working hours. |
| 15 | WEATHER WORKING DAY | A working day (or part) during which cargo could be worked without weather interruption, including hypothetically while waiting for turn; interruptions are deducted **pro rata** to the time that would have been worked. |
| 16 | WEATHER WORKING DAY OF 24 CONSECUTIVE HOURS | A working day (or part) of 24 consecutive hours of weather-workable time; the **actual period** of weather interruption (real or hypothetical) is deducted. |
| 17 | WEATHER WORKING DAY OF 24 HOURS | A period of 24 hours **assembled from one or more working days** of weather-workable time; the actual interruption is deducted. |
| 18 | (WORKING DAY) WEATHER PERMITTING | Same meaning as no. 16. |
| 19 | EXCEPTED or EXCLUDED | The specified days do not count as laytime even if cargo is worked on them. |
| 20 | UNLESS SOONER COMMENCED | If turn-time has not expired but cargo work starts, laytime commences. |
| 21 | UNLESS SOONER COMMENCED, IN WHICH CASE ACTUAL TIME USED TO COUNT | Only the time actually used during turn-time counts as laytime. |
| 22 | UNLESS USED | If laytime has commenced and cargo is worked in an excepted period, the time actually used counts. |
| 23 | TO AVERAGE LAYTIME | Separate loading and discharging calculations; time saved in one is set off against excess in the other. |
| 24 | REVERSIBLE LAYTIME | Charterer's option to add loading and discharging allowances together; if exercised, it works as one total allowance. |
| 25 | NOTICE OF READINESS | Notice to the charterer/shipper/receiver (as the charter requires) that the vessel has arrived at the port or berth and is ready to load or discharge. |
| 26 | TIME LOST WAITING FOR BERTH TO COUNT AS LOADING OR DISCHARGING TIME or AS LAYTIME | If no berth is available and NOR cannot be tendered at the waiting place, time lost counts as laytime (or demurrage if laytime expired); stops when a berth is available; resumes after NOR and any notice time. |
| 27 | WHETHER IN BERTH OR NOT (WIBON) or BERTH OR NO BERTH | If the berth is unavailable on arrival, NOR may be tendered from any usual waiting place in the port and laytime runs per the charter. |
| 28 | WHETHER IN PORT OR NOT (WIPON) | If berth and usual waiting place are both unavailable, NOR may be tendered from any recognised waiting place off the port. |
| 29 | VESSEL BEING IN FREE PRATIQUE | The vessel complies with port health requirements. |
| 30 | DEMURRAGE | Agreed amount payable to the owner for delay once laytime has expired, for which the owner is not responsible; laytime exceptions do not apply unless the charter says so. |
| 31 | DESPATCH MONEY or DESPATCH | Agreed amount payable by the owner if cargo work finishes before laytime expires. |
| 32 | DESPATCH ON ALL WORKING TIME SAVED or ON ALL LAYTIME SAVED | Despatch runs from completion to laytime expiry **excluding** periods excepted from laytime. |
| 33 | DESPATCH ON ALL TIME SAVED | Despatch runs from completion to laytime expiry **including** excepted periods. |

Specific definitions asked for, with supporting quotes (definition numbers in parentheses):

- WEATHER WORKING DAY (15): "excluded from the Laytime a period calculated by reference to the ratio which the duration of the interruption bears" — i.e. pro-rata deduction. Also counts hypothetical interruption: "if the Vessel is still waiting for her turn, it would be possible to load/discharge the cargo without interruption".
- WEATHER WORKING DAY OF 24 CONSECUTIVE HOURS (16): "excluded from the Laytime the period during which the weather interrupted or would have interrupted work".
- WEATHER WORKING DAY OF 24 HOURS (17): "a period of 24 hours made up of one or more Working Days"; deduction is "the actual period of such interruption".
- EXCEPTED or EXCLUDED (19): "the Days specified do not count as Laytime even if loading or discharging is carried out on them".
- UNLESS SOONER COMMENCED (20): "if turn-time has not expired but loading or discharging is carried out, Laytime shall commence".
- UNLESS SOONER COMMENCED, IN WHICH CASE ACTUAL TIME USED TO COUNT (21): "actual time used during turn-time shall count as Laytime".
- UNLESS USED (22): "if Laytime has commenced but loading or discharging is carried out during excepted periods, actual time used shall count".
- REVERSIBLE LAYTIME (24): "an option given to the charterer to add together the time allowed for loading and discharging".
- TO AVERAGE LAYTIME (23): "any time saved in one operation is to be set off against any excess time used in the other".
- NOTICE OF READINESS (25): "the Vessel has arrived at the Port or Berth, as the case may be, and is ready to load or discharge".
- TIME LOST WAITING FOR BERTH TO COUNT (26): "any time lost to the Vessel is counted as if Laytime were running, or as time on Demurrage if Laytime has expired"; "Such time ceases to count once the Berth becomes available."
- WHETHER IN BERTH OR NOT (27): "shall be entitled to tender Notice of Readiness from it and Laytime shall commence in accordance with the Charter Party".
- WHETHER IN PORT OR NOT (28): "entitled to tender Notice of Readiness from any recognised waiting place off the Port".
- DEMURRAGE (30): "Demurrage shall not be subject to exceptions which apply to Laytime unless specifically stated in the Charter Party."
- DESPATCH (31): "an agreed amount payable by the owner if the Vessel completes loading or discharging before the Laytime has expired".
- DESPATCH ON ALL WORKING TIME SAVED (32): "until the expiry of the Laytime excluding any periods excepted from the Laytime".
- DESPATCH ON ALL TIME SAVED (33): "to the expiry of the Laytime including periods excepted from the Laytime".
- LAYTIME (5): "the period of time agreed between the parties during which the owner will make and keep the Vessel available".
- PER HATCH PER DAY (6): "Each pair of parallel twin hatches shall count as one hatch."; a hatch "capable of being worked by two gangs simultaneously shall be counted as two hatches".
- PER WORKING HATCH PER DAY (7): "dividing the quantity of cargo in the hold with the largest quantity by the result of multiplying the agreed daily rate".
- STRIKE: NOT FOUND — no such definition in the 2013 document.
- TURN TIME: NOT FOUND as a definition — only used as a term inside nos. 20 and 21.
- Time-unit definitions relevant to code: DAY (8) "a period of twenty-four (24) consecutive hours. Any part of a Day shall be counted pro rata."; CALENDAR DAY (9) "running from 0000 hours to 2400 hours"; CONVENTIONAL DAY (10) "running from any identified time".

---

## 2. GENCON 1994, Part II, clause 6(c) — commencement of laytime

- Claim: laytime starts at **13.00** if NOR is given up to and including **12.00**; at **06.00 next working day** (not 08.00) if NOR is given during office hours after 12.00.
- Quote: "commence at 13.00 hours, if notice of readiness is given up to and including 12.00 hours"
- Quote: "at 06.00 hours next working day if notice given during office hours after 12.00 hours"
- Quote (same clause, last sentence): "Time used before commencement of laytime shall count."
- Quote (berth not available): "Laytime or time on demurrage shall then count as if she were in berth and in all respects ready for loading/discharging"
- Quote (shifting): "Time used in moving from the place of waiting to the loading/ discharging berth shall not count as laytime."
- Source: BIMCO SmartCon "Sample copy" of GENCON 1994 Part II, clause 6 "Laytime", sub-clause (c) "Commencement of laytime (loading and discharging)", hosted at https://consemaracademy.com/wp-content/uploads/2024/01/GENCON-1994.pdf (MIRROR of the BIMCO form; BIMCO's own copy is behind SmartCon login). Cross-checked against the Institute of Chartered Shipbrokers Ireland guide, which reproduces the clause with the form's line numbers 101–104: https://icsireland.ie/pdfs/ICS-LAYTIME.pdf (REPRODUCTION).
- Clause 7 "Demurrage" (same source): "per day or pro rata for any part of a day. Demurrage shall fall due day by day"; non-payment triggers "96 running hours written notice to rectify the failure".

---

## 3. "Once on demurrage, always on demurrage"

- Claim: once laytime has expired, laytime exceptions do not stop demurrage unless the exceptions clause expressly says so.
- Case: *Dias Compania Naviera SA v Louis Dreyfus Corporation* [1978] 1 WLR 261 (House of Lords), Lord Diplock at pp. 263–264.
- Quote: "no exceptions will operate to prevent demurrage continuing to be payable unless the exceptions clause is clearly worded"
- Note: Lord Diplock is quoting Scrutton on Charterparties, 16th ed. (1955) p. 353, and adopting it.
- Source: https://www.trans-lex.org/302840/ (REPRODUCTION of the judgment text; the official law report is paywalled).
- Codified in the BIMCO 2013 definitions, no. 30: "Demurrage shall not be subject to exceptions which apply to Laytime unless specifically stated in the Charter Party." — https://www.bimco.org/media/qy2neqim/laytime-definitions-for-charter-parties-2013-v2.pdf (PRIMARY).

---

## 4. DCSA event classifier codes (JIT Port Call and Track & Trace)

- JIT Port Call, OpenAPI 1.2.0-Beta-2, schema `eventClassifierCode` (Timestamp and OperationsEvent):
  - Quote: "Code for the event classifier can be ACT (Actual) PLN (Planned) EST (Estimated) REQ (Requested)"
  - Enum: `PLN`, `ACT`, `REQ`, `EST`.
  - Source: https://raw.githubusercontent.com/dcsaorg/DCSA-OpenAPI/master/jit/v1/jit_v1.2.0-Beta-2.yaml (PRIMARY, DCSA's own GitHub organisation).
- Track & Trace (T&T 2.2 references DCSA `EVENT_DOMAIN` 1.0.4 on SwaggerHub):
  - Quote: "Code for the event classifier. Values can vary depending on eventType"
  - Shipment, Transport and Equipment events: `ACT`, `PLN`, `EST`. Operations events only: `ACT`, `PLN`, `EST`, `REQ`.
  - Source: https://api.swaggerhub.com/domains/dcsaorg/EVENT_DOMAIN/1.0.4 (PRIMARY, DCSA's SwaggerHub account); referenced from https://api.swaggerhub.com/apis/dcsaorg/DCSA_TNT/2.2.0.
- ERP pattern wording (DCSA documentation page): "ERP-pattern (Estimated, Requested, and Planned times) together with Actuals" — https://dcsa.org/standards/just-in-time-port-call/documentation-just-in-time-port-call- (PRIMARY). That page names JIT 1.2 Beta data definitions and a 2025 "Port Call Interface Standard" reachable only through an Atlassian wiki; the 2025 documents were not opened.
- Not verified: whether T&T 3.x or the 2025 Port Call standard adds classifiers beyond ACT/PLN/EST/REQ.

---

## 5. Advance-filing timing rules

Note: ecfr.gov redirected every request to `unblock.federalregister.gov`; the CFR text below was read from Cornell LII, which republishes the eCFR text verbatim (MIRROR).

### 5a. US Importer Security Filing (19 CFR 149.2)
- Anchor: lading aboard the vessel at the foreign port; **24 hours** before.
- Quote: "no later than 24 hours before the cargo is laden aboard the vessel at the foreign port"
- Stuffing location and consolidator elements: "as early as possible, in no event later than 24 hours prior to arrival in a United States port" (or by lading for voyages under 24 h).
- FROB: "prior to lading aboard the vessel at the foreign port". Break bulk and bulk cargo timing is relaxed by § 149.4.
- Source: https://www.law.cornell.edu/cfr/text/19/149.2, § 149.2(b) (MIRROR of eCFR).

### 5b. US 24-hour advance manifest (19 CFR 4.7)
- Anchor: lading at the foreign port; **24 hours** before. Bulk and qualifying break bulk: **24 hours before arrival** in the US instead.
- Quote: "24 hours before the cargo is laden aboard the vessel at the foreign port"
- Quote: "24 hours prior to the vessel's arrival in the United States"
- Source: https://www.law.cornell.edu/cfr/text/19/4.7, § 4.7(b)(2) and (b)(4) (MIRROR of eCFR).

### 5c. EU entry summary declaration by sea — Delegated Regulation (EU) 2015/2446, Article 105
- Anchor and hours: containerised cargo **24 h before loading** at the foreign port; bulk/break bulk **4 h before arrival** at first EU port; listed short-sea origins **2 h before arrival**; EU overseas departments with voyage under 24 h, **2 h before arrival**.
- Quote (a): "at the latest 24 hours before the goods are loaded onto the vessel on which they are to be brought into the customs territory"
- Quote (b): "at the latest four hours before the arrival of the vessel at the first port of entry into the customs territory of the Union"
- Quote (c): "at the latest two hours before arrival of the vessel at the first port of entry" — for goods from Greenland, the Faeroe Islands, Iceland, ports on the Baltic Sea, North Sea, Black Sea and Mediterranean, and all ports of Morocco (text as adopted in 2015).
- Source: text as originally adopted, https://www.legislation.gov.uk/eur/2015/2446/article/105/adopted (MIRROR of the EU act as adopted). EUR-Lex itself (https://eur-lex.europa.eu/eli/reg_del/2015/2446/oj/eng and the consolidated CELEX 02015R2446-20240401) returned empty pages to WebFetch, so the **current EU consolidated wording of point (c) is NOT VERIFIED** — the list of origins in (c) has been amended since 2015 and the UK point-in-time copy shows a different list (Ireland, Norway, Faeroe Islands, Iceland, Baltic/North Sea/Channel/Atlantic-coast ports), which is UK-specific.

### 5d. EU air pre-loading (PLACI) — Article 106
- Anchor: para 1 full ENS — flights under 4 h "at the latest by the time of the actual departure of the aircraft"; longer flights "at the latest four hours before the arrival of the aircraft at the first airport". Para 2 (postal/express) and 2a (other operators): the minimum dataset (PLACI) is due before loading.
- Quote (para 2): "minimum dataset of the entry summary declaration as soon as possible and at the latest before the goods are loaded"
- Source: point-in-time text including the Regulation (EU) 2020/877 amendments, https://www.legislation.gov.uk/eur/2015/2446/article/106/2020-12-30 (MIRROR). The DG TAXUD operational guidance (REPRODUCTION) uses the same "as early as possible ... at the latest prior to loading" formulation.

### 5e. Japan Advance Filing Rules (AFR, "JP24")
- Anchor: departure of the vessel from the port of loading; **24 hours** before. In force since March 2014.
- Quote: "no later than 24 hours before departure of the vessel from a port of loading"
- Source: Japan Customs, https://www.customs.go.jp/english/summary/advance5/index.htm (PRIMARY). The page cites "the Customs Law" generally; the article number is not given on the page.

### 5f. China advance manifest — GACC Announcement [2017] No. 56
- Anchor: for container vessels, **24 h before loading** (装船的24小时以前); for non-container vessels, **24 h before arrival at the first domestic port** (抵达境内第一目的港的24小时以前). Effective **1 June 2018**.
- Official text: **NOT FOUND** on customs.gov.cn. Tried: site search of customs.gov.cn (no hit for 2017年第56号), OOCL advisory (403), shui5.cn reproduction (page delivered obfuscated JavaScript), xindemarinenews (404). A partial Chinese reproduction at https://forfly.net/haiguanzongshugonggao2017niandi56hao.html (REPRODUCTION) gives the 24-hours-before-loading rule and the 2018-06-01 date; the non-container rule comes from search-result snippets of sohu.com/hsciq.com interpretations only (REPRODUCTION). Treat the hours as consistent across every reproduction seen but **unverified against GACC's own text**. Predecessor: GACC Decree No. 172 (2008), http://english.customs.gov.cn/statics/2bb17644-55f2-4c6b-a296-5ad18cd3f7d6.html (not opened).

### 5g. Canada ACI marine
- Legal source: Reporting of Imported Goods Regulations, SOR/86-873.
  - Cargo, s. 15(1)(a): "at least 24 hours before the shipment is loaded onto the vessel if all or part of the shipment is in a cargo container"
  - Conveyance, s. 14(1)(a): "at least 96 hours before the vessel is scheduled to arrive at its port of arrival if there is a cargo container on board"
  - Conveyance, s. 14(1)(b): "at least 24 hours before the vessel is scheduled to arrive at its port of arrival in any other case"
  - Conveyance from US/Puerto Rico with only empty containers, s. 14(2)(a): "at least four hours before the vessel is scheduled to arrive at its port of arrival"
  - Shorter voyages: ss. 14(3) and 15(3) require transmission before departure.
  - Source: https://laws-lois.justice.gc.ca/eng/regulations/SOR-86-873/FullText.html (PRIMARY).
- CBSA Memorandum D3-5-1, Appendix A (PRIMARY, https://www.cbsa-asfc.gc.ca/publications/dm-md/d3/d3-5-1-eng.pdf): "Containerized cargo 24 hours before loading"; "Break-bulk cargo 24 hours before arrival"; "Bulk cargo 24 hours before arrival"; "Empty marine containers 96 hours before arrival"; cargo loaded in the US: "Containerized, bulk or break-bulk 24 hours before arrival", "Empty marine containers 4 hours before arrival". Also para 45: EDTA "must be kept accurate to within eight hours"; para 54: the arrival message "must be transmitted and received within a two (2) hour window".

### 5h. US Notice of Arrival (33 CFR 160.212)
- Anchor: arrival at port or place of destination; **96 hours** before; voyages under 96 h: before departure and at least **24 hours** before arrival.
- Quote: "At least 96 hours before arriving at the port or place of destination"
- Quote: "Before departure but at least 24 hours before arriving at the port or place of destination"
- (a)(3): US vessels of 300 GT or less on voyages under 24 h — "at least 60 minutes before departure from the foreign port or place".
- Source: https://www.law.cornell.edu/cfr/text/33/160.212, § 160.212(a)(3)–(4) (MIRROR of eCFR).

---

## 6. X12 data elements 623 (Time Code) and 1250 (Date Time Period Format Qualifier)

Source used: Stedi's X12 dictionary (X12-licensed; acceptable per the brief). x12.org requires a licence; the x12.netlify.app mirror returned 404. Version shown by Stedi for element 623 at https://www.stedi.com/edi/x12/element/623 is its latest release (008010 series); 1250 was read at release 005010, https://www.stedi.com/edi/x12-005010/element/1250, and the definition confirmed at 008010, https://www.stedi.com/edi/x12/element/1250.

### 623 Time Code
- Definition quote: "since + is a restricted character, + and - are substituted by P and M in the codes that follow"
- Fixed UTC offsets (ISO-8601 style): 01–12 = "Equivalent to ISO P01" … "P12" (UTC+01 … UTC+12); 13–24 = "Equivalent to ISO M12" … "M01" — note the descending order: 13 = UTC−12, 14 = UTC−11, …, 24 = UTC−01; 25 = "ISO M2:30"; 26 = "ISO M3:30"; 27 = "ISO P5:30"; 28 = "ISO P9:30"; 29 = "ISO P10:30".
- Zero offset: GM "Greenwich Mean Time"; UT "Universal Time Coordinate".
- Named standard/daylight codes (each one names a specific rule, so it is a fixed offset by that zone's definition, though the element text does not state the offset): AD/AS Alaska Daylight/Standard; CD/CS Central; ED/ES Eastern; HD/HS Hawaii-Aleutian; MD/MS Mountain; ND/NS Newfoundland; PD/PS Pacific; TD/TS Atlantic.
- Generic (offset depends on the date): AT Alaska Time, CT Central Time, ET Eastern Time, HT Hawaii-Aleutian Time, MT Mountain Time, NT Newfoundland Time, PT Pacific Time, TT Atlantic Time, LT "Local Time".

### 1250 Date Time Period Format Qualifier
- Definition quote: "Code indicating the date format, time format, or date and time format"
- Codes (release 005010): CC "First Two Digits of Year Expressed in Format CCYY"; CD "Month and Year Expressed in Format MMMYYYY"; CM CCYYMM; CQ CCYYQ (year + quarter); CY "Year Expressed in Format CCYY"; D6 "Date Expressed in Format YYMMDD"; D8 "Date Expressed in Format CCYYMMDD"; DA DD-DD (range within month); DB MMDDCCYY; DD "Day of Month in Numeric Format"; DDT CCYYMMDD-CCYYMMDDHHMM; DT "Date and Time Expressed in Format CCYYMMDDHHMM"; DTD CCYYMMDDHHMM-CCYYMMDD; DTS CCYYMMDDHHMMSS-CCYYMMDDHHMMSS; EH YDDD; KA YYMMMDD; MCY MMCCYY; MD MMDD; MM "Month of Year in Numeric Format"; RD MMDDCCYY-MMDDCCYY; RD2 YY-YY; RD4 CCYY-CCYY; RD5 CCYYMM-CCYYMM; RD6 YYMMDD-YYMMDD; RD8 "Range of Dates Expressed in Format CCYYMMDD-CCYYMMDD"; RDM YYMMDD-MMDD; RDT CCYYMMDDHHMM-CCYYMMDDHHMM; RMD MMDD-MMDD; RMY YYMM-YYMM; RTM "Range of Time Expressed in Format HHMM-HHMM"; RTS "Date and Time Expressed in Format CCYYMMDDHHMMSS"; TC "Julian Date Expressed in Format DDD"; TM "Time Expressed in Format HHMM"; TQ MMYY; TR DDMMYYHHMM; TS "Time Expressed in Format HHMMSS"; TT MMDDYY; TU YYDDD; UN Unstructured; YM YYMM; YMM CCYYMMM-MMM; YY "Last Two Digits of Year Expressed in Format CCYY".
- Note: "DTM" is not a 1250 code (it is the segment name); the date-time codes are DT, RTS, DTS, RDT, DDT, DTD, TR.

---

## 7. UN/EDIFACT data element 2379 — Date or time or period format code

- Official UNECE UNTDID pages **NOT REACHED**: https://service.unece.org/trade/untdid/d03a/tred/tred2379.htm (403), .../d16b/... (403), https://unece.org/fileadmin/DAM/trade/untdid/d16b/tred/tred2379.htm (404). Used the StylusStudio mirror of UNTDID D03A: https://www.stylusstudio.com/edifact/D03A/2379.htm (MIRROR).
- Requested codes (name, then description quote):
  - 101 YYMMDD — "Calendar date: Y = Year; M = Month; D = Day."
  - 102 CCYYMMDD — "Calendar date: C = Century ; Y = Year ; M = Month ; D = Day."
  - 201 YYMMDDHHMM — "Calendar date including time without seconds"
  - 203 CCYYMMDDHHMM — "Calendar date including time with minutes"
  - 204 CCYYMMDDHHMMSS — "Calendar date including time with seconds"
  - 301 YYMMDDHHMMZZZ — "See 201 + Z = Time zone."
  - 303 CCYYMMDDHHMMZZZ — "See 203 plus Z=Time zone."
  - 304 CCYYMMDDHHMMSSZZZ — "See 204 plus Z=Time zone."
  - 718 CCYYMMDD-CCYYMMDD — "start date followed by the end date (both including century)"
  - 719 CCYYMMDDHHMM-CCYYMMDDHHMM — "A period of time which includes the century, year, month, day, hour and minute."
- Other codes seen on the same page: 2 DDMMYY; 3 MMDDYY; 4 DDMMCCYY; 105 YYDDD; 106 MMDD; 107 DDD; 108 WW; 302 YYMMDDHHMMSSZZZ; 305 MMDDHHMM; 306 DDHHMM; 401 HHMM; 402 HHMMSS; 404 HHMMSSZZZ; 405 MMMMSS; 406 ZHHMM "Offset from Coordinated Universal Time (UTC) where Z is plus (+) or minus (-)."; 501 HHMMHHMM; 502 HHMMSS-HHMMSS; 602 CCYY; 609 YYMM; 610 CCYYMM; 615 YYWW; 616 CCYYWW; 715 YYWW-YYWW; 716 CCYYWW-CCYYWW; 717 YYMMDD-YYMMDD; 720 DHHMM-DHHMM (D = ISO weekday 1–7); 801–814 quantities of years, months, weeks, days, hours, minutes, seconds, semesters, four-month periods, trimesters, half months, ten-day periods, day of week (Monday = 1), working days.

---

## 8. Bowditch, The American Practical Navigator, 2019 edition — zone description and zone letters

- Edition and location: Pub. No. 9, Volume I, 2019 edition (NGA), **Chapter 16 "Time"**, section **1607 "Zone Time"**, printed pages 279–280, and **Table 1607a "Time zones, descriptions, and suffixes"**. (In the 2002 edition the same material is Chapter 18, §1806.)
- Zone meridian rule: "the nearest meridian exactly divisible by 15° is usually designated as the time meridian or zone meridian"; zone width: "within a time zone extending ±7.5° on each side of the time meridian the time is the same".
- Sign convention: "positive in west longitude and negative in east longitude".
- ZD definition: "called the zone description (ZD), is the number of whole hours that are added to or subtracted from the zone time".
- DST: "Note that the zone description does not change when Daylight Savings Time is in effect."
- Conversion: "When converting ZT to UTC, a positive ZT is added and a negative one subtracted" [sic: "ZT" for "ZD" in the source].
- Table 1607a letters: 7.5°W–7.5°E ZD 0 suffix **Z**; east zones ZD −1 … −12 = **A B C D E F G H I K L M** (no J); west zones ZD +1 … +12 = **N O P Q R S T U V W X Y**. Table note: "GMT is indicated by suffix Z."
- Source: https://msi.nga.mil/api/publications/download?key=16693975/SFH00000/Bowditch_Vol_1_LoRes_2019.pdf (PRIMARY; 37 MB, fetched with curl locally, text-extracted with pypdf; extracted text at the extracted text (not kept)).
- Source defect worth knowing: the Y row of Table 1607a as printed reads "172.5° W to 7.5° W + 12 Y"; the intended bound is 180° (compare the M row "172.5° E to 180° E -12 M" and ACP 121 Annex A).
- Cross-check, 2002 edition §1806 (Wikisource transcription, REPRODUCTION): "the nearest meridian exactly divisible by 15° is usually used as the time meridian", "positive in west longitude and negative in east longitude" — https://en.wikisource.org/wiki/The_American_Practical_Navigator/Chapter_18.

---

## 9. Date-time group (DTG) — ACP 121(G)

- Document: ACP 121(G) "Communication Instructions — General", Combined Communications-Electronics Board, October 2004. Copy read: https://navy-radio.org/manuals/acp/acp121g.pdf (MIRROR; pages carry an everyspec.com watermark). ACP 121(F) is also at https://www.commsmuseum.co.uk/publications/ACP121/acp121f.pdf (not opened).
- Chapter 3, para 317c(1): "Date and time together are expressed as six figures followed by the zone letter." — first pair day of month, second pair hour (24-h clock), third pair minutes.
- Para 317c(3) example: "271630Z JUN 03 represents 1630 GMT on 27th June 2003."
- Chapter 3, message-format block "c. DATE-TIME GROUP" (pages 3-13/3-14): "expressed as six digits followed by a zone suffix, and the month expressed by the first three letters"; "The zone suffix “Z”, meaning Greenwich Mean Time, is used except where the theatre or area commander prescribes".
- Para 317c(2): the zone letter may be omitted "when a covering expression such as "all times Zulu" may be used instead of appending a zone letter to each".
- Annex A to Chapter 3, para 1 "Table of Time Zones, Zone Description and Designation Letters": 7½W–7½E → 0 → Z; 7½E–22½E → −1 → A … 172½E–180 → −12 → M (no J; I is used); 7½W–22½W → +1 → N … 172½W–180 → +12 → Y. Footnote: "Letter N is also used to designate zone -13; this is to provide for a ship in zone -12 keeping Daylight Saving Time."
- Annex A, para 2a(3): "The letter “J” is omitted."; para 1 note (4): the suffix is "the correction ... which must be applied to the time as expressed in order to convert to GMT" (e.g. Washington DC ZD +5 → suffix R; on DST ZD +4 → suffix Q).
- Extracted text: the extracted text (not kept).

---

## 10. NMEA 0183 — RMC, ZDA, GGA time fields

- Source: gpsd "NMEA Revealed", https://gpsd.gitlab.io/gpsd/NMEA.html (REPRODUCTION — the NMEA 0183 standard itself is paywalled; gpsd is the de-facto public reference).
- RMC field 1: "UTC of position fix, hh is hours, mm is minutes, ss.ss is seconds."; field 9: "Date, ddmmyy".
- ZDA fields: 1 "UTC time (hours, minutes, seconds, may have fractional subseconds)"; 2 "Day, 01 to 31"; 3 "Month, 01 to 12"; 4 "Year (4 digits)"; 5 "Local zone description, 00 to +- 13 hours"; 6 "Local zone minutes description, 00 to 59, apply same sign as local hours".
- GGA field 1: "UTC of this position report, hh is hours, mm is minutes, ss.ss is seconds."
- Precision note (GGA): "The number of digits past the decimal point for Time, Latitude and Longitude is model dependent."
- Century pivot: RMC carries only a two-digit year (`ddmmyy`); gpsd's page states no century rule — **NOT FOUND** in the source. A pivot must be chosen by the consumer (ZDA gives a four-digit year and is the fix).
- ZDA zone sign: gpsd gives the range "00 to +- 13 hours" but does **not** state whether positive means east or west of UTC — **NOT VERIFIED**; the NMEA 0183 standard text was not reachable.

---

## 11. GNSS time scales from the ICDs

### Galileo — OS SIS ICD Issue 2.0 (January 2021), §5.1.2 "Galileo System Time (GST)"
- Epoch: "GST was equal to 13 seconds at 22nd August 1999 00:00:00 UTC" (i.e. start epoch 13 s before that midnight; GST was 13 s ahead of UTC at the epoch).
- Week number: "This parameter is represented with 12 bits, which covers 4096 weeks (about 78 years)."; Table 62: WN 12 bits, TOW 20 bits, total 32 bits.
- TOW: "The TOW covers an entire week from 0 to 604799 seconds and is reset to zero at the end of each week."
- Continuity: "As GST is a continuous time scale, and UTC is corrected periodically with an integer number of leap seconds".
- GST−UTC parameters, §5.1.7 Table 68: A0 (32 bits), A1 (24 bits), ΔtLS "Leap Second count before leap second adjustment" (8 bits), t0t, WN0t (8 bits, modulo 256), WNLSF, DN, ΔtLSF.
- GST−TAI: the ICD does not state a TAI offset constant. Derived, not quoted: TAI−UTC was 32 s in August 1999 and GST−UTC was 13 s, so GST = TAI − 19 s (same as GPS time).
- Source: https://www.gsc-europa.eu/sites/default/files/sites/all/files/Galileo_OS_SIS_ICD_v2.0.pdf (PRIMARY, EU GNSS Service Centre). Extracted text: the extracted text (not kept).

### BeiDou — BDS-SIS-ICD-2.0 (December 2013)
- Epoch: "The start epoch of BDT was 00:00:00 on January 1, 2006 of Coordinated Universal Time (UTC)."
- No leap seconds: "BDT adopts international system of units (SI) seconds, rather than leap seconds, as the basic unit"
- UTC link: "BDT is related to the UTC through UTC(NTSC)."; "BDT offset with respect to UTC is controlled within 100 nanoseconds (modulo 1 second)."
- Week number, §5.2.4.4: "There are altogether 13 bits for week number (WN) which is the integral week count of BDT with the range of 0 through 8191."; "Week number count started from zero at 00:00:00 on Jan. 1, 2006 of BDT."
- SOW, §5.2.4.3: 20 bits, "the number of seconds that have occurred since the last Sunday, 00:00:00 of BDT".
- BDT = TAI − 33 s: not stated in the ICD; derived from TAI−UTC = 33 s on 2006-01-01 and BDT = UTC at the epoch.
- Source: copy of the official ICD at https://gge.ext.unb.ca/Resources/beidou_icd_english_ver2.0.pdf (MIRROR). The official host http://en.beidou.gov.cn/SYSTEMS/ICD/201806/P020180608519640359959.pdf closed the socket on three attempts (NOT REACHED). Extracted text: the extracted text (not kept).

### GLONASS — ICD L1, L2 GLONASS, Edition 5.1 (2008), §3.3.3 "GLONASS time"
- Leap seconds applied: "The GLONASS time scale is periodically corrected to integer number of seconds simultaneously with UTC corrections"
- Timing of the step: "at midnight 00 hours 00 minutes 00 seconds UTC from December 31 to January 1" (or end of any quarter), with users "notified in advance (at least three months before)".
- Three-hour offset (§4.4, word tb): "index of a time interval within current day according to UTC(SU) + 03 hours 00 min"; §5.2 also writes "MT (UTC + 03 hours 00 minutes 00 seconds)".
- Almanac word τc (§4.5): "GLONASS time scale correction to UTC(SU) time"; N4 "four-year interval number starting from 1996".
- Source: https://www.unavco.org/help/glossary/docs/ICD_GLONASS_5.1_(2008)_en.pdf (MIRROR of the Russian Institute of Space Device Engineering document; glonass-iac.ru not attempted). Extracted text: the extracted text (not kept).

### QZSS — IS-QZSS-PNT-003
- Time system, §5.1: "The PNT time system shall is the QZSS time system (QZSST) shown below." [sic]; "The length of 1 second in QZSST shall be identical to the International Atomic Time (TAI)."; "QZSST shall be delayed from TAI by 19 seconds." (identical to GPS time).
- Week number: "The week number is counted from January 6th, 1980."; LNAV §4.1.2.3(1): "This is 10-bit binary data (0-1024) that shall be modulo 1024 of each QZSS week number." (CNAV GGTO reference week WNGGTO is 13 bits.)
- Source: https://qzss.go.jp/en/technical/download/pdf/ps-is-qzss/is-qzss-pnt-003.pdf (PRIMARY, Cabinet Office of Japan). Extracted text: the extracted text (not kept).

### GPS — IS-GPS-200N
- §3.3.4 "GPS Time and SV Z-Count": "zero time-point defined as midnight on the night of January 5, 1980/morning of January 6, 1980"; "GPS time shall be a continuous time scale, while UTC is corrected periodically with an integer number of leap seconds"; a week is "604,800 seconds".
- LNAV §20.3.3.3.1.1 "Transmission Week Number": "These ten bits shall be a modulo 1024 binary representation of the current GPS week number"
- CNAV §30.3.3.1.1.1 "Transmission Week Number" (Message Type 10, bits 39–51): "13 bits which are a modulo-8192 binary representation of the current GPS week number"
- Source: https://www.navcen.uscg.gov/sites/default/files/pdf/gps/IS-GPS-200N.pdf (PRIMARY; US Coast Guard NAVCEN is an official distribution point alongside gps.gov). Extracted text: the extracted text (not kept).

---

## 12. STCW Code Section A-VIII/1 (Manila 2010) and MLC 2006 Standard A2.3

### MLC, 2006, as amended — Standard A2.3 "Hours of work and hours of rest"
- Source: ILO consolidated text including the 2014, 2016, 2018 and 2022 amendments, https://www.ilo.org/sites/default/files/2024-10/NORMES_MLC%20Amendments-EN_2022_Web_1.pdf (PRIMARY), printed pp. 32–33. Extracted text: the extracted text (not kept).
- Para 5(a): "maximum hours of work shall not exceed: (i) 14 hours in any 24-hour period; and (ii) 72 hours in any seven-day period"
- Para 5(b): "minimum hours of rest shall not be less than: (i) ten hours in any 24-hour period; and (ii) 77 hours in any seven-day period"
- Para 6: "divided into no more than two periods, one of which shall be at least six hours in length"; "the interval between consecutive periods of rest shall not exceed 14 hours"
- Para 7 (drills): "conducted in a manner that minimizes the disturbance of rest periods and does not induce fatigue"
- Para 8 (on call): "the seafarer shall have an adequate compensatory rest period if the normal period of rest is disturbed by call-outs to work"
- Para 13 (exceptions): collective agreements may permit "exceptions to the limits set out. Such exceptions shall, as far as possible, follow the provisions of this Standard" — the MLC itself sets **no** 70-hour or two-week cap; those caps are STCW A-VIII/1 para 9.
- Para 14 (master): "the master may suspend the schedule of hours of work or hours of rest and require a seafarer to perform any hours of work"; afterwards "provided with an adequate period of rest".

### STCW Code Section A-VIII/1 "Fitness for duty" (2010 Manila amendments, in force 1 January 2012)
- IMO's own text: **NOT REACHED**. Tried: https://stcw.maritime.edu/stcw/2025/assets/images/STCW_Chap_VIII.pdf (STCW/CONF.2/34 conference text; 403 to WebFetch and to curl), https://fms.maritime.edu:8452/assets/images/STCW_Chap_VIII.pdf (connection refused), https://www.regjeringen.no/globalassets/upload/nhd/ma-avd/skipssikkerhetsloven/stcw.pdf (403), IMO's hours-of-rest page (no figures). The cloudfront copy at torontobrigantine is the **pre-Manila** 1995 text (STCW.6/Circ.1) and must not be used for current limits — it reads "shall be provided a minimum of 10 hours of rest in any 24-hour period" with no 77-hour rule, and its para 4 allows reduction "to not less than 6 consecutive hours ... not less than 70 hours of rest are provided each seven day period".
- Manila figures verified against a flag-state notice reproducing A-VIII/1: UK MCA **MGN 566 (M+F)**, https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/590127/MGN_566_STCW_Manila_Amendments_Hours_of_Work__Alcohol_limit_final.pdf (REPRODUCTION by a government body):
  - Para 2.3: "The Manila amendments to STCW Regulation VIII/1 and Code A-VIII/1 came into force on 1 January 2012."
  - Para 2.1: the STCW minimum rest provisions match ILO 180/MLC (10 h in 24, 77 h in 7 days).
  - Para 2.7 (weekly, exceptions): "Seafarers must receive a minimum of 70 hours rest in any 7-day period;"; "Exceptions from the normal weekly rest period (77 hours) shall not be allowed for more than two consecutive weeks;"; "The intervals between two periods of exceptions on board shall not be less than twice the duration of the exception."
  - Para 2.8 (daily, exceptions): rest "may be divided into no more than three periods, one of which shall be at least 6 hours in length"; "neither of the other two periods shall be less than one hour in length"; "the intervals between consecutive periods of rest shall not exceed 14 hours;"; "Exceptions shall not extend beyond two 24-hour periods in any 7-day period."
- Paragraph map of the Manila A-VIII/1 as reported by imorules.com (REPRODUCTION, https://www.imorules.com/Chunk1819766217.html): para 2 = 10 h/24 h and 77 h/7 days; para 3 = no more than two periods, one at least 6 h, interval not exceeding 14 h; para 4 = emergency/overriding operational conditions, drills to minimise disturbance; para 5 = posting of schedules; para 6 = on-call compensatory rest; para 7 = records of daily hours of rest; para 8 = master's power for immediate safety; para 9 = collective-agreement exceptions (70 h/7 days, two consecutive weeks, three periods, one-hour minimum, two 24-hour periods in 7 days). The paragraph **numbers** are therefore from a reproduction, not from IMO's text.
- IMO-published cross-check: "Guidelines for the Development of Tables of Seafarers' Shipboard Working Arrangements", https://wwwcdn.imo.org/localresources/en/OurWork/HumanElement/Documents/ILO-IMO-Hours%20of%20rest_1.pdf (PRIMARY for ILO 180 wording, which the MLC carried forward): "minimum hours of rest shall not be less than: (i) 10 hours in any 24-hour period; and (ii) 77 hours in any 7-day period."

---

## 13. 46 CFR 541.6, 541.7, 541.8 (FMC demurrage and detention billing)

- Source: Cornell LII mirror of eCFR (ecfr.gov redirected): https://www.law.cornell.edu/cfr/text/46/541.6, https://www.law.cornell.edu/cfr/text/46/541.7, https://www.law.cornell.edu/cfr/text/46/541.8 (MIRROR).
- § 541.7(a): "issue a demurrage or detention invoice within thirty (30) calendar days from the date on which the charge was last incurred"
- § 541.7(b) (NVOCC re-billing): "within thirty (30) calendar days from the issuance date of the demurrage or detention invoice it received"
- § 541.7(c): the billing party must "provide an additional thirty (30) calendar days for the NVOCC to dispute the charge"; § 541.7(d): a corrected invoice also "within thirty (30) calendar days from the date on which the charge was last incurred". Failure: "the billed party is not required to pay the charge."
- § 541.8(a): "at least thirty (30) calendar days from the invoice issuance date to request mitigation, refund, or waiver of fees"
- § 541.8(b): "attempt to resolve the request within thirty (30) calendar days of receiving such a request" (or a later date agreed by both parties).
- § 541.6 required invoice contents — (a) identifying: bill of lading number(s); container number(s); port(s) of discharge (imports); "The basis for why the billed party is the proper party of interest". (b) timing: invoice date; invoice due date; allowed free time in days; start date of free time; end date of free time; "For imports, the container availability date"; "For exports, the earliest return date"; the specific date(s) for which demurrage/detention were charged. (c) rate: total amount due; "The applicable detention or demurrage rule"; the specific rate(s) per tariff or service contract. (d) dispute: contact for questions and mitigation requests; digital means to the publicly accessible dispute process; the timeframes for requesting mitigation/refund/waiver. (e) certifications that the charges comply with FMC rules and that the billing party's performance did not cause the charges.
- Day count confirmed: **30 calendar days** in every instance.

---

## Not found / uncertain

1. **BIMCO 2013 "STRIKE" and "TURN TIME"** — not numbered definitions in the 2013 document (STRIKE was dropped; TURN TIME appears only as a phrase in nos. 20–21).
2. **GACC Announcement [2017] No. 56** — official customs.gov.cn text not reached; 24 h before loading (container) / 24 h before first-port arrival (non-container) and the 2018-06-01 date rest on Chinese-language reproductions only.
3. **EU DA 2015/2446 Art. 105(c) current list of short-sea origins** — EUR-Lex returned empty pages; only the 2015 as-adopted text (legislation.gov.uk "adopted" copy) and the UK-amended point-in-time text were read. Hours in (a), (b), (d) are stable across both; the (c) origin list should be re-read on EUR-Lex.
4. **STCW A-VIII/1 Manila text** — IMO's own STCW/CONF.2/34 text was 403 on every host tried; limits and paragraph numbers come from the UK MCA MGN 566 and imorules.com reproductions. The values agree with the MLC A2.3 paras 5(b) and 6, which were read from ILO's text.
5. **UN/EDIFACT 2379** — official UNECE UNTDID pages 403/404; codes taken from the StylusStudio mirror of D03A.
6. **X12 623/1250** — read from Stedi (X12-licensed) rather than x12.org; the named zone codes (ES, ED, …) carry no offset in the element text — the UTC offset is by the named zone's own definition, not X12's.
7. **BeiDou BDS-SIS-ICD** — official en.beidou.gov.cn host closed the socket three times; text read from the UNB mirror of ICD 2.0 (2013). "BDT = TAI − 33 s" and "GST = TAI − 19 s" are derived, not stated in either ICD.
8. **GLONASS "constant three-hour difference" sentence** — the exact phrase was not located in the extracted 5.1 text; the offset is evidenced by "UTC(SU) + 03 hours 00 min" in §4.4 and §5.2.
9. **NMEA ZDA sign direction and RMC century pivot** — gpsd's page states neither; the NMEA 0183 standard is paywalled.
10. **Japan AFR legal basis article** — the Japan Customs page cites "the Customs Law" without an article number.
11. **DCSA 2025 Port Call standard / T&T 3.x** — only JIT 1.2.0-Beta-2 and EVENT_DOMAIN 1.0.4 (T&T 2.2) were verified.
12. **Bowditch 2019 Table 1607a** — the printed Y-zone bound "7.5° W" is a typo for 180°; noted so nobody transcribes it.
13. **eCFR** — every ecfr.gov URL redirected to unblock.federalregister.gov; all CFR text was read via Cornell LII.
