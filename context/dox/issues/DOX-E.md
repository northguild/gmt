# Story Group E — Globe

One story. The flourish, scoped so that it cannot compromise anything else.

## Definition of done — binding for every Group E story

- The globe is **decoration**. Nothing in Groups A–D may come to depend on it, and
  deleting this story must leave the site fully intact.
- It never delays content becoming readable.
- Gated behind `prefers-reduced-motion`, and degrades cleanly where WebGL is
  unavailable.

---

### DOX-E1 — Landing-page hero globe

**GitHub Issue:** #142 — see tracker.md\_

**Title:**

```
DOX-E1 Add a wireframe globe hero to the docs landing page
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Story Group E, item E1.
Depends on A5 (tokens). Independent of B, C, and D — it can be built or dropped at any
point after A without affecting them.

## Gap
A temporal library's landing page should look like it knows what a timezone is. This is
the one purely decorative story in the epic, and it is scoped accordingly.

## Scope
- A wireframe globe with meridian and latitude rings, in the A5 palette.
- React Three Fiber island, hydrated `client:visible`, **on the homepage only**.
- Pause `requestAnimationFrame` when the tab is hidden.
- Static fallback image (or nothing at all) under `prefers-reduced-motion` and where
  WebGL is unavailable.
- Slow rotation. This is ambient, not a demo.

## The scoping decision — do not undo it
The superseded plan specified this as a **full-bleed backdrop behind every glass panel**,
reacting to the conversation's active namespace: globe for `zoned`/`utc`/`unix`,
clockface for `plain`, crossfading between them. That design made the scene load-bearing
in three ways at once — it was what `backdrop-filter` sampled, so glass legibility
depended on it; it had to read clearly *through* a 24px blur; and it created the epic's
worst-case frame budget (scene rendering + response streaming + border animation
simultaneously, verified on integrated graphics).

Scoping it to a hero removes all three problems. Nothing must remain legible over it, no
panel samples it, and there is no combined worst case. It is also trivially removable if
it does not earn its weight — which a full-bleed reactive scene would not have been.

If you find yourself wanting the reactive full-bleed version, read
[appendix-parked.md](../appendix-parked.md) first, where it is recorded along with what
it costs.

## Before starting
Check the bundle cost of Three.js plus React Three Fiber against the homepage's budget
before committing. If it is unacceptable, hand-rolled WebGL or even an animated SVG
globe achieves most of this effect for a fraction of the weight — the goal is the
impression, not the framework.

Note this is the one place in the epic where a `@octanejs/three` + `@octanejs/drei`
island could be reconsidered later, since it is fully isolated. Do not do so for this
story: `@octanejs/drei` was `0.0.9` as of 2026-08-21 and there is no reason to take that
risk for a decoration.

## Definition of done
- The globe renders on the homepage and nowhere else — verify no Three.js bundle is
  loaded on a reference page.
- Tab-hidden pauses rendering (verify in the devtools performance profiler, not
  visually).
- `prefers-reduced-motion` yields a static state.
- The page is fully readable and interactive before the globe finishes loading.
- Homepage Lighthouse performance is not meaningfully worse than a reference page's.
```
