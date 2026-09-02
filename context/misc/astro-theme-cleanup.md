# Dox theme cleanup — shipped

This refactor is done. The theme architecture and the rules for changing it now
live in [`context/dox/reference/design-system.md`](../dox/reference/design-system.md).

Summary of what changed (pure refactor — output stayed byte-identical except one
intentional fix, the theme-toggle icon color):

- `apps/dox/src/styles/gmt-site.css` (820 lines) split into `gmt-shell.css` /
  `gmt-content.css` / `gmt-controls.css` / `gmt-light.css`; the `--sl-*` mapping
  moved out of `gmt-tokens.css` into a new `gmt-theme.css`; glass recipe classes
  moved into a new `gmt-primitives.css`. `customCss` is now an 8-file ordered stack.
- ~110 inline `color(from var(--gmt-…) / <alpha>)` calls and the hard-coded
  scrollbar `rgba()` literals replaced with a named `--gmt-fill-* / --gmt-border*
  / --gmt-glow` token scale.
- ~32 scattered `[data-theme="light"]` blocks collapsed: palette re-tints and new
  theme-role tokens (`--gmt-code-*`, `--gmt-sidebar-link`, `--gmt-pagination-title`)
  do the work; duplicate rules removed; the rest consolidated into `gmt-light.css`.
- The icon-button treatment (was written 4×) is now one `.gmt-icon-button`
  primitive; `PageTitle.astro` (a no-op override) and the dead `markdown.shikiConfig`
  removed.
- Intentional fix: the theme-toggle icon renders in primary text color at rest
  (was bright cyan), still cyan on hover.
