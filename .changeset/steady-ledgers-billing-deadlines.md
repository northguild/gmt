---
"@northguild/gmt": minor
---

Add `billingTimeline` to the `intermodal/` namespace: the invoice, dispute and resolution deadlines around a demurrage or detention invoice, with every window a caller parameter (Story INT-58).

A billing regime or service contract can set up to three windows around an invoice: one to issue it, counted from an anchor date; one to dispute it, counted from issuance; and one to resolve the dispute, counted from the request, unless the parties agree a date instead. The number of days in each is the caller's fact; GMT carries none of them. The arithmetic is the function's: each deadline is a date, counted in calendar days from a date, with the anchor as day zero and the deadline day itself inside the window.

```typescript
import { billingTimeline } from "@northguild/gmt";

const windows = { issueDays: 30, disputeDays: 30, resolutionDays: 30 };

// Charges last accrued on 1 March. Day 30 is the last day by the deadline; day 31 is not.
billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31" }, windows);
// { invoiceDeadline: "2026-03-31", issuedByDeadline: true, disputeDeadline: "2026-04-30",
//   requestedByDeadline: null, resolutionDeadline: null }
billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-04-01" }, windows);
// { invoiceDeadline: "2026-03-31", issuedByDeadline: false, disputeDeadline: "2026-05-01",
//   requestedByDeadline: null, resolutionDeadline: null }

// A dispute received on the dispute deadline; the resolution deadline is counted from it.
billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-20", requestReceivedOn: "2026-04-19" }, windows);
// { invoiceDeadline: "2026-03-31", issuedByDeadline: true, disputeDeadline: "2026-04-19",
//   requestedByDeadline: true, resolutionDeadline: "2026-05-19" }

// A 14/14/45 service contract through the same chain: the numbers are the caller's.
billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-05", requestReceivedOn: "2026-03-18" }, { issueDays: 14, disputeDays: 14, resolutionDays: 45 });
// { invoiceDeadline: "2026-03-15", issuedByDeadline: true, disputeDeadline: "2026-03-19",
//   requestedByDeadline: true, resolutionDeadline: "2026-05-02" }

// Windows have no defaults.
billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31" }, { disputeDays: 30, resolutionDays: 30 }); // null
```

- **Day zero is the anchor and the deadline is `anchor + days`** on the ISO calendar; a date is by the deadline when it is on or before it. Thirty days across a leap day, a month end, a year end or a DST change is thirty dates, never thirty times 24 hours. That is the function's stated contract, not a reading of any rule; a regime that counts differently passes a different number.
- **Deadlines are dates, never instants.** Reduce an instant to the billing party's local date first with `convertUtcToPlainDate(instant, { timeZone })`; the function does not guess a zone.
- **Windows have no defaults.** Each is a safe integer of at least `0`; a missing, negative or non-integer window returns `null`, the same rule as `firstDay`.
- **The anchor is whatever date the caller counts from**: the last charged date (`chargeableDays(...).chargedDates.at(-1)`), or for a party re-billing a charge it was itself billed, the issuance date of the invoice it received. The chain is the same.
- **The chain fills in as its dates exist.** With only `anchorOn` the result is a forecast: `invoiceDeadline` is set and every other field is `null`. An invoice date sets `issuedByDeadline` and `disputeDeadline`; a request date sets `requestedByDeadline` and `resolutionDeadline`. A request without an invoice, or dated before it, returns `null`.
- **An agreed date replaces the computed resolution deadline.** `agreedResolutionOn` must be a valid date on or after `requestReceivedOn`, else `null`. Every emitted date is bare ISO.
- **GMT computes dates, not liability.** `issuedByDeadline` and `requestedByDeadline` compare dates and say nothing else; whether a charge is payable is the consumer's question, the sibling of "GMT computes days, never money".
- Also exported: the `BillingDates` and `BillingWindows` argument types and the `BillingDeadlines` result type, from the package root, `@northguild/gmt/intermodal` and `…/intermodal/calculate`.
