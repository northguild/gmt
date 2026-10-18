# ULT-1 — Ultimation: The parity matrix

**Scope:** A cited table of every date and time capability the platform and the major libraries in other languages provide, with GMT's status against each, published on the docs site and kept current. Adds no function.

## Gap

Nobody, including GMT, can say which calculations other ecosystems offer that GMT does not. Gaps are found one at a time, from a user's question or a library's release notes, and the answer is never written down. Without a cited comparison, every claim about coverage is a guess, and so is every choice of what to build next.

## Scope

1. **`context/ultimation/parity.md`.** One row per capability, one column per target. Each cell is `has`, `partial`, `none` or `non-goal`, with a link to the target's documentation. A GMT `has` names the function; a GMT `partial` names what is missing; a `non-goal` links its reason.
2. **Targets.**
   - The platform: TC39 Temporal and ECMA-402 `Intl`.
   - Java: `java.time` and ThreeTen-Extra.
   - .NET: NodaTime.
   - Python: `datetime`, `zoneinfo`, `dateutil`, pandas time series, `astropy.time`.
   - Rust: jiff and hifitime.
   - Go: `time`.
   - Reference implementations: SOFA and ERFA, NAIF SPICE, ICU4C and ICU4X, tzdb.
   - Finance: QuantLib and OpenGamma Strata.
   - Standards: ISO 8601-1 and 8601-2, RFC 3339, RFC 9557, RFC 5545, RFC 7529, RFC 9636, RFC 2822, RFC 9562, CLDR.
3. **Every `none` in GMT's column is resolved.** It becomes a painpoint with a non-peer source and a candidate in [../candidates.md](../candidates.md), or a documented non-goal with its reason.
4. **Docs site page.** A comparison page generated from `parity.md`, with every cell's link, the date each target was read, and the target versions.
5. **Upkeep.** A target's major release is a reason to re-read its column. The page shows each column's read date, so a stale column is visible.

## Tool

None. The story adds no function. The comparison page is a docs page, not a widget.

## Design notes

- **Built from documentation, never from memory.** Every cell links the page it was read from. A cell that cannot be confirmed is left empty and listed, not guessed.
- **Peer libraries are targets, never authorities.** The matrix records what they do. Why GMT should do something comes from a standard or a recorded need, per the epic rule.
- **Capabilities, not function names.** A row is a calculation a user needs, such as "add a calendar month, clamping", so libraries that name it differently line up.
- **No law.** A capability that exists only to apply one jurisdiction's rule is a non-goal row, with the "GMT tracks no law" reason.

## What gmt provides (do not re-implement)

- The README function list and `packages/gmt/src/*/index.ts` — GMT's own column
- [../../domination/painpoints.md](../../domination/painpoints.md) — the parked and non-goal reasons already recorded

## Verification

- Every cell has a link or an explicit "not confirmed" mark.
- Every `none` in GMT's column has a candidate row or a non-goal row.
- The docs page builds from `parity.md` and shows each column's read date.
- `pnpm run validate` stays green.
