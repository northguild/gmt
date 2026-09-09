# INT-13 — Intermodal: Advance filing deadlines

**Scope:** Customs advance-filing deadlines, which are deterministic offsets from a defined cargo event.

## Gap

Cross-border cargo carries statutory filing deadlines with real penalties. They are anchored to a specific, legally defined event — and critically, that event is **lading**, not departure and not arrival. Getting the anchor wrong produces a filing that is late by days.

| Regime | Deadline | Anchor |
| --- | --- | --- |
| ISF 10+2 (US import) | 24 hours before | Cargo laden aboard the vessel at the foreign port |
| AMS 24-Hour Rule (US carrier manifest) | 24 hours before | Commencement of loading |
| ENS / ICS2 (EU) | 24 hours before | Commencement of loading |

Sources: [exFreight ISF](https://www.exfreight.com/what-is-isf-102-complete-guide-to-importer-security-filing-for-us-imports/), [Hapag-Lloyd ENS FAQ](https://www.hapag-lloyd.com/en/services-information/security-information/europe-security-information/faq-24h-rule-ens.html).

## Scope

- `packages/gmt/src/intermodal/calculate/filingDeadline.ts`:
  - `filingDeadline(ladenAt: string, rule: { offset: string, anchor: 'lading' | 'departure' | 'arrival' }, options?: { timeZone?: string, calendar?: BusinessCalendar, roll?: RollConvention }): string` — The deadline instant.
- `packages/gmt/src/intermodal/compare/filingStatus.ts`:
  - `filingStatus(filedAt: string, deadline: string): { onTime: boolean, margin: string }` — `margin` is a signed ISO duration; negative means late.

## Design notes

- **The anchor is a parameter with no default.** ISF and ENS both key on lading, but the caller must say so explicitly, because the whole class of error this function exists to prevent is anchoring to the wrong event. Silently defaulting to departure would reintroduce it.
- **Rules are caller-supplied**, not bundled. Filing regimes change by legislation, sometimes with short notice, and a stale bundled table would make GMT confidently wrong. The table above is documentation, not data.
- These deadlines are stated in hours and are genuine instant offsets, so unlike the ocean cut-offs in TRAN-10 they do **not** take a local time of day by default. The optional calendar and roll parameters exist for jurisdictions that express a deadline in working days.
- GMT computes the deadline. Whether a filing was accepted, and any penalty, is the consumer's problem.

## Corrections

This story is the replacement for the original `customsClearance(arrival, port) => { clearanceStart, clearanceEnd, estimatedHours }`, which is deleted. That function asked a time library to predict how long a customs authority would take to process a shipment — not time math, and not knowable from a timestamp and a port code. The genuinely deterministic, legally binding part of customs timing is the filing deadline, and that is what this story computes.

## What gmt provides (do not re-implement)

- `cutoffAt` from TRAN-10 — deadline-from-anchor arithmetic
- `subtractDuration` — offset arithmetic
- `spanMs` from CORE-2 — filing margin
- `rollDate` from CORE-7 — working-day rolling where a regime requires it

## Verification

- `filingDeadline` with the ISF rule returns exactly 24 hours before the lading instant
- Anchoring the same shipment to departure rather than lading yields a demonstrably different deadline, asserted explicitly
- `filingStatus` returns `onTime: true` at exactly the deadline instant and `false` one second later
- `margin` is negative for a late filing
- Working-day rolling moves a deadline landing on a holiday backward
- Invalid anchor or malformed offset returns the sentinel
- `pnpm run validate` stays green
