# Definition of Done — binding for every story

Every story in the [tracker](tracker.md) meets all of these before it closes.

- `pnpm run validate` stays green, including the CI timezone matrix (10 zones × Node 22/24/26 — the `gmt-matrix` job in `.github/workflows/ci.yml`).
- **Changesets required** per the [changeset rule](../coding-standards/changesets.md#changesets): a new
  API story is `minor`; a fix to shipped behaviour is `patch`; no behaviour change, none.
- No `Date` object anywhere. All inputs are ISO 8601 strings; outputs are strings, numbers,
  booleans, arrays, bigint, or objects.
- Wrap all Temporal calls in `try-catch`. Bad input returns the sentinel from the
  [sentinel table](../coding-standards/api-contract.md#api-contract), never throws.
- Full locale matrix for any locale-aware function (17 locales; `expectOneOfIcu` /
  `expectDateTimeEqual` from `src/test/icuVariants.ts` where CLDR wording differs).
- Timezone-aware functions run across `battleTestTimeZones`, and boundary functions add the
  probe-zone transition rows — see
  [§ Calendar & zone semantics](../coding-standards/calendar-and-zones.md#calendar--zone-semantics).
- JSDoc with `@example` on every public function. Cover valid, invalid, and edge-case inputs.

## Added for this epic

- **Zones and calendars are parameters.** Realm functions take IANA zone identifiers and
  calendar objects as arguments. GMT does not bundle place registries and does not resolve a
  port, airport, station or exchange code to a timezone.
- **Bundled reference data is opt-in only, and limited to two kinds.** Data published by a
  standards body (IERS leap seconds and Earth orientation, IANA, CLDR) and calendars published
  by an operator such as an exchange or a payment system. No national holiday tables, no
  regulator tables, no dealer-convention tables. It lives behind a `…/data` subpath, never on
  the default import path, and each record carries its source, revision and validity window.
  **Exemption: a table its standards body has closed.** Data that will receive no further
  entries is a fixed historical record, not data that goes stale, so it ships on the default
  path as an internal constant, with its source and final revision cited beside it. The IERS
  leap-second table is such a table: CGPM 2026 Resolution 5 makes UTC continuous from
  20 May 2027, and IERS Bulletin C 72 announces no leap second at the end of December 2026 and
  states that leap seconds are introduced "at the end of the months of December or June". A
  weekly canary against the IERS file stays in place until continuous UTC takes effect.
- **International authority first.** A rule's authority is, in order: (1) an
  international treaty or standards body — ISO, IEC, ITU, BIPM, IERS, IAU, IMO, ICAO, WMO, WHO,
  UN/CEFACT, CCSDS, IGS/RINEX, IETF, Unicode/CLDR, IANA, ECMA; (2) a multinational industry body —
  ISDA, IATA, BIMCO, DCSA, GS1, HL7 International, FIX, SWIFT; (3) a national source, only as one peer
  among others and labelled with its country. A national system, agency or convention is never a
  default, never the only authority and never gets its own named function. Where no international
  source exists, the rule is a GMT rule backed by sources from at least two countries. Example zones,
  locales, holidays and date orders are spread across regions; none is "the" example. An
  international convention that is law (a maritime labour or watchkeeping convention, a road-transport
  agreement, an aviation-operations annex) may shape an example's numbers, but it is never named in
  code or docs: GMT tracks no law. Research files and GitHub issues may still cite national
  sources as proof that a painpoint exists.
- **Every local-to-instant conversion states its disambiguation policy** in JSDoc, using the
  vocabulary in [LOCAL_TIME_RESOLUTION.md](../reference/LOCAL_TIME_RESOLUTION.md). Ambiguous
  and nonexistent wall times are never resolved silently.
- **Every function implementing a standard cites the clause it implements** in
  `## Design notes` — and the citation must be verifiable: read the primary text, never a
  secondary paper's summary of it. A function that implements no standard says so in its JSDoc and takes every
  number from the caller; the citation rule then applies to the arithmetic's own references
  (Temporal, ISO 8601, CORE stories), not to the caller's regime.
- **A rule whose primary text was not reached is marked, not asserted.** The function says so in
  its JSDoc and takes the value from the caller or returns the sentinel until the text is cited.
- **Dependencies are declared, not implied.** If a story's scope changes what it consumes
  from other stories, update its `## What gmt provides (do not re-implement)` section and run
  `pnpm deps:sync` in the same PR. The `Blocked by` column is generated from that section, and
  `pnpm run validate` fails when the two disagree.
- **A story that adds public functions ships its docs-site pages in the same PR**: a guide,
  scenarios and a mistakes page, with every result checked against the built package. See
  [docs-site.md](docs-site.md).
- **Closing a story means flipping its `Status` to `Done`, running `pnpm deps:sync` and deleting
  its planning files** (issue file, spec folder, research; see
  [finalizer step 10](../../.agents/finalizer.md)). The flip removes it from every other story's
  `Blocked by` cell; skip it and the tracker keeps showing work as blocked that is not.
- **No invented quantities.** If a value cannot be derived from the inputs, the function does
  not return it. Estimating processing times, drift from one sample, or limits from no table
  is out of scope by rule, not by omission.
- **Every behaviour-changing story gets a standards review.** `gmt-reviewer` (read-only) runs
  after `tdd-dev` and `tester` in categories A, B and G; its report goes in the PR's Validation
  section; an open blocking finding blocks closure. It is what verifies the citations above.
- **GMT tracks no law.** Windows, limits, thresholds and tables from a statute, regulation,
  treaty, agency, accreditation body, professional body or court are caller parameters with no
  defaults, the same rule as tariff terms. That covers legislatures and regulators, treaties
  ratified into national law (maritime labour and watchkeeping conventions, collision
  regulations), and professional, accreditation and public-health bodies (residency work-hour
  rules, immunisation grace periods, obstetric dating thresholds, adherence cut-offs): a body's
  _format, vocabulary, cadence or algorithm_ is a standard GMT may implement and cite; a body's
  _limit, window, threshold or table on conduct_ is treated like law, whoever publishes it.
  Library code rests on TC39 Temporal, ISO 8601, the RFCs and the realm's industry standards
  only; no statute, regulation number, agency, court decision or jurisdiction label appears in
  code, JSDoc or on the docs site. A function is generic or it is not shipped; a docs example is
  labelled by its numbers ("30-day windows", "a 14/14/45 contract", "an 11-hour cap inside a
  14-hour window"), never by a jurisdiction or a body. Research files and GitHub issues may cite
  law as proof that a painpoint exists and that its numbers are real; nothing downstream of them
  (specs, code, docs, changesets, issue titles) may. Reading public
  regulation text during research is fine; shipping it is not.
