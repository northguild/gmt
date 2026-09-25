# INT-58 — Intermodal: billing deadlines

**Scope:** The deadline chain around a demurrage or detention invoice: the last date it may be issued, the last date it may be disputed, and the last date the dispute must be resolved, with every window length supplied by the caller.

## Gap

A billing regime or service contract can set up to three windows around an invoice: one to issue it, counted from an anchor date such as the last date a charge accrued or, for a party re-billing a charge it was itself billed, the issuance date of the invoice it received; one to dispute it, counted from issuance; and one to resolve the dispute, counted from the request, unless the parties agree a date instead. The number of days in each is the caller's fact; GMT carries none of them. The arithmetic does not differ: each deadline is a date, counted in calendar days from a date, with the anchor as day zero and the deadline day itself inside the window.

Three things go wrong in hand-built code. Adding 30 × 86,400,000 ms to a `Date` crosses a DST change and lands a day off. Comparing an instant to a date treats a midnight invoice as a day late. Hard-coding the window ships a wrong deadline the day the contract or the rule changes. INT-12 already produces the dates an itemised invoice can list (`freeTimeStart`, `lastFreeDay`, `chargedDates`, and the `available` event `demurrageClock` accepts); this story adds the deadline chain on top of them.

## Scope

- `packages/gmt/src/intermodal/calculate/billingTimeline.ts`:
  - `billingTimeline(dates: { anchorOn: string, invoiceIssuedOn?: string, requestReceivedOn?: string }, windows: { issueDays: number, disputeDays: number, resolutionDays: number, agreedResolutionOn?: string }): { invoiceDeadline: string, issuedByDeadline: boolean | null, disputeDeadline: string | null, requestedByDeadline: boolean | null, resolutionDeadline: string | null } | null` — The chain. `invoiceDeadline` is `anchorOn + issueDays`. With an invoice date, `issuedByDeadline` says whether it is on or before that deadline and `disputeDeadline` is `invoiceIssuedOn + disputeDays`. With a request date, `requestedByDeadline` says whether it is on or before the dispute deadline and `resolutionDeadline` is `requestReceivedOn + resolutionDays`, or `agreedResolutionOn` when the parties agreed a date. Fields whose input does not exist yet are `null`: a timeline with no invoice is a forecast, not a finding.
  - Exported types `BillingDates`, `BillingWindows`, `BillingDeadlines`.
- Docs site (`apps/dox/src/content/docs/`, per [../docs-site.md](../docs-site.md)):
  - `guides/industries/intermodal-billing-deadlines.mdx` — day zero and the deadline date, the chain, no default windows, the re-bill anchor, where the numbers come from, the dates an itemised invoice can list, mapped to INT-12's outputs, ported from the README section.
  - Scenarios: `invoice-a-day-late`, `re-bill-anchored-on-the-wrong-date`, `dispute-window-from-a-contract` (all `billingTimeline`).
  - `mistakes/intermodal.mdx` — a hard-coded window, business days where the regime counts calendar days, a re-bill anchored on the charge, an anchor moved to a reissue date, an instant reduced in UTC, the deadline day treated as late, a request dated before its invoice.
  - Index entries in `guides/industries/index.mdx`, `guides/index.mdx` and `mistakes/index.mdx`; the existing intermodal guide's last section links forward instead of saying the deadlines are out of scope.
  - The Billing Deadlines tool (`tools/billing-deadlines.mdx`): a day strip from the anchor through the last deadline with the three windows shaded and the anchor, invoice and request dates marked, "on or before the deadline" / "after the deadline" for each comparison, window inputs with no defaults, presets labelled by their numbers, and the real `billingTimeline` call and result. It is the Dox chat tool `showBillingDeadlines({ anchorOn, invoiceIssuedOn?, requestReceivedOn?, issueDays, disputeDays, resolutionDays, agreedResolutionOn? })`; the guide and the scenarios link to it. Its permalink carries every number as a string, because `seedFromLocation` passes only strings.

## Design notes

- **Day zero is the anchor and the deadline is `anchor + days`** on the ISO 8601 calendar (`Temporal.PlainDate.add`); a date is "by the deadline" when `Temporal.PlainDate.compare(date, deadline) <= 0`. That is the function's stated contract, not a reading of any rule. A regime that counts differently passes a different number.
- **Deadlines are dates, never instants.** The caller reduces an instant to the billing party's local date first with `convertUtcToPlainDate(instant, { timeZone })`; the function does not guess a zone. (`convertUtcToPlainDate` reads the `Z` grammar, which is what INT-12's `expiresAt` emits.)
- **Windows have no defaults.** Each is a safe integer of at least 0; a missing, negative or non-integer window returns the sentinel. Same rule as INT-12's `firstDay`: a silently defaulted window is a wrong deadline.
- **The booleans compare dates and say nothing else.** `issuedByDeadline` and `requestedByDeadline` are date comparisons; whether a charge is payable, whether a dispute must be heard, and any consequence are the consumer's problem. **GMT computes dates, not liability**, the sibling of INT-12's "GMT computes days, never money".
- **`agreedResolutionOn` replaces the computed resolution deadline** when given; it must be a valid date on or after `requestReceivedOn`, else the sentinel. It is validated even when no request exists, but cannot act without one.
- **A request cannot precede the invoice it disputes.** `requestReceivedOn` without `invoiceIssuedOn`, or earlier than it, is a data error and returns the sentinel. An invoice earlier than the anchor is allowed: an invoice may be issued while charges still accrue.
- **Every emitted date is canonical bare ISO** (`Temporal.PlainDate.from(v).toString()`), so an input annotation such as `[u-ca=iso8601]` does not reach the output, as `addDate` behaves.
- **The result type is `BillingDeadlines`**, not `BillingTimeline`: the reference generator refuses two pages whose paths differ only by case (INT-12's decision of record).
- **GMT tracks no law** (tracker, "Added for this epic", set by this story). No statute is quoted, no regulation's numbers are carried and no court decision is named in code, JSDoc or on the docs site. Docs examples are labelled by their numbers ("30-day windows", "a 14/14/45 contract"), never by a jurisdiction.

## Corrections

The scope as first filed is replaced. It is recorded here so it is not re-derived from this file later.

- **The filed spec encoded one jurisdiction's invoice rule as library logic**: five functions with a 30-day window built in and that regulator's initials in their names, plus an assembler that renamed INT-12's outputs to that rule's field names. The research record for INT-12 (`../research/int-12-demurrage-conventions.md`) had already established that no world standard governs invoice deadlines and that one country's rule is the only one. Under the epic policy above the story ships the generic chain with every window as a parameter, and the assembler is cut because INT-12 already outputs every date such an invoice prints. The numbers a caller passes are the caller's, and neither the library nor the docs name, link or paraphrase any jurisdiction's rule.
- **Suggestions posted on the issue thread by a third party were reviewed and nothing was adopted, vendored, fetched or linked.** Their rule tables and example code are not a source for this library, and the repository is not coupled to theirs.
- **`floorToZone` returns a UTC instant, not a local date.** The filed spec named it as the way to reduce an instant to the billing party's date; the reduction is `convertUtcToPlainDate(instant, { timeZone })`.
- **The booleans are named as date comparisons** (`issuedByDeadline`, `requestedByDeadline`), not as findings (`invoiceTimely`), so a result reads as arithmetic and not as a compliance verdict. A request-side comparison was added as the mirror of the invoice-side one.
- **The policy applies to INT-12's shipped text too.** No statute name, section number or country label remains in the INT-12 source JSDoc (`freeTimeExpiry`, `chargeableDays`, `demurrageClock`, `internal/freeTimeLedger`, with no behaviour change, and no `@example` change beyond one label), its tests' labels, the INT-12 guide, its scenario and mistakes pages, the Free Time Ledger tool page and widget copy, the package and root READMEs, and `packages/gmt/skills/`. Facts the research record sources to published tariffs stay, labelled as tariff terms ("some tariffs charge working days only", "some tariffs start the import clock at the container availability date"). The generic sense of "jurisdiction" in the business-calendar docs names no law and stays. The INT-12 guide's closing section becomes "The dates an invoice can list", mapped to INT-12 outputs with no jurisdiction, and links forward to the billing guide. Published CHANGELOG entries and git history are not rewritten.
- **The re-bill case needs no second function.** A party that re-bills a charge it was billed passes the issuance date of the invoice it received as `anchorOn`; the chain is the same.
- **Site-wide contrast work is part of this story.** The Billing Deadlines widget exposed accent text below the Dox 7:1 text rule, so every accent used as text now uses its `-ink` theme-role token, `--gmt-ice-dim` was retuned to at least 7:1 in both themes, and the Starlight badges were fixed. See `../../dox/reference/design-system.md` rule 6.
- **The tax-regulation citation in the `getFiscalPeriod` and `internal/fiscalCalendar` JSDoc is out of this story's scope.** It predates the story and is not intermodal; a separate story removes it.

## What gmt provides (do not re-implement)

- `chargeableDays` from INT-12 — its `chargedDates.at(-1)` is the usual anchor; `freeTimeExpiry` and `chargeableDays` produce the dates an itemised invoice can list
- `addDate` — the calendar-day arithmetic the deadline reproduces, not calls (`Temporal.PlainDate.add` inside the function, so the sentinel stays `null`)
- `convertUtcToPlainDate` — reducing an instant to the billing party's local date
- `isValidDate` — input validation

## Verification

- `billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 })` reports `invoiceDeadline: "2026-03-31"` and `issuedByDeadline: true`; the same with `invoiceIssuedOn: "2026-04-01"` reports `false`, asserted side by side
- With only `anchorOn`, every other field is `null`
- With an invoice and a request, `disputeDeadline` is `invoiceIssuedOn + disputeDays`, `requestedByDeadline` compares the request to it, and `resolutionDeadline` is `requestReceivedOn + resolutionDays`; `agreedResolutionOn` on or after the request replaces it, and an earlier one returns `null`
- A re-bill anchored on the received invoice's issuance date (`anchorOn: "2026-03-10"`) reports `invoiceDeadline: "2026-04-09"`, not a date counted from the charge
- A 14/14/45 contract through the same call reports `"2026-03-15"`, `"2026-03-19"` and `"2026-05-02"` for the example in the JSDoc
- A 30-day span crossing a DST transition, a month end, a year end or a leap day is counted in calendar days, not hours (`2028-01-30 + 30` is `2028-02-29`)
- A missing window, a non-integer, a negative number, a string, `NaN` or `null` returns `null`; a request without an invoice, or before it, returns `null`; hostile and revoked proxies in either position return `null` without throwing
- `2026-03-01[u-ca=iso8601]` yields bare `2026-03-31`; `[u-ca=hebrew]` and a critical unknown annotation return `null`
- Every result on the docs-site pages matches the built package, and every internal link on them resolves; each Billing Deadlines preset prints the JSDoc example it draws, asserted in the mount test
- The chat parity tests pass with the seventh tool
- `html-diff` reports the five new pages (the billing guide, the Billing Deadlines tool and the three scenarios) as having no baseline. Every other `visual:diff` change is on a page this story edits: the new sidebar entry on every page, the contrast fixes, the Free Time Ledger tool, the INT-12 guide, its scenarios and mistakes page, and the three index pages. A keyboard-only pass and a `prefers-reduced-motion` check pass.
- A grep of `packages/gmt/src`, `packages/gmt/skills`, `packages/gmt/README.md`, the root `README.md`, `.changeset`, `apps/dox/src/content` and this file finds no statute section, regulation number or docket name introduced by the story
- `pnpm run validate` stays green
