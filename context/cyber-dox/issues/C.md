### C1 — Chat UI, text only

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
C1 Build streaming chat transcript and composer, text only
```

**Description:**

```
Part of the Dox epic — see `context/cyber-dox/index.md`, Story Group C, item C1.
Depends on A3 (design system) and B2 (Worker proxy).

## Gap
No chat UI exists yet. This story proves the grounded, streaming answer pipeline works
end to end before any generative-UI or 3D complexity is layered on.

## Scope
- Transcript + composer + SSE client in TSRX, built entirely from the A3 design system
  primitives (`<GlassPanel>`, restyled `<textarea>`, etc.) — no ad hoc styling.
- Streaming markdown render via `@octanejs/markdown`.
- Stop button, error state, rate-limit state.
- Explicitly out of scope for this story: widgets, the 3D scene, voice. Text-only chat
  first.

## Before starting
`@octanejs/markdown` was `0.0.1` when this was written — re-check its current maturity.
If it proves rough against partial streamed markdown input (a real risk at that version),
fall back to a plain markdown parser; this rendering layer is view-only and swapping it
does not affect anything downstream.

## Definition of done
- Asking "how do I convert a UTC timestamp to Tokyo time" returns a correct, grounded,
  streaming answer through the full B2 Worker.
- Stop button actually halts the stream.
- Error and rate-limit states render intelligibly, using A3's sentinel/signal-lost
  treatment where appropriate rather than a generic error box.
```

---

### C2 — Widget registry + first playground

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
C2 Generative-UI widget registry with live gmt playground
```

**Description:**

```
Part of the Dox epic — see `context/cyber-dox/index.md`, Story Group C, item C2.
Depends on C1.

## Gap
This is the epic's central mechanism: Dox does not write a code block, it invokes a
component. See `context/cyber-dox/overview.md` §2 "Data flow" for the full rationale —
because `apps/dox` depends on `@burglekitt/gmt` via `workspace:*`, widgets execute the
real library, so their output can never drift from shipped behavior.

## Scope
- Define the widget contract and register it as Gemini **function declarations**, so the
  model calls something like `showPlayground({ fn, args })` instead of emitting markdown
  code.
- Build the generic playground widget: editable inputs, live output computed by calling
  the real `@burglekitt/gmt` function (no simulation, no `eval` — select from a fixed,
  typed widget registry).
- Sentinel-aware rendering: an invalid-input result (`""`/`null`/`false`/`[]`) must
  render as the A3 "signal lost" state, not as a blank field.
- Stream partial function-call arguments using a partial-JSON parser — never
  `JSON.parse` on a raw chunk, since partial JSON is by definition invalid JSON until
  the call completes.

## Before starting
Re-check current provider behavior for streamed function-call arguments before
implementing the parser — if using Anthropic's fine-grained tool streaming, note it does
not guarantee valid JSON even at the *final* chunk, so the parser needs to handle a
malformed terminal object gracefully, not just partial ones.

## Definition of done
- Asking "show me formatDate" mounts a live widget, not a code block.
- Editing an input (e.g. locale) recomputes the output live, using the real function.
- An invalid input renders the sentinel treatment correctly.
```

---

### C3 — Widget set

**GitHub Issue:** _blank — see tracker.md_

**Title:**

```
C3 Add timezone converter, DST inspector, interval visualizer, regex tester, signature card
```

**Description:**

```
Part of the Dox epic — see `context/cyber-dox/index.md`, Story Group C, item C3.
Depends on C2 (the widget registry pattern).

## Gap
C2 establishes one generic playground widget. This story adds the purpose-built widgets
that make Dox teach rather than just execute.

## Scope
- Timezone converter widget.
- DST-transition inspector, seeded from `docs/dst-disambiguation.md` — this is GMT's own
  most nuanced documented behavior (disambiguation vs. offset options, gap vs. overlap
  handling) and deserves a dedicated widget rather than the generic playground.
- Interval/duration visualizer.
- Regex tester for the 16 exported `regex` consts.
- Signature card (renders a function's full signature + JSDoc without executing it, for
  quick reference).
- Optional: an `@octanejs/cmdk` command-palette for jumping straight to a known function
  by name.
- Each widget is declared as its own callable function in the C2 registry.

## Before starting
Read `docs/dst-disambiguation.md` in full before building the DST inspector — it
documents real, non-obvious interactions (the `offset` parameter being permanently inert
on some functions, gap-vs-overlap resolution differing between construction and
arithmetic) that the widget should surface, not paper over.

## Definition of done
- Each widget renders correctly from a natural-language prompt aimed at it.
- The DST inspector correctly demonstrates at least one gap case and one overlap case.
```
