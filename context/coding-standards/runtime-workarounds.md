# Runtime Workarounds — the Fixed Approach

**Frozen.** This is the approach GMT uses whenever the polyfill, a runtime or its ICU gives an
answer that differs from the standard or from another runtime. It is the approach on `main` before
CORE-114, copied here word for word from
[`temporalCompat/README.md`](../../packages/gmt/src/internal/temporalCompat/README.md) rules 2
and 3 and its sources paragraph. No agent, story or PR changes it, adds an exception to it, or
writes a competing rule next to it. Only the owner changes it, by an instruction in plain words that
names this file. A change that cannot follow it stops and goes to the owner as a question.

## The approach

1. **Fix to the standard's answer.** The expected value comes from, in order: the TC39 Temporal
   specification, the Intl era/monthCode proposal and ECMA-402, test262, the native engine
   (Chromium), then an independent arithmetic oracle (Dershowitz and Reingold for Hebrew). Never
   from the polyfill, from GMT, or from a peer library.
2. **Dormant unless needed.** Each defect has a repro in `probeRepros.ts` (or, for the canary-only
   groups, `repros.ts`), probed lazily in `capabilities.ts`: once per process, per calendar,
   memoized. If the installed runtime passes, that workaround never runs. When a probe fails, a
   per-call guard (a range check, a polyfill throw, a failed read-back, or a result that is not the
   spec's) decides whether this call needs it. `iso8601` values always pass straight through.
3. **Same answer after removal.** Every workaround computes the spec's answer, so deleting it on a
   fixed runtime changes no output and no test row. If a row would have to change, the workaround
   was wrong. The one exception is D29: where CLDR's range pattern is broken, the spec's answer
   needs CLDR's fixed data, which GMT must not own. So D29 prints ECMA-402's `[[Default]]`
   fallback, and a fixed engine may print CLDR's rewritten range text instead.
4. **No GMT copy of calendar or locale data.** GMT owns calendar data only where the standard
   cannot be met without it: the published Hebrew arithmetic and the Indian leap rule for years the
   runtime gets wrong. No CLDR or ICU tables (week data, likely subtags, calendar preferences, era
   names, patterns).
5. **When the spec's answer needs data GMT must not own,** the failing runtime returns the
   function's sentinel (D26: an Islamic date before the Hijra on a runtime whose probe fails) or
   ECMA-402's default (D29). A runtime that passes the probe keeps its own answer.
6. **Retirable.** Every workaround has a README row, a removal trigger naming the upstream fix, and
   removal steps. The canary reports when the trigger holds.

## How to check a change against it

For every workaround a diff adds or changes, answer each line. A "no" is a defect in the diff.

- Does a repro give the standard's expected value from the sources in step 1?
- Does a probe gate it, so a runtime that passes never runs it?
- Would deleting it on a fixed runtime change no output and no test row (D29 aside)?
- Does it read no GMT-owned CLDR or ICU data?
- Does a failing runtime get the standard's answer, or the sentinel only where step 5 applies?
- Does it have a README row, a removal trigger and removal steps?

The review doc for a `temporalCompat` change is
[review/invariants-and-readmes.md](../review/invariants-and-readmes.md#reviewing-a-temporalcompat-change).
