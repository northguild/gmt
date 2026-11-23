# Slice 3: guide text, "A refused schedule is not a closed one"

Part of [CORE-115 (Dox)](./index.md). **This work moves here from the library spec's finalizer
list.** That list named "one sentence under The rules or See also" for
`guides/core-date-operations/operating-hours.mdx`. The library finalizer no longer edits the
guide.

It runs after slices 1 and 2, so that its tool links resolve, and after library slice 1 is
built, so the pasted results come from `dist`.

## Edit `apps/dox/src/content/docs/guides/core-date-operations/operating-hours.mdx`

1. **Introduction.** After the sentence that lists the seven functions, add one sentence:
   "[`isValidOperatingSchedule`](/reference/calendar/validate/isValidOperatingSchedule) checks
   a schedule before you use it." Add `isValidOperatingSchedule` to the code sample's import,
   from `@northguild/gmt`, as the sample already imports.
2. **A new rule.** Add it under `## The rules`, after "### Dates are the zone's real local dates":

   ```mdx
   ### A refused schedule is not a closed one

   `operatingIntervals` returns `[]` for a schedule that is closed throughout the range, and
   also for one it refuses. `isOpenAt` returns `false` for both. All six functions share one
   schedule check, so `isValidOperatingSchedule` tells the two apart: `true` exactly when they
   accept the schedule.
   ```

   Follow it with a short typescript block. It shows two schedules: one is closed (`weekly: {}`)
   and one has a weekday key `"8"`. Each gets `operatingIntervals(…) // []` and
   `isValidOperatingSchedule(…) // true` or `// false`. Use `Europe/London` or another zone
   from the rotation, and dates with their years. Paste every result from `dist`; never type one
   by hand.

   Then one line: "Try it in the [Operating Schedule Checker](/tools/operating-schedule-checker/);
   the [Opening Hours Board](/tools/opening-hours-board/) shows all six functions on one
   week."
3. **See also.** Add two bullets, one for each tool, written in the style of the existing bullets.

## Rules that apply

- Name functions as shipped, with no "planned" or "new". The prose follows ISO 24495-1 (`/plain-english`).
- The page stays `industries: [core]`. Links to `/reference/calendar/...` are allowed on a core
  page ([industry tags](../../built/tier-2-tools.md#industry-tags)).
- Say nothing about why a schedule is refused beyond the function's JSDoc. The reference page
  holds the rules list.
- The guide is hand-written, not generated. The reference page for `isValidOperatingSchedule`
  comes from `build-reference.ts`, and the library finalizer refreshes it. Never hand-edit
  `src/generated/`.

## Definition of done

- Each snippet result equals what `dist` returns. Check it with a scratch script in the session
  scratchpad, not committed, or with the prose test the guides already use, if one covers code
  blocks.
- Every link resolves in the route manifest, and both tool routes exist.
- `scripts/llms.test.ts` and the guide's Markdown export (`[...slug].md.ts`) still pass. Pagefind
  indexes the new heading. Own lint passes.
- `context/dox/built/`: nothing to add. A guide paragraph is shown by the page itself.
