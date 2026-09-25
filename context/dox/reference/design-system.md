# Dox theme — implementation rules

> The visual language itself ("maximal chrome, disciplined content surface") is
> [visual-design.md](visual-design.md). This file is the implementation.

## The stylesheet stack

The theme is plain, **unlayered** CSS custom properties — no Tailwind, no `@layer` — which is
what lets it beat Starlight's defaults. The core sheets load in this order via
`starlight({ customCss })` in `apps/dox/astro.config.mjs`:

| #   | File                 | Owns                                                                                                          |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | `gmt-tokens.css`     | Palette (6 roles), every `--gmt-*` token, `@font-face`, the `[data-theme="light"]` value block. Custom properties only |
| 2   | `gmt-theme.css`      | Maps `--gmt-*` onto Starlight's `--sl-*`                                                                      |
| 3   | `gmt-primitives.css` | Reusable recipes: `.gmt-glass*`, `.gmt-brackets`, `.gmt-icon-button`, `.gmt-dox-mark*`, sonar focus          |
| 4   | `gmt-glass.css`      | Glass on Starlight's own elements (header, sidebar, `pre`, tables, asides, search, dialogs)                   |
| 5   | `gmt-shell.css`      | Global typography and the layout frame                                                                        |
| 6   | `gmt-content.css`    | The reading surface (`.sl-markdown-content`), Expressive Code chrome, the search modal                        |
| 7   | `gmt-controls.css`   | CTA buttons, pagination, `:focus-visible`, `::selection`, scrollbars                                          |
| 8   | `gmt-light.css`      | Light overrides that are neither a palette re-tint nor adjacent to a base rule                                |

Per-widget sheets (`gmt-widget.css`, `gmt-clock-list.css` — before `gmt-map.css`,
`gmt-globe.css` and `gmt-scrubber.css`, which build on its row recipe — `gmt-dst-inspector.css`,
…) load between 7 and 8; `dox.css` and `gmt-a11y.css` load after 8. The config has the full
list.

**The chat's sheets are not in `customCss`.** `gmt-ask-tailwind.css`, `gmt-ask.css` and
`gmt-hive.css` are imported from `src/components/ask/DoxChat.tsx`, so Vite code-splits them into
the `/dox` island and no other page loads them.

Component `<style>` blocks stay in their `.astro` files and consume the tokens; they never
redefine them.

## Tokens

- **Palette:** `--gmt-void / cyan / spring / teal / ice / signal`, each re-tinted in the light
  block.
- **Glass scale:** fills `--gmt-fill-subtle` … `--gmt-fill-deep`; borders `--gmt-border`,
  `--gmt-border-strong`, `--gmt-hairline-faint`; plus `--gmt-glow`, `--gmt-highlight*`,
  `--gmt-signal-fill/-border`, `--gmt-scrollbar-*`.
- `--gmt-glass-tint / -subtle / -scrim` carry extra alpha in light mode. Keep them separate from
  `--gmt-fill-*`.
- **Theme-role tokens** (`--gmt-code-surface`, `--gmt-sidebar-link`, …) resolve to a different
  token per theme, so the rule that uses one needs no light block.
- **`-ink` tokens** (`--gmt-cyan-ink`, `--gmt-spring-ink`, `--gmt-purple-ink`, `--gmt-signal-ink`,
  `--gmt-severity-critical-ink`, `--gmt-severity-high-ink`, `--gmt-dst-gold-ink`) are the
  text-safe variant of an accent. See rule 6.
- **`--gmt-ice-dim`** is the muted/secondary text tier — retuned per theme so every `color:` use
  clears 7:1 while staying visibly quieter than `--gmt-ice`. `--gmt-ice-dim-fill` keeps the old
  (pre-retune) value for the handful of non-text consumers — a low-alpha wash or hatch pattern,
  never a rule's `color:` — that would have looked wrong re-tinted alongside it.

## Maintenance rules

1. **Never add a `[data-theme="light"]` block for a colour.** Use the re-tinted token, or add a
   theme-role token in `gmt-tokens.css`. A light rule is only for a non-colour effect (a
   `backdrop-filter`, a scrollbar tweak), and goes in `gmt-light.css` unless a base rule for the
   same selector lives elsewhere.
2. **No colour literals in rules.** One-off gradient stops are the only exception.
3. **Widgets compose primitives** and never touch a Starlight-override sheet.
4. **Respect the `customCss` order.** Moving a rule between files can change which of two
   equal-specificity rules wins — verify with the visual gate below.
5. **No `@layer` in the GMT sheets.** Tailwind's layers exist only inside the chat island, under
   the constraints below.
6. **An accent used as text uses its `-ink` theme-role token; the bright accent is for fills,
   borders and non-text only.** `--gmt-cyan`, `--gmt-cyan-bright`, `--gmt-spring`, `--gmt-signal`
   and `--gmt-dst-purple` are tuned to read well as a *fill* or a *border* against the page — a
   3:1 bar — and several of their light-theme re-tints fall to ~2.5–3.7:1 once painted as
   `color:` on a light surface, under this site's 7:1 text floor
   (`context/dox/reference/verification-and-risks.md`). Each has an `-ink` sibling in
   `gmt-tokens.css`: dark value an alias onto the base token (pixel-identical, unchanged), light
   value the same hue darkened until every surface it sits on clears 7:1.
   `--gmt-cyan-bright` reuses `--gmt-cyan-ink` rather than getting its own token — the two land
   within a few hex digits of each other once both are darkened for 7:1, so a second token would
   only have duplicated it. `--gmt-severity-critical-ink` (an alias onto `--gmt-cyan-ink`),
   `--gmt-severity-high-ink` and `--gmt-dst-gold-ink` are the same pattern one level down, for
   the two tokens whose own base value is already a fill/border colour
   (`--gmt-severity-high` is `--gmt-teal`; the DST inspector's gap/overlap badges pair
   `--gmt-dst-gold`/`--gmt-dst-purple` with their own wash). A drag handle, an SVG icon glyph or
   any other non-text use of an accent stays on the bright token — a focus ring only needs 3:1,
   and `--gmt-cyan` already clears it (3.38:1 against `#f5f5f5`). `--gmt-ice-dim` is the one
   token retuned directly rather than split: it is overwhelmingly a `color:` use (captions, table
   headers, idle sidebar links, and the tokens that alias it — Starlight's `--sl-color-gray-2`,
   Pagefind's `--pagefind-ui-text`, shadcn's `--muted-foreground`), so the base value moved and
   `--gmt-ice-dim-fill` keeps the old one for the few non-text consumers a retune would have
   changed the look of.

## `/dox` and the header

- `src/pages/dox.astro` wraps `<StarlightPage>` so the chat keeps the site's `customCss`;
  `data-dox-shell` hides Starlight's header and `<h1>` for a full-bleed page. `noindex`,
  `pagefind: false`.
- `Header.astro` adds the "Ask Dox" link: a plain `<a>` carrying `DoxMark.astro`, no JavaScript.
- `Header.astro` composes Starlight's parts via `virtual:starlight/components/*`, not
  `@astrojs/starlight/components/*.astro`. The direct path resolves Starlight's defaults and
  silently bypasses this repo's `SocialIcons` and `ThemeSelect` overrides. Types for the virtual
  modules live in `src/virtual-starlight.d.ts`; re-check it on every Starlight upgrade.

## The composer control bar

- The brain menu (Radix `DropdownMenu`, `menuitemradio`) and the reset clock (Popover + cmdk) sit
  in `PromptInputTools`, left of Send, and both open upward. The `/dox` strip holds wayfinding,
  the header clock and the Live/Local badge.
- The brain menu groups brains by provider, each heading showing that provider's reset.
- The reset chip shows whatever refills next (`src/lib/quota-resets.ts`). Every format is one gmt
  call (`src/lib/reset-formats.ts`), shown with its reference link, opened in a new tab.
- **Dates render after mount only.** The reader's zone and locale are not the server's (#418).
  Picks persist in `localStorage` (`dox:reset-zone`, `dox:reset-format`).
- **Nothing implies "unlimited".** The dev cookie exempts its holder from the per-visitor cap,
  never from the shared pool.

## Tailwind in the chat island

AI Elements needs Tailwind CSS 4, and it must not reach any other page:

1. **No Preflight, no automatic content scan** (`gmt-ask-tailwind.css`):

   ```css
   @layer theme, base, components, utilities;
   @import "tailwindcss/theme.css" layer(theme);
   /* preflight.css deliberately NOT imported */
   @import "tailwindcss/utilities.css" layer(utilities) source(none);

   @source "../components/ai-elements";
   @source "../components/ui";
   @source "../components/ask";
   @source "../../node_modules/streamdown/dist/*.js";
   /* …plus each installed @streamdown/* plugin's dist */
   ```

   Streamdown ships utility classes in its compiled output, so its `dist` needs `@source` lines.
2. **Import that sheet from the island's entry module, never from `customCss`.**
3. **Unlayered GMT rules beat every Tailwind utility.** `gmt-ask.css` ships a scoped `.gmt-ask`
   reset for the six collision groups: `h1`–`h6` (typography), `textarea` / `input` /
   `[contenteditable]` (caret), `header` (`backdrop-filter`), `dialog` / `[role="dialog"]`
   (matches every Radix overlay), `::selection`, and `body`.
4. **Bridge the palette.** shadcn's variables (`--background`, `--primary`, `--border`, `--ring`,
   …) map onto `--gmt-*`; `--gmt-danger` backs `--destructive`. Amber stays reserved for the
   sentinel.

- **`dark:` follows `data-theme`, not the OS:**
  `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));`. Without it,
  Shiki's `dark:`-gated token colours pick the wrong theme for anyone whose OS and site theme
  differ.
- **Streamdown is styled through `.gmt-ask-response`**, a class passed to every `MessageResponse`,
  with unlayered overrides in `gmt-ask.css`. Streamdown emits a single `data-streamdown`
  attribute (`table-wrapper`), so there are no attribute hooks to style against.

## Verifying a change is visually safe

From `apps/dox`:

```sh
pnpm build && pnpm visual:before   # baseline, on a clean tree
# ... make the change ...
pnpm build && pnpm visual:after
pnpm visual:diff                   # exits non-zero over threshold
```

- The captured pages — landing, a dense reference page, the tool pages, one page per teaching
  widget — plus the search modal and mobile menu, in both themes at 1440×900 and 390×844.
- A perceptual pixel diff (pixelmatch), not a hash: GPU blur re-encodes differently on every
  capture. `MAX_DIFF_PIXEL_RATIO` is 0.2%.
- Masked: live clock text and the globe canvas (the day/night terminator moves with time).
  `prefers-reduced-motion` emulation stops the globe's ambient spin.
- **`scripts/html-diff.mjs`** is the structural gate for widget markup the pixel diff cannot
  see — a dropped `selected`, a missing `data-role`: `capture <dir>`, then `compare <dir>`. It
  separates "the widget changed" (✗) from "only the page around it changed" (~).
- A diff over threshold is a regression unless it is the deliberate change — then re-baseline
  and say so. Never loosen the threshold.
