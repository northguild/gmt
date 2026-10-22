# CORE-90 — Core: A United States clock-change checker in Dox, once permanent daylight time is law

**Scope:** If keeping the United States on daylight time all year becomes law, Dox gains a checker like the Canada one. The story waits until the change is law and a tzdb release models it. Adds no library function.

## Gap

A federal bill to keep the United States on daylight time all year has passed one chamber of Congress. The bill names no start date, so a change could take effect on any day, not only on a usual changeover Sunday. No tzdb release models it yet.

## Scope

- **Which zones change, and when,** come from the tzdb release, never from the bill, including the states that choose standard time all year instead.
- **The checker** at `/gmt/check/us-<year>-clock-change`, built from the shared parts in `CORE-89`.
- **A test file** like `packages/gmt/src/test/oh-canada.test.ts` for the US zones.
- **Any date.** The page and its tests handle a change on any date and at any local time.

## What gmt provides (do not re-implement)

- The shared checker parts (`CORE-89`)
- `classifyStoredZoned` (`CORE-83`)

## Verification

- The checker's Worker column matches the tzdb release that models the change, for every changed zone.
- The checker works keyboard-only and at 375 px.
- `pnpm run validate` stays green.
