# Coding Standards: Loops, Separation, Authority

## Loop Style

Avoid `while` loops in new code. Prefer `for` loops or array methods (`map`, `filter`, `reduce`, etc.). `while` loops are more error-prone and harder to reason about than bounded `for` loops.

**A bounded loop that runs out returns the sentinel, never a partial value.** When a walker, stepper or search hits its cap without converging (e.g. `zonedUnitStart`'s transition walk-back, `bucketRange`'s 10,000-boundary cap), the function returns `""` / `null` / `[]`. A plausible-looking wrong answer is worse than the documented sentinel.

### Loop cost

- **Name what bounds every loop.** A loop bounded by a constant, by the output size, or by one pass over the caller's own input needs no more. A loop that steps across the input span (days, weeks or offset changes between two instants), or that passes over a log or holiday list more than once per call, needs a stated reason no closed form exists, in a comment beside the loop.
- **Formula first.** Before stepping day by day, use epoch-day arithmetic (`epochDayOf`, `isoFieldsOf`, `isoWeekdayOf` in `internal/epochDay.ts`), whole-week jumps, and binary search over sorted arrays (`lowerBound`, `countWithin`). Walk only the remainder, at most a week, and only the dates near a zone transition.
- **Temporal at the edges.** Parse inputs once on the way in; format once on the way out. Build or parse no Temporal object per loop step or inside a sort comparator.
- **Resolve once.** Validate and resolve a calendar, schedule, zone or rule set once per public call, and pass it in resolved form to an `internal/` core. A public function never calls another public function; both call the core, and oxlint's `no-restricted-imports` boundary rule (`packages/gmt/oxlint.boundary.mts`) fails the lint on any value import that breaks this.
- **Remember only what is pure.** A module-level memo holds only facts that are a pure function of their key for the life of the process (zone transitions, parsed holiday strings, validated zone ids, `Intl` formatters built from explicit arguments). It is bounded and cleared on overflow, stores no answer that depends on the clock, on process defaults or on a global the caller can replace (the formatter cache drops a kind once `Intl[kind]` is no longer the constructor that built it), and does no work at import time. The existing memos are in `internal/zonedTransitionSearch.ts`, `internal/businessCalendar.ts`, `internal/formatterCache.ts` and `internal/validatedZones.ts`; reuse them before adding one. `internal/temporalCompat/` keeps its own probe caches for its workarounds.
- **No `new Intl.*Format` outside `internal/formatterCache.ts`**, except the default-locale and system time-zone reads in `internal/resolveLocale.ts`.
- **Nothing runs at import, and no fixtures ship.** No top-level Temporal or `Intl` call. Test data, repros and canary tables never live in a module that shipped code imports.
- **Measure what you add.** A function with a span-dependent loop gets a `packages/gmt/bench/` row for a short, a 1-year and a 10-year input. The handoff gives the numbers and the size delta of each touched entry from `pnpm size --files <entry>`. Put no timing assertion in an `it` row: it is flaky across the CI matrix.
- **The existing rows are the contract when optimising.** A rewrite keeps every row green on the full zone matrix. Old against new over random inputs is a check, never an expected value.

## Plain / Zoned Separation

- `plain/` — timezone-free operations (`PlainDate`, `PlainTime`, `PlainDateTime`)
- `zoned/` — IANA timezone-aware operations (`ZonedDateTime`)
- Never mix the two in the same function or module.
- **Core namespaces, industry layers, cross-industry layers.** Core namespaces hold general time primitives anyone uses (`calendar/`, `duration/`, `instant/`, `zoned/`, `timescale/`, `precision/` and the rest). Industry layers are named for an industry and hold its own functions (`transport/`, `intermodal/`, `finance/`, `aviation/`, `healthcare/`, `rail/`, `iot/` and, later, `maritime/` and the rest). A cross-industry layer is a recognised industry domain that other industries draw on: `workforce/` (people's working time, the CORE-76 duty engine) and `gnss/`. A function shared across industries goes in the cross-industry layer for its domain, or in Core if it is truly general — never in a grab-bag "shared" namespace, never in one industry's namespace when other industries also need it, and never in a new namespace that is not a recognised domain.
- The other namespaces follow the same one-type-per-function rule: `utc/`, `unix/`, `instant/`, `calendar/`, `span/`, `interval/`, `precision/`, `duration/`, `regex/`, `transport/`, `intermodal/`, `finance/`, `workforce/`, `gnss/` (see `packages/gmt/src/`).

## International authority first

**International authority first.** A rule's authority is, in order: (1) an
international treaty or standards body — ISO, IEC, ITU, BIPM, IERS, IAU, IMO, ICAO, WMO, WHO,
UN/CEFACT, CCSDS, IGS/RINEX, IETF, Unicode/CLDR, IANA, ECMA; (2) a multinational industry body —
ISDA, IATA, BIMCO, DCSA, GS1, HL7 International, FIX, SWIFT; (3) a national source, only as one peer
among others and labelled with its country. A national system, agency or convention is never a
default, never the only authority and never gets its own named function. Where no international
source exists, the rule is a GMT rule backed by sources from at least two countries. Example zones,
locales, holidays and date orders are spread across regions; none is "the" example. An
international convention that is law (a maritime labour or watchkeeping convention, a road-transport
agreement, an aviation-operations annex) may shape an example's numbers, but it is never named in
code or docs: GMT tracks no law. Evidence records — `painpoints.md` and `research/*.md` — may still
cite national sources as proof that a painpoint exists. The full rule and its place among the epic's rules are in
[the epic's Definition of Done](../domination/definition-of-done.md#added-for-this-epic); an Authority table
row ([AUTHORITY_TABLE.md](../reference/AUTHORITY_TABLE.md)) names the international source first.

## Linting Enforcement

The `Date` API ban is enforced at the AST level by three optional linting packages:

- `@northguild/gmt-eslint` — ESLint flat config
- `@northguild/gmt-biome` — Biome + GritQL plugins
- `@northguild/gmt-oxlint` — Oxlint JS plugin

If the linter passes, no `Date` object crept in.
