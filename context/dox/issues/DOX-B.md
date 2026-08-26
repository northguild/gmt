# Issue #135–#136 — The widget platform

**Re-audited 2026-08-26 — the import-granularity instruction in this file's original
`DOX-B1` was wrong and is corrected below; see overview.md §1.** Six stories now fold into
these two issues, all in Tier 2: `DOX-B1a`/`DOX-B1b` on #135, `DOX-B2a`–`DOX-B2d` on #136.
**No new GitHub issues.** This is the epic's differentiator — every one of 1,860 examples
becomes runnable, plus three purpose-built inspectors nothing else in this space has.

## Definition of done — binding for every story in this file

- Widgets execute the **real** `@northguild/gmt`. No simulation, no `eval`, no
  reimplementation. Because `apps/dox` depends on the package via `workspace:*`, output
  can never drift from shipped behavior — that property is the whole point and must not
  be traded away for convenience.
- Islands hydrate `client:visible`, never `client:load`.
- **Import at module granularity** (`@northguild/gmt/plain/calculate`), **never at
  namespace granularity** (`@northguild/gmt/plain`) and **never per-function**. See
  "Corrected 2026-08-26" under `DOX-B1a` below — the exports map forbids per-function
  imports outright, and the namespace barrels re-export the polyfill.
- Sentinel-aware rendering and the widget-chrome rules in overview.md §3 apply to every
  widget in this file, not only `DOX-B1a`'s playground.
- `pnpm nx run-many -t lint test typecheck build` stays green.

---

### DOX-B1a — `<Playground>` island

**GitHub Issue:** #135 — see tracker.md\_

**Title:**

```
DOX-B1a Build the live Playground island running real gmt in the browser
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 2, item DOX-B1a.
Depends on DOX-A5 (tokens, and specifically the Signal-lost amber).

## Gap
DOX-A3a's reference pages show examples as static text. A temporal library is exactly the
kind of API where reading `startOfZoned(..., { disambiguation: "reject" }) // ""` teaches
far less than changing `"reject"` to `"earlier"` and watching the output change.

## Corrected 2026-08-26 — the import instruction below replaces the 2026-08-21 draft's
The original DOX-B1 instructed "deep-import per function
(`@northguild/gmt/plain/...`)". **This is not possible.** `packages/gmt/package.json`
sets `"./plain/*/*": null` (and the same for `zoned`/`unix`/`utc`), which explicitly
blocks per-function subpaths. The maximum import granularity is the **module** barrel —
`@northguild/gmt/plain/calculate`.

It is also more consequential than the original draft assumed: `src/index.ts`,
`src/plain/index.ts`, and `src/zoned/index.ts` each open with
`export * from "@js-temporal/polyfill"`, so a **namespace**-level import
(`@northguild/gmt/plain`) pulls the entire polyfill — 2.98 MB unpacked — into the
bundle. Module barrels do not carry this cost. **Use module-granularity imports
throughout this story and every widget that follows it.**

## Scope
- An interactive component: editable inputs per parameter, live output computed by
  calling the real function.
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
- Handle option-object parameters, not just positional strings — a playground that only
  supports `fn(string)` misses most of the interesting surface (`disambiguation`,
  `offset`, `weekStartsOn`, `fractionalSecondDigits`).

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

## Definition of done
- A playground on `startOfZoned`'s page recomputes live when `disambiguation` is changed
  between `"compatible"`, `"earlier"`, `"later"`, and `"reject"`, and correctly shows the
  `"reject"` case producing the sentinel.
- An invalid input renders the signal-lost treatment, not a blank field.
- Output values are produced by the real library — verify by breaking a gmt function
  locally and confirming the playground breaks with it.
- Lighthouse/devtools confirm the polyfill is not loaded on pages without a playground,
  and confirm no page imports at namespace granularity.
- Keyboard-operable: every input reachable and editable without a mouse.
```

---

### DOX-B2a — Auto-embed

**GitHub Issue:** #136 — see tracker.md\_

**Title:**

```
DOX-B2a Auto-embed playgrounds into every generated @example
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 2, item DOX-B2a.
Depends on DOX-B1a (the component) and DOX-A3a (the generator).

## Gap
DOX-B1a gives one component. Wiring it in by hand across 504 pages is not viable, and
hand-authoring would guarantee drift.

## Scope
- Extend DOX-A3a's `build-reference.ts` to mark up each `@example` so it renders as a
  playground seeded with that example's own arguments.
- This is cheap precisely because DOX-A3a already did the hard part: its parser splits
  each example into `{ call, result, note }`, and the `call` half is exactly the seed
  data this story needs. If DOX-A3a's parse was done properly, this story is small; if
  it was done loosely, this is where that shows up.
- Keep the static rendering as the non-JS fallback — the example text must still be
  readable with JavaScript disabled and in the Pagefind index. **Do not let auto-embed
  remove content from search**: if the examples become JS-only, the site loses a large
  fraction of what makes it searchable.
- Not every example should hydrate. A page with several examples should not mount that
  many islands. Decide a strategy (one shared playground per page seeded by clicking an
  example, or hydrate on interaction) and record it.

## Before starting
Re-read DOX-A3a's emitted `gmt-corpus.json` structure. If the `call` field is a raw
string rather than parsed arguments, decide here whether to parse it in the generator
(better — one place, testable) or in the browser (worse — ships a parser to every
reader).

## Definition of done
- Examples across all namespaces render as runnable playgrounds with no per-page
  authoring.
- With JavaScript disabled, every example is still readable as text.
- Pagefind still indexes example content — search for a distinctive string from an
  example and confirm it is found.
- Page weight on a heavy reference page (e.g. `startOfZoned`, five examples) is measured
  and acceptable.
```

---

### DOX-B2b — DST Transition Inspector

**GitHub Issue:** #136 — see tracker.md\_ (folds into the same issue as `DOX-B2a`)

**Title:**

```
DOX-B2b Build a DST Transition Inspector widget
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 2, item DOX-B2b. New in the
2026-08-26 rewrite, promoted out of `appendix-parked.md` §2 by explicit user request.
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
Read `appendix-parked.md` §2, which is where this widget was first identified as
buildable without any model, and `startOfZoned.ts`'s fifth example for the exact
behavior to demonstrate.

## Definition of done
- The widget correctly renders at least one real gap (spring-forward) and one real
  overlap (fall-back) for a zone/year the reader picks.
- Toggling `offset` from `"ignore"` to `"prefer"` visibly makes a `"reject"`
  `disambiguation` stop firing, demonstrating the inert-disambiguation behavior.
- Keyboard-operable: zone, year, and both toggles are reachable and operable without a
  mouse; the scrub axis has a non-drag equivalent.
```

---

### DOX-B2c — Interval algebra visualizer

**GitHub Issue:** #136 — see tracker.md\_ (folds into the same issue as `DOX-B2a`)

**Title:**

```
DOX-B2c Build an interval algebra visualizer over the 109 interval functions
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 2, item DOX-B2c. New in the
2026-08-26 rewrite.
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

### DOX-B2d — Converter + format bench

**GitHub Issue:** #136 — see tracker.md\_ (folds into the same issue as `DOX-B2a`)

**Title:**

```
DOX-B2d Build a zone converter, format bench, and regex tester widget
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 2, item DOX-B2d. New in the
2026-08-26 rewrite.
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

---

### DOX-B1b — Widget permalinks

**GitHub Issue:** #135 — see tracker.md\_ (folds into the same issue as `DOX-B1a`)

**Title:**

```
DOX-B1b Encode every widget's state into the URL
```

**Description:**

```
Part of the Dox epic — see `context/dox/index.md`, Tier 2, item DOX-B1b. New in the
2026-08-26 rewrite.
Depends on DOX-B1a, DOX-B2a, DOX-B2b, DOX-B2c, and DOX-B2d (every widget this tier ships).

## Gap
Without this, a widget is a toy — its state resets on reload and cannot be sent to a
colleague. With it, a widget is exactly as linkable as a reference page, which is the
entire premise the docs site is built on (overview.md §1: "someone who wants to send a
colleague the DST rules has nothing to link").

## Scope
- A shared mechanism, used by every Tier 2 widget, that serializes current widget state
  (inputs, toggles, selected zone/year, dragged interval positions) into the URL query
  string or hash, and rehydrates a widget from it on load.
- Must not fight Astro/Starlight's routing or break the back button.

## Before starting
Design this as one shared utility consumed by all five widgets rather than five
independent implementations — divergence here would be expensive to unify later.

## Definition of done
- Every widget shipped in `DOX-B1a`/`DOX-B2a`–`d` can be configured, copied as a URL,
  opened in a new tab, and reproduces the exact same state.
- Back/forward navigation behaves sensibly with widget state changes.
```
