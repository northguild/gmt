# US permanent daylight time: the checked facts behind CORE-90

**Question:** what do the primary sources say about the national proposal for permanent daylight
time, the state laws that wait for it, and the research the US clock-change checker quotes?

**Answer:** every fact in the CORE-90 evidence table was checked against its issuing body's own
text on 13 November 2026. Eleven rows needed a correction. The largest: seven states, not three,
tie their switch to other states. One condition (Maine's) was removed in 2025. The House vote was
308 to 117. The two California bills are not pending: neither passed a chamber.

**Checked on:** 13 November 2026. The live tz release is 2026f; the repo pins 2026e. Where a
legislature's site refused automated access or failed its TLS handshake, the page was read from
an Internet Archive capture of that same official page, and the capture date is given.

This file is the only CORE-90 file that may cite law. The page and the data module name no
statute, bill or legislature.

---

## 1. International bodies

### 1.1 IANA tz database

| # | Fact | What the source says |
| - | ---- | -------------------- |
| 1 | A change reaches devices only after a tz release, and the maintainers ask for a year's notice | `tz-link.html`: "It is OK if a rule change is planned to affect clocks far into the future, as a long-planned change can easily be reverted or otherwise altered with a year's notice before the change would have affected clocks." And: "any rule change should be promulgated at least a year before it affects how clocks operate". And: "Many downstream timezone data distributors wait for a tzdb release before they produce an update to time zone behavior in consumer devices and software products." |
| 2 | The latest release has no US change | `NEWS`: release 2026f, dated 2026-10-27. Its only change to future timestamps is Cuba, which "will not fall back 2026-11-01" and stays on -04 through 2027-11-07. It also fixes past timestamps for Brazil (1965 and 1966) and the end of leap seconds. Nothing for the United States. |
| 3 | Mexico, 2022 | `NEWS` 2022f (2022-10-28): "Mexico will no longer observe DST after 2022, except for areas near the US border that continue to observe US DST rules." `northamerica` (Paul Eggert, 2022-10-28): "The new Mexican law was published today" (Diario Oficial, 28 October 2022). It "abolishes DST except where US DST rules are observed, and in addition changes all of Chihuahua to -06 with no DST". Chihuahua changed on 2022-10-30. `NEWS` 2022g (2022-11-29): the Chihuahua border strip (America/Ciudad_Juarez, America/Ojinaga) moved to US rules on 2022-11-30 at 00:00, after a decree published 2022-11-29. Most border areas never stopped following US rules. |
| 4 | United Kingdom, 1968 to 1971 | `europe`, Europe/London: +1 BST from 18 February 1968 as summer time. From 27 October 1968 the same +1 became legal standard time, "British Standard Time" ("the clocks didn't change"), until 31 October 1971 at 02:00 UTC. So clocks stayed at +1 from 18 February 1968 to 31 October 1971. |
| 5 | Russia, 2011 to 2014 | `europe`, Europe/Moscow: +4 MSK from 27 March 2011 at 02:00 standard time, then +3 from 26 October 2014 at 02:00 standard time. |
| 6 | United States, 1974 | `northamerica`: Rule US 1974 Jan 6 2:00. Public Law 93-182 (15 December 1973) started year-round daylight time; Public Law 93-434 (5 October 1974) restored standard time from 27 October 1974. It was "meant to last for 16 months or two winters (through 1975-04-27)". |
| — | Navajo Nation in Arizona | `northamerica`: "Navajo Nation participates in the Daylight Saving Time policy… See America/Denver". |
| — | Arizona and Hawaii | `northamerica`: America/Phoenix last observed daylight time in 1967 and has been MST since 21 March 1968. Pacific/Honolulu has been on HST with no daylight time since 8 June 1947. The 1967 date for Hawaii is the year of its state exemption (CRS R45208, citing Haw. Rev. Stat. §1-31), not the year its clocks last changed. |

Sources:

- https://data.iana.org/time-zones/tzdb/tz-link.html
- https://data.iana.org/time-zones/tzdb/NEWS
- https://data.iana.org/time-zones/tzdb/northamerica
- https://data.iana.org/time-zones/tzdb/europe

### 1.2 Society for Research on Biological Rhythms (fact 7)

An international society of scientists. Its 2019 position paper, approved by its executive board:
"the advantages of permanent ST outweigh switching to DST annually or permanently". The abstract
describes the society as "an international organization of scientists dedicated to studying
circadian and other biological rhythms".

Roenneberg T, Wirz-Justice A, Skene DJ, et al. "Why Should We Abolish Daylight Saving Time?"
*Journal of Biological Rhythms* 34(3):227–230, June 2019.

- https://doi.org/10.1177/0748730419854197
- https://pubmed.ncbi.nlm.nih.gov/31170882/

### 1.3 Systematic review, 2026 (fact 18)

157 studies from 36 countries, searched to June 2025. The review finds "the messaging of
transitions and DST during summer months being uniformly detrimental is not supported", that "the
evidence base remains limited and heterogeneous", and recommends "a balanced approach" rather than
"advocating for maintaining or removing transitions". The spring change is linked to more heart
attacks and fatal crashes. Daylight time in summer is linked to fewer deaths and crashes.
Standard time is "potentially associated with decreased sleep duration during winter".

Steponenaite A, Wallraff JP, Wild U, et al. "A systematic review of epidemiological studies into
daylight-saving time & health identifying beneficial & adverse effects." *European Journal of
Epidemiology* 41(4):419–433, April 2026.

- https://doi.org/10.1007/s10654-026-01372-8
- https://pubmed.ncbi.nlm.nih.gov/41721993/

---

## 2. Multinational bodies

### 2.1 European Union (fact 8)

- The Commission's 2018 consultation "generated around 4.6 million replies, of which 84% were in
  favour of discontinuing the bi-annual clock changes".
- Proposal COM(2018)639, dated 12 September 2018. Parliament adopted its first-reading position on
  26 March 2019 (T8-0225/2019).
- Procedure 2018/0332(COD) status: "Awaiting Council's 1st reading position". The Commission page:
  "The Council has not yet finalised its position."

So the member states have not agreed to end the changes at all, not only which time to keep.

- https://transport.ec.europa.eu/transport-themes/summertime_en
- https://oeil.europarl.europa.eu/oeil/en/procedure-file?reference=2018/0332(COD)

### 2.2 European sleep and rhythm societies (fact 9)

A joint letter to the European Commission, published on the European Sleep Research Society's own
site in March 2019. It is signed by three societies: the European Biological Rhythms Society
(EBRS), the European Sleep Research Society (ESRS) and the Society for Research on Biological
Rhythms (SRBR). It says: "the scientific evidence presently available indicates that installing
permanent Central European Time (CET, standard time or 'wintertime') is the best option for
public health."

The live esrs.eu pages return 403 to automated clients, so they were read from Internet Archive
captures of the same URLs (post: 16 May 2026; letter: 5 September 2026).

- https://esrs.eu/news/joint-statement-to-the-eu-commission-on-dst/
- https://esrs.eu/wp-content/uploads/2019/03/To_the_EU_Commission_on_DST.pdf
- http://web.archive.org/web/20260905141144/https://esrs.eu/wp-content/uploads/2019/03/To_the_EU_Commission_on_DST.pdf

---

## 3. National peers (United States)

### 3.1 American Academy of Sleep Medicine (fact 10)

- **2020:** "It is the position of the AASM that the U.S. should eliminate seasonal time changes in
  favor of a national, fixed, year-round time." It adds: "Current evidence best supports the
  adoption of year-round standard time". The acknowledgements list 21 endorsing organizations,
  World Sleep Society among them. Rishi MA et al., *JCSM* 16(10):1781–1784, 15 October 2020.
- **2024:** "It is the position of the AASM that the United States should eliminate seasonal time
  changes in favor of permanent ST, which aligns best with human circadian biology." Its
  endorsement list ends "…Southern Sleep Society, and World Sleep Society." Rishi MA et al.,
  *JCSM* 20(1):121–125, January 2024.

- https://doi.org/10.5664/jcsm.8780 (PMC7954020)
- https://doi.org/10.5664/jcsm.10898 (PMC10758561)

### 3.2 Fatal crashes after the spring change (fact 11)

US registry data, 732,835 fatal crashes in all states, 1996–2017. The spring change
"significantly increased fatal MVA risk by 6%, which was more pronounced in the morning and in
locations further west within a time zone". "The MVA risk increase waned in the week subsequent to
DST, and there were no effects of the fall-back transition". The abstract does not say the 6%
applies to a whole week, so the page should say "after the spring change", not "in the week
after".

Fritz J, VoPham T, Wright KP, Vetter C. *Current Biology* 30(4):729–735.e2, February 2020.

- https://doi.org/10.1016/j.cub.2019.12.045
- https://pubmed.ncbi.nlm.nih.gov/32008905/

### 3.3 Congressional Research Service, R45208 (facts 12, 13, 14)

Updated 24 July 2026.

- 1974: the Department of Transportation found the benefits "small and difficult to isolate
  completely from the larger effects of seasonal patterns and changes in energy availability and
  prices". The National Bureau of Standards found a statistically significant rise in school-age
  morning deaths from January to April 1974, but "this increase cannot be simply interpreted as a
  'DST effect'".
- Energy: the Department of Energy put the saving from the 2007 extension at about 0.02%.
- "No state has enacted legislation for permanent standard time between January 2015 and April
  2026."
- R45208 has three errors that the primary records correct. It gives the House vote as 309-117
  (the Clerk records 308-117). It leaves New York out of Delaware's condition. It says Idaho's law
  covers the "entire state" (the law covers only the Pacific-zone part).

- https://www.congress.gov/crs-product/R45208
- https://www.congress.gov/crs_external_products/R/HTML/R45208.html

---

## 4. US law

### 4.1 The national proposal (facts 15, 16)

- **House vote:** Roll Call 238, 119th Congress, 2nd session, 14 July 2026, 5:17 PM, H.R. 139, "On
  Passage", passed **308 yea, 117 nay**, 6 not voting.
- **Senate:** received 15 July 2026 and referred to the Committee on Commerce, Science, and
  Transportation. That is still the latest action in the govinfo bill status record (updated
  8 September 2026). There has been no Senate vote.
- **Earlier Senate passage:** S. 623 (117th Congress) passed the Senate with an amendment by
  unanimous consent on 15 March 2022 (received in the House 16 March 2022).
- **Effects** (text as passed by the House):
  - It repeals 15 U.S.C. 260a, the seasonal period.
  - It moves every standard time in 15 U.S.C. 261(a) one hour later.
  - It adds a new 261(b): a state, or an area of a state, that was exempt under 260a(a) "as in
    effect on the day before the date of the enactment" may choose either the new standard time
    or its standard time as it was that day.
  - It has no effective-date section, so it would take effect when it becomes law.

- https://clerk.house.gov/Votes/2026238 (XML: https://clerk.house.gov/evs/2026/roll238.xml)
- https://www.govinfo.gov/content/pkg/BILLS-119hr139rfs/html/BILLS-119hr139rfs.htm
- https://www.govinfo.gov/bulkdata/BILLSTATUS/119/hr/BILLSTATUS-119hr139.xml
- https://www.govinfo.gov/bulkdata/BILLSTATUS/117/s/BILLSTATUS-117s623.xml

### 4.2 The 19 states that would keep daylight time if federal law allowed it (fact 14)

The "Condition" column lists what each law needs beyond federal permission. A dash means federal
permission alone.

| State | Year | Law | Condition beyond federal permission |
| ----- | ---- | --- | ----------------------------------- |
| FL | 2018 | Laws of Fla. ch. 2018-99 (HB 1013), approved 23 Mar 2018 | — |
| DE | 2019 | 82 Del. Laws c. 193 (SB 73 with SA 1), approved 12 Aug 2019 | New York, Pennsylvania, New Jersey **and** Maryland must each enact a law asking for the same. The route is a move to the Atlantic time zone by the US Secretary of Transportation, not a change in federal law. |
| ME | 2019 | P.L. 2019 c. 268 (LD 885), amended by P.L. 2025 c. 191 (LD 3) | — (the 2019 condition that every eastern-zone state and DC do the same was removed in 2025) |
| OR | 2019 | Or. Laws 2019 ch. 421 (SB 320) | California **and** Washington must both move. It covers only the part of Oregon outside the Mountain zone. It lapses if not in force by 1 December 2029. |
| TN | 2019 | Pub. Ch. 416 (HB 247), signed 21 May 2019 | The transportation commissioner must certify the federal change, **and** the General Assembly must confirm it by joint resolution |
| WA | 2019 | 2019 c 297 (HB 1196), RCW 1.20.052 | — |
| ID | 2020 | 2020 Sess. Laws ch. 145 (S1267), Idaho Code 67-9601, signed 16 Mar 2020 | Only the part of Idaho in the Pacific zone, and only once Washington makes daylight time permanent |
| LA | 2020 | Act 133 (HB 132), R.S. 1:50 | — |
| SC | 2020 | Act 113 (S. 11), S.C. Code 1-1-30, approved 3 Feb 2020 | — |
| UT | 2020 | Laws 2020 ch. 247 (SB 59), Utah Code 63G-1-901, signed 28 Mar 2020 | At least four western states other than Utah must pass a law putting all or part of the state on year-round daylight time (western: AZ, CA, CO, ID, MT, NV, NM, OR, WA, WY) |
| WY | 2020 | Enrolled Act 87 (HB 44), W.S. 8-4-115 | At least four western states, Wyoming included, must pass a law (western: CO, ID, MT, NE, ND, SD, UT, WY) |
| AL | 2021 | Act 2021-421 (SB 388) | — |
| GA | 2021 | Act 17 (SB 100), signed 21 Apr 2021 | — |
| MN | 2021 | Laws 2021, 1st Spec. Sess. ch. 12 art. 2 s. 20, Minn. Stat. 645.071 | — |
| MS | 2021 | Ch. 352 (HB 1062), approved 17 Mar 2021 | — |
| MT | 2021 | Ch. 447, L. 2021 (SB 254), MCA 1-3-110 | At least four western states, Montana included, must pass a law (western: ID, MT, ND, SD, UT, WY). The federal step may be either a federal law or a move of Montana to the Central zone by the US Department of Transportation. |
| CO | 2022 | Ch. 330 (HB22-1297), signed 2 Jun 2022 | At least four other states in the Mountain zone must enact the same |
| OK | 2024 | SB 1200 (enrolled), 25 O.S. 90.28, approved 26 Apr 2024 | — |
| TX | 2025 | HB 1393, Gov't Code 312.016 | — (it waits only for federal law) |

All 19 years in the evidence table are confirmed.

Sources (each read on 13 November 2026):

- FL: http://laws.flrules.org/2018/99 ; https://www.flsenate.gov/Session/Bill/2018/1013
- DE: https://legis.delaware.gov/SessionLaws/Chapter?id=15054 ; https://delcode.delaware.gov/title1/c008/index.html
- ME: https://lldc.mainelegislature.org/Open/Laws/2019/2019_PL_c268.pdf ; https://lldc.mainelegislature.org/Open/Laws/2025/2025_PL_c191.pdf ; https://legislature.maine.gov/statutes/1/title1sec151.html
- OR: ORS 187.110 notes, capture of 6 June 2026 (the live site failed its TLS handshake): http://web.archive.org/web/20260606100201/https://www.oregonlegislature.gov/bills_laws/ors/ors187.html
- TN: bill history and "As enacted" summary, capture of 14 August 2019 (the live site refused the connection): http://web.archive.org/web/20190814203505/http://wapp.capitol.tn.gov/apps/BillInfo/default.aspx?BillNumber=HB0247&GA=111
- WA: https://app.leg.wa.gov/RCW/default.aspx?cite=1.20.052 ; https://app.leg.wa.gov/RCW/default.aspx?cite=1.20.055
- ID: bill text and status, captures of 11 September 2025 and 16 June 2026 (the live site failed its TLS handshake): http://web.archive.org/web/20250911152310/https://legislature.idaho.gov/wp-content/uploads/sessioninfo/2020/legislation/S1267.pdf ; http://web.archive.org/web/20260616212735/https://legislature.idaho.gov/sessioninfo/2020/legislation/s1267/
- LA: https://legis.la.gov/legis/ViewDocument.aspx?d=1181442 ; https://legis.la.gov/legis/BillInfo.aspx?s=20RS&b=HB132
- SC: https://www.scstatehouse.gov/sess123_2019-2020/bills/11.htm
- UT: https://le.utah.gov/xcode/Title63G/Chapter1/63G-1-S901.html ; https://le.utah.gov/~2020/bills/static/SB0059.html
- WY: https://wyoleg.gov/2020/Enroll/HB0044.pdf
- AL: enrolled text, capture of 27 March 2023: http://web.archive.org/web/20230327015810/http://alisondb.legislature.state.al.us/ALISON/SearchableInstruments/2021rs/PrintFiles/SB388-enr.pdf
- GA: Senate Research Office, *2021 Legislation Passed*, p. 16: https://www.legis.ga.gov/api/document/docs/default-source/senate-research-office-document-library/2021/2021-sro-final-report-of-legislation-passed-post-vetoes_09202021.pdf
- MN: https://www.revisor.mn.gov/statutes/cite/645.071
- MS: https://billstatus.ls.state.ms.us/2021/pdf/history/HB/HB1062.xml
- MT: https://mca.legmt.gov/bills/mca/title_0010/chapter_0030/part_0010/section_0100/0010-0030-0010-0100.html ; enrolled SB 254 via https://api.legmt.gov/docs/v1/documents/getBillVersions?legislatureOrdinal=67&sessionOrdinal=20211&billType=SB&billNumber=254
- CO: https://leg.colorado.gov/bills/hb22-1297
- OK: https://www.oklegislature.gov/cf_pdf/2023-24%20ENR/SB/SB1200%20ENR.PDF ; http://www.oklegislature.gov/BillInfo.aspx?Bill=SB1200&Session=2400
- TX: https://capitol.texas.gov/tlodocs/89R/billtext/html/HB01393F.htm

Not checked on a primary page: the governor's approval date for Alabama (CRS gives 6 May 2021) and
for Wyoming (CRS gives 24 March 2020). The enrolled texts leave the date blank. Neither date is
used on the page.

### 4.3 States on standard time all year

Arizona (1968) and Hawaii (1967) exempted themselves, per CRS R45208 citing Ariz. Rev. Stat.
§1-242 and Haw. Rev. Stat. §1-31. The tz data agrees that neither changes its clocks (section 1.1).
Puerto Rico, the US Virgin Islands, Guam, the Northern Mariana Islands and American Samoa have no
daylight time in the tz data.

### 4.4 California (fact 17)

- **SCR 7** (Niello), Resolution Chapter 178, "Filed with Secretary of State August 18, 2026".
  Digest: "This measure would proclaim that the Legislature acknowledges the health benefits of
  permanent standard time." Resolved: "the Legislature acknowledges the health benefits of
  permanent standard time". It is a concurrent resolution adopted by both houses. It changes no
  law.
- **SB 51** (2025–26): held in Senate Appropriations on 23 May 2025. On 2 February 2026 it was
  "Returned to Secretary of Senate pursuant to Joint Rule 56". It is dead.
- **SB 1197** (2025–26): held in Senate Appropriations, "Held in committee and under submission",
  on 14 May 2026. In the latest capture (13 July 2026) it had passed no chamber.

- **Proposition 7** (November 2018), a measure the Legislature referred to the voters. It passed
  on 6 November 2018, 7,167,315 (59.75%) to 4,828,564 (40.25%). The Legislative Analyst's
  analysis: it "allows the Legislature with a two-thirds vote to change DST", "such as by remaining
  on DST year-round", if the change is "allowed under federal law". It changes no clock by
  itself: until the Legislature acts, California keeps the federal daylight period. So it is not a
  law for daylight time all year and is not one of the 19 rows in §4.2, but it means the Legislature
  needs no new vote of the people to act once federal law allows daylight time all year. That
  bears on Oregon's row, which waits on California.
  - Analysis: https://lao.ca.gov/BallotAnalysis/Proposition?number=7&year=2018
  - Vote totals: the Secretary of State's Statement of Vote returns 403 to automated clients. The
    totals above are the certified figures as given by Ballotpedia
    (https://ballotpedia.org/California_Daylight_Saving_Time_Measure_(2018)) and the UC Law SF
    ballot measure archive (https://repository.uclawsf.edu/ca_ballot_props/1373), which agree.

leginfo returns 403 to automated clients, so these pages were read from Internet Archive captures:

- http://web.archive.org/web/20260924203530/https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260SCR7
- http://web.archive.org/web/20260308153651/https://leginfo.legislature.ca.gov/faces/billHistoryClient.xhtml?bill_id=202520260SB51
- http://web.archive.org/web/20260713201027/https://leginfo.legislature.ca.gov/faces/billHistoryClient.xhtml?bill_id=202520260SB1197

---

## 5. Corrections to the CORE-90 evidence table

| Row | Table says | Primary source says |
| --- | ---------- | ------------------- |
| 3 | Mexico's border-area decree followed in 2022g | Only Chihuahua's border strip changed (2022-11-30). The other border areas never stopped following US rules. |
| 4 | UK +1 from 1968-10-27 | Clocks were at +1 from 1968-02-18. The +1 became legal standard time on 1968-10-27. |
| 9 | EBRS/ESRS joint statement | Confirmed. SRBR also signed it, and it names CET as the standard time to keep. |
| 11 | "in the week after the spring change" | The abstract gives 6% after the spring change. It does not tie the figure to a whole week. |
| 14 | DE waits for PA, NJ, MD | It waits for NY, PA, NJ and MD, and needs a federal transport department zone move. |
| 14 | Only DE, ID and TX have conditions | Seven states tie their switch to other states: DE, ID, OR, UT, WY, MT and CO. TX waits only for federal law. TN also needs a state certification and a joint resolution. ME's condition was removed in 2025. |
| 15 | 308-117 (CRS says 309-117) | Clerk Roll Call 238: 308-117, 6 not voting. |
| 15 | Awaiting a Senate vote | In the Senate Commerce committee since 15 July 2026. No other action. |
| 17 | SB 1197 and SB 51 pending | SB 51 died on 2 February 2026. SB 1197 was held in committee on 14 May 2026. Neither passed a chamber. |
| 18 | Effects of a permanent setting are mixed | The review compares daylight and standard time by season and finds effects in both directions, with a limited evidence base. |
| 8 | The EU has not agreed which time to keep | The Council has no position at all, so the EU has not agreed to end the changes. |

Rows 1, 2, 5, 6, 7, 10, 12, 13 and 16 are confirmed as written.
