### D1 — Scene: globe + clockface

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
D1 Build ambient 3D globe/clockface scene reacting to chat topic
```

**Description:**

```
Part of the Dox epic — see `context/cyber-dox/index.md`, Story Group D, item D1.
Depends on A2 (Octane runtime) and A3 (design system — the glass panels this scene sits
behind). Can proceed in parallel with C1–C3 once A3 is done, since it doesn't depend on
chat being complete.

## Gap
No 3D backdrop exists yet. The scene is not decorative — it's what the A3 `<GlassPanel>`
`backdrop-filter` actually samples, so its visual design is constrained by that.

## Scope
- `@octanejs/three` Canvas, full-bleed behind the glass panels.
- Wireframe globe with glowing meridian/latitude rings for `zoned`/`utc`/`unix` topics.
- Analog clockface for `plain` topics.
- A blended idle state for when no specific namespace is active.
- `@octanejs/drei` supplies `OrbitControls`/`Html` — re-verify current parity coverage
  on the registry before relying on any specific Drei export, per the note in
  `context/cyber-dox/overview.md` §1 about this ecosystem's fast release cadence.
- Scene subscribes to the active chat namespace and crossfades between states.
- Respect `prefers-reduced-motion`; pause `requestAnimationFrame` when the tab is
  hidden.

## Before starting
Read `context/cyber-dox/overview.md` §3's "Panel construction — real glass" section —
the scene must read clearly *through* a 24px blur + darkened backdrop, not just at full
opacity. Design and test it behind an actual `<GlassPanel>` from A3, not in isolation.

## Definition of done
- A `zoned` question spins the globe toward the relevant timezone.
- A `plain` question morphs the scene to the clockface.
- Idle state is visually coherent, not a jarring blend.
- Confirmed legible through the glass panel blur, not just as a standalone canvas.
- Tab-hidden correctly pauses rendering (verify via devtools/profiler, not just visually).
```

---

### D2 — Motion pass

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
D2 Add view-transition morph choreography and boot sequence
```

**Description:**

```
Part of the Dox epic — see `context/cyber-dox/index.md`, Story Group D, item D2.
Depends on C2/C3 (widgets to animate) and D1 (scene to choreograph against).

## Gap
Without this story, widgets pop into place abruptly and there's no boot sequence — both
called out explicitly in the original ask ("UI elements morph and pop into place").

## Scope
- `@octanejs/motion` for widget entry/morph choreography.
- CSS primitives: `view-transition-name` so widgets morph rather than pop,
  `@starting-style` + `transition-behavior: allow-discrete` for entry/exit, Popover API
  for tooltips (all Baseline — see overview.md §2's decisions table).
- Boot sequence on first paint: panels stagger in, HUD elements register.
- Typewriter reveal for Dox's replies.
- Glitch/RGB-split **only** on state transitions, never idle, never over text being
  actively read — per overview.md §3's "Motion" section.
- Debounce `startViewTransition` — calling it per streamed token thrashes badly.

## Before starting
Read `context/cyber-dox/overview.md` §3's "Motion" and "Performance budget" sections.
This story is where the performance risk in overview.md §7 ("scene + streaming +
border animation together") first becomes measurable — profile it here, not later.

## Definition of done
- Widgets visibly morph into place rather than appearing abruptly.
- Reduced-motion preference disables all of the above cleanly (verify in devtools).
- No layout jank while a response is actively streaming.
- Profiled on integrated graphics with the D1 scene running, a response streaming, and
  an active-panel border animation all simultaneously — this is the real worst case, not
  any one of them alone.
```
