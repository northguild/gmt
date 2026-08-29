# Dox theme — architecture & maintenance

How `apps/dox`'s theme is put together, and the rules for changing it without
making a mess. The visual language itself (palette intent, "maximal chrome,
disciplined content surface") is `context/dox/overview.md` §3 — this file is the
*implementation*.

## The stylesheet stack

The theme is plain CSS custom properties — **no Tailwind, no `@layer`**. It beats
Starlight's defaults by being unlayered (unlayered always wins over `@layer`).
Eight files, loaded in this order via `starlight({ customCss })` in
`apps/dox/astro.config.mjs`:

| # | File | Owns |
| - | ---- | ---- |
| 1 | `gmt-tokens.css` | The palette (6 roles), every `--gmt-*` token, the `@font-face`, and the `[data-theme="light"]` value block. **Custom properties only — no selectors.** |
| 2 | `gmt-theme.css` | Maps `--gmt-*` onto Starlight's `--sl-*` system (+ a 3-line light override for the non-palette literals). Theming Starlight's built-ins happens here. |
| 3 | `gmt-primitives.css` | Reusable, Starlight-agnostic recipe classes: `.gmt-glass` / `-subtle` / `-clear` / `-heavy`, `.gmt-brackets`, `.gmt-icon-button`. **Compose from these in widgets.** |
| 4 | `gmt-glass.css` | The glass treatment applied to Starlight's own elements (header, sidebar, `pre`, tables, asides, cards, search, dialogs). |
| 5 | `gmt-shell.css` | Global typography + the layout frame (`.page`, sidebar, header, site title). |
| 6 | `gmt-content.css` | The reading surface: everything inside `.sl-markdown-content`, Expressive Code frame chrome, the search modal / Pagefind UI. |
| 7 | `gmt-controls.css` | Interactive chrome: CTA buttons, prev/next pagination, mobile search trigger, hamburger, `:focus-visible`, `::selection`, scrollbar. |
| 8 | `gmt-light.css` | The `[data-theme="light"]` overrides that are neither a palette re-tint nor adjacent to a base rule. Loaded last so it always wins its ties. |

Component-scoped `<style>` blocks stay in their `.astro` files
(`Hero`, `LinkButton`, `ButtonLink`, `Icon`, `SocialIcons`, `ThemeSelect`) — the
idiomatic Starlight override pattern. They consume the tokens/primitives above;
they don't redefine them.

## Tokens

**Palette** — 6 roles (`--gmt-void / cyan / spring / teal / ice / signal`), each
re-tinted in the `[data-theme="light"]` block. Everything else derives from these.

**Glass scale** — named stand-ins for the teal/cyan `color(from … / <alpha>)`
washes, so alphas aren't magic numbers sprinkled through every rule:

- fills (teal-derived): `--gmt-fill-subtle` `.06` · `--gmt-fill` `.08` · `--gmt-fill-2` `.10` · `--gmt-fill-strong` `.12` · `--gmt-fill-deep` `.15`
- borders (cyan-derived): `--gmt-border` `.18` · `--gmt-border-strong` `.35` · `--gmt-hairline-faint` `.08`
- `--gmt-glow` (box-shadow), `--gmt-highlight` / `--gmt-highlight-faint` (inset top line)
- `--gmt-signal-fill` / `--gmt-signal-border` (caution aside)
- `--gmt-scrollbar-track` / `-thumb` / `-thumb-hover`

`--gmt-glass-tint` / `-subtle` / `-scrim` are **separate** from `--gmt-fill-*`:
they get *extra* alpha in light mode to compensate for the brighter light-mode
teal ("light-compensated"). Don't merge the two sets.

**Theme-role tokens** — `--gmt-code-surface`, `--gmt-code-bg`, `--gmt-code-border`,
`--gmt-sidebar-link`, `--gmt-pagination-title`. Each resolves to a *different
token* in dark vs light (not just a re-tint), so the rule that uses it needs no
`[data-theme="light"]` block.

## Maintenance rules

1. **Never add a `[data-theme="light"]` block for a color.** If a value differs
   between themes, either it's a palette re-tint (already handled — just use the
   `--gmt-*` token) or it needs a new **theme-role token**: define it in `:root`
   and again in the light block in `gmt-tokens.css`, then use `var(--gmt-role)` in
   the rule. A `[data-theme="light"]` rule is only acceptable for a genuine
   non-color effect change (a `backdrop-filter`, a `::-webkit-scrollbar` tweak) —
   and it goes in `gmt-light.css` unless a base rule for the same selector lives
   elsewhere, in which case keep it adjacent.
2. **No color literals in rules.** Every fill/border/glow goes through a `--gmt-*`
   token. One-off gradient stops that appear once are the only exception.
3. **Widgets compose primitives.** New interactive widgets (DOX-B) use
   `.gmt-glass*` / `.gmt-brackets` / `.gmt-icon-button` and the token scale — they
   should not need to touch any Starlight-override sheet.
4. **Respect the file order.** The cascade depends on the `customCss` order above.
   Moving a rule between files can change which of two equal-specificity rules
   wins. If you split or reorder, verify with a screenshot diff (see below).
5. **Don't introduce `@layer`** into the GMT sheets without a full re-QA — the
   whole system currently relies on being unlayered.

## Verifying a change is visually safe

A Playwright screenshot diff is the gate. From `apps/dox`:

```sh
pnpm --filter @gmt/dox build          # then: astro preview --port 4321
# capture landing / a dense reference page / sidebar / search modal / mobile menu,
# in light + dark, desktop + mobile; compare byte-for-byte against a pre-change build.
pnpm --filter @gmt/dox check && pnpm --filter @gmt/dox lint
```

A pure refactor (renames, file moves, role-token swaps) must produce a
**byte-identical** screenshot set. Any diff is a regression unless it's the exact
change you intended, confined to the region you touched.
