# CORE-91 — Core: Past tense only on the Canada checker after 1 November 2026

**Scope:** Until 1 November 2026, the Canada 2026 clock-change checker says four zones stop changing their clocks on that date, and after it, that they stopped. Once 1 November 2026 at 09:00 UTC has passed (02:00 in Vancouver, the last of the four zones), the future-tense wording can never show again. This story removes it. Adds no library function.

## Gap

`CORE-89` gives the Canada checker two forms of every sentence about the change. The page picks one from the reader's clock and switches at 02:00 local time. After the date, the future-tense form, the tense check and the two-form layout cell are dead code.

## Scope

- **Past tense only,** on the page and in the chat widget ("Stopped changing clocks on 1 November 2026 at 02:00 local time"). The library still writes the date and time.
- **Remove** Canada's future-tense forms, its call to the shared tense check, and its two-form cell. The list of lines, rules and tests to delete is under [What the cleanup deletes](#what-the-cleanup-deletes) below.
- **Shared parts:** keep the shared tense check and its CSS rule only if another checker uses them. Otherwise delete them.
- **Tests:** delete the tests and browser checks for before the date, and the check that the wording switches. Keep one check that the past tense shows.
- **Text that runs no code:** the page's opening sentence, its description and the chat tool description, in the past tense.

## What the cleanup deletes

Paths are under `apps/dox/src`. Search each name again before deleting; a later story may have added a user.

- `CANADA_MOMENTS`: defined in `lib/canada-clock-change.ts`, read in `lib/canada-clock-change-mount.ts`, `lib/clock-change-tense.fixture.ts` and `lib/clock-change-tense.test.ts`. Keep one past-tense fixture for the Canada tests.
- The `bindTense` block: the call in `lib/canada-clock-change-mount.ts` and the function in `lib/clock-change-tense.ts`, with the tense timer and `onChange: () => map?.retense()`. Keep `changeTense`, `momentWords` and `tenseView` only if Morocco still reads them (it does).
- `changesHintHtml`: `lib/canada-clock-change-mount.ts`. Its "Clock changes" hint keeps the past-tense sentence as plain text.
- The `KeyPart` tense variant (`{ tense, before, after, dated }`), `tenseKeyOf` and `partsInForm`: `data/clock-change-text.ts`, used by `lib/clock-change-mount.ts` (`runHtml`). `KeyPart` itself stays, without the tense variant.
- `retense()`: the `ZoneMap` member and its function in `lib/zone-map.ts` (also its `deps.tense` hook).
- The `.gmt-tense` rules in `styles/clock-change.css` (`.gmt-tense`, `.gmt-tense--block`, `[data-form]`), and `slotHtml` in `lib/clock-change-tense.ts` that writes the cell.
- The Canada before-form tests: `Canada: before shows the future form, after the past form` in `lib/clock-change-tense.test.ts` (keep the after form), and the before-date cases in the Canada tests that import `canadaTense`.
- The two-timer test: `clears the one timer when the signal aborts` in `lib/canada-clock-change-mount.test.ts` expects two timers (the probe clock and the tense timer); it expects one after the cleanup.
- The `loadCanadaTense` calls: `components/CanadaClockChange.astro`, `components/ask/widget-registry.ts`, and the export in `lib/canada-clock-change-mount.ts`.

## What gmt provides (do not re-implement)

- The Canada and Morocco checkers with the date-based wording (`CORE-89`)

## Verification

- No "Stops changing" or "stop changing" text is left in the Canada checker.
- `pnpm run validate` stays green.
