# INT-12 — Demurrage and detention conventions: charge basis and clock events

Date: 2026-09-24. Tools: curl, a browser session (for hosts that refuse scripted fetches: msc.com,
cma-cgm.com, unece.org), pypdf and pdf.js for PDF text. Quotes are verbatim and at most about 125
characters. Nothing under the repository tree was touched except this file.

Legend for source rank: **PRIMARY** = the issuing body's own text; **MIRROR** = verbatim copy of a
primary text on another host; **NOT REACHED** = the primary text could not be fetched, so the claim is
marked, not asserted. Jurisdiction and reach: **US-only** = binds US trades and the FMC only;
**national** = one other country's rule; **global tariff** = a carrier's published terms, per
country; **global standard** = an industry body whose members are the major carriers (DCSA) or a UN
body (UN/CEFACT).

Questions:

1. When free time is granted in working days, are the days charged after expiry counted in calendar
   days or working days? Does any regulation or standard fix it, and what do published tariffs say?
2. Which events start and stop each clock (import demurrage, import detention, terminal storage,
   export demurrage, export detention), and does any source run a merged demurrage-and-detention
   clock? What can GMT's `demurrageClock` vocabulary express against that?

---

## 1. Charge basis after working-day free time

### 1a. Regulation

- **46 CFR 541.6(b)** requires the invoice to state "(3) The allowed free time in days; (4) The start
  date of free time; (5) The end date of free time; (6) For imports, the container availability date;
  (7) For exports, the earliest return date; and (8) The specific date(s) for which demurrage and/or
  detention were charged." It says nothing about how those days are counted. "Calendar days" appears
  only in §§ 541.7–541.8 (30-day invoice, dispute and resolution windows). **US-only, PRIMARY.**
  https://www.ecfr.gov/current/title-46/chapter-IV/subchapter-B/part-541
- **46 CFR 541.3** defines "Demurrage or detention" as "any charges, including 'per diem' charges ...
  related to the use of marine terminal space (e.g., land) or shipping containers". Terminal storage
  is inside the definition, so the invoice rules reach it. **US-only, PRIMARY.** (same link)
- **89 FR 14330 (26 Feb 2024), preamble:** the FMC "declines to define 'end of free time', 'start of
  free time', or 'free time' as part of this rulemaking ... their meaning can vary terminal to
  terminal" and "does not have evidence at this time to support a finding that standardizing these
  terms is warranted." On (b)(8): "this rule requires the billing parties to identify the specific
  dates on which they charged demurrage or detention." **US-only, PRIMARY.**
  https://www.federalregister.gov/documents/2024/02/26/2024-02926/demurrage-and-detention-billing-requirements
- **90 FR 60579 (29 Dec 2025):** § 541.4 (who may be billed) was set aside by the D.C. Circuit and
  removed; §§ 541.6–541.8 are unchanged. **US-only, PRIMARY.**
  https://www.federalregister.gov/documents/2025/12/29/2025-23920/demurrage-and-detention-billing-requirements-properly-issued-invoices-provision-set-aside-by-court
- **85 FR 29638 (18 May 2020), interpretive rule preamble:** a shipper asked that "All free time
  should be defined as business days as not all ports allow pick up/return on weekends"; the FMC
  answered "the Commission will not in this general interpretive rule make a finding" and kept the
  incentive principle (now 46 CFR 545.5(c)). No day basis is fixed. **US-only, PRIMARY.**
  https://www.federalregister.gov/documents/2020/05/18/2020-09370/interpretive-rule-on-demurrage-and-detention-under-the-shipping-act
- **46 U.S.C. 41104(a)(15)** makes it unlawful to "invoice any party for demurrage or detention
  charges unless the invoice includes information as described in subsection (d)". Same fields as
  § 541.6; no counting rule. **US-only, MIRROR (Cornell LII).**
  https://www.law.cornell.edu/uscode/text/46/41104
- **California Bus. & Prof. Code § 22928(b)(1)** is the one legal text found that mandates
  working-day charging: a provider or terminal "shall not commence or continue free time or impose per
  diem, detention, demurrage ... (1) When the intermodal marine or terminal truck gate is closed
  during posted normal working hours. No per diem, detention, or demurrage charges shall be imposed on
  a holiday". **Sub-national (California), PRIMARY.**
  https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=22928.
- **China, MOT/NDRC 港口收费计费办法 (2017):** storage (堆存保管费) rates are set by the port
  operator ("收费标准由港口经营人自主制定", art. 45) and the free storage period is negotiated
  ("货物堆存免费保管期 ... 协商确定"). Carrier D&D is not regulated. A 2025 MOT rail-water notice only
  "鼓励航运企业延长空箱还箱期、减免滞箱费" (encourages). **National, PRIMARY.**
  https://www.gov.cn/gongbao/content/2017/content_5248236.htm ·
  https://xxgk.mot.gov.cn/2020/jigou/syj/202509/t20250924_4177224.html
- **EU:** Regulation (EU) 2017/352 (port services, charge transparency) contains no occurrence of
  "demurrage", "detention", "free time" or "storage" (read on the legislation.gov.uk mirror, which is
  also the UK's retained text). No EU or UK instrument on container D&D was found. **MIRROR.**
  https://www.legislation.gov.uk/eur/2017/352
- **Australia, ACCC Container stevedoring monitoring report 2023–24:** "Shipping lines charge cargo
  owners detention fees for failing to return containers within the agreed free period" and "cargo
  owners in Australia do not have adequate protection against such unreasonable practices". The ACCC
  monitors stevedores; it does not set free time or a day basis. **National, PRIMARY.**
  https://www.accc.gov.au/system/files/container-stevedoring-report-2023-24.pdf
- **India, Major Port Authorities Act 2021 and its scale-of-rates rules** (ministry compilation): the
  Board of each major port frames "a scale of rates and a statement of conditions" for its services,
  which include "(iv) wharfage, storage or demurrage of goods on any such place". In Indian port usage
  "demurrage" is the port's or CFS's storage charge on goods and "detention" the line's container
  charge; no counting rule. The DG Shipping advisory of 29 Mar 2020 on non-charging of detention was
  **NOT REACHED** (TLS reset). **National, PRIMARY.** https://shipmin.gov.in/sites/default/files/MPAACT2021.pdf
- **South Africa, Transnet Port Terminals Tariff Book 2025:** **NOT REACHED** (TLS reset).
  https://www.transnetportterminals.net/Customer/Tariffs/TPT%20Tariff%20Book%202025.pdf

### 1b. Standards

- **DCSA Arrival Notice API 1.0.0-Beta-1, `Freetime` object:** `freetimeTypeCode` is "`DET`
  (Detention) - `DEM` (Demurrage) - `PDM` (Per Diem) - `STO` (Storage)"; `unitOfMeasure` is "`CD`
  (Calendar Days) - `WD` (Working Days) - `HR` (Hours) - `DOD` (Day of discharge)";
  `calculationBasis` is free text ("reference to carrier website or individual charge"). The same
  object is in DCSA documentation domain 3.0.0. DCSA models the *free-time* unit; it has no field
  for the charge basis. **Global standard, PRIMARY.**
  https://github.com/dcsaorg/DCSA-OpenAPI/blob/master/an/v1/AN_v1.0.0-Beta-1.yaml
- **DCSA shipping glossary:** Demurrage "when a container remains inside the terminal or depot beyond
  the allotted free time"; Detention "for the usage of the container outside the terminal or depot,
  beyond the allotted free time period. This term is often used interchangeably with Per Diem in
  certain regions, particularly in the United States"; Storage "pays to the terminal/port or to the
  shipping line/carrier on behalf of the terminal/port". No start or end events, no counting basis,
  no merged term. **Global standard, PRIMARY.** https://dcsa.org/standards/shipping-glossary
- **DCSA domain 3.1.1:** `demurrageFreetime` "The number of days that the consignee has to pick up the
  full container before demurrage fees are charged"; `demurrageAmount` "A per-day fee ... after expiry
  of freetime for storing a full container at the equipment handling facility". **Global standard.**
  https://github.com/dcsaorg/DCSA-OpenAPI/blob/master/domain/dcsa/dcsa_domain_v3.1.1.yaml
- **UNECE Recommendation 23, Freight Cost Code rev. 1:** lists "1 04 028 Equipment demurrage" as a
  charge code (an "Equipment detention" code was not verified in the text read). A code list, not a
  counting rule. **Global standard, PRIMARY.**
  https://unece.org/sites/default/files/2023-10/rec23fcc_rev1_030623.pdf
- **UNCTAD (news, 2020):** "Demurrage refers to the charge that the merchant pays for the use of the
  container within the terminal beyond the free time period. Detention refers to the charge ...
  outside of the terminal or depot". Commentary, not a standard. **Global, PRIMARY.**
  https://unctad.org/news/demurrage-and-detention-charges-container-shipping
- **BIMCO Laytime Definitions 2013** govern charter parties only (see the spike record); they do not
  reach container D&D.

### 1c. Published tariffs

| Carrier, country | Free time basis | Charged days | Quote (verbatim) |
|---|---|---|---|
| CMA CGM, general terms (all countries) | C or W per grid | C or W per grid | "Duration are expressed either in calendar days or in working days." "The first chargeable day is the first day following the last day of free time." "Each day or part thereof is due in full." WORKING days "excludes the non-working day(s) of the week and the public holidays" |
| CMA CGM, US import (all ports except California) | working | calendar | "FREE DAYS ARE IN WORKING DAYS AFTER EXPIRATION OF FREE DAYS, TARIFF IS BILLABLE IN CALENDAR DAYS (i.e. including weekends and legal holidays)" |
| CMA CGM, US import, California | working | working | "No demurrage will be assessed during days for which a Terminal is closed, including weekends or holidays, even when demurrage free time has been exceeded." |
| CMA CGM, Uruguay | calendar (6 C) | calendar (C) | "AFTER FREE TIME DAY N°: Day number since discharge"; grid rows "6 C from 7th to 10th 75 USD C MERGED" |
| Hapag-Lloyd, USA detention (Oct 2025) | working ("DOI+4WD") | calendar outside California, **working in California** | "Rate per Calendar day ... 1st Period 3/CD" (USA excl. California) vs "Rate per workday ... 1st Period 3/WD" (California Ports); "Calendar days includes weekends and scheduled holidays"; "WD = Working day is defined as when the relevant terminal/facility is open for interchange" |
| Hapag-Lloyd, USA import demurrage (Maher) | per table | per table | "CD: Calendar Days: Saturdays, Sundays and Public Holidays are fully countable. WD: Working Days: Saturdays, Sundays and Public Holidays are excluded." |
| Hapag-Lloyd, USA import demurrage (Sep 2024) and US guide (Oct 2024) | working ("DOD + 4WD") | calendar; California working | table: "Rate per Calendar day ... 1st Period 3CD" and, for the California block, "Working Days ... 1st Period 3WD*"; guide: "Detention and Demurrage are applicable on a calendar / continuous day basis after free time has expired. Any unscheduled closures ... will be excluded" |
| Hapag-Lloyd, Japan import (rule D05; Jan 2026 table) | calendar excluding bank holidays, from customs release | calendar | "Cargo free time will commence of the day when the removal permit is granted by Customs at port of discharge, based on calendar days, excluding bank holidays"; "Commences from the 1st calendar day container Gated out full to container Gated in empty" |
| Hapag-Lloyd, UK import | calendar | calendar | "Demurrage and Storage freetime is inclusive of day of discharge of container. Bank Holidays are included." |
| Hapag-Lloyd, Italy import | calendar | calendar | "it commences at 00:01 the calendar day of the container discharged"; detention "Saturdays, Sundays and Public Holidays are fully countable" |
| Hapag-Lloyd, Belgium; Taiwan | calendar | calendar | Belgium table headed "Calendar Days"; Taiwan: "Calendar days include Saturdays, Sundays, and Public/Bank Holidays." |
| Maersk, Germany import | calendar | calendar | "Free time: Calendar days (Public holidays are counted as standard calendar days)"; "Invoiced: Per container, per calendar days" |
| Maersk, UK; Australia; Brazil import | calendar | calendar | UK "Free time: Calendar days"; Australia "Invoiced: Per container, per calendar day"; Brazil "Charges in USD per calendar day (including weekends and holidays)" |
| Maersk, South Africa tariff | calendar | (not stated) | "Standard demurrage free-time is 3 calendar days from date vessel completes discharge for Durban" |
| Maersk, US import; advisory 18 Jul 2024 | working | calendar since 8 Aug 2024 | "Free time will commence the first 0800 on the first business day following discharge"; advisory: "assessing demurrage and detention charges on a calendar day basis in the United States after freetime has expired, including days a pickup and return location is closed. Freetime will remain calculated on a working day basis" |
| Maersk, US export | demurrage calendar, detention working | calendar | "Free time is 7 calendar days including Saturday, Sunday, and holidays."; "demurrage will apply per calendar day including Saturdays, Sundays and holidays until the cargo loads, or scheduled vessel sail date, whichever event occurs first"; detention: "Working Day are defined as any day with operating gates" |
| MSC, USA | working | period lengths given in days, basis not stated | "Free time will start the first working day after individual container discharge."; "4 working days" |
| MSC, Vietnam export (combined) | calendar, holidays excluded | calendar | "7 Calendar days 4 Calendar days"; "The above free days do not include public holidays" |
| MSC, India import detention; UAE import (combined) | inclusive of discharge day; days | days | "Detention free days is inclusive of the Import discharge date"; UAE "Combined Detention and Demurrage Tariff - Imports ... Free Days 1st Period" |
| ACL, most ports (US, Canada, UK, IE, BE) | business | calendar | "Terms: Business days. Once free time expires, detention is charged on calendar days" (repeated for detention and export demurrage at every port) |
| ACL, Liverpool import demurrage and quay rent | business | business (no calendar switch stated) | "Terms: Business days" — the only ACL rows without the "charged on calendar days" sentence |
| TTI Long Beach terminal (wharf demurrage) | working | calendar | free time "Exclusive of Saturdays, Sundays and the Legal Holidays in which the terminal is designated as 'Closed'"; charge "Per day or fraction, Saturdays, Sundays, and holidays included" |

Sources: CMA CGM https://www.cma-cgm.com/ebusiness/tariffs/demurrage-detention/general-terms ·
https://www.cma-cgm.com/assets/public/documents/DD_Tarifs_US_21-JAN-2025.pdf ·
https://www.cma-cgm.com/assets/public/documents/URUGUAY%20S2%202025.pdf · Hapag-Lloyd
https://www.hapag-lloyd.com/content/dam/website/downloads/detention_demurrage/USA_Detention_Effective_October_01_2025.pdf ·
https://www.hapag-lloyd.com/en/services-information/news/2021/03/usa---import-demurrage-charges.html ·
https://www.hapag-lloyd.com/content/dam/website/downloads/detention_demurrage/USA_CH_Port_Demurrage_Import_Effective_09012024_to_03312025.pdf ·
https://www.hapag-lloyd.com/content/dam/website/downloads/detention_demurrage/Detention_and_Demurrage_Guide_USA_October_1_2024.pdf ·
https://www.hapag-lloyd.com/content/dam/website/downloads/pdf/US_Detention_and_Demurrage_Policies.pdf ·
https://www.hapag-lloyd.com/content/dam/website/downloads/detention_demurrage/Japan_detention_import_Jan2026.pdf ·
https://www.hapag-lloyd.com/content/dam/website/downloads/detention_demurrage/united_kingdom_demurrage_detention_import_20260101.pdf ·
https://www.hapag-lloyd.com/content/dam/website/downloads/detention_demurrage/italy_dnd_new.pdf ·
https://www.hapag-lloyd.com/content/dam/website/downloads/detention_demurrage/BE_Detention_Demurrage.pdf ·
https://www.hapag-lloyd.com/en/services-information/news/2021/03/taiwan---revision-of-import-detention---demurrage-tariff.html ·
Maersk https://terms.maersk.com/dnd · https://www.maersk.com/local-information/europe/germany/import ·
https://www.maersk.com/local-information/europe/united-kingdom/import ·
https://www.maersk.com/local-information/asia-pacific/australia/import ·
https://www.maersk.com/local-information/latin-america/brazil/import ·
https://www.maersk.com/~/media_sc9/maersk/local-information/files/africa/botswana/overview/ml-south-africa-tariff-2022-v3-updated.pdf ·
https://www.maersk.com/local-information/north-america/united-states-of-america/import ·
https://www.maersk.com/local-information/north-america/united-states-of-america/export ·
https://www.maersk.com/news/articles/2024/07/18/customer-advisory-for-nam-usa-demurrage-detention-tariff-update · MSC
https://www.msc.com/-/media/files/msc-cargo/local-information/america/united-states/detention-demurrage-and-per-diem-charges.pdf ·
https://www.msc.com/-/media/files/msc-cargo/local-information/asia-pacific/vietnam/export-_adjusment-of-export-demurrage-detention-tariff--12th-jan-2026.pdf ·
https://www.msc.com/-/media/files/msc-cargo/local-information/asia-pacific/india/import-detention.pdf ·
https://www.msc.com/-/media/files/msc-cargo/local-information/middle-east/united-arab-emirates/import-demurrage-tariff.pdf ·
ACL https://www.aclcargo.com/free-time-demurrage/ · TTI
https://www.totalterminals.com/sites/default/files/2022-10/TTI_Terminal_Tariff_20220110.pdf.
Not reached: Hapag-Lloyd Germany and Netherlands PDFs (404 on retry), MSC Denmark (404), Maersk India
and China pages (rendered empty), CMA CGM non-US country grids other than Uruguay.

**Answer to Question 1.** (a) No regulation or standard fixes the charge basis. 46 CFR 541 fixes
invoice contents and 30-calendar-day deadlines only; the FMC twice declined to define free time;
DCSA types the free-time unit (`CD`/`WD`/`HR`/`DOD`) and leaves the charge basis to free text. The
only legal text that dictates the basis is California § 22928, which forbids charging on a closed
gate or a holiday. (b) The dominant published shape is **free time in working days, charges in
calendar days**: CMA CGM's US header, Hapag-Lloyd's US table (working-day free time, "Rate per
Calendar day"), ACL's "Once free time expires ... charged on calendar days" at every port, TTI's
wharf demurrage, and the 2024 US switches by Maersk (8 Aug 2024) and Hapag-Lloyd (1 Sep 2024) from
working-day to calendar-day charging with free time left on working days. A third free-time basis,
calendar days excluding public holidays, appears in Japan (Hapag-Lloyd D05) and Vietnam (MSC). Outside the US the free time itself is mostly calendar
days (Maersk DE/UK/AU/BR/ZA, Hapag-Lloyd UK/IT/BE/TW, CMA CGM UY, MSC VN), so the question does not
arise. (c) Working-day charging exists and is a distinct tariff term: Hapag-Lloyd's California columns
("Rate per workday"), CMA CGM's California clause, and ACL's Liverpool import demurrage and quay rent,
which name business days without the calendar switch.

---

## 2. The clocks and their events

| Clock | Start | End | Sources (verbatim) |
|---|---|---|---|
| Import demurrage | discharge from vessel (some tariffs: day after, or availability) | gate-out of the full container | Maersk terms: "From the time we discharge the Equipment from the vessel ... At gate-out of the Equipment from the port of discharge ('gate out delivery')"; CMA CGM: "as from container discharge from the vessel till gate-out of the full container"; Hapag-Lloyd TW: "from the container discharged from vessel to laden pick up from Terminal"; Maersk DE: "Commences on and includes the day that the full container is discharged" |
| Import detention | gate-out full | gate-in of the empty | Maersk terms: "From gate-out of the Equipment ... At gate-in of the returned empty Equipment ... ('gate in empty')"; CMA CGM: "from gate-out of the full container till gate-in of the empty container"; Hapag-Lloyd TW: "(gate out full) to empty return to carrier CY" |
| Terminal storage / quay rent | discharge | gate-out full | Maersk UK: "Terminal Storage ... Commences on and includes the day that the full container is discharged ... Ends on the day that the full container is gated-out"; Maersk AU: "Port storage is not included into combined demurrage and detention tariff but port operator charges storage directly"; ACL: "Import Quay Rent ... Counting begins on the day of discharge"; TTI: "Free Time shall commence for each Container at 3:00 a.m. after the Container is discharged" |
| Export demurrage | gate-in of the full container at the terminal | loaded on board (Maersk US: or scheduled sail date, whichever first) | Maersk terms: "from gate-in of the Container into the agreed terminal, port or depot until the Container is loaded on board a vessel"; CMA CGM: "from gate-in of the full container ... till full containers loaded on board the designated vessel"; ACL: "Counting begins once received at the terminal ... count until the day of loading aboard a vessel" |
| Export detention | gate-out of the empty (pick-up at depot) | gate-in full | Maersk terms: "from the gate-out of the empty Container until gate-in of the Container into the agreed terminal, port or depot"; CMA CGM: "from the pick-up of the empty container in terminal or depot till gate-in of the full container"; ACL: "Counting begins once the equipment is turned over to the custody of the shipper" |
| Merged / combined D&D, import | discharge | gate-in empty | Maersk terms: "Combined Demurrage and Detention ... From the time that we discharge the Goods ... At gate-in of the returned empty Equipment"; CMA CGM: "the merged D&D time is the duration elapsed as from 'discharge' of the vessel of the full container till 'return' of the empty equipment"; Maersk BR: "from discharge of Full unit at terminal/ depot to gate in Empty return"; Maersk AU, UK (default shape) |
| Merged / combined D&D, export | gate-out empty | loaded on board | Maersk terms: "from the gate-out of the empty Container until the Container is loaded on board a vessel"; CMA CGM: "as from 'pick up' of the empty equipment till full container 'loaded' on board"; MSC VN: "export combined Demurrage & Detention tariff" |

Merged is a published, named tariff shape, not an edge case: CMA CGM's grid code "G = merged
demurrage & detention charge" and Uruguay's "If not otherwise specified in the tariff grid, a merged
(or combined) demurrage & detention rate is applied"; Maersk's terms make "Detention and/or
Demurrage, and Combined Detention and Demurrage ... alternatives" chosen per country; MSC publishes
"Combined Detention and Demurrage Tariff" (UAE) and "export combined Demurrage & Detention" (Vietnam).

**46 CFR 541.6(b)(6)–(7).** The import "container availability date" is, per the 2024 preamble
adopting the 2020 rule's meaning, "the physical availability of a container: Whether it is discharged
from the vessel, assigned a location, and in an open area"; a request to replace it with vessel
arrival was refused because it "is statutorily mandated by 46 U.S.C. 41104(d)(2)(A)". The export
"earliest return date" is the terminal's first receiving date for the booking; the FMC "declines to
make the commenters' changes ... This is an issue that the Commission will continue to examine." Both
are **US-only** invoice fields. Their closest global counterparts are tariff events, not standard
fields: Maersk US starts import free time "the first 0800 on the first business day following
discharge" and export demurrage free time "on the first calendar day following the equipment's
arrival at the loading port"; ACL grants export free time as a "Specified number of free days prior
vessel ETA".

**DCSA event vocabulary (global standard).** Track & Trace `equipmentEventTypeCode`: "LOAD
(Loaded) - DISC (Discharged) - GTIN (Gated in) - GTOT (Gated out) - STUF (Stuffed) - STRP (Stripped)
- PICK (Pick-up) - DROP (Drop-off) - INSP - RSEA - RMVD", each carrying `emptyIndicatorCode`
`LADEN`/`EMPTY`. The glossary fixes the moment: "Gate in has been completed once the operator of the
area is legally in possession of the container"; gate-out "once the possession of the container has
been transferred ... to the entity that is picking-up". There is no availability or customs-release
event; availability is a US invoice date, and Hapag-Lloyd's Japan rule D05 starts import free time at
"the day when the removal permit is granted by Customs".
https://github.com/dcsaorg/DCSA-OpenAPI/blob/master/domain/event/event_domain_v2.0.2.yaml

**US vocabulary drift, noted for the docs.** MSC USA defines "Detention - Charge applicable, after
the free time expires, for the use of the carrier's full container inside the marine terminal", "Per
Diem - ... outside the marine terminal", "Demurrage - ... inside the terminal for the use of the
land". Outside the US (and in Maersk's, CMA CGM's and UNCTAD's texts) detention is the outside-terminal
charge. GMT's scope names follow the global usage; the US drift is a documentation note.
https://www.msc.com/en/local-information/america/united-states/msc-usa-demurrage-and-detention

**Answer to Question 2.** GMT's current vocabulary (`discharged | available | gatedOut |
emptyReturned`) and scopes (`demurrage | detention | storage`) express the import cycle exactly as
Maersk, CMA CGM and Hapag-Lloyd publish it, with `available` covering the US invoice date and the
tariffs that start at availability. It cannot express: export demurrage (gate-in full to loaded),
export detention (empty gate-out to gate-in full), or the merged clock in either direction, all of
which are named, published tariff shapes at three of the four carriers read.

---

## What is standardised / what is tariff-specific

| Item | Status | Reach | Source rung |
|---|---|---|---|
| Invoice must print free days, free-time start and end, availability or earliest return date, charged dates | Fixed | US-only | Regulation: 46 CFR 541.6(b), 46 U.S.C. 41104(d) |
| Invoice, dispute, resolution windows are 30 calendar days | Fixed | US-only | Regulation: 46 CFR 541.7–541.8 |
| Meaning of "free time", its start and end | Not standardised ("can vary terminal to terminal") | US-only statement; true everywhere read | Regulation preamble: 89 FR 14330 |
| Free-time unit is one of calendar days, working days, hours, day of discharge | Typed | Global standard | DCSA AN `Freetime.unitOfMeasure` |
| Free-time types DEM / DET / PDM / STO | Typed | Global standard | DCSA AN `freetimeTypeCode` |
| Charge basis after expiry | Not standardised; calendar days dominate; working days in California and at ACL Liverpool | Global tariff; California statute | Tariff; California § 22928 |
| "Each day or part thereof is due in full"; first chargeable day is the day after the last free day | Tariff term | Global tariff (CMA CGM general terms) | Tariff |
| Whether discharge day is day one | Tariff term (Hapag-Lloyd UK, MSC India: inclusive; Maersk US, Hapag-Lloyd IT detention: next day) | Global tariff, per country | Tariff |
| Container events DISC, GTOT, GTIN, LOAD, PICK, DROP with LADEN/EMPTY | Typed | Global standard | DCSA T&T event domain |
| Import demurrage = discharge to gate-out; detention = gate-out to empty gate-in | Uniform across every carrier read | Global tariff | Tariff (Maersk, CMA CGM, Hapag-Lloyd, ACL) |
| Export demurrage = gate-in full to loaded; export detention = empty gate-out to gate-in full | Uniform across Maersk, CMA CGM, ACL | Global tariff | Tariff |
| Merged D&D = discharge to empty gate-in (import), empty gate-out to loaded (export) | Named tariff product | Global tariff (Maersk, CMA CGM, MSC) | Tariff |
| Terminal storage is a separate charge with its own free time; sometimes folded into carrier demurrage | Per country | Global tariff; national port rules (China art. 43–45) | Tariff; national regulation |
| Availability date, earliest return date | Invoice fields | US-only | Regulation |
| Working-day charging forbidden on closed gate or holiday | Fixed | Sub-national (California) | Statute |

---

## Recommendation for GMT

> **Superseded in part (2026-09-24):** the owner-approved spec makes `chargeBasis` required with no default, on the story's own no-default rule; see `issues/INT-12.md` Design notes. The evidence below stands.

**Decision 1 — charge basis is a separate term, calendar by default.** Rung: published tariff (no
regulation or standard fixes it), with California § 22928 as the one statute mandating the other
shape. `basis` keeps its meaning from `freeTimeExpiry` (how free days are counted). `chargeableDays`
gains `chargeBasis?: "calendar" | "working"`, default `"calendar"`, because every carrier read charges
calendar days unless it says otherwise (CMA CGM "BILLABLE IN CALENDAR DAYS", Hapag-Lloyd "Rate per
Calendar day", ACL "charged on calendar days", TTI "Saturdays, Sundays, and holidays included").
`chargeBasis: "working"` reuses the same `calendar` and is the documented shape for California
terminals and ACL Liverpool. The current behaviour (`basis: "working"` also suspends charging) must
stop being implicit: it is the minority shape and silently under-bills a Hapag-Lloyd New York
detention invoice. The composition `freeTimeExpiry(start, n, working)` then `chargeableDays(expiresAt,
end, 0, calendar)` stays correct and can be documented as equivalent, but it is not the API contract,
because `chargedDates` and `byTier` must come from one call. The guide should show the two shapes
side by side with the CMA CGM US header as the worked example.

**Decision 2 — add export events and a merged scope.** Rung: published tariff (Maersk terms, CMA CGM
general terms, MSC combined tariffs), with DCSA event codes as the naming authority. Extend
`ClockEventType` to `discharged | available | gatedOut | emptyReturned | emptyReleased | gatedIn |
loaded`, mapped to DCSA as DISC laden, (no DCSA code; 46 CFR 541.6(b)(6)), GTOT laden, GTIN empty,
GTOT empty or PICK empty, GTIN laden, LOAD laden. Extend `ClockScope` to `demurrage | detention |
storage | combined` and add a required `direction: "import" | "export"` to the options (no default:
the same scope name selects different events in each direction, and inferring it from which events
are present would be a silent guess). Selections: import demurrage and storage `startEvent → gatedOut`;
import detention `gatedOut → emptyReturned`; import combined `startEvent → emptyReturned`; export
demurrage `gatedIn → loaded`; export detention `emptyReleased → gatedIn`; export combined
`emptyReleased → loaded`; export storage `gatedIn → loaded`. Tariff variants that end export demurrage
at the scheduled sail date (Maersk US) or at cut-off (ACL Halifax: "until day of cut off") are the
caller's `loaded` timestamp, documented, not extra events. `available` stays import-only; a
`customsReleased` start event (Hapag-Lloyd D05, one carrier, one lane) is worth adding as a
`startEvent` value rather than overloading `available`, but it rests on a single published tariff.
"Calendar days excluding bank holidays" needs no new basis: it is `basis: "working"` with a
`BusinessCalendar` whose `weekend` is empty.

**Labelling for JSDoc and the guide.** The 46 CFR 541.6 citations are the **US invoice rule**, not a
world standard; the world has none. Global equivalents per field: allowed free time in days → DCSA AN
`Freetime.quantity` + `unitOfMeasure` (global standard); start and end date of free time → no
standard field, a tariff term in every country (Maersk "Commences on and includes the day ..."), so
`freeTimeStart` / `lastFreeDay` are labelled tariff outputs; container availability date → US-only,
no DCSA event, `available` documented as "US invoice date, or a tariff that starts at availability";
earliest return date → US-only invoice field whose global counterpart is the terminal's receiving
window (Maersk US "earliest receipt date", ACL "free days prior vessel ETA"), which GMT does not
model (TRAN-10 cut-offs); charged dates → US-only invoice field, but `chargedDates` is also what
CMA CGM's "day number since discharge" grids and Maersk's "Progressive method" tiers consume, so it
stays as a global output with the US rule cited as the place it is mandatory. Event names and the
LADEN/EMPTY distinction rest on DCSA (global standard); the import and export clock definitions rest
on the uniform published tariff shape; the calendar-day default and the working-day exception rest on
published tariffs plus California statute; nothing in the model rests on US law alone except the
`available` event and the invoice-field labels.

## Not found / uncertain

1. India DG Shipping 2020 advisory and Transnet TPT tariff book: hosts reset TLS; **NOT REACHED**.
   The India Act was read from the ministry's compiled PDF; the indiacode copy served HTML.
2. Hapag-Lloyd Germany and Netherlands grids returned 404 on retry; Italy, Belgium, UK, USA and Taiwan
   were read instead. MSC Denmark returned 404; USA, UAE, India and Vietnam were read.
3. CMA CGM country grids other than the US and Uruguay were not read; the general terms and the
   US header carry the rule.
4. UNECE Rec 23: "Equipment demurrage" code verified; an "Equipment detention" code was not verified.
5. No EU, UK, South African or Indian instrument on container D&D was found; absence is asserted only
   for EU Regulation 2017/352, whose text was read.
