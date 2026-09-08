# Dox style guide

The CSS architecture for `apps/dox`. Read this before writing or reviewing any component
style in Dox.

## Rule: no inline `<style>` in Astro components

Every style lives in `apps/dox/src/styles/*.css`, loaded via Starlight's `customCss` in
`astro.config.mjs`. Component markup uses classes from those sheets.

Inline `<style>` blocks are forbidden except for `@layer`-scoped overrides that cannot be
expressed as a reusable class — and those require explicit architect approval. See
`.agents/dox-architect.md` for the invariant.

Rationale: inline component styles bypass the layered `customCss` pipeline, create
unlayered cascade conflicts, and duplicate rules already defined centrally. They also
render in the document body (after the head bundle), so their cascade position differs
from every other rule in the system.

## The CSS file map and ownership

Loaded in order (see `astro.config.mjs` `customCss`). Earlier files set the base; later
files override. `dox.css` is second-to-last; `gmt-a11y.css` is last.

| File                    | Owns                                                                          |
| ----------------------- | ------------------------------------------------------------------------------ |
| `gmt-tokens.css`        | `:root` custom properties + `@font-face`. Source of every `--gmt-*` value.     |
| `gmt-theme.css`         | Maps `--gmt-*` onto Starlight's `--sl-*`.                                      |
| `gmt-primitives.css`    | Reusable Starlight-agnostic classes: `.gmt-glass*`, `.gmt-brackets`, `.gmt-icon-button`. |
| `gmt-glass.css`         | Glass treatment applied to Starlight selectors.                               |
| `gmt-shell.css`         | Typography + page layout frame.                                               |
| `gmt-content.css`       | `.sl-markdown-content` (headings, code, tables, links, tabs) + EC + search.   |
| `gmt-controls.css`      | `.sl-link-button`, pagination, focus, selection, scrollbar.                   |
| `dox.css`               | Homepage grid layout + live-component layout (hero, why-date sections).       |
| `gmt-globe.css`         | Globe-specific styles.                                                         |
| `gmt-a11y.css`          | `prefers-reduced-transparency` / `-contrast` / `forced-colors`. Loaded last.  |

When deciding where a new rule goes, ask: is this a Starlight element override, a reusable
primitive, homepage-specific layout, or interactive control chrome? That maps to one of
the sheets above. Do not create a new CSS file for a one-off rule.

## Token-only rule

No color literals in any component style. Every value goes through a `--gmt-*` token.
Amber is reserved exclusively for the sentinel state — its rarity is what makes it
communicate. This is `dox-builder.md` invariant #8.

## `@layer` convention

- `@layer starlight.core` — layout rules. Used by `Hero.astro`, `HeroCopy.astro`,
  `HeroGlobe.astro`, `LinkButton.astro`.
- `@layer starlight.components` — component-style rules. Used by `LinkButton.astro`.

When moving a `<style>` block out of a component, wrap it in the same layer it already
used. Changing the layer changes the cascade position relative to Starlight's own rules.

`gmt-controls.css` uses **unlayered** rules for `.sl-link-button`. That is the existing
convention for that file (it already handles pagination and the `.secondary` variant).
When consolidating `LinkButton.astro` into `gmt-controls.css`, follow the unlayered
convention — do not wrap the moved rules in `@layer`.

## Class naming convention

- `gmt-*` — GMT primitives and Dox-owned classes. Starlight-agnostic where possible.
- `sl-*` — Starlight overrides. Only when targeting Starlight-rendered markup.
- `why-date-*` — homepage why-date section classes. These live in `dox.css`, not in
  the components that use them.

## When two components share a rule

Merge it into a single definition in the owning sheet. Duplicate rules across components
are a maintenance hazard — when both move into the same file they must become one rule,
not two identical ones.

## Container queries vs. `@media`

Homepage grid sections use `@container gmt-grid-section (...)` (defined in `dox.css`),
not `@media`. A viewport query here would fire at the wrong time once the section is
squeezed into a narrow grid column. Co-locate container-query rules with the container
they query.

## Verification

After any change: `pnpm nx run-many -t lint test typecheck build` (with `fnm use &&`
prefix per `dox-builder.md`). The homepage (`index.mdx`) and `/why-gmt` are the visual
regression targets.