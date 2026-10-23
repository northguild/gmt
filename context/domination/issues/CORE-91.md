# CORE-91 — Core: Past tense only on the Canada checker after 1 November 2026

**Scope:** Until 1 November 2026, the Canada 2026 clock-change checker says four zones stop changing their clocks on that date, and after it, that they stopped. Once 1 November 2026 at 09:00 UTC has passed (02:00 in Vancouver, the last of the four zones), the future-tense wording can never show again. This story removes it. Adds no library function.

## Gap

`CORE-89` gives the Canada checker two forms of every sentence about the change. The page picks one from the reader's clock and switches at 02:00 local time. After the date, the future-tense form, the tense check and the two-form layout cell are dead code.

## Scope

- **Past tense only,** on the page and in the chat widget ("Stopped changing clocks on 1 November 2026 at 02:00 local time"). The library still writes the date and time.
- **Remove** Canada's future-tense forms, its call to the shared tense check, and its two-form cell. The list of lines, rules and tests to delete is in `context/dox/built.md` under the Canada checker.
- **Shared parts:** keep the shared tense check and its CSS rule only if another checker uses them. Otherwise delete them.
- **Tests:** delete the tests and browser checks for before the date, and the check that the wording switches. Keep one check that the past tense shows.
- **Text that runs no code:** the page's opening sentence, its description and the chat tool description, in the past tense.

## What gmt provides (do not re-implement)

- The Canada and Morocco checkers with the date-based wording (`CORE-89`)

## Verification

- No "Stops changing" or "stop changing" text is left in the Canada checker.
- `pnpm run validate` stays green.
