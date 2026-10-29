# Dox style guide

Where a CSS rule goes in `apps/dox`, and how to name it. Read this before writing or reviewing
any component style. The stylesheet stack, its load order, tokens and the visual gate are
owned by [design-system.md](design-system.md) — this file does not repeat them.

## Where a rule goes

- **A widget rule** goes in the widget's CSS Module (`src/widgets/tools/<widget>.module.css`).
  It is unlayered, so it beats every global rule without `!important`.
- **A family rule** goes in its family piece, `src/widgets/families/<family>/`.
- **A global rule** goes in its `gmt.*` layer. `src/styles/gmt.css` is the one `customCss`
  entry; it sets the layer order and imports every other sheet into a layer. Pick the owning
  layer and sheet from design-system.md: tokens, base, shell, content, controls, tools,
  third-party or a11y.
- **Chat sheets** sit in `gmt.chat`, after Tailwind's layers. `DoxChat.tsx` imports them.
- **The eight Astro components on `@layer starlight.*`** keep it.
- **Component `<style>` blocks** may stay in their `.astro` file when the rule is private to
  that component. They consume `--gmt-*` tokens and never redefine them. Components that
  already scope rules with `@layer` (`Hero.astro`, `HeroCopy.astro`, `HeroGlobe.astro`,
  `Header.astro`, `Icon.astro`, `LinkButton.astro`) keep the layer they use — changing it moves
  the rule's cascade position relative to Starlight.
- Do not create a new CSS file for a one-off rule.

## Token-only rule

No colour literals in any component style — every value goes through a `--gmt-*` token. Amber
is reserved for the sentinel state; its rarity is what makes it communicate. This is
`dox-builder.md` invariant #8.

## Class naming

- `gmt-*` — GMT primitives and Dox-owned classes. Starlight-agnostic where possible.
- `sl-*` — Starlight overrides, only when targeting Starlight-rendered markup.
- `why-date-*` — homepage why-date section classes. They live in `dox.css`, not in the
  components that use them.

## When two components share a rule

Merge it into one definition in the owning sheet. Duplicate rules across components are a
maintenance hazard.

## Container queries vs. `@media`

Homepage grid sections use `@container gmt-grid-section (...)` (defined in `dox.css`), not
`@media`. A viewport query fires at the wrong time once the section is squeezed into a narrow
grid column. Co-locate container-query rules with the container they query.

## Verification

From the repo root, with the `fnm` prefix described in `dox-builder.md`:

```sh
pnpm dox:lint && pnpm dox:test && pnpm dox:check && pnpm dox:build
```

The homepage (`index.mdx`) and `/why-gmt` are the visual regression targets; run the visual
gate in design-system.md for any change that could move pixels.
