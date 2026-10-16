## M. The Workforce layer (step DU)

`duty/` becomes `workforce/` (decision 16). `tdd-dev` moves the seven duty calculators to
`workforce/calculate` and `isValidDutyLog` to `workforce/validate`, and removes the `/duty`
subpaths (P1). The library side, its exports map and the `GMT_MODULES` keys (`duty/calculate` and
`duty/validate` out, `workforce/calculate` and `workforce/validate` in, as `gmt-modules.test.ts`
requires) are `tdd-dev`'s; DU checks they landed and reports it if not.

1. **Declaration and text.** D1 already declares Workforce (own namespace `workforce`) and
   Transport drawing on it (B2). DU writes Workforce's overview text and Transport's crew-hours
   pain point (B7). Confirm `/industries/workforce/` lists the eight `workforce` functions under
   "Its own functions" and `/industries/transport/` lists them under "Functions it draws on" with
   "Part of the Workforce industry layer", with no hand edit; a needed hand edit is a generator
   bug, fixed in the generator.
2. **Move and retag the pages.**
   - `guides/intervals/hours-of-work.mdx` moves to `guides/industries/workforce-hours-of-work.mdx`
     and becomes the Workforce guide (its title stays unless the move makes it read wrongly);
     tag `[workforce]`.
   - `mistakes/duty.mdx` moves to `mistakes/workforce.mdx` (docs-site.md names a realm's mistakes
     page `mistakes/<realm>.mdx`); tag `[workforce]`; its description names the `workforce/`
     namespace, not "GMT's duty/ module".
   - The three scenarios keep their slugs and take `[workforce]`, the layer that owns the duty
     functions they run (`duty-day-is-not-midnight`, `paired-rest-that-does-not-qualify`,
     `sliding-window-not-calendar-day`). Transport's hub links the driver's and operator's cases.
   - **The tag rule needs a link.** These pages import from the root barrel and link no duty
     reference page today, so under B8 they use no declared module and the tag would fail. Each
     gains at least one link to the `/reference/workforce/<module>/<function>/` page of a function
     it shows, in its related links or beside the passage.
   - Every link to the moved pages (`guides/index.mdx`, the scenarios, the mistakes page, the
     guides' "See also" lists, any `/dox` starter or tool page) points at the new paths.
3. **Moved URLs and their redirects.**
   - Every hand-written link to `/reference/duty/…` points at `/reference/workforce/…` (same module
     and function names). An import in a code block from `@northguild/gmt/duty/…` becomes
     `@northguild/gmt/workforce/…`. `grep -rn "reference/duty\|gmt/duty\|guides/intervals/hours-of-work\|mistakes/duty"`
     over `apps/dox/src` outside `generated/` and `content/docs/reference/` finds nothing afterwards.
   - **Function redirects:** `RENAMED_FUNCTIONS` (C2's file) gains one entry per moved function,
     `duty/calculate/<name>` → `workforce/calculate/<name>` and `duty/validate/isValidDutyLog` →
     `workforce/validate/isValidDutyLog`. They shipped in 1.19.0, so their old URLs have inbound
     links; each gets the three `301` rules.
   - **Other moved pages:** a new leaf list, `scripts/build-utils/moved-pages.ts` (`MOVED_PAGES`,
     `{ from, to }` site paths), holds `/reference/duty` → `/reference/workforce`,
     `/reference/duty/calculate` → `/reference/workforce/calculate`, `/reference/duty/validate` →
     `/reference/workforce/validate`, `/guides/intervals/hours-of-work` →
     `/guides/industries/workforce-hours-of-work` and `/mistakes/duty` → `/mistakes/workforce`.
     `buildRedirects` writes the same three `301` rules for each (bare, trailing slash, `.md`
     twin). Generation fails when a `to` is not a page or a route in the build's page list, or a
     `from` still is one. `redirects.test.ts` covers it. The `/dox` chat's links come from the
     route manifest and the retrieval chunks, so they follow the move with no list.
   - Shared duty types keep their `/reference/types/<Name>` pages; their tag becomes Workforce by
     `typeIndustry`, and the links inside them change by regeneration.
4. **README.** The namespace line loses `[duty]` and gains `[workforce]`, and the "By industry:"
   line leads with Workforce (B3). Within section 0's README exception; if the library finalizer
   has made the namespace edit, DU confirms `stats.mjs check` passes and leaves it.
5. **Context docs**, in the present tense with no history: `context/domination/issues/CORE-76.md`
   line 41 says the duty engine is the `workforce/` cross-industry layer, its guide is the
   Workforce industry guide, and each industry that uses it declares `workforce` (Transport today;
   Maritime, Rail, Aviation and Health when they arrive). The id `CORE-76` stays.
   `context/domination/tracker.md`'s CORE-76 notes say the same in one line. `context/dox/built.md`
   states the cross-industry-layer rule of B1. Then `grep -rn "duty" context/dox
   context/domination/overview.md` and correct any Dox line that names a `duty/` namespace; a needed
   `overview.md` change is reported to the main session.
6. **No changeset from this step and no skills change.** The library's move carries its own
   changeset and skills update; `/tanstack-intent` is run to confirm it reports nothing more for
   the Dox side.
