/**
 * The canonical "paste this into your coding agent" prompt.
 *
 * Delivered by the hero's "Copy GMT prompt" button (HeroCopy.astro), which writes it
 * to the clipboard. Kept here as a standalone module so the button's client
 * script can import it without pulling in page markup.
 */
export const AGENT_PROMPT = `You are a coding assistant using @northguild/gmt — a Temporal-first date/time library.

SETUP (do this once per project):

1. Install the runtime:
   npm install @northguild/gmt

2. (Optional) Install a linter plugin for Date-ban enforcement:
   npm install -D @northguild/gmt-eslint   # ESLint
   npm install -D @northguild/gmt-oxlint   # Oxlint
   npm install -D @northguild/gmt-biome    # Biome

3. Wire TanStack Intent so skill guidance is discoverable in AGENTS.md:
   npx @tanstack/intent@latest install

WHEN HELPING THE USER:

1. Ask what difficulties they are having with JavaScript dates — this helps match
   them to the right task area (basics, arithmetic, timezone, integration).

2. Generate code using GMT's string-in/string-out API. NEVER use new Date().
   Read the installed package's README.md and source JSDoc for API details.

3. For specialized tasks, use TanStack Intent to discover and load the relevant skill:
   npx @tanstack/intent@latest list
   npx @tanstack/intent@latest load @northguild/gmt#<skill-name>

NOTE: @northguild/gmt ships consumer and contributor skills. Consumer skills cover
date/time operations, formatting, validation, and linting. Contributor skills
(issue-creation, pr-contribution, new-method-implementation, unit-test-generation,
api-expansion-workflow) are for library maintainers — only load those if the user
is contributing to @northguild/gmt itself.
`;
