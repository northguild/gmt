### A1 — Workspace skeleton

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
A1 Create apps/dox workspace package and wire pnpm/nx/oxlint
```

**Description:**

```
Part of the Dox epic — see `context/cyber-dox/index.md`, Story Group A, item A1.

## Gap
`apps/` does not exist in this monorepo and is not a workspace glob. Dox needs its own
package before any code can land.

## Scope
- Create `apps/dox` as `@gmt/dox` (private, `"type": "module"`).
- Depend on `@burglekitt/gmt` via `workspace:*`.
- Update `pnpm-workspace.yaml` to add `- 'apps/*'`.
- Update root `package.json` `"workspaces"` array to add `apps/*` (it currently
  duplicates the pnpm glob as `["packages/*"]`).
- Update `oxlint.config.ts`'s `files.include` to add `apps/**` (currently
  `packages/**`, `docs/**`, `context/**`, `scripts/**`).
- Add root scripts `dox:dev` and `dox:build`.

## Before starting
Read `context/cyber-dox/overview.md` §2 (Architecture) and §4 (Workspace integration).
Confirm none of the three files listed above have already drifted since this was
written — re-check `pnpm-workspace.yaml`, root `package.json`, and `oxlint.config.ts`
directly rather than trusting this issue's snapshot.

## Definition of done
- `pnpm install` resolves with `apps/dox` present.
- `pnpm nx show projects` lists `dox`.
- `pnpm dox:dev` and `pnpm dox:build` exist as root scripts (they may no-op or fail
  until A2 adds a real app — that's fine, this story is plumbing only).
```

---

### A2 — Octane boots

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
A2 Boot Octane + TSRX runtime in apps/dox
```

**Description:**

```
Part of the Dox epic — see `context/cyber-dox/index.md`, Story Group A, item A2.
Depends on A1.

## Gap
`apps/dox` has no runtime yet. Dox is built on Octane (`.tsrx`), not React — see
`context/cyber-dox/overview.md` §1 "Verified findings" and §2 "Decisions taken" for why,
including the version trap and why `@octanejs/vite-plugin` is not needed.

## Scope
- Add `vite@^7` and `octane@0.1.35` — **exact version, no caret or range.** `octane` has
  abandoned 2015-era `1.0.0`–`1.0.3` releases that sort higher than `0.1.35` under
  semver; any range resolves to dead code. Re-verify the current `latest` dist-tag
  before installing (`pnpm view octane dist-tags`) in case it has moved since this was
  written, and pin whatever that resolves to.
- `vite.config.ts` uses the compiler from `octane/compiler/vite` (built into core — do
  not add a separate `@octanejs/vite-plugin` dependency).
- Configure `tsconfig.json` for `.tsrx` recognition; add the `octane/compiler/volar`
  editor plugin for `.tsrx` language support.
- One `App.tsrx` rendering a static shell (no chat, no widgets, no scene yet).

## Before starting
Read `context/cyber-dox/overview.md` §1 and §2 in full. Re-verify Octane's current
version and `@octanejs/*` adapter coverage on the npm registry (`pnpm view octane
version`, `pnpm view @octanejs/three version`, etc.) — this ecosystem was moving fast
(35 releases in 7 weeks) as of when this was written; do not assume the pinned versions
are still current without checking.

## Gate — do not proceed to A3 until this passes
This repo's `tsconfig.base.json` uses `nodenext` module resolution and
`verbatimModuleSyntax`. If `.tsrx` tooling conflicts with that setup, resolve it here.
Building the design system (A3) or any product code on top of a broken toolchain wastes
the following stories.

## Definition of done
- `pnpm dox:dev` serves the app.
- A TSRX `@if` control-flow block renders correctly in `App.tsrx`.
- HMR works on a source edit.
- `pnpm nx run-many -t typecheck` still passes for the whole workspace (confirms the
  `.tsrx` tsconfig changes didn't leak into other packages).
```

---

### A3 — Design system + control primitives

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
A3 Build Dox design system: glass panels, animated borders, restyled native controls
```

**Description:**

```
Part of the Dox epic — see `context/cyber-dox/index.md`, Story Group A, item A3.
Depends on A2.

## Gap
No visual language exists yet. This is the single most consumed dependency in the whole
epic — six later chunks (C1, C2, C3, D1, D2, F1) are all built from these primitives,
so getting this wrong means restyling five chunks downstream.

## Scope
Read `context/cyber-dox/overview.md` §3 "Visual design language" in full — this story
*is* that section, implemented, and every decision below is explained there in more
depth than repeated here:

- Token layer: the color table from §3 as CSS custom properties, plus spacing,
  tracking, and timing tokens. No literal colors in component styles, ever.
- Self-host display (Chakra Petch / Michroma / Orbitron) + body (JetBrains Mono) font
  subsets — no runtime CDN request.
- `<GlassPanel>` — the full six-layer stack from §3 "Panel construction — real glass",
  including the `brightness()` component of `backdrop-filter` (not optional — it's what
  keeps text legible over the moving 3D scene, see the note there).
- `<AnimatedBorder>` — `@property --angle` conic sweep, wired to render only on the
  active/focused/streaming panel, not globally.
- Chamfer utility — `corner-shape: bevel` behind `@supports` (it is experimental, not
  Baseline), with a `clip-path: polygon(…)` fallback. **The fallback must still produce
  a working focus ring** — `clip-path` clips `box-shadow`/`outline`, so the fallback
  path needs an inset ring or pseudo-element instead.
- Controls: button, textarea (`field-sizing: content`, Baseline since 2026-06-16, plus a
  JS scroll-height fallback for older engines), select, range, toggle, scrollbars
  (`scrollbar-width`/`scrollbar-color` + `::-webkit-scrollbar`), blocky terminal caret.
  **All built from native elements with `appearance: none` — never rebuilt as `div`s**
  (see §3's "Controls" section for why: IME composition, autofill, mobile keyboards,
  screen readers all break otherwise, invisibly, on a US-English desktop).
- Corner brackets, HUD label style, static (never animated) grain overlay via SVG
  `feTurbulence`, and the "signal lost" sentinel treatment tied to GMT's actual sentinel
  contract (`""`/`null`/`false`/`[]`).
- Wire `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast` from
  the start.

## Before starting
Read `context/cyber-dox/overview.md` §3 completely, including the "core tension"
subsection (maximal chrome, disciplined content surface) — this is the rule every
subsequent visual decision should be checked against.

## Definition of done
- A throwaway kitchen-sink page renders every control over a placeholder animated
  backdrop.
- Tab through the entire page with the mouse unplugged — every interactive element has
  an obviously visible focus state, in both the `corner-shape` path and the `clip-path`
  fallback path.
- Body text measures ≥7:1 contrast against the darkened glass, checked against the
  backdrop's brightest frame, not a flat swatch.
- Toggling each `prefers-*` media query in devtools produces graceful, correct
  degradation.
- No literal color values outside the token file.
```
