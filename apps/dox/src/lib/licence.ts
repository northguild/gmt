/**
 * The site's licence note, in one place. `Footer.astro` renders it under every docs page and
 * `DoxPage.tsx` renders it at the foot of the chat shell, where the Starlight footer is not
 * (the shell is one fixed viewport, so a footer there would sit behind the chat).
 */
export const LICENCE_LEAD =
  "Code examples: MIT-0. Packages: MIT. Third-party data and components: their own licences, credited where they appear. Everything else:";
export const LICENCE_LINK_TEXT = "© 2026 NorthGuild, all rights reserved";
export const LICENCE_URL =
  "https://github.com/northguild/gmt/blob/main/apps/LICENSE";
