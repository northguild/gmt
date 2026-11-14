# US permanent daylight time: the bodies behind CORE-90

Sections 1 to 3 of [the CORE-90 research](../us-permanent-daylight-time.md): international bodies,
multinational bodies and US national peers. Checked on 13 November 2026.

## 1. International bodies

### 1.1 IANA tz database

| #   | Fact                                                                                          | What the source says                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A change reaches devices only after a tz release, and the maintainers ask for a year's notice | `tz-link.html`: "It is OK if a rule change is planned to affect clocks far into the future, as a long-planned change can easily be reverted or otherwise altered with a year's notice before the change would have affected clocks." And: "any rule change should be promulgated at least a year before it affects how clocks operate". And: "Many downstream timezone data distributors wait for a tzdb release before they produce an update to time zone behavior in consumer devices and software products."                                                                                                                                                        |
| 2   | The latest release has no US change                                                           | `NEWS`: release 2026f, dated 2026-10-27. Its only change to future timestamps is Cuba, which "will not fall back 2026-11-01" and stays on -04 through 2027-11-07. It also fixes past timestamps for Brazil (1965 and 1966) and the end of leap seconds. Nothing for the United States.                                                                                                                                                                                                                                                                                                                                                                                  |
| 3   | Mexico, 2022                                                                                  | `NEWS` 2022f (2022-10-28): "Mexico will no longer observe DST after 2022, except for areas near the US border that continue to observe US DST rules." `northamerica` (Paul Eggert, 2022-10-28): "The new Mexican law was published today" (Diario Oficial, 28 October 2022). It "abolishes DST except where US DST rules are observed, and in addition changes all of Chihuahua to -06 with no DST". Chihuahua changed on 2022-10-30. `NEWS` 2022g (2022-11-29): the Chihuahua border strip (America/Ciudad_Juarez, America/Ojinaga) moved to US rules on 2022-11-30 at 00:00, after a decree published 2022-11-29. Most border areas never stopped following US rules. |
| 4   | United Kingdom, 1968 to 1971                                                                  | `europe`, Europe/London: +1 BST from 18 February 1968 as summer time. From 27 October 1968 the same +1 became legal standard time, "British Standard Time" ("the clocks didn't change"), until 31 October 1971 at 02:00 UTC. So clocks stayed at +1 from 18 February 1968 to 31 October 1971.                                                                                                                                                                                                                                                                                                                                                                           |
| 5   | Russia, 2011 to 2014                                                                          | `europe`, Europe/Moscow: +4 MSK from 27 March 2011 at 02:00 standard time, then +3 from 26 October 2014 at 02:00 standard time.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 6   | United States, 1974                                                                           | `northamerica`: Rule US 1974 Jan 6 2:00. Public Law 93-182 (15 December 1973) started year-round daylight time; Public Law 93-434 (5 October 1974) restored standard time from 27 October 1974. It was "meant to last for 16 months or two winters (through 1975-04-27)".                                                                                                                                                                                                                                                                                                                                                                                               |
| —   | Navajo Nation in Arizona                                                                      | `northamerica`: "Navajo Nation participates in the Daylight Saving Time policy… See America/Denver".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| —   | Arizona and Hawaii                                                                            | `northamerica`: America/Phoenix last observed daylight time in 1967 and has been MST since 21 March 1968. Pacific/Honolulu has been on HST with no daylight time since 8 June 1947. The 1967 date for Hawaii is the year of its state exemption (CRS R45208, citing Haw. Rev. Stat. §1-31), not the year its clocks last changed.                                                                                                                                                                                                                                                                                                                                       |

Sources:

- <https://data.iana.org/time-zones/tzdb/tz-link.html>
- <https://data.iana.org/time-zones/tzdb/NEWS>
- <https://data.iana.org/time-zones/tzdb/northamerica>
- <https://data.iana.org/time-zones/tzdb/europe>

### 1.2 Society for Research on Biological Rhythms (fact 7)

An international society of scientists. Its 2019 position paper, approved by its executive board:
"the advantages of permanent ST outweigh switching to DST annually or permanently". The abstract
describes the society as "an international organization of scientists dedicated to studying
circadian and other biological rhythms".

Roenneberg T, Wirz-Justice A, Skene DJ, et al. "Why Should We Abolish Daylight Saving Time?"
_Journal of Biological Rhythms_ 34(3):227–230, June 2019.

- <https://doi.org/10.1177/0748730419854197>
- <https://pubmed.ncbi.nlm.nih.gov/31170882/>

### 1.3 Systematic review, 2026 (fact 18)

157 studies from 36 countries, searched to June 2025. The review finds "the messaging of
transitions and DST during summer months being uniformly detrimental is not supported", that "the
evidence base remains limited and heterogeneous", and recommends "a balanced approach" rather than
"advocating for maintaining or removing transitions". The spring change is linked to more heart
attacks and fatal crashes. Daylight time in summer is linked to fewer deaths and crashes.
Standard time is "potentially associated with decreased sleep duration during winter".

Steponenaite A, Wallraff JP, Wild U, et al. "A systematic review of epidemiological studies into
daylight-saving time & health identifying beneficial & adverse effects." _European Journal of
Epidemiology_ 41(4):419–433, April 2026.

- <https://doi.org/10.1007/s10654-026-01372-8>
- <https://pubmed.ncbi.nlm.nih.gov/41721993/>

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

- <https://transport.ec.europa.eu/transport-themes/summertime_en>
- <https://oeil.europarl.europa.eu/oeil/en/procedure-file?reference=2018/0332(COD)>

### 2.2 European sleep and rhythm societies (fact 9)

A joint letter to the European Commission, published on the European Sleep Research Society's own
site in March 2019. It is signed by three societies: the European Biological Rhythms Society
(EBRS), the European Sleep Research Society (ESRS) and the Society for Research on Biological
Rhythms (SRBR). It says: "the scientific evidence presently available indicates that installing
permanent Central European Time (CET, standard time or 'wintertime') is the best option for
public health."

The live esrs.eu pages return 403 to automated clients, so they were read from Internet Archive
captures of the same URLs (post: 16 May 2026; letter: 5 September 2026).

- <https://esrs.eu/news/joint-statement-to-the-eu-commission-on-dst/>
- <https://esrs.eu/wp-content/uploads/2019/03/To_the_EU_Commission_on_DST.pdf>
- <http://web.archive.org/web/20260905141144/https://esrs.eu/wp-content/uploads/2019/03/To_the_EU_Commission_on_DST.pdf>

---

## 3. National peers (United States)

### 3.1 American Academy of Sleep Medicine (fact 10)

- **2020:** "It is the position of the AASM that the U.S. should eliminate seasonal time changes in
  favor of a national, fixed, year-round time." It adds: "Current evidence best supports the
  adoption of year-round standard time". The acknowledgements list 21 endorsing organizations,
  World Sleep Society among them. Rishi MA et al., _JCSM_ 16(10):1781–1784, 15 October 2020.
- **2024:** "It is the position of the AASM that the United States should eliminate seasonal time
  changes in favor of permanent ST, which aligns best with human circadian biology." Its
  endorsement list ends "…Southern Sleep Society, and World Sleep Society." Rishi MA et al.,
  _JCSM_ 20(1):121–125, January 2024.

- <https://doi.org/10.5664/jcsm.8780> (PMC7954020)
- <https://doi.org/10.5664/jcsm.10898> (PMC10758561)

### 3.2 Fatal crashes after the spring change (fact 11)

US registry data, 732,835 fatal crashes in all states, 1996–2017. The spring change
"significantly increased fatal MVA risk by 6%, which was more pronounced in the morning and in
locations further west within a time zone". "The MVA risk increase waned in the week subsequent to
DST, and there were no effects of the fall-back transition". The abstract does not say the 6%
applies to a whole week, so the page should say "after the spring change", not "in the week
after".

Fritz J, VoPham T, Wright KP, Vetter C. _Current Biology_ 30(4):729–735.e2, February 2020.

- <https://doi.org/10.1016/j.cub.2019.12.045>
- <https://pubmed.ncbi.nlm.nih.gov/32008905/>

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

- <https://www.congress.gov/crs-product/R45208>
- <https://www.congress.gov/crs_external_products/R/HTML/R45208.html>
