# CORE-90 — Core: A United States clock-change checker in Dox, once permanent daylight time is law

**Scope:** If keeping the United States on daylight time all year becomes law, Dox gains a checker like the Canada one. The story waits until the change is law and a tzdb release models it. Adds no library function.

## Gap

A federal bill to keep the United States on daylight time all year has passed one chamber of Congress. The bill names no start date, so a change could take effect on any day, not only on a usual changeover Sunday. No tzdb release models it yet.

## Scope

- **Which zones change, and when,** come from the tzdb release, never from the bill, including the states that choose standard time all year instead.
- **The checker** at `/gmt/check/us-<year>-clock-change`, built from the shared parts in `CORE-89`.
- **A test file** like `packages/gmt/src/test/oh-canada.test.ts` for the US zones.
- **Any date.** The page and its tests handle a change on any date and at any local time.
- **Words before the date.** A checker published before its change needs each dated phrase in
  both tenses, flipping when the moment passes. Dox has none today; commit 4ce90269 has the
  two-form parts (`tense-slot`, `bindTense`) to rebuild from.

## What gmt provides (do not re-implement)

- The shared checker parts (`CORE-89`)
- `classifyStoredZoned` (`CORE-83`)

## Verification

- The checker's Worker column matches the tzdb release that models the change, for every changed zone.
- The checker works keyboard-only and at 375 px.
- `pnpm run validate` stays green.

## Phase 1 (shipped)

Phase 1 needs no law and no tz release. It adds a Dox page, not a library function, and no changeset.

- **The Sunshine Protection Act page** at `/check/us-sunshine-protection-act/`: a map with a Today
  view (every US zone as the tz database models it) and a Proposals view (each state's adopted
  position, dated), a pin, a permalink, and evidence on how disruptive a change would be. It is a
  chat tool (`showUsSunshineProtectionAct`, kind `sunshineact`). It states effects only and
  projects no offset. What and where: [built.md](../../dox/built.md), "Sunshine Protection Act
  page". The facts behind it, and the only file that cites law:
  [research/us-permanent-daylight-time.md](../research/us-permanent-daylight-time.md).
- **A weekly freshness canary** watches Congress.gov, Open States and the tz database against a
  committed snapshot: [canary/overview.md](../../canary/overview.md), "US clock-change watch".

## Phase 2 (waiting)

The checker at `/check/us-<year>-clock-change/` and the US test file wait for a change to be law
and a tz release to model it. The canary's tz issue is the trigger. The plan is in
[specs/CORE-90/index.md](../specs/CORE-90/index.md). The tracker row stays "Waiting" with the note
"phase 1 page and watcher shipped; the tz-release canary issue triggers phase 2".

## Decisions

1. **Place and name.** The page is under Checks, slug `us-sunshine-protection-act`, title and
   sidebar label "Sunshine Protection Act": a page-scoped exception to the rule that GMT names no
   law, with one neutral sentence on the page saying proposals under that name have been put
   forward in several sessions. It is no precedent. Tool `showUsSunshineProtectionAct`, kind
   `sunshineact`; the component, mount, data and test files follow the slug.
2. **It is a tool,** with a `CHAT_STARTERS` pill after the first five.
3. **A Worker endpoint** (`/api/sunshine-protection-act`) computes the Today classes with gmt.
4. **"If federal law changes"** is the UI wording. No body is named.
5. **"Standard time all year proposed"** means a measure passed by one chamber, or adopted by a
   whole legislature, in this session. Bills only introduced are counted in words, not drawn. An
   unverified measure leaves the class with an empty legend count; the class stays.
6. **One "Sources" link** to the research file on GitHub, the only place that cites law.
7. **Status.** "In progress" while the PR is open; after merge, "Waiting" with the note under
   Phase 2. The PR says "Part of #341".
8. **The tz database pin** stays 2026e.
9. **Unverified facts** are checked on their primary sites. Anything unverified is cut.
10. **Ageing.** The page says "checked N days ago" at runtime, and after the session ends a note
    that it has ended. No test depends on the run date. The canary opens issues when the sources
    move; the data module is edited by hand.
11. **Canary retirement, in parts.** The tz part retires when phase 2 ships; the federal and state
    parts when the Proposals view's data is removed or replaced. The workflow header says so.
12. **Issue bodies may show the bill numbers and titles the APIs return,** as data, in GitHub
    issues only. The script, snapshot keys and site hold none of their own.
13. **Open States pacing.** One request a second, at most 60 a run; a 429 is could-not-run, with
    no retry.
