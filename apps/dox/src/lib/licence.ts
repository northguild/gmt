/**
 * The site's licence note, in one place. It stays out of the way: `Footer.astro` puts the one
 * quiet line `LICENCE_SUMMARY` under every docs page, and the full sentence opens from it.
 * `DoxPage.tsx` does the same at the foot of the chat shell, where the Starlight footer is not
 * (the shell is one fixed viewport, so a footer there would sit behind the chat). On the
 * landing the sentence is the "Licence" row of the Earth's data-credits popover instead
 * (`LICENCE_CREDIT` in `lib/data-credits.ts`).
 */
/** The closed line: the owner and the way in to the terms. */
export const LICENCE_SUMMARY = "© 2026 NorthGuild · Licences";
export const LICENCE_LEAD =
  "Code examples: MIT-0. Packages: MIT. Third-party data and components: their own licences, credited where they appear. Everything else:";
export const LICENCE_LINK_TEXT = "© 2026 NorthGuild, all rights reserved";
export const LICENCE_URL =
  "https://github.com/northguild/gmt/blob/main/apps/LICENSE";
