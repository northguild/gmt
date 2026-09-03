/**
 * The canonical "paste this into your coding agent" prompt.
 *
 * Delivered by the hero's "Copy GMT prompt" button (Hero.astro), which writes it
 * to the clipboard. Kept here as a standalone module so the button's client
 * script can import it without pulling in page markup.
 */
export const AGENT_PROMPT = `You are working with the @northguild/gmt library — a Temporal-first date/time library
for JavaScript. Install @northguild/gmt (and, if the user wants lint enforcement,
whichever of @northguild/gmt-eslint, @northguild/gmt-oxlint, or @northguild/gmt-biome
matches their toolchain).

Run the TanStack Intent CLI once to wire skill guidance into AGENTS.md:

    npx @tanstack/intent@latest install

Whenever a date/time or lint task arises, discover the relevant skill with:

    npx @tanstack/intent@latest list

The agent loads the matching skill with \`intent load\`. The @northguild/gmt package
covers the core namespaces (plain, zoned, unix, utc, regex):

    npx @tanstack/intent@latest load @northguild/gmt#format-date-time

The linter packages use the same mechanism — load whichever one was installed:

    npx @tanstack/intent@latest load @northguild/gmt-eslint#first-time-setup

Ask what difficulties the user is having with JavaScript dates — this helps match them
to the right GMT namespace (plain, zoned, unix, utc, regex). Then generate code using
GMT's string-in/string-out API, never \`new Date()\`.
`;
