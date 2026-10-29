# Where the docs were wrong

Part of the [gate-stability spec](./index.md).

This work corrects each of these:

- The plan suspected `clock-change.css:18-27,110-118` for cause 4. The table that overflows is
  `table.gmt-clockcheck-stored-table` (`clock-change.css:1722`, stacked form near line 1880).
- The plan scoped every content-table rule with `:not(.not-content …)`. That would restyle about
  18 widget tables that rely on the content `th` rules (`gmt-content.css:611-634`), so only the
  `table-layout` declaration moves (slice 4).
- The `/dox/` starter buttons already carry `data-widget` (`ExamplesPanel.tsx:70`), and two gates
  read it (`contrast-measure.mjs:726`, `lib/a11y-sweep.mjs:164`). They become `data-starter`.
- The gate registry has no `visual-snapshot` id. That gate is `visual-diff` (script
  `visual-snapshot.mjs`).
- Earlier local passes on cause 1 used a `dist` older than #422, so they prove nothing. On a
  fresh build of HEAD, causes 5–8 pass on macOS Chromium. Cause 4 still reproduces.
- The workflow is `disabled_manually` on GitHub. Its daily `decide` skip rule and the `bug`
  label go (slice 6).
