# Dox theme — architecture & maintenance

> The visual language itself (palette intent, "maximal chrome, disciplined content
> surface") is [reference/visual-design.md](visual-design.md) — this file is the
> _implementation_.

How `apps/dox`'s theme is put together, and the rules for changing it without
making a mess.

## The stylesheet stack

The theme is plain CSS custom properties — **no Tailwind, no `@layer`**. It beats
Starlight's defaults by being unlayered (unlayered always wins over `@layer`).
**One exception:** `DOX-C0` (#171) scopes Tailwind v4 to the chat island for AI
Elements. It never touches these sheets, and the rules that keep it contained are in
"Tailwind in the chat island" below.
Eight files, loaded in this order via `starlight({ customCss })` in
`apps/dox/astro.config.mjs`:

| #   | File                 | Owns                                                                                                                                                                                                                                                                                                                                                                              |
| --- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `gmt-tokens.css`     | The palette (6 roles), every `--gmt-*` token, the `@font-face`, and the `[data-theme="light"]` value block. **Custom properties only — no selectors.**                                                                                                                                                                                                                            |
| 2   | `gmt-theme.css`      | Maps `--gmt-*` onto Starlight's `--sl-*` system (+ a 3-line light override for the non-palette literals). Theming Starlight's built-ins happens here.                                                                                                                                                                                                                             |
| 3   | `gmt-primitives.css` | Reusable, Starlight-agnostic recipe classes: `.gmt-glass` / `-subtle` / `-clear` / `-heavy`, `.gmt-brackets`, `.gmt-icon-button`. **Compose from these in widgets.**                                                                                                                                                                                                              |
| 4   | `gmt-glass.css`      | The glass treatment applied to Starlight's own elements (header, sidebar, `pre`, tables, asides, cards, search, dialogs).                                                                                                                                                                                                                                                         |
| 5   | `gmt-shell.css`      | Global typography + the layout frame (`.page`, sidebar, header, site title).                                                                                                                                                                                                                                                                                                      |
| 6   | `gmt-content.css`    | The reading surface: everything inside `.sl-markdown-content`, Expressive Code frame chrome, the search modal / Pagefind UI.                                                                                                                                                                                                                                                      |
| 7   | `gmt-controls.css`   | Interactive chrome: CTA buttons, prev/next pagination, mobile search trigger, hamburger, `:focus-visible`, `::selection`, scrollbar.                                                                                                                                                                                                                                              |
| 8   | `gmt-light.css`      | The `[data-theme="light"]` overrides that are neither a palette re-tint nor adjacent to a base rule. **Not actually loaded last** — `dox.css` (live component layout) and `gmt-a11y.css` (`prefers-reduced-transparency`/`-contrast`/`forced-colors`) both load after it in `astro.config.mjs`'s `customCss` array; this table's numbering is source-order, not "wins every tie." |

**`gmt-ask.css` and `gmt-ask-tailwind.css` (DOX-C0, #171 — built) are deliberately
NOT in `customCss`.** Both are imported from the chat island's entry module
(`AskDoxProbe.tsx`) instead, so Vite code-splits them into the island's own chunk —
a page that never opens the chat loads neither. Unlayered rules beat `@layer
utilities` regardless of import order, so nothing about the cascade is lost by
keeping them outside this table's numbering.

The `customCss` array in `astro.config.mjs` also carries per-widget and per-feature
sheets (`gmt-widget.css`, `gmt-clock-list.css`, `gmt-map.css`, `gmt-globe.css`,
`gmt-scrubber.css`, `gmt-dst-inspector.css`, …) loaded between #7 and #8, with
`gmt-clock-list.css` registered before `gmt-map.css`/`gmt-globe.css`/`gmt-scrubber.css`
since it's now the shared `.gmt-clock-*` row recipe all three widgets sit on top of.
This table describes the **core stack** whose order the cascade depends on; consult
the config for the full list. (`gmt-hero.css` — extracting `HeroGlobe.astro`'s
`.gmt-herostage*` out of its current `@layer starlight.core` — was scoped for `DOX-E1`
but not done; still pending, tracked only here, not as a separate issue.)

Component-scoped `<style>` blocks stay in their `.astro` files
(`Hero`, `LinkButton`, `ButtonLink`, `Icon`, `SocialIcons`, `ThemeSelect`, `Header`) —
the idiomatic Starlight override pattern. They consume the tokens/primitives above;
they don't redefine them.

## `/dox` and the header link (DOX-C0, #171 — promoted early)

`DOX-C3a`'s spec calls for the `/dox` route and a persistent, every-page entry point
("Host 1", the draggable dock). Both were promoted into `DOX-C0` at explicit user
request, ahead of `DOX-C1`/`DOX-C2` landing — with a scope cut recorded here so a
later reader isn't confused about what actually exists:

- **`apps/dox/src/pages/dox.astro`** is the real, permanent `/dox` route (replacing
  what was a `/ask-probe` build-verification fixture). It hosts the same static,
  non-networked `AskDoxProbe` island DOX-C0 built to prove the wiring — hardcoded
  messages, no `useChat`, no `/api/chat`. `pagefind: false` and `noindex` stay set:
  there is no real answerable content until `DOX-C1`–`DOX-C3b` land, and the page
  says so in its own copy.
- **The every-page entry point is a plain header link, not the draggable dock.**
  `Header.astro` (a new component override) adds an "Dox" `ButtonLink` into the
  header's right-hand group, linking to `/dox/`. The full dock — drag, resize,
  focus trap, `prefers-reduced-motion`, keyboard dock-position cycling — is real,
  substantial UI work specified in `visual-design.md` §Overlays, and needs a working
  `/api/chat` behind it to be worth building; faking that now would be worse than a
  plain link. `DOX-C3a` replaces this link with the actual dock when it lands.
- **`Header.astro` composes Starlight's own sub-components via
  `virtual:starlight/components/*`** (`Search`, `SiteTitle`, `SocialIcons`,
  `ThemeSelect`, `LanguageSelect`) rather than importing
  `@astrojs/starlight/components/*.astro` directly — the direct-file-import path
  resolves to Starlight's _defaults_, silently bypassing this repo's own
  `SocialIcons.astro` and `ThemeSelect.astro` overrides. The virtual module path is
  config-aware and composes whatever `astro.config.mjs`'s `components` map actually
  points at, matching how Starlight's own internal `Header.astro` does it.
  TypeScript has no ambient types for `virtual:starlight/components/*` in a
  consuming project (only Starlight's own package build sees its
  `virtual-internal.d.ts`) — `apps/dox/src/virtual-starlight.d.ts` supplies them,
  mirroring that file's declarations exactly. Re-check this file against
  `@astrojs/starlight` on every Starlight upgrade.

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
they get _extra_ alpha in light mode to compensate for the brighter light-mode
teal ("light-compensated"). Don't merge the two sets.

**Theme-role tokens** — `--gmt-code-surface`, `--gmt-code-bg`, `--gmt-code-border`,
`--gmt-sidebar-link`, `--gmt-pagination-title`. Each resolves to a _different
token_ in dark vs light (not just a re-tint), so the rule that uses it needs no
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
5. **Don't introduce `@layer` into the GMT sheets.** The whole system relies on being
   unlayered, and that is what lets it beat Starlight's defaults. `DOX-C0` (#171) brings
   Tailwind v4 in for the chat island, and Tailwind emits
   `@layer theme, base, components, utilities`. That is allowed **only** under the
   constraints in the next section. The GMT sheets themselves stay unlayered.

## Dox's brains and the free-tier quota (DOX-C3a, #139 — built)

Gemini's free tier allows **20 requests per day**, and the quota id says exactly which
dimension: `GenerateRequestsPerDay**PerProject**PerModel-FreeTier`. Google's docs confirm
*"Limits are applied per project rather than per API key, and RPD quotas reset at midnight
Pacific time."* So the allowance is shared by every visitor — the first ~20 people between
them would exhaust `/dox` for the day.

**The escape hatch is in that same id: the allowance is per _model_.** `src/lib/chat-constants.ts`
holds an ordered `BRAINS` list, and Dox moves between them as each one's separate budget runs
out. Four brains is roughly four times the budget.

Rules that keep this honest:

1. **`dailyLimit` is advisory.** It renders the badge and nothing else. The only real gate is
   Google's 429 — a wrong number here misprints a digit, it cannot let a request through.
2. **The chain self-prunes.** A brain that answers 404/400 is marked `unavailable` for the
   Pacific day and skipped; a 429 marks it `spent`. Both expire at midnight, so a model
   Google restores comes back on its own. This is not hypothetical: `gemini-2.5-flash` was
   withdrawn for new keys *mid-story* during DOX-C2. **Never hardcode a model list that
   assumes availability.**
3. **The ledger is Workers KV, and eventual consistency is fine** precisely because of rule 1.
   A Durable Object's strong consistency would buy nothing and is not free.
4. **`maxRetries: 1` on `streamText`.** The SDK retries a 429 three times with backoff by
   default, which made sense with one model. With failover it is harmful: a *daily* quota will
   not refill for hours, so the backoff only delays telling the reader and delays marking the
   brain so the next request can route elsewhere.
5. **Day keys are Pacific, computed with `@northguild/gmt`** (`src/lib/pt-day.ts`) — two days a
   year are 23 and 25 hours long, which is exactly the arithmetic this library exists to get
   right.

**Nobody gets "unlimited" on the free tier, including the dev team.** The pool is a fixed
project ceiling. The dev cookie exempts its holder from the *per-visitor* cap only, and the UI
must never imply otherwise.

## Tailwind in the chat island (DOX-C0, #171 — built)

AI Elements requires Tailwind CSS 4. It is scoped to the chat island and **must not reach
any other page**. Four constraints make that true; all four are `DOX-C0` DoD items.

> **Re-point Tailwind's `dark:` variant at `data-theme` (DOX-C3a, #139).** By default v4
> keys `dark:` to `prefers-color-scheme` — the OS — while this site keys everything to
> `<html data-theme>`. Starlight's inlined `ThemeProvider` always writes that attribute,
> resolving its own "auto" from `prefers-color-scheme` first, so the attribute is the
> complete source of truth and no media fallback is needed:
>
> ```css
> @custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
> ```
>
> Without it the two disagree for any reader whose OS and site theme differ, and every
> `dark:` utility inside the island silently picks the wrong branch. This is not
> hypothetical: Shiki's dual-theme output is entirely `dark:`-gated, so an OS-light /
> site-dark reader got the github-**light** token colours — near-black `rgb(36,41,46)`
> code on the dark code surface. One line fixes every such utility at once.

1. **Omit Preflight, and disable Tailwind's automatic content scan.** Tailwind's reset
   targets `*`, `html`, `body` and headings and would wreck the docs. Import the layers
   individually — the documented v4 opt-out — **and add `source(none)`**: without it,
   Tailwind scans all of `apps/dox`, including the ~504 generated reference pages, looking
   for class names to keep, producing a much larger utility sheet than the island needs.

   ```css
   @layer theme, base, components, utilities;
   @import "tailwindcss/theme.css" layer(theme);
   /* preflight.css deliberately NOT imported */
   @import "tailwindcss/utilities.css" layer(utilities) source(none);

   @source "../components/ai-elements";
   @source "../components/ui";
   @source "../components/ask";
   @source "../../node_modules/streamdown/dist/*.js";
   @source "../../node_modules/@streamdown/cjk/dist/*.js";
   @source "../../node_modules/@streamdown/code/dist/*.js";
   @source "../../node_modules/@streamdown/math/dist/*.js";
   @source "../../node_modules/@streamdown/mermaid/dist/*.js";
   ```

   The `@source` lines on Streamdown's own `dist/*.js` are required by Streamdown's README
   — it ships Tailwind utility classes in its compiled output, not just source. List a
   plugin's `@source` line only if that plugin is actually installed (`message.tsx` imports
   all four).

2. **Import that sheet from the island's entry module, never from `customCss`.**
   Vite then code-splits it into the island's own chunk, so a page that never opens the
   chat never loads it. (`gmt-ask-tailwind.css` and `gmt-ask.css` both live outside this
   file's stylesheet-stack table for the same reason — see the note there.)

3. **Know which way the cascade falls.** Tailwind utilities are in `@layer utilities`;
   these sheets are unlayered, and unlayered always wins. **So every GMT rule beats every
   Tailwind utility.** The collision set has **six** groups, not the three originally
   assumed — verified by a full scan of the 22 sheets on 2026-09-09, this is the list to
   re-check rather than re-derive:

   | Selector                                                                    | File                                               | What it sets                                                               | Why it matters here                                                                                       |
   | --------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
   | `h1`–`h6`                                                                   | `gmt-shell.css`                                    | font-family, font-weight, letter-spacing, color (h1 also forces font-size) | hits markdown headings in replies                                                                         |
   | `textarea`, `input:not([type=checkbox\|radio\|range])`, `[contenteditable]` | `gmt-controls.css`                                 | caret-color                                                                | hits the composer and every AI Elements input                                                             |
   | `header`                                                                    | `gmt-glass.css`, `gmt-shell.css`, `gmt-a11y.css`   | `backdrop-filter`, background, border                                      | would nest a second blur inside a future dock header — visual-design.md's "one layer of glass, never two" |
   | `dialog`, `[role="dialog"]`                                                 | `gmt-content.css`, `gmt-glass.css`, `gmt-a11y.css` | background, border, `backdrop-filter`                                      | `[role="dialog"]` matches **every Radix overlay** AI Elements renders                                     |
   | `::selection`, `input::selection`, `textarea::selection`                    | `gmt-controls.css`                                 | selection background/color                                                 |                                                                                                           |
   | `body`                                                                      | `gmt-shell.css`                                    | background, color, 2 scrollbar pseudo-selectors                            | not applicable inside the panel                                                                           |

   `gmt-ask.css` ships a scoped `.gmt-ask` reset for all six groups, not just the two the
   original draft of this section named.

4. **Bridge, don't fork, the palette.** Map shadcn's variables (`--background`,
   `--foreground`, `--primary`, `--muted`, `--border`, `--ring`, …) onto the `--gmt-*`
   tokens. Rule 1 still applies: no `[data-theme="light"]` color blocks — add a theme-role
   token instead. `--gmt-danger` (new) backs `--destructive`; `--gmt-signal` (amber) is
   reserved exclusively for the sentinel "no signal" state and must not be reused for it.

**Correction (2026-09-09): the Streamdown reading surface is NOT Tailwind-free.**
Streamdown 2.6.0 emits exactly one `[data-streamdown="…"]` attribute
(`table-wrapper`) — none of the `heading-1` / `link` / `code-block` / … values this
section originally assumed exist. Streamdown's own components ship Tailwind utility
classes and need shadcn's CSS variables to render correctly at all (its README says so).
The actual approach: Tailwind (via the `@source` lines above) provides the structural
baseline, and unlayered `.gmt-ask-response …` descendant selectors in `gmt-ask.css`
override it — unlayered beats `@layer utilities` regardless of import order, the same
idiom `gmt-content.css` already uses over `.sl-markdown-content`. `MessageResponse` is
given `className="gmt-ask-response"` explicitly at every call site (see
`AskDoxProbe.tsx`) — that classname, not a `data-streamdown` attribute, is the real
styling hook, and it's also the hook `DOX-C3a`'s link-hardening `components.a` override
composes with.

## Verifying a change is visually safe

`apps/dox/scripts/visual-snapshot.mjs` (added in `DOX-E1`'s part-2 branch; automated in
`DOX-C0`, #171) is the gate. From `apps/dox`, before touching any CSS:

```sh
pnpm build && pnpm visual:before   # captures .visual/before/<page>-<theme>-<viewport>.png
# ... make the change ...
pnpm build && pnpm visual:after    # captures .visual/after/... for the same page/theme/viewport set
pnpm visual:diff                   # asserts before ~= after — exits non-zero over threshold
```

Fixed page list: `/` (hero), `/install` (dense reference page, zero islands),
`/tools/zoned-earth`, `/tools/zone-planner`, one Tier-2/3 teaching-widget page — plus
two interaction states, the **search modal** (desktop) and the **mobile menu**
(mobile), each captured mid-open. Both `data-theme="dark"`/`"light"`, both desktop
(`1440×900`) and mobile (`390×844`) viewports — 24 snapshots total.

**`visual:diff` is a perceptual pixel diff (`pixelmatch`), not a byte-identical hash.**
Byte-identical was tried first and doesn't hold up: any page with
`backdrop-filter: blur()` (the glass panels, the search modal's dimmed backdrop)
re-encodes to a different PNG on every single capture even with zero code change,
confirmed by diffing two runs of an unmodified build — the difference is GPU blur
dithering noise (sub-visual, but it cascades through PNG compression into a
wholesale-different file). This is a known class of flakiness for GPU-composited
blur, which is why every real screenshot-diff tool (Percy, Chromatic, Playwright's
own `toHaveScreenshot`) compares pixels with a tolerance instead of hashing.
`MAX_DIFF_PIXEL_RATIO` in the script (0.2%) is tuned to absorb that noise (observed:
0.000%–0.012% on an unmodified build) while still failing hard on a real regression
(verified against a deliberately broken `--gmt-void` token: 84%–97% diff on every
affected page).

Two more sources of run-to-run noise are neutralized before the pixel diff ever runs,
both in the capture script itself:

- **The globe's live clock text** (`.gmt-clock-time`, `.gmt-globe-tooltip-time` —
  re-rendered every second) is covered with Playwright's `mask` option on every shot.
- **The globe's ambient auto-rotation** is stopped by emulating
  `prefers-reduced-motion: reduce` for every captured page/context — `globe.ts`
  already checks this media query and skips starting ambient rotation when it
  matches, so this isn't a workaround, it's using an existing, real code path.

```sh
pnpm check && pnpm lint && pnpm test
```

A pure refactor (renames, file moves, role-token swaps) must produce a **near-zero
pixel diff** on every page not intentionally touched by the change. A diff beyond
`MAX_DIFF_PIXEL_RATIO` is a regression unless it's the exact, deliberate change —
in which case update the baseline and say so in the PR, don't loosen the threshold.
