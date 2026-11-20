# Reviewer reference: epic rules, invariants, compat and README review

## The epic's own rules, and what past corrections teach

From [definition-of-done.md](../domination/definition-of-done.md): zones and calendars are parameters, never bundled registries; reference data sits behind a `.../data` subpath and records its source, revision and validity window; every local-to-instant conversion states its disambiguation policy in JSDoc, in the vocabulary of [LOCAL_TIME_RESOLUTION.md](../reference/LOCAL_TIME_RESOLUTION.md); and no function returns a quantity that cannot be derived from its inputs.

Also binding:

- **No function without a traceable need.** A realm function needs a real-world pain point and a primary source for every constant. A plausible name with no source is an invented quantity.
- **A `.../data` module exposes a staleness predicate.** A safety-critical rule that is not implemented is documented as such, never approximated. A space-realm function states its accuracy limit as a number in JSDoc, traceable to its model.
- **GMT tracks no law.** Regulated windows, limits and tables are caller parameters. No statute, section number, regulator table or national holiday set ships in code or docs.
- **A story's `## Corrections` section is closed.** Never reintroduce an API it records as removed without a new primary source.
- **The classes of invented quantity to look for:** an identity read as a timestamp (an MMSI holds none); a citation for a standard that does not exist or was not read; a claimed leap second that never happened; a sign backwards (GPS runs ahead of UTC); a table keyed on something the caller owns (free time is set by carrier and contract, not port); a convention applied where the standard's own code differs (a day-count name that is not an ISDA/FpML code; NOTAM `YYMMDDHHMM`, not METAR `DDHHMM`); a single-double Julian Date past its ~100 microsecond resolution; two timestamps asked to separate offset from drift; a trading day as one session; a regulator's number inside logic.

## Invariants a green suite most often fails to pin
- **Round-trip.** For a parse/format pair, `parse(format(x)) === x` on the canonical form,
  and the JSDoc names what is lossy — HTTP-date and RFC 5322 carry no fractional seconds, a
  pattern without a year cannot round-trip.
- **Direction.** Calendar-unit differences are not symmetric under clamping: check the
  function says which way it counts and carries a `Jan 31 → Feb 28/29` row in both
  directions. Day-and-below units are exactly antisymmetric; a row should prove it.
- **Zone-invariance.** Output of `instant/`, `utc/`, `unix/`, `interval/` and `precision/`
  must not move with the ambient zone. CI runs 10 zones × Node 22/24/26, so a local green
  run is one leg of thirty; `TZ=Pacific/Apia` and `TZ=Pacific/Niue` catch most of it early.
- **Boundaries.** Every `startOf*`/`endOf*`/floor/bucket/count function asserts
  `start ≤ input < next start` on the probe zones, not only the value; comparison functions
  agree in sign with `Temporal.Instant.compare` on the same inputs.
- **Range limits.** Rows at the exact limits and one step beyond: `±8_640_000_000_000_000_000_000n`
  epoch nanoseconds, `±Number.MAX_SAFE_INTEGER`, and Temporal's own
  `-271821-04-20` / `+275760-09-13`. `PlainDate`'s range is wider than `Instant`'s, and an
  eastward zone cannot reach the last hours of the instant range — a limit row that passes
  only in `UTC` proves nothing. Check no `Number(bigint)` happens before the range test.
- **Leap seconds.** Temporal has none and clamps `:60`; RFC 3339 §5.7 permits it; GMT
  rejects it in `isValid*`. A parser that reaches `Temporal.*.from` without its guard
  accepts `23:59:60` and silently returns 23:59:59 — a wrong value with no error.
- **Annotations.** For each parser touched, state what it does with `[u-ca=x]`, `[!u-ca=x]`,
  `[foo=bar]`, `[!foo=bar]` and `[!Europe/Paris]`, and confirm the `isValid*` guard and the
  `try` body agree. When they don't, one spelling returns the sentinel and the other doesn't.
- **Disambiguation.** Rows for the canonical cases in
  [LOCAL_TIME_RESOLUTION.md](../reference/LOCAL_TIME_RESOLUTION.md) under every
  policy the function accepts, and the `offset` policy stated where the function takes an
  `offset[zone]` string.
- **Durations.** Whether `Y/M/W` are accepted, what `relativeTo` resolves them against, and
  that mixed signs are rejected. `P1M` from `2024-01-31` is the row that catches it.
- **Locale extensions.** Whether `-u-ca-`, `-u-nu-` and `-u-hc-` are honoured or stripped,
  stated and pinned — `ja-JP-u-ca-japanese` and `ar-SA` are the cases that diverge.
- **Version-dependent rows.** An `oneOfIcu` variant names the ICU version that produced it;
  a row that depends on a recent tzdb change names the release it assumes. A one-variant
  `expectOneOfIcu`, or a variant nobody ran, is masking rather than tolerance.

## Reviewing a `temporalCompat` change

A workaround for a runtime defect is the one place GMT deliberately diverges from what the
installed polyfill does, so it carries its own contract. The approach is frozen in
[runtime-workarounds.md](../coding-standards/runtime-workarounds.md); a diff that changes it or
adds an exception without the owner's word naming that file fails review.
[internal/temporalCompat/README.md](../../packages/gmt/src/internal/temporalCompat/README.md) is
the rulebook; a new or changed workaround passes only when all of this holds:

- The defect has a repro in `repros.ts` whose `expected` came from test262 or native Temporal —
  never from the polyfill or from GMT — and that file imports **only** the polyfill, so the
  canary can load it from `dist`.
- A lazy, memoised probe in `capabilities.ts` gates it, and the workaround is dormant when the
  probe passes. `iso8601` always goes straight through.
- It computes the spec's answer, so deleting it on a fixed runtime changes no output and no
  test row. If a row would have to change, the workaround is wrong.
- No test mocks Temporal or forces a probe. Public rows assert values that hold either way.
- Call sites import from `index.ts` only.
- The README's defect table and removal-trigger table name the upstream commit that retires it,
  and the removal steps say what to delete.

Run `pnpm compat` and read its output before concluding a workaround is unnecessary; run
`pnpm compat:oracle` before concluding one is correct.

## Reviewing the READMEs

`README.md` is the GitHub landing page and `packages/gmt/README.md` is the npm landing page.
They are one page, kept as two identical files: two fact bullets, a line that links the Why GMT and compare pages, the
install command, a sample, the namespace links and the agent prompt. npm and GitHub serve the
committed bytes, so a wrong line stays wrong for every reader until someone fixes the file.
Check all six on every review.

| Check                           | It passes when                                                                                                                                                                          | How you check it                                                                                                                                                                                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Figures**                     | The function and locale counts in both READMEs match the generated stats, the READMEs hold no test count, and the opening line names the libraries in `apps/dox/src/data/library-measurements.json`                             | `node scripts/stats.mjs check` passes. Then read the fact bullets against `apps/dox/src/data/gmt-stats.json`, and confirm the Why GMT and compare links are there |
| **Sample**                      | Every result in the sample block is what the function returns                                                                                                                           | `node scripts/api-surface.mjs check` passes; it needs the built library. Then run one sampled call yourself against `packages/gmt/dist` and compare the result with the line                                                                                                          |
| **Namespace links**             | There is one `/reference/<namespace>/` link for every namespace that exports functions and for no other, and the "By industry:" line links each declared industry's page, not a reference page | `stats check` guards the set of links and the "By industry:" line. Confirm each link names a page the docs site serves                                                                                                                                                                |
| **Agent prompt**                | The fenced block in both READMEs and in `CONTRIBUTING.md` equals `AGENT_PROMPT` in `apps/dox/src/lib/agent-prompt.ts`                                                                   | Read each block against the constant. The Dox test `apps/dox/src/lib/agent-prompt.test.ts` guards the same thing                                                                                                                                                                      |
| **The two files are identical** | `README.md` and `packages/gmt/README.md` are the same, byte for byte                                                                                                                    | `cmp README.md packages/gmt/README.md` prints nothing. `stats check` fails when they differ                                                                                                                                                                                           |
| **No per-function section**     | Neither README holds a section for one function or one feature                                                                                                                          | Read the headings. That content belongs in a docs guide under `apps/dox/src/content/docs/guides/` and in the generated reference                                                                                                                                                      |

A stale figure, a wrong sample result or a missing namespace is a finding, not a note. So is a
prompt that differs, two files that differ, or a per-function
section. `tdd-dev` does not edit READMEs, so a README finding goes to
[`finalizer`](../../.agents/finalizer.md) through the main session.

**Report the age of the other libraries' snapshot.** Their figures, which the Dox site shows, are a dated snapshot. Each
has a `measuredOn` date in `library-measurements.json`, and nothing measures them again
automatically. Give each date and how long ago it was. Age alone is not a finding. The owner
decides when to re-measure.
