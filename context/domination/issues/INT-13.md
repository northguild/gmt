# INT-13 — Intermodal: Advance filing and notification deadlines

**Scope:** Customs advance-filing and pre-arrival notification deadlines, which are deterministic offsets from a defined cargo or vessel event.

## Gap

Cross-border cargo carries statutory filing deadlines with real penalties. They are anchored to a specific, legally defined event — and critically, the event differs by regime: **lading** for the US and Canadian container rules, **departure from the port of loading** for Japan, **arrival at the first port** for bulk cargo almost everywhere, and **loading of the aircraft** for air pre-loading data. Getting the anchor wrong produces a filing that is late by days.

| Regime | Rule | Anchor | Hours |
| --- | --- | --- | --- |
| US ISF 10+2 | "no later than 24 hours before the cargo is laden aboard the vessel at the foreign port"; FROB "prior to lading"; stuffing-location and consolidator elements "no event later than 24 hours prior to arrival in a United States port" | lading; arrival for two elements | 24 |
| US 24-hour manifest (AMS) | "24 hours before the cargo is laden aboard the vessel at the foreign port"; bulk and qualifying break bulk "24 hours prior to the vessel's arrival in the United States" | lading; arrival for bulk | 24 |
| EU ENS by sea (ICS2) | containerised: "at the latest 24 hours before the goods are loaded onto the vessel"; bulk/break bulk: "at the latest four hours before the arrival of the vessel at the first port of entry"; listed short-sea origins: "at the latest two hours before arrival" | loading; arrival | 24 / 4 / 2 |
| EU ENS by air (PLACI) | flights under 4 hours: by actual departure; longer flights: 4 hours before arrival at the first airport; the minimum pre-loading dataset "at the latest before the goods are loaded" | departure / arrival / loading | 0 / 4 / 0 |
| Japan AFR | "no later than 24 hours before departure of the vessel from a port of loading" | departure from port of loading | 24 |
| China advance manifest (GACC [2017] No. 56) | container vessels 24 hours before loading; non-container 24 hours before arrival at the first domestic port (reproductions only — the GACC text was not reached; the JSDoc must say so) | loading; arrival | 24 |
| Canada ACI marine | cargo: "at least 24 hours before the shipment is loaded onto the vessel if all or part of the shipment is in a cargo container"; conveyance: "at least 96 hours before the vessel is scheduled to arrive" with containers aboard, 24 hours otherwise, 4 hours for US-origin empties; shorter voyages before departure | loading; arrival | 24 / 96 / 24 / 4 |
| US Notice of Arrival | "At least 96 hours before arriving at the port or place of destination"; voyages under 96 hours: "Before departure but at least 24 hours before arriving"; small US vessels on voyages under 24 hours: 60 minutes before departure | arrival; departure | 96 / 24 / 1 |

([19 CFR 149.2(b)](https://www.law.cornell.edu/cfr/text/19/149.2), [19 CFR 4.7(b)](https://www.law.cornell.edu/cfr/text/19/4.7), [Delegated Regulation (EU) 2015/2446 Art. 105 and 106](https://www.legislation.gov.uk/eur/2015/2446/article/105/adopted), [Japan Customs, Advance Filing Rules](https://www.customs.go.jp/english/summary/advance5/index.htm), [Reporting of Imported Goods Regulations SOR/86-873 ss. 14–15](https://laws-lois.justice.gc.ca/eng/regulations/SOR-86-873/FullText.html), [CBSA Memorandum D3-5-1 Appendix A](https://www.cbsa-asfc.gc.ca/publications/dm-md/d3/d3-5-1-eng.pdf), [33 CFR 160.212(a)](https://www.law.cornell.edu/cfr/text/33/160.212))

## Scope

- `packages/gmt/src/intermodal/calculate/filingDeadline.ts`:
  - `filingDeadline(anchorAt: string, rule: { offset: string, anchor: 'lading' | 'loadingCommencement' | 'departure' | 'arrival' }, options?: { timeZone?: string, calendar?: BusinessCalendar, roll?: RollConvention }): string` — The deadline instant: `anchorAt − offset`, optionally rolled off non-business days.
  - `applicableRule(regime: FilingRegime, cargo: { containerised: boolean, bulk?: boolean, voyageHours?: number, flightHours?: number, originListed?: boolean }): { anchor: ..., offset: string, clause: string } | null` — Which branch of a regime's rule applies to a shipment, with the clause it comes from; the table above as data with its citations, opt-in under `@northguild/gmt/intermodal/data`.
- `packages/gmt/src/intermodal/compare/filingStatus.ts`:
  - `filingStatus(filedAt: string, deadline: string): { onTime: boolean, margin: string }` — `margin` is a signed ISO duration; negative means late.
- `packages/gmt/src/intermodal/calculate/notificationAccuracy.ts`:
  - `etaUpdateRequired(previousEta: string, newEta: string, tolerance: string): boolean` — Some regimes require an amended notice when the estimate moves beyond a tolerance (CBSA: the estimated time of arrival "must be kept accurate to within eight hours"); the tolerance is the caller's.

## Design notes

- **The anchor is a parameter with no default.** ISF and the EU container rule key on lading; Japan keys on departure; bulk rules key on arrival. Silently defaulting to any one of them would reintroduce the class of error this function exists to prevent.
- **Rules are data, not code, and the data is opt-in.** Filing regimes change by legislation with short notice, and a stale rule on the default import path would make GMT confidently wrong. `applicableRule` ships behind the data subpath with each row's clause and revision, so a caller can see what it is relying on; a regime whose primary text was not reached (China) is marked as such in the data and the JSDoc.
- **These deadlines are stated in hours and are genuine instant offsets**, so unlike the ocean cut-offs in TRAN-10 they do **not** take a local time of day by default. The optional calendar and roll parameters exist for jurisdictions that express a deadline in working days.
- **Some anchors are estimates.** "Arrival" and "departure" anchors are ETAs and ETDs until they happen; the deadline moves with the estimate, and `etaUpdateRequired` is the companion test for regimes that demand an amended filing when it moves.
- GMT computes the deadline. Whether a filing was accepted, and any penalty, is the consumer's problem.

## Corrections

This story is the replacement for the original `customsClearance(arrival, port) => { clearanceStart, clearanceEnd, estimatedHours }`, which is deleted. That function asked a time library to predict how long a customs authority would take to process a shipment — not time math, and not knowable from a timestamp and a port code. The genuinely deterministic, legally binding part of customs timing is the filing deadline, and that is what this story computes.

The previous revision of this spec had three regimes and one anchor vocabulary. The table now has eight regimes read from their own texts, and the anchor vocabulary gained `loadingCommencement` (the EU and Canadian wording) and `departure` (Japan), because "lading" and "loading" are the same physical event but "departure from the port of loading" is not.

## What gmt provides (do not re-implement)

- `cutoffAt` from TRAN-10 — deadline-from-anchor arithmetic
- `subtractDuration` — offset arithmetic
- `spanMs` from CORE-2 — filing margin and ETA movement
- `rollDate` from CORE-7 — working-day rolling where a regime requires it

## Verification

- `filingDeadline` with the ISF rule returns exactly 24 hours before the lading instant
- Anchoring the same shipment to departure rather than lading yields a demonstrably different deadline, asserted explicitly
- `applicableRule('us-isf', { containerised: true })` returns lading and `PT24H` with `19 CFR 149.2(b)`; `applicableRule('eu-ens-sea', { containerised: false, bulk: true })` returns arrival and `PT4H` with Art. 105(b); `applicableRule('ca-aci-marine', { containerised: true })` returns loading and `PT24H`; `applicableRule('us-noa', { voyageHours: 48 })` returns arrival and `PT24H` with the before-departure condition flagged
- `applicableRule('cn-manifest', …)` carries `primaryTextVerified: false`
- `filingStatus` returns `onTime: true` at exactly the deadline instant and `false` one second later
- `margin` is negative for a late filing
- `etaUpdateRequired` with `PT8H` is `true` for a nine-hour ETA shift and `false` for seven
- Working-day rolling moves a deadline landing on a holiday backward
- Invalid anchor or malformed offset returns the sentinel
- `pnpm run validate` stays green
