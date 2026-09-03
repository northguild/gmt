# Issue #135–#136 — The widget platform

Five stories fold into these two issues, all in Tier 2: `DOX-B1a` on #135,
`DOX-B2a`–`DOX-B2d` on #136. `DOX-B1a` and `DOX-B2a` are done; `DOX-B2b`–`DOX-B2d` are
planned.

Each issue below is one logical unit; its sub-stories are nested under it. The issue stays
open until its last sub-story lands.

## Definition of done — binding for every story in this file

- Widgets execute the **real** `@northguild/gmt`. No simulation, no `eval`, no
  reimplementation. Because `apps/dox` depends on the package via `workspace:*`, output
  can never drift from shipped behavior — that property is the whole point and must not
  be traded away for convenience.
- Islands render inline via `<PlaygroundLive>` (server-rendered markup + inline `<script>`),
  not via `client:visible` or `client:load` hydration.
- **Import at module granularity** (`@northguild/gmt/plain/calculate`), **never at
  namespace granularity** (`@northguild/gmt/plain`) and **never per-function**. The exports
  map forbids per-function subpaths outright, and the namespace barrels re-export the
  polyfill (~2.98 MB).
- Sentinel-aware rendering and the widget-chrome rules in overview.md §3 apply to every
  widget in this file, not only `DOX-B1a`'s playground.
- `pnpm nx run-many -t lint test typecheck build` stays green.

---

### Issue #135 — DOX-B1

**GitHub Issue:** #135 — see tracker.md

`DOX-B1` is a single story, Tier 2: `DOX-B1a` (the `<PlaygroundLive>` textarea island).
**Done.**

#### DOX-B1a — `<PlaygroundLive>` textarea island

**GitHub Issue:** #135 — see tracker.md\_

**Title:**

```
DOX-B1a Build the live PlaygroundLive textarea island running real gmt in the browser
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 2, item DOX-B1a.
Depends on DOX-A5 (tokens, and specifically the Signal-lost amber).

## Gap
DOX-A3a's reference pages show examples as static text. A temporal library is exactly the
kind of API where reading `addDate("2024-03-15", { days: 5 }) // "2024-03-20"` teaches
far less than typing a modified expression and watching the output change.

## Approach: textarea, not input widgets
A single `<textarea>` where the user types any JS expression calling the real library, a
run button, and a live output — not a web component with editable inputs per parameter
and URL-encoded widget state. This means no per-parameter input widget system (enum
selects, units selects, array inputs), no URL state / permalink system (there is no
state to encode when the textarea content is the only state), and no `widget-state.ts`
serialization layer.

The textarea is seeded with a call string from `LIVE_PLAYGROUND_TEMPLATES` (generated
from the function's first `@example` or synthesized from its param spec), so the user
starts with a working expression they can modify.

## Import granularity
`packages/gmt/package.json` sets `"./plain/*/*": null` (and the same for `zoned`/`unix`/
`utc`), which explicitly blocks per-function subpaths. The maximum import granularity is
the **module** barrel — `@northguild/gmt/plain/calculate`.

It is consequential: `src/index.ts`, `src/plain/index.ts`, and `src/zoned/index.ts` each
open with
`export * from "@js-temporal/polyfill"`, so a **namespace**-level import
(`@northguild/gmt/plain`) pulls the entire polyfill — 2.98 MB unpacked — into the
bundle. Module barrels do not carry this cost. **Use module-granularity imports
throughout this story and every widget that follows it.**

## Scope
- A `<textarea>` where the user types a JS expression calling the real library, plus a
  run button and a live output area.
- The textarea is seeded with a call string from `LIVE_PLAYGROUND_TEMPLATES` — the
  generator produces one template per function from its first `@example` or synthesizes
  one from the function's param spec.
- **Sentinel-aware rendering — this is the point, not a detail.** An invalid-input
  result (`""` / `null` / `false` / `[]`) renders as `⟨ NO SIGNAL — invalid input ⟩` in
  DOX-A5's Signal-lost amber, never as a blank field. A user seeing an empty output box
  learns nothing; a user seeing the signal-lost state learns GMT's sentinel contract,
  which is one of the library's four core rules and one of the least obvious things
  about it.
- Distinguish the sentinel from a legitimately empty result where the two differ (e.g.
  an interval function correctly returning `[]`) — otherwise the treatment teaches the
  wrong lesson. See overview.md §3 "Widget chrome" for the general rule this instance
  follows.
- Import at module granularity per the correction above.
- Import from the built `dist`, not source. `packages/gmt` sets
  `customConditions: ["@northguild/source"]`, but matching it means configuring Vite's
  `resolve.conditions`; letting Nx build the package first (DOX-A1's
  `dependsOn: ["^build"]`) is fewer moving parts.
- The textarea evaluates the expression with `new Function()` — the user can type any
  valid JS expression that calls the library, not just the seeded template.

## Before starting
Read `context/dox/overview.md` §3's Color and Widget chrome sections for the sentinel
rationale, and `context/coding-standards.md` for the actual sentinel contract — which
sentinel maps to which return type (`""` strings, `null` numbers/arrays, `false`
booleans). Getting this mapping wrong makes the widget lie about the library's behavior.

Check the real bundle cost of `@js-temporal/polyfill` on a page with a playground before
deciding hydration strategy — it is not small, and reference pages are the most-visited
pages on the site. **Also check whether native `Temporal` support is broad enough at
build time to drop the polyfill from widgets entirely.** If it is, this is the largest
free performance win available in the whole epic; verify rather than assume either way.

## Implementation notes
- `PlaygroundLive.astro` renders inline markup + an inline `<script>` block — no separate
  `.ts` init module.
- `GMT_MODULES` in `gmt-modules.ts` is a static registry of dynamic imports at module
  granularity. Vite resolves these at build time into separate chunks that only load
  when a playground is present on the page.

## Definition of done
- A playground on `startOfZoned`'s page starts with a seeded template and recomputes
  live when the user edits the expression and clicks run, correctly showing the
  `"reject"` case producing the sentinel.
- An invalid input renders the signal-lost treatment, not a blank field.
- Output values are produced by the real library — verify by breaking a gmt function
  locally and confirming the playground breaks with it.
- Lighthouse/devtools confirm the polyfill is not loaded on pages without a playground,
  and confirm no page imports at namespace granularity.
- Keyboard-operable: the textarea and run button are reachable and operable without a
  mouse.

---

### Issue #136 — DOX-B2

**GitHub Issue:** #136 — see tracker.md

`DOX-B2` spans four sub-stories, all Tier 2: `DOX-B2a` (auto-embed), `DOX-B2b` (DST
Transition Inspector), `DOX-B2c` (interval algebra visualizer), and `DOX-B2d` (converter +
format bench). The issue stays open until `DOX-B2d` also lands.

#### DOX-B2a — Auto-embed

**GitHub Issue:** #136 — see tracker.md\_

**Title:**

```
DOX-B2a Auto-embed playgrounds into every generated @example
```

**Status:** Done.

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 2, item DOX-B2a.
Depends on DOX-B1a (the component) and DOX-A3a (the generator).

## Gap

DOX-B1a gives one component. Wiring it in by hand across 504 pages is not viable, and
hand-authoring would guarantee drift.

## What shipped

- `build-reference.ts:renderFn` emits one static code block (first example) + one
  `<PlaygroundLive>` island per function. The island is seeded from the first example's
  `call` string via `LIVE_PLAYGROUND_TEMPLATES`, which contains one entry per function
  (keyed by function name), not one per example.
- `PlaygroundLive.astro` renders inline markup + an inline `<script>` block — no separate
  init module.
- Only the first example is shown per function page: a static code block for no-JS
  fallback / Pagefind indexing, followed by a live `<PlaygroundLive>` island. Additional
  examples are not rendered — this is intentional.

## Scope

- `build-reference.ts` emits `<PlaygroundLive specId="{fnName}" />` after the static
  code block for every function that has at least one `@example`.
- The playground is seeded from `LIVE_PLAYGROUND_TEMPLATES[fnName]`, which is derived
  from the function's first `@example` call string (or synthesized from the param spec
  if no examples exist).
- Static code blocks remain for no-JS fallback and Pagefind indexing.
- Only one playground per function page. A function with five examples shows the first
  as a static block + playground; the remaining four are not rendered.

## Implementation notes

- `GMT_MODULES` in `gmt-modules.ts` is a static registry of dynamic imports at module
  granularity (`@northguild/gmt/plain/calculate`). Vite resolves these at build time
  into separate chunks that load only when a playground is present on the page.
- The polyfill is not bundled into namespace-level imports because we never import at
  namespace granularity.
- `parseCallArgs` and `splitTopLevel` in `playground-parsers.ts` run both in the Node
  generator and in the browser client, ensuring the parser behavior is identical.

## Definition of done

- Examples across all namespaces render as runnable playgrounds with no per-page
  authoring.
- With JavaScript disabled, the static code block is still readable as text.
- Pagefind still indexes example content — search for a distinctive string from an
  example and confirm it is found.
- Page weight on a heavy reference page is acceptable (measured and confirmed by author).

```

---

#### DOX-B2b — DST Transition Inspector

**GitHub Issue:** #136 — see tracker.md\_ (folds into the same issue as `DOX-B2a`)

**Title:**

```

DOX-B2b Build a DST Transition Inspector widget

```

**Description:**

```

Part of the Dox epic — see `context/dox/index.md`, Tier 2, item DOX-B2b.
Depends on DOX-B1a.

## Gap

`getDstTransitions` is exported, tested, and correct, but nothing on the site
demonstrates it — or the one genuinely counter-intuitive fact in the entire library:
`startOfZoned`'s fifth example states in prose that setting `offset: "prefer"` makes
`disambiguation` inert, because the source offset is nearly always still valid after a
same-day field reset. Nothing currently shows this happening.

## Scope

- A widget: pick an IANA zone and a year, call `getDstTransitions(zone, year)`, and
  render the resulting gap or overlap on a scrubbable local-time axis.
- Toggle `disambiguation` (`"compatible"` / `"earlier"` / `"later"` / `"reject"`) and
  `offset` (`"prefer"` / `"use"` / `"ignore"` / `"reject"`) live against a function that
  takes them (e.g. `startOfZoned` with an `hour`-unit boundary landing in the
  transition), and show the result updating — including the `offset: "prefer"` making
  `disambiguation` inert case explicitly.
- No model, no key, no server — this runs entirely on the already-exported functions.

## Before starting

Read `startOfZoned.ts`'s fifth example for the exact behavior to demonstrate. This
widget runs entirely on already-exported functions — no model needed.

## Definition of done

- The widget correctly renders at least one real gap (spring-forward) and one real
  overlap (fall-back) for a zone/year the reader picks.
- Toggling `offset` from `"ignore"` to `"prefer"` visibly makes a `"reject"`
  `disambiguation` stop firing, demonstrating the inert-disambiguation behavior.
- Keyboard-operable: zone, year, and both toggles are reachable and operable without a
  mouse; the scrub axis has a non-drag equivalent.

```

---

#### DOX-B2c — Interval algebra visualizer

**GitHub Issue:** #136 — see tracker.md\_ (folds into the same issue as `DOX-B2a`)

**Title:**

```

DOX-B2c Build an interval algebra visualizer over the 109 interval functions

```

**Description:**

```

Part of the Dox epic — see `context/dox/index.md`, Tier 2, item DOX-B2c.
Depends on DOX-B1a.

## Gap

The library implements **109 interval functions** across four namespaces (plain 53,
zoned 19, unix 19, utc 18) — essentially Allen's interval algebra, fully built — and
none of it is illustrated anywhere. This is the largest completely undocumented-by-
example surface in the library.

## Scope

- A widget: drag two (and optionally more) intervals on a shared timeline.
- Live-update results from the real functions as the intervals move: intersection,
  union, difference, xor, abuts, engulfs, overlap — pick the initial set from the
  namespace most relevant to the page it is embedded on (start with `zoned`, since it
  has the richest set of concrete examples via DST).
- Sentinel-aware: a correct empty result (e.g. `intervalIntersectionZoned` returning
  `[]` for non-overlapping intervals) must be visually distinct from an invalid-input
  sentinel — see overview.md §3 "Widget chrome" for why conflating the two teaches the
  wrong lesson.

## Before starting

Read the `zoned/interval/` directory in full to choose which subset of the 109
functions the first version demonstrates — do not attempt all 109 in one widget.

## Definition of done

- At least intersection, union, difference, and xor are demonstrated live and correctly
  for a dragged pair of intervals.
- The distinction between "correct empty result" and "invalid input sentinel" is visibly
  different in the widget.
- Keyboard-operable: interval endpoints have a typed-input equivalent to dragging.

```

---

#### DOX-B2d — Converter + format bench

**GitHub Issue:** #136 — see tracker.md\_ (folds into the same issue as `DOX-B2a`)

**Title:**

```

DOX-B2d Build a zone converter, format bench, and regex tester widget

```

**Description:**

```

Part of the Dox epic — see `context/dox/index.md`, Tier 2, item DOX-B2d.
Depends on DOX-B1a.

## Gap

The "try it on my own input" need is otherwise scattered across many individual
reference pages with no single place to explore zone conversion, formatting, and the
library's regex surface together.

## Scope

- A widget combining: zone-to-zone conversion via `convertZonedToZoned`; live
  `formatZonedToParts` output and relative-time formatting with locale switching; and a
  regex tester running input against the 22 exported `regex` consts.
- Each sub-panel runs the real exported function or const — no reimplementation.

## Before starting

Read the `regex/` directory's 13 files (7 with `//` line-comment documentation rather
than JSDoc, per DOX-A3a's finding) to confirm the regex tester covers the full exported
set, not a sample.

## Definition of done

- Zone conversion, format/relative-time output, and the regex tester are each
  independently usable and produce output from the real library.
- All 22 `regex` consts are selectable in the tester.

```

```
