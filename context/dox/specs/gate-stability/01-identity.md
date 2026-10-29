# Slice 1 — element identity and the `target` field

A finding's key today ends in a CSS path: `issue-plan.mjs:85`,
`` `${gate}:${rule}:${page}:${collapse(selector)}` ``. The paths come from two copies:
`computePath` in `a11y-tab-walk.mjs:61-80` (tag, `#id`, `:nth-of-type`) and `installPath` in
`a11y-media.mjs:53-74` (`window.__pathOf`). Each gate also builds its own selector string. A
sibling insert, a `useId` change or a class rename changes the path, so the weekly sweep files a
new issue for an old finding.

## Create `apps/dox/scripts/lib/element-identity.mjs`

It exports two functions. Each is **self-contained**: no closure over module scope, and no
imports. That way a gate installs it with
`page.addInitScript({ content: `window.__gmtIdentity = ${identityOf}; window.__gmtCssPath = ${cssPathOf};` })`
and jsdom tests import it directly.

- `identityOf(el)` returns the key: `scope › role "name"`, plus `[n]` only on repeats.
  - **scope**: the nearest ancestor-or-self with `data-widget`, written `widget:<slug>`. Without
    one, the nearest named landmark (`banner`, `navigation "…"`, `main`, `complementary "…"`,
    `contentinfo`, `region "…"`, `search`, `form "…"`), written `<role>` or `<role> "<name>"`.
    Without either, `page`.
  - **role**: the explicit `role` (its first token). Otherwise the implicit role, from a fixed
    table of tags:
    - `a[href]` → link, `button` → button;
    - `input` by `type` → textbox, checkbox, radio, slider, spinbutton, searchbox or button;
    - `select` → combobox or listbox, `textarea` → textbox;
    - `h1`–`h6` → heading, `table` → table, `th` → columnheader or rowheader, `td` → cell;
    - `ul`/`ol` → list, `li` → listitem;
    - `section` with a name → region, `nav` → navigation, `main` → main;
    - `header`/`footer` → banner/contentinfo when not inside `article`, `aside`, `main`, `nav` or
      `section`;
    - `p` → paragraph, `time` → time, `output` → status, `img[alt]` → img, `figure` → figure,
      `dl` → list, `dt` → term, `dd` → definition;
    - anything else → generic.
  - **name**:
    1. the accessible name: `aria-labelledby` text, then `aria-label`, then `<label>` (`labels`),
       then `alt`/`title`;
    2. otherwise the element's own text (`textContent`), with whitespace collapsed.
    3. Then replace every digit run with `#` and cut the name to 60 characters.
    4. If the name is still empty, append the nearest named ancestor inside the scope as a step
       (`group "Start" › generic`). This keeps a nameless box from colliding with every other
       nameless box.
  - **`[n]`**: compute the base key (no `[n]`) of every element inside the same scope root that
    has the same role. When two or more share this element's base key, append `[n]`, the 1-based
    document-order index among them. Keys are then unique on the page. Never use ids, classes,
    `nth-*`, `data-role` or tag names except through the role table.
  - Format: `widget:gnss-week-decoder › slider "Week"`, `contentinfo › time "Oct #, #"`,
    `page`. A page-level finding (sideways scroll, a `:root` token) uses `page`, or `root` for a
    custom property read from `:root`.
- `cssPathOf(el)` is today's `computePath`. It stays as the readable `selector` field, for people
  debugging. No key reads it.

## Modify

- `scripts/gates/findings.mjs`:
  - Add `target` to `FINDING_FIELDS`, after `page`.
  - `recordFinding` **throws** when `target` is missing or empty. The gate then crashes and the
    runner reports a gate failure, so a finding without identity never reaches an issue.
  - `recordLabelled({ gate, page, message, target })` passes `target` through. The three Canada
    scripts send the overflowing element's key, or `page`.
- `scripts/gates/issue-plan.mjs`: `keyOf(f)` = `` `${f.gate}:${f.rule}:${f.page}:${f.target}` ``.
  Delete `collapse()` if nothing else calls it. `marker()` already escapes `"`, `>` and `--`;
  extend its tests to a key holding `›` and `"`.
- `scripts/a11y-tab-walk.mjs`: drop `computePath`. `pathOf` becomes `__gmtIdentity`. The in-page
  dedupe keys (radio groups, lines 144–173) keep working because `[n]` makes each key unique on
  the page. `describe(el)` in the `focus-obscured` message (tag, id, two classes, `data-role`)
  becomes the identity key plus the covering element's rect, rounded to 0.1 px (slice 5 needs
  this).
- `scripts/a11y-media.mjs`: drop `installPath`. Each emitted finding sets `selector` from
  `__gmtCssPath` and `target` from `__gmtIdentity`. The border-token and text-shadow findings use
  `target: "root"` or the element's key.
- `scripts/contrast-measure.mjs` (around lines 287, 393 and 831–866): `target` from
  `__gmtIdentity` on the measured text node's element.
- Every other gate that calls `recordFinding` passes `target`: `readout-still`, `grow-measure`,
  `data-credits-check`, `globe-smoke`, `html-diff`, `visual-snapshot`, `table-fit` and
  `lib/a11y-sweep.mjs`. For axe results, resolve `node.target[0]` with `document.querySelector`
  in the page, then call `__gmtIdentity`. If it does not resolve, that is a gate failure, not
  `null`. To find the full set, run
  `grep -ln 'recordFinding\|recordLabelled' apps/dox/scripts/*.mjs apps/dox/scripts/lib/*.mjs`.
  Do not trust this list.

## Tests

`scripts/lib/element-identity.test.ts` starts with `// @vitest-environment jsdom`. It builds a
small widget (`data-widget="demo"`, `aria-label`, a slider, two unnamed cells, a React-style
`id=":r3:"` with `aria-labelledby`, and repeated buttons). It asserts:

- the key is unchanged after inserting a **different** sibling before the element;
- the key is unchanged after changing every `id` (the `useId` case) and rewiring
  `aria-labelledby` to match;
- the key is unchanged after renaming every class;
- digits collapse (`Week 2345` and `Week 2346` give the same key);
- `[n]` appears only on true repeats;
- the 60-character cut holds;
- the landmark fallback works, and so does `page`;
- `new Function("return " + identityOf.toString())()` gives the same results, because the
  function is serialised into the page.

Extend `gates/findings.test.ts` (missing `target` throws; `target` is written in field order)
and `gates/issue-plan.test.ts` (`keyOf` ignores `selector`).

## Traps

- Shadow DOM is not used by the widgets. If `identityOf` meets a `ShadowRoot`, stop at the host
  and prefix the host's key. Do not pierce it.
- Gates call this function thousands of times per page (tab-walk, contrast-measure). Cache base
  keys in a `WeakMap` kept on `window`, and clear it whenever the DOM changes (a
  `MutationObserver` the function sets up on its first call).
- `textContent` of a big container is huge. Read only the first 200 characters before
  collapsing.
