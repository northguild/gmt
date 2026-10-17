# MAR-16 ICD clauses: IEC 61108 and IEC 61162-1

Part of the [MAR-16 GNSS ICD clauses index](../mar-16-gnss-icd-clauses.md).

### 9a.3 IEC 61108 — receiver standards by system (IEC webstore catalogue, PRIMARY)

Series title: "Maritime navigation and radiocommunication equipment and systems - Global navigation
satellite systems (GNSS) - …", IEC TC 80.

| Part | Title (after the series title) | Edition, date | Webstore | Abstract (first sentence) |
| --- | --- | --- | --- | --- |
| 61108-1:2003 | Part 1: Global positioning system (GPS) - Receiver equipment - Performance standards, methods of testing and required test results | Ed. 2.0, 2003-07-31; stability 2028 | <https://webstore.iec.ch/en/publication/4515> | "Specifies the minimum performance standards, methods of testing and required test results for GPS shipborne receiver equipment, based on the relevant IMO Resolution, …" |
| 61108-2:1998 | Part 2: Global navigation satellite system (GLONASS) - Receiver equipment - Performance standards, methods of testing and required test results | Ed. 1.0, 1998-06-05; stability 2027 | <https://webstore.iec.ch/en/publication/4516> | (no abstract text extracted) |
| 61108-3:2010 | Part 3: Galileo receiver equipment - Performance requirements, methods of testing and required test results | Ed. 1.0, 2010-05-26; stability 2027 | <https://webstore.iec.ch/en/publication/4517> | "… for Galileo shipborne receiver equipment, based on IMO resolution MSC.233(82) …" |
| 61108-4:2004 | Part 4: Shipborne DGPS and DGLONASS maritime radio beacon receiver equipment - Performance requirements, methods of testing and required test results | Ed. 1.0, 2004-07-19; stability 2027 | <https://webstore.iec.ch/en/publication/4518> | "… conforming to performance standards not inferior to those adopted by the IMO in resolution MSC.114(73)." |
| 61108-5:2020 | Part 5: BeiDou navigation satellite system (BDS) - Receiver equipment - Performance requirements, methods of testing and required test results | Ed. 1.0, 2020-03-11; stability 2028 | <https://webstore.iec.ch/en/publication/61159> | "… for BDS shipborne receiver equipment, based on IMO resolution MSC.379(93) …" |
| 61108-6:2023 | Part 6: Navigation with Indian constellation (NavIC)/Indian regional navigation satellite system (IRNSS) - Receiver equipment - Performance requirements, methods of testing and required test results | Ed. 1.0, 2023-02-23; stability 2027 | <https://webstore.iec.ch/en/publication/67527> | "… for the Indian regional satellite system (IRNSS) shipborne receiver equipment, based on IMO resolution MSC.449(99) …" |
| 61108-7:2024 | Part 7: Satellite based augmentation system (SBAS) L1 - Receiver equipment - Performance standards, methods of testing and required test results | Ed. 1.0, 2024-05-03; stability 2027 | <https://webstore.iec.ch/en/publication/68696> | "… which uses L1 signals from GPS and satellite based augmentation system (SBAS) in order to improve the estimated GPS position." |

**No IEC 61108 part for QZSS was found.** The webstore search returned parts 1–7 only, and no other
part is cross-listed on these pages. IMO has a QZSS performance standard, MSC.480(102), but IEC has
not published a matching receiver test standard that I could find — marked, not asserted beyond the
search. **Part 7 is an augmentation, not a GNSS**, and MSC.599(111) annex §1.6 says augmentation
systems "do not require recognition by IMO". So IEC 61108 does not give the six systems parallel
coverage: QZSS has no part, and DGPS/DGLONASS and SBAS have parts of their own.

### 9a.4 IEC 61162-1 (IEC webstore catalogue, PRIMARY)

<https://webstore.iec.ch/en/publication/72729> — **IEC 61162-1:2024, Edition 6.0, published
2024-04-04**, International Standard, TC 80, 385 pages, stability date 2028. Title: "Maritime
navigation and radiocommunication equipment and systems - Digital interfaces - Part 1: Single talker
and multiple listeners". It replaces IEC 61162-1:2016 (Ed. 5.0, 2016-08-31; withdrawn 2024-04-04 per
the search-result listing of <https://webstore.iec.ch/en/publication/25754>).

Abstract:

> "IEC 61162-1:2024 contains the requirements for data communication between maritime electronic
> instruments, navigation and radiocommunication equipment when interconnected via an appropriate
> system. This document is intended to support one-way serial data transmission from a single talker
> to one or more listeners. These data are in printable ASCII form and can include information such
> as position, speed, depth, frequency allocation, etc. Typical messages can be from about 11 to a
> maximum of 79 characters in length and generally require transmission no more rapidly than one
> message per second."

It continues: "For applications where a faster transmission rate is necessary, IEC 61162-2 applies.
For applications to shore based equipment of the automatic identification system (AIS) the IEC 62320
series applies."

**Relationship to NMEA 0183: not reached in a primary text — marked, not asserted.**

- The IEC abstract does not mention NMEA.
- IEC's preview PDFs (`webstore.iec.ch/p-preview/…` and `/preview/…`) return an HTML page, not the
  PDF, for every edition I tried.
- NMEA's own page (<https://www.nmea.org/nmea-0183.html>) gives "Version 4.30" ("As of December
  2023") but does not mention IEC 61162-1.
- Search snippets say the 2000 edition is "closely aligned with NMEA 0183 version 2.30" and the 2007
  edition with version 3.01. These come from an IEC preview and a reseller listing I could not open,
  so I do not rely on them.

IMO itself points to IEC 61162 for the receiver's output: MSC.599(111) annex §3.4, footnote 1, quoted
in §9a.1.

### 9a.5 Citation for "six peer systems"

The strongest primary chain for the Maritime guide and the `gnss` JSDoc:

> IMO recognizes GPS, GLONASS, BeiDou, Galileo, NavIC (IRNSS) and QZSS as components of the
> Worldwide Radionavigation System, under the policy of IMO resolution A.1046(27) (2011), whose annex
> was revised by MSC.599(111) (2026). Recognition: GPS and GLONASS, resolution A.860(20) (1997);
> BeiDou, SN.1/Circ.329 (2014); Galileo, SN.1/Circ.334 (2016); IRNSS, SN.1/Circ.340 (2020);
> QZSS, SN.1/Circ.341 (2021).

A short form that rests on a single primary page the reader can open: "IMO, Maritime Safety
Committee 104th session summary (October 2021), which lists all six as recognized components of the
WWRNS."

What this does and does not support:

- IMO **recognition** applies to all six, so "six peer systems" in the sense of *IMO-recognized WWRNS
  components* is supported.
- Recognition is not uniform in scope. BDS (2014) was recognized for ocean waters (100 m, 95%).
  IRNSS was recognized for ocean waters inside 55°E–110°E, 50°N–5°S. Galileo was expected to reach
  10 m. GPS's 1997/2001 recognition was "for navigation use in other waters" (not harbour
  approaches). Do not write that IMO treats them as equivalent for every phase of navigation.
- **IEC 61108 is not a basis for "six peers"**: it has no QZSS part. Cite IEC 61108 per system
  (parts 1, 2, 3, 5, 6) only, not as a six-system authority.
- IEC 61162-1 is the interface standard, not a recognition instrument. Cite it for the sentence
  format, not for peer status.

---

