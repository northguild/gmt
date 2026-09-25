# Spec: Billing deadlines on the docs site (INT-58)

Execution spec for `dox-builder`, verified by `dox-tester`. This is not `packages/gmt` work.
`billingTimeline` is final and built in `packages/gmt/dist`. Nothing here edits library
source, tests, the READMEs or `packages/gmt/skills/`. The one library item found while writing
this is listed under **Blocked on the library pipeline**. Report it; do not build around it.

Sources, in order of precedence: `context/domination/issues/INT-58.md` (Scope → Docs site,
Design notes, `## Corrections`), the tracker policy "GMT tracks no law"
(`context/domination/tracker.md`), `context/domination/docs-site.md`, then the approved plan's
"Docs site" section. This spec wins over the plan where they differ. The differences are listed
under **Risks**.

Every value in this spec was run against `packages/gmt/dist` (section 9 has the script). Do not type a result that is not in section 9's table. If you need a new value, run it
against dist first and add it to the table.

---

## 0. Binding rules

- **GMT tracks no law.** No page, widget string, preset label, chat tool doc or test name names,
  links, quotes or paraphrases a statute, regulation, regulator, docket, court decision or
  jurisdiction's rule. Examples are labelled by their numbers only: "30-day windows", "a 14/14/45
  contract". Country labels ("US shape", "outside the US", "California") are removed. Tariff
  facts stay, labelled as tariff terms ("some tariffs charge working days only"). Carrier names
  used as tariff evidence ("MSC USA", "Hapag-Lloyd") may stay. The generic sense of
  "jurisdiction" in the business-calendar docs stays.
- **GMT computes dates, not liability.** `issuedByDeadline` and `requestedByDeadline` are date
  comparisons. Widget copy says "on or before the deadline" or "after the deadline". The words
  `timely`, `untimely`, `late`, `void`, `payable` and `compliant` never appear in widget copy,
  preset labels or descriptions, null-reason text, the tool page or the chat tool docs. The guide
  may keep the README's sentence "Whether a charge is payable … are the consumer's". Scenario
  titles may say "a day late" when they describe what naive code reports.
- **Windows have no defaults, in the widget as in the library.** A blank window input is left out
  of the call, never filled from a preset. Window inputs have no `placeholder`, because a
  placeholder number reads as a default.
- **Ported, not rewritten.** The guide ports `packages/gmt/README.md` § "Billing deadlines". Prose
  may be tightened. Examples and results are the README's.
- **Every result shown is real.** Nothing is elided: `{ …, issuedByDeadline: true }` is not
  allowed.
- **Module granularity only.** The widget loads `GMT_MODULES["intermodal/calculate"]()` and
  `GMT_MODULES["plain/validate"]()`. It never imports gmt's root or a namespace barrel.
- **React stays inside `/dox`.** The tool page is Astro plus a plain-DOM module.
- **The tier stays droppable.** The tool page must not import `dox-tools.ts`, `zod` or `ai`.
  Deleting the chat must leave the page working.
- **Tokens only, amber for the sentinel only.** Use no colour literals. Verdicts never use amber.
  Follow `reference/style-guide.md` and `reference/visual-design.md`.
- **Restyle native controls.** Use real `<select>` and `<input>` elements. Nothing in the strip is
  focusable.
- **Counts drift.** New copy contains no function, test or guide counts.

---

## A. Content pages

All paths are under `apps/dox/src/content/docs/`.

### A1. `guides/industries/intermodal-billing-deadlines.mdx` (new)

The filename must start with `intermodal-`, because `scripts/stats.mjs` `industryLayers()` reads
the namespace from the prefix and throws on any other. Front matter:

```yaml
title: "Intermodal: Billing Deadlines"
description: billingTimeline — the last date to issue, dispute and resolve a demurrage or detention invoice, counted in calendar days from a date you name, with every window a number you pass and none defaulted.
sidebar:
  order: 3
```

No `<Aside>`, no retrieval dates, no docket, no external legal link. Sections, in this order:

1. **Intro (no heading).** Port the README section's opening paragraph: a billing regime or
   service contract can set up to three windows around a demurrage or detention invoice (issue,
   dispute, resolve). The number of days in each is yours, and GMT carries none. Each deadline is
   a date, counted in calendar days from a date, with the anchor as day zero and the deadline day
   inside the window. Then the import:
   `import { billingTimeline } from "@northguild/gmt/intermodal";` and one line saying it lives
   under `@northguild/gmt/intermodal/calculate`.
2. **`## Day zero is the anchor, and the deadline is a date`.** `anchor + days` on the ISO
   calendar (`Temporal.PlainDate.add`). A date is by the deadline when it is on or before it.
   Thirty days across a leap day, a month end, a year end or a DST change is thirty dates, never
   thirty times 24 hours. Code: the forecast example and the leap-day example (V1, V8). Then the
   instant step: a date-time or instant passed as a date returns `null`. Reduce an instant to the
   billing party's local date first, not to its UTC date. Code:
   `convertUtcToPlainDate("2026-04-01T02:30:00Z", { timeZone: "America/New_York" }) // "2026-03-31"`
   (V14), with the import from `@northguild/gmt/utc`. Add one sentence: the UTC date of that
   instant is `2026-04-01`, a day later. Link
   [`convertUtcToPlainDate`](/reference/utc/convert/convertUtcToPlainDate/).
3. **`## The chain: billingTimeline`.** The chain fills in as its dates exist. Code: V2 and V3 side
   by side (day 30 and day 31), then V4 (request received on the dispute deadline) and V5 (an
   agreed date replaces the computed one). Bullets: a request without an invoice, or dated before
   it, returns `null` (V10). An invoice dated before the anchor is allowed. `agreedResolutionOn`
   must be on or after the request. Every emitted date is bare ISO. Close with the sentence:
   "`issuedByDeadline` and `requestedByDeadline` compare dates and say nothing else. What follows
   from a date after a deadline is yours: GMT computes dates, not liability."
4. **`## Windows have no defaults`.** Each window is a safe integer ≥ 0. A missing, negative or
   non-integer window returns `null` (V9). This is the same rule as `firstDay` in
   [Intermodal: Free Time and Demurrage](/guides/industries/intermodal-free-time-and-demurrage/#which-day-is-day-one-firstday).
   Then the 14/14/45 contract through the same call (V7): the numbers are the caller's.
5. **`## A re-bill is anchored on the invoice it received`.** A party that re-bills a charge it
   was itself billed passes the issuance date of the invoice it received as `anchorOn`. The chain
   is the same, and no second function is needed. Code: V6.
6. **`## Where the numbers come from`.** One short paragraph. The windows and the anchor come from
   the document you bill under: the tariff, the service contract, or the rules that apply to
   you. GMT names none of them and carries no default. A regime that counts differently, or from
   a different date, passes a different number or a different anchor. Keep it generic: name no
   jurisdiction, cite no rule and give no link.
7. **`## The dates on the invoice`.** Two to three sentences. The usual anchor is the last charged
   date, `chargeableDays(...).chargedDates.at(-1)`. Code (V15, V16):

   ```typescript
   import { billingTimeline, chargeableDays } from "@northguild/gmt/intermodal";

   const tariff = { basis: "calendar", chargeBasis: "calendar", timeZone: "America/New_York", firstDay: "eventDay" };
   const lastCharged = chargeableDays("2024-06-14T19:00:00Z", "2024-06-24T15:00:00Z", 3, tariff).chargedDates.at(-1);
   // "2024-06-24"
   billingTimeline({ anchorOn: "2024-06-24" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 });
   // { invoiceDeadline: "2024-07-24", issuedByDeadline: null, disputeDeadline: null,
   //   requestedByDeadline: null, resolutionDeadline: null }
   ```

   Then one sentence and a link: the other dates an itemised invoice can list come from the
   free-time functions, mapped in
   [The dates an invoice can list](/guides/industries/intermodal-free-time-and-demurrage/#the-dates-an-invoice-can-list).
   Do not duplicate that table here. It has one home.
8. **`## See it break, then work`.** A bulleted list:
   - `[Billing Deadlines: move an invoice across the deadline](/tools/billing-deadlines/)`
   - `[Invoice a day late](/scenarios/invoice-a-day-late/)`
   - `[A re-bill anchored on the wrong date](/scenarios/re-bill-anchored-on-the-wrong-date/)`
   - `[A dispute window from a contract](/scenarios/dispute-window-from-a-contract/)`
   - `[Intermodal mistakes](/mistakes/intermodal/#billing-deadlines)`

Every fenced block that shows a `call // result` imports the function it calls, so
`api-surface.mjs` executes it.

### A2. Scenarios (`scenarios/`, new; copy `demurrage-across-a-weekend.mdx`'s shape)

Each has front matter `title` and `description`, a `<Scenario … fixedSpecId="billingTimeline" />`,
and then a "what to edit" paragraph ending in a permalink (strings only, see C6) and a link to
the guide. `scenarios/index.mdx` is generated. Never edit it.

**`invoice-a-day-late.mdx`**: title "Invoice a Day Late". Description: "An invoice issued on day 30
of a 30-day window, flagged as a day late by millisecond arithmetic."

- `naiveCode` (verified, N1):

  ```js
  // The naive approach: a 30-day window as milliseconds, compared with an instant
  const anchor = new Date("2026-03-01T00:00:00-05:00"); // midnight, 1 March, New York
  const deadline = new Date(anchor.getTime() + 30 * 86400e3); // 2026-03-31T05:00:00.000Z
  const invoiced = new Date("2026-03-31T09:00:00-04:00"); // 09:00 on day 30
  invoiced <= deadline; // false — an invoice on day 30 is flagged a day late
  ```

- `explanation`: two mistakes stack. The deadline is a date, not an instant, so comparing an
  instant with it flags anything issued on the deadline day after the anchor's time of day.
  And 30 × 86,400,000 ms from a New York midnight crosses the 8 March clock change, so it lands
  at 01:00 on 31 March, not at midnight. The chain counts dates: day 30 is by the deadline, and
  day 31 is not.
- `gmtCode`: import `billingTimeline` from `@northguild/gmt/intermodal` and
  `convertUtcToPlainDate` from `@northguild/gmt/utc`. Show
  `convertUtcToPlainDate("2026-03-31T14:00:00Z", { timeZone: "America/New_York" }) // "2026-03-31"`
  (V13), then V2 and V3 with `const windows = { issueDays: 30, disputeDays: 30, resolutionDays: 30 };`.
- Edit paragraph: change the invoice date to `2026-04-01` and the verdict turns to "after the
  deadline". Permalink P1.

**`re-bill-anchored-on-the-wrong-date.mdx`**: title "A Re-Bill Anchored on the Wrong Date".
Description: "A party re-billing a charge it was itself billed counts its 30-day window from the
charge, not from the invoice it received."

- `naiveCode` (V17): `billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-04-05" }, windows)`
  with the full result. Comment: counted from the charge, so the re-bill looks after the
  deadline.
- `explanation`: the anchor is whatever date the caller counts from. The received invoice was
  issued on 10 March, so the re-bill's window runs from that date.
- `gmtCode`: V6, with the import.
- Edit paragraph: change the anchor between `2026-03-01` and `2026-03-10`. Permalink P3.

**`dispute-window-from-a-contract.mdx`**: title "A Dispute Window from a Contract". Description:
"A service contract gives 14 days to dispute. Code that hard-codes 30 gives the wrong deadline."

- `naiveCode` (N3):

  ```js
  // The naive approach: a dispute window copied from somewhere else
  const DISPUTE_DAYS = 30;
  const invoiced = new Date("2026-03-05T00:00:00Z");
  new Date(invoiced.getTime() + DISPUTE_DAYS * 86400e3).toISOString().slice(0, 10); // "2026-04-04"
  // This contract gives 14 days: the dispute deadline is 2026-03-19
  ```

- `explanation`: the windows are the contract's. GMT carries no number, so the caller passes
  14, 14 and 45.
- `gmtCode`: V7 and V18 (a request on 20 March is after the 14-day dispute deadline).
- Edit paragraph: change the dispute window to 30 and watch every later date move. Permalink P5.

### A3. `mistakes/intermodal.mdx` (modify)

- Intro: "three functions, `freeTimeExpiry`, `chargeableDays` and `demurrageClock`" becomes four
  functions, adding `billingTimeline`. Extend the list with "a deadline window hard-coded or
  counted from the wrong date".
- Rename `## Mistakes` to `## Free time and demurrage`. No link targets `#mistakes` (checked with
  `grep -rn "#mistakes" apps/dox/src/content`).
- Rewrite the `chargeBasis` entry's description (see B).
- Append `## Billing deadlines` with seven `<Mistake>` entries. Each has
  `rightSpecId="billingTimeline"`, and each `rightCode` imports from `@northguild/gmt/intermodal`
  (and `@northguild/gmt/utc` where needed):

| # | severity | title | wrongCode | rightCode |
| --- | --- | --- | --- | --- |
| M1 | high | Hard-coding a deadline window | `const WINDOWS = { issueDays: 30, disputeDays: 30, resolutionDays: 30 }; // for every contract` then the 14/14/45 case run with it (V19) | V7 |
| M2 | high | Counting working days where the window is in calendar days | the weekday loop (N4): `"2026-04-10"` | V1 |
| M3 | high | Anchoring a re-bill on the charge | V17 | V6 |
| M4 | medium | Moving the anchor to a reissue date | V20 (anchor on the first invoice's date: `true`) | V21 (the anchor the regime names: `false`) |
| M5 | high | Reducing an instant to its UTC date | `"2026-04-01T02:30:00Z".slice(0, 10)` then V3 | V14, then V2 |
| M6 | medium | Treating the deadline day as late | `"2026-03-31" < "2026-03-31"; // false` | V2 |
| M7 | medium | A dispute request dated before its invoice | V10 and V22 (`null`) | V4 |

Descriptions are one or two sentences and name no jurisdiction. M4's description: "The anchor is
the date the regime or contract names, such as the last date a charge accrued. Correcting or
reissuing an invoice does not move it. Whether a reissue opens a new window is the regime's rule,
not GMT's, so pass the anchor that rule names." M6's title uses "late" because it describes the
naive reading. This is allowed on the mistakes page, not in the widget.

### A4. Indexes (modify)

- `guides/industries/index.mdx`: a third Layers bullet after the free-time one:
  `- [Intermodal: billing deadlines](./intermodal-billing-deadlines/) — the last date to issue,
  dispute and resolve a demurrage or detention invoice, counted in calendar days from a date you
  name, with every window a number you pass. Built on the free-time layer's charged dates.`
  Add three Scenarios bullets after "Detention is not demurrage", using the three titles from A2.
- `guides/index.mdx`: in the Industries table row, change "free time and demurrage" to "free time
  and demurrage, billing deadlines". Keep the table aligned.
- `mistakes/index.mdx`: under `## Intermodal`, add
  `- [Billing Deadline Mistakes](/mistakes/intermodal/#billing-deadlines)` after the existing
  link.

---

## B. Law removal from INT-12's shipped docs and widget copy

`grep -rnE "46 CFR|CFR|FMC|US invoice|US trades|US shape|United States|California|Cal\. Bus|§ ?22928|NVOCC" apps/dox/src/content/docs apps/dox/src/lib apps/dox/worker --exclude-dir=reference`
returns these hits on the current tree. A wider read of the same files for `\bUS\b|India|law`
found the extra rows marked (w). Rewrite each one to match the rewritten library JSDoc in
`chargeableDays.ts`, `freeTimeExpiry.ts` and `demurrageClock.ts`, and the README § "Free time and
demurrage":

| File:line | Now | Replacement |
| --- | --- | --- |
| `guides/industries/intermodal-free-time-and-demurrage.mdx:90-92` (w) | "The words differ in US usage … some US tariffs … in India 'demurrage' usually means …" | "Some tariffs differ in words, not events: MSC USA calls the in-terminal container charge "detention" and the out-of-terminal one "per diem". The scope names here follow the global usage." (the `demurrageClock` JSDoc wording; the India sentence is dropped) |
| same file `:164-167` | "Outside the United States most tariffs count free time in calendar days … Many US tariffs, and some elsewhere, count free time in working days" | "Many tariffs count free time in **calendar days**, so a weekend burns two free days while the terminal is shut. Others count it in **working days**, the days the terminal is open, and then the terminal's own weekend and holidays decide which days count." (rest of paragraph unchanged) |
| same file `:266-274` | "Outside the US both are mostly calendar days … the usual US shape … California law requires it … (Cal. Bus. & Prof. Code § 22928)" | "How the days after free time are charged is a separate tariff term from how free days are counted. Many tariffs count both in calendar days. Where a tariff grants free time in working days, the days after it are mostly charged as calendar days, weekends and holidays included ("Once free time expires ... charged on calendar days"). That is `basis: "working", chargeBasis: "calendar"`. Some tariffs charge working days only, for free time and charges alike, so neither counts a day the gate is closed or a holiday: both set to `"working"`. The two differ by every closed day after expiry, so `chargeBasis` has no default either." |
| same file `:323-333` `## The US invoice rule` | the whole section | Replace with `## The dates an invoice can list` (anchor `#the-dates-an-invoice-can-list`, which A1 links to). One sentence: an itemised demurrage or detention invoice can list the free time allowed, when it started and ended, the date the clock started, and each date charged. Each one is your input or an output here. Then the table below. Then the forward link: "The deadlines around the invoice, the last date to issue it, to dispute it and to resolve the dispute, are counted from these dates by `billingTimeline`: see [Intermodal: Billing Deadlines](/guides/industries/intermodal-billing-deadlines/)." Drop "not part of this layer". |
| `scenarios/demurrage-across-a-weekend.mdx:3` (w) | description "…and the invoice has to name the date." | "…and `chargedDates` names the date." |
| same file `:17` | "(on US trades the invoice must print those dates, under 46 CFR 541.6)" | "(the dates an itemised invoice can list)" |
| same file `:44-46` | "the usual shape where free time is in working days … as California law requires at its terminals" | "…the most common shape where free time is in working days, …" and "Change `chargeBasis` to `"working"`, as some tariffs do, and only the 20th, 21st and 24th are." |
| `mistakes/intermodal.mdx:111` | "…the usual US shape, most tariffs then charge every calendar day …; California law and some tariffs charge working days only…" | "How free days are counted and how charged days are counted are separate tariff terms. Where a tariff grants free time in working days, most then charge every calendar day, weekends and holidays included; some tariffs charge working days only. Charging on the free-time basis under-bills the first and over-bills the second, so chargeBasis has no default." |
| `tools/free-time-ledger.mdx:15` | "outside the US both are mostly calendar days, and where free time is in working days (the usual US shape) …" | "many tariffs count both in calendar days, and where a tariff grants free time in working days the days after it are mostly charged as calendar days; some tariffs charge working days only." |
| `src/lib/free-time-ledger.ts:135` (`working-days` description) | "The usual US shape: free time counted in working days, then every calendar day charged. …" | "Free time counted in working days, then every calendar day charged, the most common shape where free time is in working days. The weekend does not burn free time, but Juneteenth and the next weekend are billed once free time has ended." |
| `src/lib/free-time-ledger.ts:149` (`terminal-holiday` label) | "Working days throughout (California)" | "Working days throughout" |
| `src/lib/free-time-ledger.ts:151` (`terminal-holiday` description) | "…as California law requires at its terminals: …" | "The same dwell on a tariff that charges working days only: the Juneteenth holiday and the weekend after expiry are not charged, so three days are billed instead of six." |
| `src/lib/dox-tools.ts:192` (`showFreeTimeLedger` args) | "chargeBasis (… outside the US both are mostly calendar days; where free time is in working days, the usual US shape, most tariffs charge calendar days, California terminals working days; ask …)" | "chargeBasis (calendar \| working: how days after free time are charged; many tariffs count both in calendar days, and where free time is in working days most charge calendar days after it, some working days only; ask if the reader did not say)" |

The table that replaces "The US invoice rule":

| What an itemised invoice can list | Where it comes from |
| --- | --- |
| Free time allowed, in days | `freeDays`, your tariff term |
| First free day | `freeTimeExpiry(...).freeTimeStart` |
| Last free day | `freeTimeExpiry(...).lastFreeDay` |
| The date the clock started (discharge, or the availability date where the tariff starts there) | your `discharged` or `available` event's `at`, reduced to the terminal's local date |
| Days charged, and which | `chargeableDays(...).chargeableDays` and `chargedDates` |

Notes:

- Preset **ids** `working-days` and `terminal-holiday` stay. Only labels and descriptions change,
  so permalinks and tests keep working.
- "Juneteenth" stays. It names a holiday date in example data, matching the library README's
  `juneteenth` calendar, and names no law.
- The generic "No regulation or industry standard fixes …" sentences stay. They name no law.
- **Permalink bug fixed with these edits:** `scenarios/demurrage-across-a-weekend.mdx` and
  `scenarios/free-time-start-day.mdx` link the Free Time Ledger with `"freeDays":3`, a number.
  `seedFromLocation` drops integers outside 1900–2100, so the key is lost. It only works because
  `readArgs` falls back to the first preset's `"3"`. Change both to `"freeDays":"3"`
  (`%22freeDays%22%3A%223%22`). The test in C6 catches this class of bug.

---

## C. The Billing Deadlines widget

This follows the Free Time Ledger split exactly. Paths are under `apps/dox/`. The root class is
exactly `gmt-billing gmt-widget`, the first thing in the template, with no other attribute on
that `<div>`, because `html-diff.mjs` `widgetSubtree` matches the literal string.

### C1. `src/lib/billing-deadlines.ts` (pure: no DOM, no gmt import)

It may import `@js-temporal/polyfill` for drawing only, as `free-time-ledger.ts` does. It never
computes a deadline. The strip draws the library's result.

- `BillingDeadlinesArgs`: `anchorOn?`, `invoiceIssuedOn?`, `requestReceivedOn?`,
  `agreedResolutionOn?` (strings); `issueDays?`, `disputeDays?`, `resolutionDays?`
  (`number | string`: numbers from the chat, strings from a permalink).
- `BillingState`: all seven fields as strings, which is what the DOM holds.
- `BILLING_PRESETS`, in this order. Labels are **numbers only**. Each is exactly one JSDoc
  `@example` in `billingTimeline.ts`:

  | id | label | dates | windows | JSDoc example |
  | --- | --- | --- | --- | --- |
  | `thirty-day-30` | 30-day windows, invoice on day 30 | anchor `2026-03-01`, invoice `2026-03-31` | 30/30/30 | V2 |
  | `thirty-day-31` | 30-day windows, invoice on day 31 | anchor `2026-03-01`, invoice `2026-04-01` | 30/30/30 | V3 |
  | `thirty-rebill` | 30-day windows, re-bill counted from the invoice received | anchor `2026-03-10`, invoice `2026-04-05` | 30/30/30 | V6 |
  | `forecast` | 30-day windows, no invoice yet | anchor `2026-03-01` | 30/30/30 | V1 |
  | `contract-14-14-45` | 14/14/45 windows, with a dispute | anchor `2026-03-01`, invoice `2026-03-05`, request `2026-03-18` | 14/14/45 | V7 |

  The descriptions are one or two sentences each. They state what the numbers show, use the
  verdict vocabulary only, and name no jurisdiction.
- `CUSTOM_PRESET_ID = "custom"`.
- `readArgs(args)`: a finite integer number becomes `String(n)`. A non-empty string is kept as
  typed. Anything else becomes `""`. **No window falls back to a preset.** An absent optional
  date becomes `""`.
- `matchPreset(state)`: compares all seven fields, trimmed.
- `datesOf(state)` and `windowsOf(state)`: the exact objects passed and printed. Key order is
  `anchorOn, invoiceIssuedOn, requestReceivedOn` and
  `issueDays, disputeDays, resolutionDays, agreedResolutionOn`, as in the JSDoc. A blank optional
  date is **omitted** (the library returns `null` for `""`: V23). A blank window is omitted. A
  non-blank window is `Number(text.trim())`, passed and printed as is (`30.5` or `NaN`), so the
  printed call is the real call.
- `callSource(state)`: `[html, plain]` for `renderCallLine`, the `optionsSource` pattern from
  `free-time-ledger-mount.ts`. For every preset, `plain` equals the JSDoc call text verbatim.
- `formatDeadlines(r)`: one key per line,
  `{ invoiceDeadline: "…",\n  issuedByDeadline: …,\n  disputeDeadline: …,\n  requestedByDeadline: …,\n  resolutionDeadline: … }`.
  Replacing each `\n` plus its indent with one space gives the JSDoc result literal exactly.
- `verdictText(kind, date, value)`, the only verdict strings:
  - issued: `true` → `Invoice issued ${date}: on or before the deadline`; `false` →
    `Invoice issued ${date}: after the deadline`; `null` →
    `No invoice date yet: this is a forecast`.
  - requested: `true` → `Request received ${date}: on or before the deadline`; `false` →
    `… : after the deadline`; `null` → `No request date yet`.
- `dayStrip(state, result)`: returns `null` when `result` is `null`. Otherwise it is a day strip
  wrapped by ISO week (Monday first), from `min(anchorOn, invoiceIssuedOn)` to the latest of the
  non-null deadlines and the given dates.
  - Each date cell carries its marks and its lanes. Marks are what the caller supplied: `anchor`
    (day 0), `invoice`, `request`. Lanes are windows from the result: lane 1 is the issue window,
    from `anchorOn` to `invoiceDeadline`. Lane 2 is the dispute window, from `invoiceIssuedOn` to
    `disputeDeadline`, and exists only when that is non-null. Lane 3 is the resolution window,
    from `requestReceivedOn` to `resolutionDeadline` (the agreed date when given), and exists
    only when that is non-null. A lane's state on a date is `zero` (day 0), `in` (days 1 to N−1),
    or `deadline` (day N). A 0-day window marks its only cell `deadline`. Each lane cell carries
    its day ordinal for the label.
  - Days outside the span in the first and last weeks are padding cells.
  - **Cell cap and collapse:** `MAX_STRIP_CELLS = 120`. When the padded span is over 120 cells,
    keep only the first week, the last week, and every week that contains a mark or a lane's day
    0 or deadline. At most seven key dates plus two ends gives at most 9 weeks, or 63 cells.
    Every run of dropped weeks becomes one gap row with `{ from, to, days }`. `summary` states the
    collapse: `"${total} days from ${start} to ${end}. Weeks with no marked date or deadline are
    collapsed: ${n} days not drawn."`. With no collapse, it is `"${total} days from ${start} to ${end}."`.
- `NULL_REASON_TEXT` and `explainNull(state, v: { isValidDate })`, in the library's check order
  (`layOutDeadlines`: `readDates`, then `readWindows`, then `agreedAfterRequest`, then range):
  `invalid-anchor`, `invalid-invoice`, `invalid-request`, `request-without-invoice`,
  `request-before-invoice`, `missing-window` (naming which: "issueDays is missing. Windows have
  no defaults: type the number your tariff or contract sets."), `invalid-window` ("… must be a
  whole number of days, 0 or more."), `invalid-agreed`, `agreed-before-request`, `out-of-range`.
  Each invalid-date reason says deadlines are dates, and that an instant must first be reduced
  to the billing party's local date.

### C2. `src/lib/billing-deadlines.test.ts`

Covers `readArgs` (numbers and strings, no window default, junk becomes `""`), `matchPreset`
(every preset and custom), `datesOf` and `windowsOf` (blank optionals and windows omitted,
`NaN` printed), `formatDeadlines`, `verdictText`, and `dayStrip`. For `dayStrip`: padding;
lanes and day ordinals for V7; the invoice-before-anchor case (V24); a 0-day window; and
`issueDays: 3650` collapsing, with ≤ 120 cells, a gap row, and a summary stating the days not
drawn. For `explainNull`: each reason. Every expected value is from section 9.

### C3. `src/lib/billing-deadlines-mount.ts`

- `renderBillingDeadlinesTemplate(args = {})`: seeded when `args.anchorOn !== undefined`, else
  the first preset. Every interpolation goes through `escapeAttr` or `escapeHtml`. Layout, with
  headings numbered as in the Free Time Ledger:
  1. `<h4>1. Set the dates and the windows</h4>`: the preset `<select>` (Custom option first, as
     in the Free Time Ledger), the preset description, a "Dates" group and a "Windows, in
     calendar days" group. Every input has a visible `<label>`: "Anchor date (day zero)",
     "Invoice issued on (optional)", "Request received on (optional)", "Issue window (days)",
     "Dispute window (days)", "Resolution window (days)" and "Agreed resolution date (optional)".
     Date inputs are `type="text" spellcheck="false" autocomplete="off"` with the placeholder
     `YYYY-MM-DD`. They are not `type="date"`, which blanks an invalid value and so cannot teach
     "an instant passed as a date returns null". Window inputs are
     `type="number" min="0" step="1" inputmode="numeric"` with **no placeholder**.
  2. `<h4>2. The chain</h4>`: the verdict list (`data-role="verdicts"`, with `verdict-issued` and
     `verdict-requested` items and `aria-live="polite"`), a deadlines line (`deadlines`), the strip
     (`strip`, `role="list"`), `strip-summary`, a static legend (`legend`), and `reason-aside`.
     Add a static `liability-note`: "These are date comparisons. What follows from a date after a
     deadline is for you and the terms you bill under: GMT computes dates, not liability."
  3. `<h4>3. What <code>billingTimeline</code> returns</h4>`: `codeFrameHtml("billing")`, which
     gives `call-billing` and `copy-billing`, and then `<output data-role="billing-output">`.
- `mountBillingDeadlines: MountFn<BillingDeadlinesArgs>`: load both modules. On failure, throw
  `new WidgetLoadError(cause)`. After the await, check `signal.aborted` and return
  `onceDestroy(() => {})`. Then `applyArgs` (a no-op without `anchorOn`), wire delegated
  `input`/`change` listeners on the root, `wireCopyButtons`, and render.
  - Render `renderCallLine`.
  - Render the output with `renderWidgetOutput(out, formatDeadlines(r), "live")`, or
    `(out, "NO SIGNAL", "sentinel")` for `null`, with `renderAside(reasonEl, "caution", …)`
    taking its text from `explainNull`.
  - Render the verdicts, the deadlines line and the strip.
  - Typing sets the preset `<select>` from `matchPreset`. Choosing a preset writes all seven
    fields, including blanking the optional ones.
- The strip markup: each date cell is
  `<div role="listitem" class="gmt-billing-cell" data-date data-marks data-lanes aria-label="…">`.
  Its visible content is the day of the month (with `1 Mar`-style month text on the first drawn
  cell and on each 1st), mark badges `A`, `I`, `R`, deadline badges `1`, `2`, `3`, and three lane
  bars below the text.
  - The `aria-label` is a full sentence, for example
    `Tue 31 Mar 2026: invoice issued; issue window day 30, invoice deadline; dispute window day 0`.
  - Padding cells are `aria-hidden="true"` and empty.
  - A gap row is a `listitem` spanning 7 columns, with visible text `… ${days} days not drawn …`
    and an `aria-label` giving its dates.
  - Month and weekday names come from fixed English arrays, as `WEEKDAY_NAMES` in the Free Time
    Ledger does. The widget does not use `Intl`.
- Permalink state (`onceDestroy`'s second argument): **strings only**, and only non-blank fields.
  Because `seedFromLocation` drops empty strings, a blank window round-trips as blank.

### C4. `src/lib/billing-deadlines-mount.test.tsx` (jsdom, against the real gmt)

- `REQUIRED_ROLES`: `preset`, `preset-description`, `anchor-on`, `invoice-issued-on`,
  `request-received-on`, `issue-days`, `dispute-days`, `resolution-days`,
  `agreed-resolution-on`, `verdicts`, `verdict-issued`, `verdict-requested`, `deadlines`,
  `strip`, `strip-summary`, `legend`, `reason-aside`, `liability-note`, `call-billing`,
  `copy-billing` and `billing-output`. All must be present in the template.
- `EXPECTED`: a map from preset id to `[call, result]`, **copied verbatim from the
  `billingTimeline.ts` JSDoc** (section 9, V1–V3, V6, V7). Then
  `it.each(BILLING_PRESETS)`: choose the preset and assert all of the following.
  - `copy-billing`'s `dataset.copyText` equals the call.
  - The output text, with each newline and indent collapsed to one space, equals the result.
  - The verdict texts equal `verdictText` for the result.
  - The cells marked `deadline` in each lane equal the result's deadline fields.
- It types the V4 and V5 inputs (request on the deadline; the agreed date) and asserts those
  JSDoc literals.
- **No defaults:** mounting with `{ anchorOn: "2026-03-01", issueDays: "30" }` leaves dispute and
  resolution blank, prints a call without them, shows `NO SIGNAL` and gives the
  `missing-window` reason naming `disputeDays`.
- A blank agreed date is omitted from the call and the output is live (V1), never `null`.
- For each `explainNull` reason, the real `billingTimeline` returns `null` for that state.
- A forbidden-word check: `/\b(timely|untimely|late|void|payable|compliant)\b/i` finds nothing
  in the template, every preset label and description, every `NULL_REASON_TEXT` value, and
  every verdict and output rendered across the presets.
- The permalink round-trips: for every preset, `getPermalinkState()` holds only strings,
  `encodeWidgetPermalink("billing", state)` → `seedFromLocation("billing", search)` keeps every
  key, and remounting renders the same output.
- `issueDays: "3650"` gives ≤ 120 date cells, a gap row, and a summary stating the collapse.
- An aborted mount is inert, and destroying twice is safe.

### C5. `src/components/BillingDeadlines.astro`

Copy `FreeTimeLedger.astro`. Use `renderBillingDeadlinesTemplate()`,
`seedFromLocation("billing")`, `.gmt-billing` and `showUnavailable` on catch.

### C6. `src/content/docs/tools/billing-deadlines.mdx`

Front matter: `title: Billing Deadlines`, and a description with no jurisdiction. Content:

- An intro in about three short paragraphs. The deadlines are dates, counted in calendar days
  from day zero, and the deadline day is inside the window. The windows are yours and none is
  defaulted: a blank one is left out of the call, and the result says why it is `null`. Lane 1
  is the issue window, lane 2 the dispute window and lane 3 the resolution window. Each is drawn
  with its own pattern and number, and each date is lettered. The outputs are the real
  [`billingTimeline`](/reference/intermodal/calculate/billingTimeline/) call.
- `<BillingDeadlines />`.
- "**Worth trying:**" with P2 (the 30-day windows, invoice on day 31) and P4 (the 14/14/45
  contract with the request moved to 20 March).
- A Reference paragraph linking `billingTimeline`, `convertUtcToPlainDate` and
  [Intermodal: Billing Deadlines](/guides/industries/intermodal-billing-deadlines/).

**Permalinks, strings only** (`?w=billing&wa=` plus the URL-encoded JSON):

| id | JSON |
| --- | --- |
| P1 | `{"anchorOn":"2026-03-01","invoiceIssuedOn":"2026-03-31","issueDays":"30","disputeDays":"30","resolutionDays":"30"}` |
| P2 | `{"anchorOn":"2026-03-01","invoiceIssuedOn":"2026-04-01","issueDays":"30","disputeDays":"30","resolutionDays":"30"}` |
| P3 | `{"anchorOn":"2026-03-01","invoiceIssuedOn":"2026-04-05","issueDays":"30","disputeDays":"30","resolutionDays":"30"}` |
| P4 | `{"anchorOn":"2026-03-01","invoiceIssuedOn":"2026-03-05","requestReceivedOn":"2026-03-20","issueDays":"14","disputeDays":"14","resolutionDays":"45"}` |
| P5 | `{"anchorOn":"2026-03-01","invoiceIssuedOn":"2026-03-05","requestReceivedOn":"2026-03-18","issueDays":"14","disputeDays":"14","resolutionDays":"45"}` |

Add one test to `src/lib/widget-permalink.test.ts`. It globs every `.mdx` under
`../content/docs/` except `reference/` (`import.meta.glob(..., { query: "?raw", eager: true })`),
extracts each `?w=<kind>&wa=<…>` link, and asserts that `seedFromLocation(kind, search)` keeps
**every** key of the decoded args. This fails on the two `freeDays: 3` links until B fixes them.

### C7. `src/styles/gmt-billing-deadlines.css`

Register it in `astro.config.mjs` `customCss` directly after `gmt-free-time-ledger.css`, with the
comment `// Billing Deadlines widget (INT-58)`.

- The strip is `display: grid; grid-template-columns: repeat(7, minmax(2.5rem, 1fr))` with a
  weekday header row. At 390 px wide, 7 × 2.5 rem fits inside the 16 px gutters, so there is no
  horizontal page scroll.
- Put `container-type: inline-size` on `.gmt-billing`, and write the narrow-width rules as
  `@container` queries, because the `/dox` rail is narrow on a wide viewport.
- **Colour is never the only signal.** Each lane bar has a fill token **and** a border style:
  lane 1 `solid`, lane 2 `dashed`, lane 3 `dotted`. The deadline cell's bar ends in a cap, and
  the cell shows the lane's number badge. Marks are letters. The legend spells out every letter,
  number and pattern. Lane bars sit **below** the day text, never behind it, so text contrast
  stays ≥ 7:1.
- The verdicts use body-copy colour in both states, with no success or error colour, so a verdict
  never reads as a compliance finding. Amber is only for `gmt-playground-sentinel`.
- No `transition` or `animation` on cells, lanes or verdicts. Values the reader is reading never
  animate.
- In `src/styles/gmt-a11y.css`, inside the existing `@media (forced-colors: active)` block, next
  to the `.gmt-freetime-*` rules, add:
  `.gmt-billing-lane { forced-color-adjust: none; border-color: CanvasText; background: Canvas; }`,
  `.gmt-billing-lane--in, .gmt-billing-lane--deadline { background: Highlight; }`,
  `.gmt-billing-badge { forced-color-adjust: none; color: CanvasText; outline: 1px solid CanvasText; }`.
  Gradients are dropped under forced colours, so the border styles are what keep the lanes
  apart.
- Light theme: follow whatever the Free Time Ledger sheet does. Use tokens only.

### C8. Chat registration

Each item is guarded by the named test.

- `src/lib/dox-tools.ts`: add
  `export const plainDateSchema = z.string().min(10).max(64);`, with a comment saying it checks
  shape, not validity. An invalid date is the widget's sentinel to show. (`dateTimeSchema`
  is `min(4)` and stays as it is.) Add
  `export const showBillingDeadlinesInput = z.object({ anchorOn: plainDateSchema, invoiceIssuedOn: plainDateSchema.optional(), requestReceivedOn: plainDateSchema.optional(), issueDays: z.number().int().min(0).max(3650), disputeDays: …, resolutionDays: …, agreedResolutionOn: plainDateSchema.optional() })`.
  Windows are **required**, as the library requires them.
  - Add it to `DoxToolName`, `DOX_TOOL_INPUTS`, `DOX_TOOL_DOCS` (index 6), `DOX_TOOLS`
    (`DOX_TOOL_DOCS[6].purpose`) and `ENABLED_TOOL_NAMES`.
  - Change the comment "All six are enabled" to "Every tool is enabled".
  - Doc text, with no jurisdiction:
    - purpose: "The deadline chain around a demurrage or detention invoice on a day strip: the
      last date to issue it, to dispute it and to resolve the dispute, each counted in calendar
      days by billingTimeline, with every window a number the reader supplies."
    - when: "the reader asks for the last date to issue, dispute or resolve a demurrage or
      detention invoice, or whether an invoice or dispute date falls on or before such a
      deadline"
    - args: "anchorOn (ISO date the issue window counts from: the last date a charge accrued,
      or for a re-bill the issuance date of the invoice received), invoiceIssuedOn (optional ISO
      date), requestReceivedOn (optional ISO date; needs invoiceIssuedOn), issueDays,
      disputeDays, resolutionDays (whole numbers of calendar days from the reader's tariff or
      contract; never assume them: ask if the reader did not say), agreedResolutionOn (optional
      ISO date the parties agreed). Dates only: reduce a date-time to the billing party's local
      date."
- `worker/tools.ts`: add `showBillingDeadlines: tool({ description: docFor("showBillingDeadlines"), inputSchema: showBillingDeadlinesInput, execute: () => accept("billing-deadlines") })`.
  There are no zones to check. An invalid date is taught by the widget's sentinel.
  (`tools.test.ts`)
- `src/components/ask/widget-registry.ts`: add
  `billingEntry = defineWidget<BillingDeadlinesArgs>({ title: "Billing deadlines", kind: "billing", parse: …safeParse…, load: () => import("~/lib/billing-deadlines-mount").then((m) => ({ renderTemplate: (_id, args) => m.renderBillingDeadlinesTemplate(args), mount: m.mountBillingDeadlines })) })`.
  It has no `validate`. Import only the **type** from the mount module. Add it to
  `WIDGET_REGISTRY`. (`widget-registry.test.ts`, `widget-graph.test.ts`)
- `src/lib/widget-permalink.ts`: add `"billing"` to `WidgetKind`, and
  `billing: "/tools/billing-deadlines/"` to `WIDGET_PAGE_PATHS`. (`widget-permalink.test.ts`)
- `src/lib/chat-constants.ts`: a `CHAT_STARTERS` entry. The text is under 110 characters,
  contains a digit and names no tool:
  "Charges last accrued 1 March 2026, every window 30 days: is an invoice dated 1 April by the
  deadline?" Its args are
  `{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-04-01", issueDays: 30, disputeDays: 30, resolutionDays: 30 }`,
  with a comment that the question names all three windows. (`chat-starters.test.ts`)
- `src/lib/widget-load-error.test.tsx`: import it and add
  `["billing deadlines", () => renderBillingDeadlinesTemplate(), mountBillingDeadlines as MountFn<never>]`
  to `MOUNTS`. This list is manual, and nothing fails if the entry is missing.
- `src/components/ask/widget-graph.test.ts`: add `"lib/billing-deadlines.ts"` to the `heavy`
  list. This list is also manual.
- `scripts/html-diff.mjs` `PAGES`: add
  `{ path: "tools/billing-deadlines", widget: "gmt-billing gmt-widget" }`.
- `scripts/visual-snapshot.mjs` `PAGES`: add
  `{ slug: "tool-billing-deadlines", path: "/tools/billing-deadlines/" }` after the free-time
  entry.
- `optimizeDeps.entries` already globs `src/lib/**/*.ts`. No change is needed.

### C9. `context/dox/built.md`

Present tense, no history.

- Tier 2 teaching widgets: append the Billing Deadlines (INT-58). It is a day strip wrapped by
  ISO week, with the three windows as numbered, patterned lanes. It draws the deadlines
  `billingTimeline` returns and computes none. Past 120 cells it collapses weeks with no marked
  date and says so.
- Tier 2 tool pages: add `/tools/billing-deadlines/`.
- "Every `.astro` shell — the five teaching widgets, …": drop the count ("every teaching
  widget").
- Tier 6: change "Six tools" to "Seven tools" and add the
  `showBillingDeadlines({ anchorOn, invoiceIssuedOn?, requestReceivedOn?, issueDays, disputeDays, resolutionDays, agreedResolutionOn? })`
  bullet: the windows are required, as the library requires them, and a blank window stays
  blank, never defaulted. Its permalink carries every window as a string, because
  `seedFromLocation` drops other numbers.

Do not add a row to `context/dox/tracker.md`. INT-12 added none.

---

## D. Definition of done (`dox-tester`: run each line literally)

Prefix every shell with `eval "$(fnm env)" && fnm use`. `$WT` is
`/Users/craigcurtis/workbench/northguild/gmt.worktrees/260-int-58-fmc-demurrage-and-detention-billing-timelines-46-cfr-541`,
and `$SP` is the session scratchpad.

1. `pnpm -C $WT --filter @northguild/gmt build`, then `pnpm -C $WT --filter @gmt/dox test`
   passes. It includes the new tests, `widget-registry`, `chat-starters`, `widget-permalink`
   (with the content-permalink test), `widget-graph`, `client-graph`, `widget-load-error` and
   `tools.test.ts`.
2. `pnpm -C $WT --filter @gmt/dox check` passes (`astro check`, 0 errors). Then
   `pnpm -C $WT --filter @gmt/dox lint` passes.
3. `node $WT/scripts/api-surface.mjs check` exits 0. It executes every import-bound
   `call // result` in the new and changed MDX.
4. **Every MDX result against dist.** Write section 9's script to `$SP/int58-values.mjs` and run
   `node $SP/int58-values.mjs` from `$WT`. Every line must print `ok`. Then list every
   `// result` comment in the eight changed or new content pages and the five new ones, and
   confirm each one matches a row of section 9. Any result not in the table fails.
5. **Scenario index.** After `pnpm -C $WT dox:generate`, the generated `scenarios/index.mdx`
   lists the three new titles.
6. **Internal links.** After `pnpm -C $WT --filter @gmt/dox build`, run the script in section 10
   over the built pages of every new and changed content page. It prints nothing and exits 0.
   Check the anchors by hand: `#the-dates-an-invoice-can-list`, `#billing-deadlines` and
   `#which-day-is-day-one-firstday` exist as `id=` in the target HTML.
7. **Structural and pixel gates against a clean `main` baseline** (built.md: "both need a
   baseline captured from a clean `main` build"). `main` is `d896085`, the branch's base. The
   branch's work is all uncommitted, so a detached worktree at `main` is clean. It can be
   captured at any time.

   ```sh
   BASE=$SP/dox-main
   git -C $WT worktree add --detach "$BASE" main
   mkdir -p "$BASE/apps/dox/src/generated"
   cp $WT/apps/dox/src/generated/upstream-filings.live.json "$BASE/apps/dox/src/generated/"   # no network, same upstream data
   pnpm -C "$BASE" install --frozen-lockfile
   pnpm -C "$BASE" --filter @northguild/gmt build && pnpm -C "$BASE" --filter @gmt/dox build
   (cd "$BASE/apps/dox" && node scripts/html-diff.mjs capture $SP/html-baseline && pnpm visual:before)
   rm -rf $WT/apps/dox/.visual/before && mkdir -p $WT/apps/dox/.visual && cp -R "$BASE/apps/dox/.visual/before" $WT/apps/dox/.visual/before
   lsof -iTCP:48173 -sTCP:LISTEN   # must print nothing before the branch run
   pnpm -C $WT --filter @northguild/gmt build && pnpm -C $WT --filter @gmt/dox build
   (cd $WT/apps/dox && node scripts/html-diff.mjs compare $SP/html-baseline; pnpm visual:after; pnpm visual:diff)
   git -C $WT worktree remove --force "$BASE"
   ```

   **Expected `html-diff`** (it exits 1 because of the Free Time Ledger, deliberately):
   - `+ tools/billing-deadlines — new widget page, no baseline`;
   - `✗ tools/free-time-ledger — WIDGET markup changed`, where the first divergence is the
     `working-days` or `terminal-holiday` preset `<option>` label or the description text (B).
     Any other divergence fails;
   - `~` or `✓` for every other page. `~` comes from the sidebar's persist hash.

   **Expected `visual:diff`**:
   - `MISSING (no before)` for the four `tool-billing-deadlines-*` shots;
   - `✗` allowed only for these, each confirmed by opening the before and after PNGs and
     finding nothing else changed:
     - every `tool-*` page at desktop (a new "Billing Deadlines" row under Tools in the open
       sidebar);
     - `tool-free-time-ledger` (the copy in B);
     - `dox` (the seventh starter pill and the generated corpus counts);
     - any page whose only change is the library's new reference entries or published counts,
       which a `main` baseline lacks.
   - Any other `✗` is a regression. INT-58.md's "visual:diff shows changes on the new page only"
     cannot hold (see Risks R2).
8. **Keyboard-only pass** (no mouse) on `/tools/billing-deadlines/` and in the `/dox` rail
   through the starter pill:
   - Tab reaches the preset select, all seven inputs and the copy button, in visual order, and
     nothing inside the strip.
   - Arrow keys change the preset, and the verdicts, strip, call and output update.
   - Typing `2026-04-01` into the invoice field turns the issued verdict to "after the deadline".
   - Clearing the dispute window shows `NO SIGNAL` and the `disputeDays` reason.
   - The focus ring is visible on every control in both themes.
9. **`prefers-reduced-motion: reduce`** (Playwright `emulateMedia` or DevTools): nothing on the
   tool page animates or transitions when a preset changes. **`forced-colors: active`**
   (DevTools emulation): the three lanes stay distinguishable by border style, and the badges
   and the verdict text stay readable.
10. **Contrast**, measured on the rendered tool page in both themes: day numbers, badges,
    verdicts and the output are ≥ 7:1.
11. **Phone width**: at 390×844 the tool page has no horizontal scroll, and the 7-column strip
    fits.
12. **Droppability**: in the build, the `/tools/billing-deadlines/` page's scripts pull in no
    `zod`, `ai` or `dox-tools` chunk. Check with `grep -l "dox-tools\|zod" dist/_astro/*.js` for
    the chunks the page references. A reference page loads no React.
13. **Final law grep.** Run
    `grep -rnE "46 CFR|CFR|FMC|US invoice|US trades|US shape|United States|California|Cal\. Bus|§ ?22928|NVOCC|OSRA|Shipping Act|541\.[0-9]" $WT/apps/dox/src/content/docs $WT/apps/dox/src/lib $WT/apps/dox/worker $WT/context/domination/issues/INT-58.md`.
    Its only allowed output is the pre-existing `26 CFR 1.441-2` line on the generated
    `reference/calendar/calculate/getFiscalPeriod.mdx`, which is not introduced by this story
    (see Blocked on the library pipeline). Then run
    `grep -rniE "\bUS\b|India|statut|jurisdiction" $WT/apps/dox/src/content/docs/{guides/industries,scenarios,mistakes,tools} $WT/apps/dox/src/lib/{free-time-ledger,billing-deadlines,dox-tools,chat-constants}*.ts`
    and read every hit. The only allowed hits are the `MSC USA` carrier name and none else.
    The forbidden verdict words (section 0) must not appear in `billing-deadlines*.ts`,
    `tools/billing-deadlines.mdx` or the `showBillingDeadlines` doc.
14. `pnpm -C $WT stats:sync`, then `pnpm -C $WT run validate` exits 0.
15. `git -C $WT status --short` shows only the files in section 11 plus the generated files that
    were already modified, and nothing staged.

---

## E. Risks and plan corrections

- **R1. `seedFromLocation` drops numbers outside 1900–2100 and empty strings.** A window sent as
  a number in a permalink is silently lost. Because windows have no defaults, the widget would
  then open with a blank window and a sentinel. *Resolution:* permalinks carry strings (C6),
  `readArgs` accepts both, and the content-permalink test (C6) guards every MDX link. The same
  bug exists today in two Free Time Ledger scenario links, hidden by a fallback. They are fixed
  in B.
- **R2. "visual:diff shows changes on the new page only" (INT-58 Verification) cannot hold.**
  The Tools sidebar group is autogenerated, and it opens on every `/tools/` page, so the new
  entry appears on each of them at desktop. The Free Time Ledger copy changes (B). `/dox/` gains
  a starter pill. A `main` baseline also lacks the library's new reference entries.
  *Resolution:* the expected-diff list in D7. The INT-58.md Verification line should be
  corrected at close-out to say "visual:diff changes only where section D7 of the dox spec
  expects".
- **R3. The Free Time Ledger's widget markup changes.** Its preset labels are server-rendered, so
  `html-diff` reports ✗ and exits 1. *Resolution:* this is expected. The tester confirms the
  divergence is only the label and description text.
- **R4. Plan: "naive `new Date` + 30 × 86400e3 across the March DST change lands a day off".**
  This is imprecise. Across spring-forward, the sum lands at 01:00 on the same date, so read as
  a date it is right. It goes wrong when compared as an instant (N1), when read in another zone
  than the one it was built in, or across fall-back (a New York 15 October anchor lands at
  23:00 on 13 November). *Resolution:* the scenario uses the verified instant comparison and
  explains both effects.
- **R5. Plan: "`dayStrip` capped like `dwell-ledger.ts` `MAX_CELLS = 120` (collapse the middle)".**
  `dwell-ledger.ts` does not collapse: past 120 cells it draws nothing. *Resolution:* this
  widget has its own `MAX_STRIP_CELLS = 120` and a stated collapse by week (C1), at most 63
  cells when collapsed. It wraps by week because 90 day cells in one row would be under 8 px
  wide, with no room for text markers.
- **R6. A blank optional date must be omitted.** `agreedResolutionOn: ""` returns `null` (V23).
  *Resolution:* `datesOf` and `windowsOf` omit blank fields, and the mount test asserts it.
- **R7. Plan: `dateSchema = z.string().min(10).max(64)`.** `dox-tools.ts` already exports
  `dateTimeSchema` (`min(4)`). *Resolution:* a separate `plainDateSchema`, so the date-time
  schema is untouched.
- **R8. Plan: "two Worth trying permalinks (the US day-30/31 pair …)".** "US" is a jurisdiction
  label. *Resolution:* "the 30-day windows, invoice on day 31" and the 14/14/45 contract.
- **R9. The plan's guide section 6 is superseded.** No jurisdiction's rule is named, linked or
  paraphrased. The mapping table lives once, in the INT-12 guide's new closing section, and the
  billing guide links to it (A1 §7).
- **R10. Tracker `Status` for INT-58 is "In progress".** `docs-site.md` says only merged
  (Done) functions are named on the site. The pages ship in the story's own PR, and the Status
  must be `Done` before merge (the finalizer's step, then `pnpm deps:sync`). The tester reports
  it as open if it is not yet `Done` when D14 runs. It is not a dox failure.
- **R11. Two registration lists fail silently.** `widget-load-error.test.tsx` `MOUNTS` and
  `widget-graph.test.ts` `heavy` are manual, although `docs-site.md` implies every registration
  is test-guarded. *Resolution:* both are listed in C8. `docs-site.md` should name them at
  close-out.
- **R12. `html-diff` matches the root by literal string.** Any extra attribute on
  `<div class="gmt-billing gmt-widget">` makes it report "subtree not found". *Resolution:* C
  preamble.
- **R13. Forced colours drop gradient fills.** A lane drawn only with a gradient disappears.
  *Resolution:* border styles carry the lane identity (C7).
- **R14. `api-surface.mjs` skips blocks with no import**, such as `wrongCode` and `naiveCode`.
  *Resolution:* D4's script checks every value, not only import-bound ones.

## Outside this spec

- The fiscal-period JSDoc (`getFiscalPeriod`, `internal/fiscalCalendar`) carries a tax-regulation
  citation that reaches its generated reference page. It is not intermodal, so a separate story
  removes it in `packages/gmt`; Dox regenerates with no hand edit. The final law grep allows
  that one generated page.

---

## 9. Verified values (run against `packages/gmt/dist`)

`W = { issueDays: 30, disputeDays: 30, resolutionDays: 30 }`, and `C = { issueDays: 14, disputeDays: 14, resolutionDays: 45 }`.
V1–V9 are verbatim `billingTimeline.ts` JSDoc examples. V10 is the JSDoc request-without-invoice
example.

| id | call | result |
| --- | --- | --- |
| V1 | `billingTimeline({ anchorOn: "2026-03-01" }, W)` | `{ invoiceDeadline: "2026-03-31", issuedByDeadline: null, disputeDeadline: null, requestedByDeadline: null, resolutionDeadline: null }` |
| V2 | `billingTimeline({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31" }, W)` | `{ invoiceDeadline: "2026-03-31", issuedByDeadline: true, disputeDeadline: "2026-04-30", requestedByDeadline: null, resolutionDeadline: null }` |
| V3 | `… invoiceIssuedOn: "2026-04-01" }, W)` | `{ invoiceDeadline: "2026-03-31", issuedByDeadline: false, disputeDeadline: "2026-05-01", requestedByDeadline: null, resolutionDeadline: null }` |
| V4 | `{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-20", requestReceivedOn: "2026-04-19" }, W` | `{ invoiceDeadline: "2026-03-31", issuedByDeadline: true, disputeDeadline: "2026-04-19", requestedByDeadline: true, resolutionDeadline: "2026-05-19" }` |
| V5 | `{ …, requestReceivedOn: "2026-04-20" }, { ...W, agreedResolutionOn: "2026-06-01" }` | `{ invoiceDeadline: "2026-03-31", issuedByDeadline: true, disputeDeadline: "2026-04-19", requestedByDeadline: false, resolutionDeadline: "2026-06-01" }` |
| V6 | `{ anchorOn: "2026-03-10", invoiceIssuedOn: "2026-04-05" }, W` | `{ invoiceDeadline: "2026-04-09", issuedByDeadline: true, disputeDeadline: "2026-05-05", requestedByDeadline: null, resolutionDeadline: null }` |
| V7 | `{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-05", requestReceivedOn: "2026-03-18" }, C` | `{ invoiceDeadline: "2026-03-15", issuedByDeadline: true, disputeDeadline: "2026-03-19", requestedByDeadline: true, resolutionDeadline: "2026-05-02" }` |
| V8 | `{ anchorOn: "2028-01-30" }, W` | `{ invoiceDeadline: "2028-02-29", issuedByDeadline: null, disputeDeadline: null, requestedByDeadline: null, resolutionDeadline: null }` |
| V9 | `{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31" }, { disputeDays: 30, resolutionDays: 30 }` | `null` |
| V10 | `{ anchorOn: "2026-03-01", requestReceivedOn: "2026-04-19" }, W` | `null` |
| V13 | `convertUtcToPlainDate("2026-03-31T14:00:00Z", { timeZone: "America/New_York" })` | `"2026-03-31"` |
| V14 | `convertUtcToPlainDate("2026-04-01T02:30:00Z", { timeZone: "America/New_York" })` | `"2026-03-31"` |
| V15 | `chargeableDays("2024-06-14T19:00:00Z", "2024-06-24T15:00:00Z", 3, { basis: "calendar", chargeBasis: "calendar", timeZone: "America/New_York", firstDay: "eventDay" }).chargedDates.at(-1)` | `"2024-06-24"` |
| V16 | `billingTimeline({ anchorOn: "2024-06-24" }, W)` | `{ invoiceDeadline: "2024-07-24", issuedByDeadline: null, disputeDeadline: null, requestedByDeadline: null, resolutionDeadline: null }` |
| V17 | `{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-04-05" }, W` | `{ invoiceDeadline: "2026-03-31", issuedByDeadline: false, disputeDeadline: "2026-05-05", requestedByDeadline: null, resolutionDeadline: null }` |
| V18 | `{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-05", requestReceivedOn: "2026-03-20" }, C` | `{ invoiceDeadline: "2026-03-15", issuedByDeadline: true, disputeDeadline: "2026-03-19", requestedByDeadline: false, resolutionDeadline: "2026-05-04" }` |
| V19 | `{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-05", requestReceivedOn: "2026-03-18" }, W` | `{ invoiceDeadline: "2026-03-31", issuedByDeadline: true, disputeDeadline: "2026-04-04", requestedByDeadline: true, resolutionDeadline: "2026-04-17" }` |
| V20 | `{ anchorOn: "2026-03-20", invoiceIssuedOn: "2026-04-10" }, W` | `{ invoiceDeadline: "2026-04-19", issuedByDeadline: true, disputeDeadline: "2026-05-10", requestedByDeadline: null, resolutionDeadline: null }` |
| V21 | `{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-04-10" }, W` | `{ invoiceDeadline: "2026-03-31", issuedByDeadline: false, disputeDeadline: "2026-05-10", requestedByDeadline: null, resolutionDeadline: null }` |
| V22 | `{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-20", requestReceivedOn: "2026-03-19" }, W` | `null` |
| V23 | `{ anchorOn: "2026-03-01" }, { ...W, agreedResolutionOn: "" }` | `null` |
| V24 | `{ anchorOn: "2026-03-10", invoiceIssuedOn: "2026-03-05" }, W` | `{ invoiceDeadline: "2026-04-09", issuedByDeadline: true, disputeDeadline: "2026-04-04", requestedByDeadline: null, resolutionDeadline: null }` |
| V25 | `{ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-01" }, { issueDays: 0, disputeDays: 0, resolutionDays: 0 }` | `{ invoiceDeadline: "2026-03-01", issuedByDeadline: true, disputeDeadline: "2026-03-01", requestedByDeadline: null, resolutionDeadline: null }` |
| V26 | `{ anchorOn: "2026-03-01" }, { issueDays: 3650, disputeDays: 3650, resolutionDays: 3650 }` | `{ invoiceDeadline: "2036-02-27", issuedByDeadline: null, disputeDeadline: null, requestedByDeadline: null, resolutionDeadline: null }` |
| V27 | `{ anchorOn: "2026-03-01T04:00:00Z" }, W` | `null` (an instant is not a date) |

Naive (plain JavaScript) values, verified with `node` (N1 and N3 hold in any `TZ`, because every
string carries an offset):

| id | code | value |
| --- | --- | --- |
| N1 | `new Date(new Date("2026-03-01T00:00:00-05:00").getTime() + 30 * 86400e3).toISOString()`; then `new Date("2026-03-31T09:00:00-04:00") <= deadline` | `"2026-03-31T05:00:00.000Z"`; `false` |
| N3 | `new Date(new Date("2026-03-05T00:00:00Z").getTime() + 30 * 86400e3).toISOString().slice(0, 10)` | `"2026-04-04"` |
| N4 | `let d = new Date("2026-03-01T00:00:00Z"), n = 0; while (n < 30) { d = new Date(d.getTime() + 86400e3); if (d.getUTCDay() % 6 !== 0) n++; } d.toISOString().slice(0, 10)` | `"2026-04-10"` |
| N5 | `"2026-04-01T02:30:00Z".slice(0, 10)` | `"2026-04-01"` |
| N6 | `"2026-03-31" < "2026-03-31"` | `false` |

The script for D4 (`$SP/int58-values.mjs`, run from `$WT`) imports
`packages/gmt/dist/intermodal/calculate/index.js` and `packages/gmt/dist/utc/convert/index.js` by
absolute path. For every row above it evaluates the call, compares
`JSON.stringify(actual)` with `JSON.stringify(expected)` (the expected value written as a JS
literal), and prints `ok <id>` or `FAIL <id> <actual>`, exiting 1 on any failure.

## 10. Internal-link check (D6)

```js
// $SP/int58-links.mjs — run from $WT/apps/dox after a build
import { existsSync, readFileSync } from "node:fs";
const pages = process.argv.slice(2); // e.g. tools/billing-deadlines guides/industries/intermodal-billing-deadlines …
let bad = 0;
for (const p of pages) {
  const html = readFileSync(`dist/${p}/index.html`, "utf8");
  for (const [, href] of html.matchAll(/href="(\/[^"#?]*)[^"]*"/g)) {
    if (href.startsWith("//") || href.startsWith("/_astro/")) continue;
    const clean = href.replace(/\/$/, "");
    const ok = existsSync(`dist${clean}/index.html`) || existsSync(`dist${href}`) || existsSync(`dist${clean}.html`);
    if (!ok) { bad++; console.log(`${p}: ${href}`); }
  }
}
process.exit(bad ? 1 : 0);
```

Run it with the 13 new and changed content pages: the guide, three scenarios, the tool page,
`mistakes/intermodal`, the three indexes, `guides/industries/intermodal-free-time-and-demurrage`,
the two fixed scenarios and `tools/free-time-ledger`.

## 11. Files

**Create:**
`apps/dox/src/content/docs/guides/industries/intermodal-billing-deadlines.mdx`,
`apps/dox/src/content/docs/scenarios/invoice-a-day-late.mdx`,
`apps/dox/src/content/docs/scenarios/re-bill-anchored-on-the-wrong-date.mdx`,
`apps/dox/src/content/docs/scenarios/dispute-window-from-a-contract.mdx`,
`apps/dox/src/content/docs/tools/billing-deadlines.mdx`,
`apps/dox/src/components/BillingDeadlines.astro`,
`apps/dox/src/lib/billing-deadlines.ts`, `apps/dox/src/lib/billing-deadlines.test.ts`,
`apps/dox/src/lib/billing-deadlines-mount.ts`,
`apps/dox/src/lib/billing-deadlines-mount.test.tsx`,
`apps/dox/src/styles/gmt-billing-deadlines.css`.

**Modify:**

- Content: `guides/industries/intermodal-free-time-and-demurrage.mdx`,
  `guides/industries/index.mdx`, `guides/index.mdx`, `mistakes/index.mdx`,
  `mistakes/intermodal.mdx`, `scenarios/demurrage-across-a-weekend.mdx`,
  `scenarios/free-time-start-day.mdx` and `tools/free-time-ledger.mdx`, all under
  `apps/dox/src/content/docs/`.
- Library and tests: `apps/dox/src/lib/free-time-ledger.ts`, `apps/dox/src/lib/dox-tools.ts`,
  `apps/dox/src/lib/chat-constants.ts`, `apps/dox/src/lib/widget-permalink.ts`,
  `apps/dox/src/lib/widget-permalink.test.ts` and `apps/dox/src/lib/widget-load-error.test.tsx`.
- Chat: `apps/dox/src/components/ask/widget-registry.ts`,
  `apps/dox/src/components/ask/widget-graph.test.ts` and `apps/dox/worker/tools.ts`.
- Styles and config: `apps/dox/src/styles/gmt-a11y.css` and `apps/dox/astro.config.mjs`.
- Scripts: `apps/dox/scripts/html-diff.mjs` and `apps/dox/scripts/visual-snapshot.mjs`.
- Context: `context/dox/built.md`.

Regenerated, not hand-edited: `apps/dox/src/data/gmt-stats.json` (`pnpm stats:sync`).

**Close-out corrections for the main session** (not the builder's):

- INT-58.md Verification: the `visual:diff` line (R2).
- `context/domination/docs-site.md`: name the two manual registration lists (R11) and point to
  a link check (section 10) under Checks.
- `context/dox/reference/design-system.md`: "Ten pages" is a stale count in the visual gate.
  Drop the number.
