# INT-58 — Intermodal: FMC demurrage and detention billing timelines

**Scope:** The statutory deadlines around a demurrage or detention invoice under 46 CFR Part 541, and the date fields such an invoice must carry.

## Gap

Since 28 May 2024, demurrage and detention invoices for US trades are regulated. A billing party must issue the invoice within 30 calendar days of the date the charge was last incurred, or the billed party is not required to pay (§541.7). The billed party then has at least 30 calendar days from issuance to request mitigation, refund or waiver, and the billing party has 30 calendar days from receiving that request to resolve it (§541.8). The invoice itself must state the allowed free time in days, the start and end dates of free time, the container availability date for imports or the earliest return date for exports, and the specific dates for which charges were assessed (§541.6).

All of that is date arithmetic on the outputs INT-12 already computes, and all of it is money: an invoice one day late is unenforceable; a dispute one day late may be refused.

([46 CFR 541.6](https://www.law.cornell.edu/cfr/text/46/541.6), [46 CFR 541.7](https://www.law.cornell.edu/cfr/text/46/541.7), [46 CFR 541.8](https://www.law.cornell.edu/cfr/text/46/541.8))

## Scope

- `packages/gmt/src/intermodal/calculate/fmcBillingTimeline.ts`:
  - `invoiceDeadline(lastIncurredOn: string): string` — The last date on which an invoice may be issued: `lastIncurredOn + 30` calendar days (§541.7).
  - `disputeDeadline(invoiceIssuedOn: string, options?: { windowDays?: number }): string` — The earliest date the request window may close: `invoiceIssuedOn + 30` by default, later if the billing party grants more (§541.8 says "at least").
  - `resolutionDeadline(requestReceivedOn: string, options?: { agreedDate?: string }): string` — `requestReceivedOn + 30`, or the later date the parties agreed (§541.8).
  - `billingTimeline(dates: { lastIncurredOn: string, invoiceIssuedOn?: string, requestReceivedOn?: string }, options?: { billingParty: 'carrier' | 'nvocc', carrierInvoiceReceivedOn?: string }): { invoiceDeadline: string, invoiceTimely: boolean | null, disputeDeadline: string | null, resolutionDeadline: string | null } | null` — For an NVOCC re-billing a carrier's charge, §541.7(b) sets the deadline at 30 calendar days "from the issuance date of the demurrage or detention invoice it received", and §541.7(c) obliges the carrier to "provide an additional thirty (30) calendar days for the NVOCC to dispute the charge".
- `packages/gmt/src/intermodal/format/fmcInvoiceDates.ts`:
  - `fmcInvoiceDateFields(input: { freeTime: ReturnType<typeof freeTimeExpiry>, charges: ReturnType<typeof chargeableDays>, direction: 'import' | 'export', availabilityDate?: string, earliestReturnDate?: string, invoiceDate: string, dueDate: string }): FmcInvoiceDates | null` — The §541.6 date set, assembled from INT-12's outputs: allowed free days, free-time start and end, availability or earliest-return date, the charged dates, invoice date and due date. Missing a field the direction requires returns the sentinel.

## Design notes

- **These are calendar days on local dates**, as the regulation states them, so the inputs are dates. An instant is reduced to a date by the caller in the billing party's zone first (`floorToZone`); the functions do not guess a zone.
- **"Within thirty calendar days from the date" is counted so the 30th day is the last timely day.** The JSDoc states the convention and cites §541.7; the regulation gives no clock time, so a deadline is a date, not an instant.
- **`invoiceTimely` is `null` until an invoice date exists.** A timeline with no invoice yet is a forecast, not a finding.
- **GMT computes deadlines, not liability.** Whether a charge was validly incurred, whether the billing party's own performance caused it (which §541.6 requires the party to certify), and any penalty are the consumer's problem.
- `fmcInvoiceDateFields` exists because the rule lists the date fields, INT-12 already produces every one, and the mapping between them is where a hand-built invoice drops a field. Amounts, tariff references and contact details are not dates and are not here.

## What gmt provides (do not re-implement)

- `freeTimeExpiry` / `chargeableDays` from INT-12 — the free-time and charged-date outputs the invoice must print
- `addDate` — the 30-day arithmetic
- `floorToZone` from CORE-5 — reducing an instant to the billing party's local date
- `isValidDate` — input validation

## Verification

- `invoiceDeadline('2026-03-01')` returns `'2026-03-31'`; an invoice dated 31 March is timely and one dated 1 April is not, asserted through `billingTimeline`
- `disputeDeadline('2026-03-31')` returns `'2026-04-30'`; with `windowDays: 45` it returns `'2026-05-15'`; `windowDays: 20` returns the sentinel because the rule says at least 30
- `resolutionDeadline` returns request date + 30, or the later agreed date; an earlier agreed date returns the sentinel
- `billingTimeline` with only `lastIncurredOn` returns `invoiceTimely: null` and no dispute or resolution deadlines
- `billingTimeline` for an NVOCC with `carrierInvoiceReceivedOn` sets the invoice deadline 30 days from that date, not from `lastIncurredOn`, and the carrier-side dispute window it reports is 30 days longer than the standard one (§541.7(b)–(c))
- `fmcInvoiceDateFields` for an import without `availabilityDate` returns the sentinel; for an export without `earliestReturnDate` returns the sentinel; a complete import case echoes INT-12's `lastFreeDay` as the free-time end and its `chargedDates` verbatim
- A 30-day span crossing a DST transition or a month end is counted in calendar days, not hours
- `pnpm run validate` stays green
