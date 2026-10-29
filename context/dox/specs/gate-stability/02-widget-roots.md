# Slice 2 — widget roots carry `data-widget` and a name; starters move to `data-starter`

The identity key scopes to the nearest `[data-widget]` (slice 1), and gate locators scope to it
(slice 3). Every widget root gets the attribute and a name, wherever it renders: a tool page, an
MDX page, or the `/dox/` chat rail.

## The rename first

`/dox/` starter buttons already use `data-widget` for a different meaning: the tool a starter
opens. Rename that attribute to `data-starter` everywhere it is read or written:

- `src/components/ask/ExamplesPanel.tsx:70`
- `src/components/ask/DoxPage.tsx:152` (`button[data-starter="…"]`)
- `src/components/ask/rail-keyboard.test.tsx:290`
- `scripts/contrast-measure.mjs:726` (`page.click('[data-starter="…"]')`)
- `scripts/lib/a11y-sweep.mjs:164-166`: "no example card (a `[data-starter]` button)"

Then `grep -rn 'data-widget' apps/dox/src apps/dox/scripts` must return only widget roots and
the slice-1/slice-3 readers.

## Widget roots

**Slug rule** (derived, never listed by hand):

- the mount file's basename without `-mount.ts`, e.g. `src/lib/gnss-week-decoder-mount.ts` →
  `gnss-week-decoder`;
- the kebab-case component name for a root that no mount file renders: `PlaygroundForm.astro` →
  `playground`, `multi-zone-scrubber.ts` → `multi-zone-scrubber`.

Where the chat registry (`src/components/ask/widget-registry.ts`) already has an id for the same
widget, the slug equals that id. If they differ, use the registry id and say so in the handback.

**Find every root:**

- `grep -rln 'gmt-widget not-content' apps/dox/src` (41 occurrences in 39 mount files,
  `multi-zone-scrubber.ts` ×2 and `PlaygroundForm.astro`);
- the roots outside that pattern: `zone-planner-mount.ts`, the shared clock-change page template
  in `clock-change-mount.ts` (Canada and Morocco pages, whose slugs are `canada-clock-change` and
  `morocco-clock-change` from their mount files), and the globe (`globe-mount.ts`,
  `components/Globe.astro`);
- the map widget, if one renders outside these.

**Markup on each root** (one attribute line in each template):

- `data-widget="<slug>"`.
- `role="region"`, **unless** the root is already a `<section>` with a name.
- A name:
  - `aria-labelledby` the widget's own visible title id, when it has one. Build the id from the
    mount's existing id prefix, never a bare `useId`, which slice 1 must not depend on.
  - Otherwise `aria-label="<tool name>"`, the same string as the tool page's `<h1>`, or the
    playground's function name for `playground`.
- Two roots on one page (`multi-zone-scrubber`) take different names.

## Tests

- In `src/components/ask/widget-graph.test.ts`, or a new `src/lib/widget-roots.test.ts`: for
  every registry entry and every `src/lib/*-mount.ts` that renders a template, render the
  template (as the existing tests do) and assert:
  - the outermost element has `data-widget` equal to the derived slug;
  - it has a non-empty accessible name;
  - its role is `region`.
  Read the list from the file system and the registry. Never hard-code a count.
- `PlaygroundForm.test.ts`: the same three assertions on the form root.

## Traps

- The roots also mount inside the chat rail (`MountedWidget.tsx`). A region landmark there is
  fine, but its name must not repeat the transcript's label.
- `a11y-axe` runs `wcag2a`/`wcag2aa`/`wcag21*`/`wcag22aa` only, so it does not report
  `landmark-unique` (a best-practice rule). Still give distinct names where two roots share a
  page.
- Do not move `class="gmt-widget not-content"`. Slice 4's `:where(.not-content *)` relies on it.

## Done

- `pnpm test` passes.
- `pnpm gates --only a11y-axe,a11y-tab-walk --pages /dox/,/tools/gnss-week-decoder/,/check/canada-2026-clock-change/ --browsers chromium`
  passes, which proves the new landmarks add no axe finding.
