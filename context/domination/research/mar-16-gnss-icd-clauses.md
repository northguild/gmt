# MAR-16 / SPA-48 / SPA-46 — GNSS time-scale clauses, the leap-second table and scale designators

Date: 2026-10-15. Tools: curl, pypdf text extraction, Node 24 with `@js-temporal/polyfill` 0.5.1 (the
version `packages/gmt` pins). Every quote below was read from the issuing body's own file on the date
above. Quotes are verbatim from the extracted text; where PDF extraction mangled a symbol (Δ, Greek,
Cyrillic) that is said. Page numbers are the printed page, then the PDF page where they differ.
Nothing under the repository tree was touched except this file.

Legend: **PRIMARY** = the issuing body's own text. **DERIVED** = computed here from primary
statements, with the computation shown. **NOT REACHED** = marked, not asserted.


## Scoped files

Read only the file for the system or topic at hand.

- [Headline findings](mar-16-gnss-icd-clauses/headline-findings.md) - section 0, the findings to read first.
- [GPS](mar-16-gnss-icd-clauses/gps.md) - section 1, IS-GPS-200 epoch, TOW, LNAV and CNAV week, GPS/UTC relationship, TAI - GPS.
- [Galileo and BeiDou](mar-16-gnss-icd-clauses/galileo-beidou.md) - sections 2 and 3, epoch, week number, TOW and offsets.
- [GLONASS and QZSS](mar-16-gnss-icd-clauses/glonass-qzss.md) - sections 4 and 5, GLONASS time, N_T, N_4, designator, IS-QZSS-PNT.
- [NavIC](mar-16-gnss-icd-clauses/navic.md) - section 5a, epoch, week, continuity, relation to TAI/UTC/GPS, RINEX 4.02, rollover dates.
- [IERS leap seconds](mar-16-gnss-icd-clauses/iers-leap-seconds.md) - section 6, the leap-second table and Bulletin C expiry fields.
- [ITU-R, CGPM and rollover dates](mar-16-gnss-icd-clauses/itu-cgpm-rollover.md) - sections 7 and 8, TF.460-6, CGPM resolutions, week rollover dates computed with Temporal.
- [Scale designators](mar-16-gnss-icd-clauses/scale-designators.md) - section 9, NAIF SPICE, FITS, RINEX, and the recommendation per scale.
- [IMO and peer systems](mar-16-gnss-icd-clauses/imo-iec-peers.md) - section 9a.1 and 9a.2, the IMO policy and per-system recognition.
- [IEC standards](mar-16-gnss-icd-clauses/iec-standards.md) - sections 9a.3 to 9a.5, IEC 61108, IEC 61162-1 and the six-peer-systems citation.
- [Pre-1972 UTC and corrections](mar-16-gnss-icd-clauses/pre1972-corrections.md) - sections 10 and 11, pre-1972 UTC and corrections to the MAR-16, SPA-48 and SPA-46 issue files.
- [Authority rows and gaps](mar-16-gnss-icd-clauses/authority-rows.md) - sections 12 and 13, authority table rows for the architect and what was not reached.
