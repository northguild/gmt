# Story Group B — Live examples

Two stories. Interactivity that needs no API key, no server, and no model — every one of
the 1,514 `@example` lines becomes runnable.

## Definition of done — binding for every Group B story

- Widgets execute the **real** `@northguild/gmt`. No simulation, no `eval`, no
  reimplementation. Because `apps/docs` depends on the package via `workspace:*`, output
  can never drift from shipped behavior — that property is the whole point and must not
  be traded away for convenience.
- Islands hydrate `client:visible`, never `client:load`.
- `pnpm nx run-many -t lint test typecheck build` stays green.

---

### DOX-B1 — `<Playground>` island

**GitHub Issue:** #135 — see tracker.md\_

**Title:**

```
DOX-B1 Build the live Playground island running real gmt in the browser
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Story Group B, item B1.
Depends on A5 (tokens, and specifically the Signal-lost amber).

## Gap
A3's reference pages show examples as static text. A temporal library is exactly the
kind of API where reading `startOfZoned(..., { disambiguation: "reject" }) // ""` teaches
far less than changing `"reject"` to `"earlier"` and watching the output change.

## Scope
- An interactive component: editable inputs per parameter, live output computed by
  calling the real function.
- **Sentinel-aware rendering — this is the point, not a detail.** An invalid-input
  result (`""` / `null` / `false` / `[]`) renders as `⟨ NO SIGNAL — invalid input ⟩` in
  A5's Signal-lost amber, never as a blank field. A user seeing an empty output box
  learns nothing; a user seeing the signal-lost state learns GMT's sentinel contract,
  which is one of the library's four core rules and one of the least obvious things
  about it.
- Distinguish the sentinel from a legitimately empty result where the two differ (e.g.
  an interval function correctly returning `[]`) — otherwise the treatment teaches the
  wrong lesson.
- Deep-import per function (`@northguild/gmt/plain/...`) rather than importing the
  package root. The exports map already exposes one level of deep import per namespace;
  root imports pull the entire surface plus `@js-temporal/polyfill` onto every page.
- Import from the built `dist`, not source. `packages/gmt` sets
  `customConditions: ["@northguild/source"]`, but matching it means configuring Vite's
  `resolve.conditions`; letting Nx build the package first (A1's `dependsOn: ["^build"]`)
  is fewer moving parts.
- Handle option-object parameters, not just positional strings — a playground that only
  supports `fn(string)` misses most of the interesting surface (`disambiguation`,
  `offset`, `weekStartsOn`, `fractionalSecondDigits`).

## Before starting
Read `context/dox/overview.md` §3's Color section for the sentinel rationale, and
`context/coding-standards.md` for the actual sentinel contract — which sentinel maps to
which return type (`""` strings, `null` numbers/arrays, `false` booleans). Getting this
mapping wrong makes the widget lie about the library's behavior.

Check the real bundle cost of `@js-temporal/polyfill` on a page with a playground before
deciding hydration strategy. It is not small, and reference pages are the most-visited
pages on the site.

## Definition of done
- A playground on `startOfZoned`'s page recomputes live when `disambiguation` is changed
  between `"compatible"`, `"earlier"`, `"later"`, and `"reject"`, and correctly shows the
  `"reject"` case producing the sentinel.
- An invalid input renders the signal-lost treatment, not a blank field.
- Output values are produced by the real library — verify by breaking a gmt function
  locally and confirming the playground breaks with it.
- Lighthouse/devtools confirm the polyfill is not loaded on pages without a playground.
- Keyboard-operable: every input reachable and editable without a mouse.
```

---

### DOX-B2 — Auto-embed

**GitHub Issue:** #136 — see tracker.md\_

**Title:**

```
DOX-B2 Auto-embed playgrounds into every generated @example
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Story Group B, item B2.
Depends on B1 (the component) and A3 (the generator).

## Gap
B1 gives one component. Wiring it in by hand across ~424 pages is not viable, and
hand-authoring would guarantee drift.

## Scope
- Extend A3's `build-reference.ts` to mark up each `@example` so it renders as a
  playground seeded with that example's own arguments.
- This is cheap precisely because A3 already did the hard part: its parser splits each
  example into `{ call, result, note }`, and the `call` half is exactly the seed data
  B2 needs. If A3's parse was done properly, this story is small; if it was done
  loosely, this is where that shows up.
- Keep the static rendering as the non-JS fallback — the example text must still be
  readable with JavaScript disabled and in the Pagefind index. **Do not let auto-embed
  remove content from search**: if the examples become JS-only, the site loses a large
  fraction of what makes it searchable.
- Not every example should hydrate. A page with 15 examples should not mount 15 islands.
  Decide a strategy (one shared playground per page seeded by clicking an example, or
  hydrate on interaction) and record it.

## Before starting
Re-read A3's emitted `gmt-corpus.json` structure. If the `call` field is a raw string
rather than parsed arguments, decide here whether to parse it in the generator (better —
one place, testable) or in the browser (worse — ships a parser to every reader).

## Definition of done
- Examples across all namespaces render as runnable playgrounds with no per-page
  authoring.
- With JavaScript disabled, every example is still readable as text.
- Pagefind still indexes example content — search for a distinctive string from an
  example and confirm it is found.
- Page weight on a heavy reference page (e.g. `startOfZoned`, five examples) is measured
  and acceptable.
```
