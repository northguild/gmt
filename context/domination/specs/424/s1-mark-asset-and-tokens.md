# S1 — The NorthGuild mark: asset, component, tokens

Spec: [index.md](index.md) (D1–D4, D9). Read
[visual-design.md § Colour](../../../dox/reference/visual-design.md#colour) and
[design-system.md § `/dox` and the header](../../../dox/reference/design-system.md) first.

## 1. Move the file

From the repo root, as a plain move (the file is untracked, so do not use `git mv` and stage nothing):

```sh
mv northguild-logo.svg apps/dox/src/assets/northguild-logo.svg
```

Afterwards the repo root has no `northguild-logo.svg`. `apps/dox/src/assets/` already exists
(it holds `og-fonts/`).

## 2. Edit the file: colours out, classes in

Change only these attributes. Every `d` string and the `viewBox` stay byte for byte.

| Path (in file order) | Was | Becomes |
| --- | --- | --- |
| root `<svg>` | `role="img" aria-label="Northguild logo"` | both removed (the link names itself, D6) |
| 1, whole shield | `fill="#184165"` | `class="gmt-ng-body"` |
| 2, left half of shield | `fill="#22517B"` | `class="gmt-ng-body-lit"` |
| 3, peaks | `fill="#3B8EC3"` | `class="gmt-ng-field"` |
| 4, left half of peaks | `fill="#57B2DE"` | `class="gmt-ng-field-lit"` |
| 5, `</>` glyphs | `fill="#FFFFFF"` | `class="gmt-ng-glyph"` |

Keep `xmlns` and `viewBox="0 0 1000 1317"`. The file now has no `fill` attribute and no hex
colour. The geometry fingerprint is the SHA-256 of the five `d` values in file order, joined by
`\n`. It is
`0268a20c07b649905c3785c21869f72775ccf2148449468b0ef204227ca509bd` and must not change.

## 3. `apps/dox/src/components/NorthGuildMark.astro` (new)

The counterpart of `DoxMark.astro`. It renders the imported SVG component and owns its
attributes, so no caller can forget them:

```astro
---
import Logo from "~/assets/northguild-logo.svg";
---
<Logo class="gmt-ng-mark" aria-hidden="true" focusable="false" />
```

- The header comment says what the mark is, that it is `aria-hidden` because every user
  supplies the name, and that its fills live in `gmt-primitives.css` because scoped styles do
  not reach an imported SVG's paths.
- Before writing the import, check that the `~/` alias resolves `src/assets`. If it does not,
  use a relative path (`../assets/northguild-logo.svg`).
- No props: the mark has one size per use, and the caller's CSS sets it.

## 4. Tokens: `apps/dox/src/styles/gmt-tokens.css`

Add a block named `NorthGuild mark (#424)` to the `:root, .gmt-theme-dark` block, with a
one-line comment for each token that names its palette source:

```css
--gmt-logo-body: #0e7490;      /* Teal */
--gmt-logo-body-lit: #107e99;  /* Teal mixed with 10% Cyan, in srgb */
--gmt-logo-field: #22d3ee;     /* Cyan */
--gmt-logo-field-lit: #67e8f9; /* Cyan bright */
--gmt-logo-glyph: #ffffff;
```

In the `[data-theme="light"]` block, override only the body pair:

```css
--gmt-logo-body: #045268;      /* light --gmt-cyan-ink */
--gmt-logo-body-lit: #0e7490;
```

The dark island (`.gmt-theme-dark`) gets the dark values from the shared block, so it needs no
extra rule. The comment above the light pair records the contrast table below in one line per
theme.

### Contrast, measured with the WCAG 2.2 relative-luminance formula

| | Dark: void `#03080c` / surface `#061018` / surface-2 `#0a1a24` | Light: `#ffffff` / `#f5f5f5` / `#ececec` |
| --- | --- | --- |
| body vs header background | 3.75 / 3.58 / 3.30 | 8.71 / 7.99 / 7.37 |
| lit body vs header background | 4.28 / 4.08 / 3.77 | 5.36 / 4.91 / 4.54 |
| glyph on body / on lit body | 5.36 / 4.70 | 8.71 / 5.36 |
| field on body / lit field on lit body | 2.96 / 3.24 | 4.82 / 3.70 |

Gates: the shield's outer parts are **≥ 3:1** against the rendered header background (SC
1.4.11). The glyphs are **≥ 4.5:1** against the body part behind them. That is a house floor:
SC 1.4.3 exempts logotypes, but `</>` is the mark's detail. The field against the body is
shading and has no gate (the original measures 2.95:1).

## 5. Fills: `apps/dox/src/styles/gmt-primitives.css`

Next to the `.gmt-dox-mark` rules, under a `NorthGuild mark (#424)` comment:

```css
.gmt-ng-mark { display: block; block-size: 2rem; inline-size: auto; }
.gmt-ng-body { fill: var(--gmt-logo-body); }
.gmt-ng-body-lit { fill: var(--gmt-logo-body-lit); }
.gmt-ng-field { fill: var(--gmt-logo-field); }
.gmt-ng-field-lit { fill: var(--gmt-logo-field-lit); }
.gmt-ng-glyph { fill: var(--gmt-logo-glyph); }
```

No colour literal here. The tokens carry every value.

## 6. Forced colours: `apps/dox/src/styles/gmt-a11y.css`

Inside the existing `@media (forced-colors: active)` block, with a comment pointing to D9:

```css
.gmt-ng-mark { forced-color-adjust: none; }
.gmt-ng-body, .gmt-ng-body-lit { fill: LinkText; }
.gmt-ng-field, .gmt-ng-field-lit, .gmt-ng-glyph { fill: Canvas; }
```

## 7. Test: `apps/dox/src/components/NorthGuildMark.test.ts` (new)

Reads `src/assets/northguild-logo.svg` with `node:fs` (no build needed) and asserts:

1. It has exactly five `<path>` elements, and the SHA-256 of their `d` values in order, joined by
   `\n`, equals the fingerprint in §2.
2. `viewBox` is `0 0 1000 1317`.
3. The file has no `fill=` attribute, no `#` followed by three to eight hex digits, no `role` and
   no `aria-label`.
4. The class list, in order, is `gmt-ng-body`, `gmt-ng-body-lit`, `gmt-ng-field`,
   `gmt-ng-field-lit`, `gmt-ng-glyph`.
5. `gmt-tokens.css` defines all five `--gmt-logo-*` tokens in the dark block and both body
   tokens in the light block. Each class in item 4 has a `fill: var(--gmt-logo-…)` rule in
   `gmt-primitives.css`.
6. With the WCAG relative-luminance formula on the token values, read from the CSS rather than
   copied into the test: the body and lit body are ≥ 3:1 against `--gmt-void`, `--gmt-surface`
   and `--gmt-surface-2` in each theme, and the glyph is ≥ 4.5:1 against both body tokens in each
   theme. `src/lib/text-contrast.test.ts` already has the block split, `hexOf`, `luminance` and
   `ratio`. Move those four into a shared test helper (`src/test/token-contrast.ts`) and import
   them in both tests. Do not copy them a second time.

The test names say what is checked, for example
`"the mark keeps the shield's five shapes byte for byte"`.

## Definition of done (dox-tester runs these literally)

From the repo root unless stated.

1. `test ! -e northguild-logo.svg` succeeds, and `test -f apps/dox/src/assets/northguild-logo.svg`
   succeeds.
2. `git status --porcelain` shows no staged entry (no line starting with a letter in column 1).
3. `grep -c 'fill=' apps/dox/src/assets/northguild-logo.svg` prints `0`.
   `grep -Ec '#[0-9A-Fa-f]{3,8}' apps/dox/src/assets/northguild-logo.svg` prints `0`.
4. The geometry fingerprint matches:
   `python3 -I -c "import re,hashlib;s=open('apps/dox/src/assets/northguild-logo.svg').read();print(hashlib.sha256('\n'.join(re.findall(r' d=\"([^\"]*)\"',s)).encode()).hexdigest())"`
   prints `0268a20c07b649905c3785c21869f72775ccf2148449468b0ef204227ca509bd`.
5. `pnpm --filter @gmt/dox exec vitest run src/components/NorthGuildMark.test.ts --reporter=verbose`
   passes. Never run `vitest list --json` with a file path.
6. `pnpm --filter @gmt/dox check` and `pnpm --filter @gmt/dox lint` pass. `astro check` is what
   proves the `.svg` import type-checks.
7. After S2 renders the mark: on a built page in each theme, the computed `fill` of every
   `.gmt-ng-*` path equals its token value in that theme (dark `rgb(14, 116, 144)` for the body;
   light `rgb(4, 82, 104)`). With `forced-colors: active` emulated in Chromium, the body paths
   compute to the system `LinkText` and the glyphs to `Canvas`.
8. No commit, no `packages/gmt` build, no changeset.
