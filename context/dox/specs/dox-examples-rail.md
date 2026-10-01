# `/dox` examples rail

The chat's starter questions live in the widget rail as a scrolling panel of example cards,
grouped by area. The empty chat keeps the crystal, the status line and the prompt; the pill
wall under the crystal is gone. Owner-approved design.

Applies: `built.md` "Rules that bind every change" and Tier 6 "Widget tools";
`reference/design-system.md` (stylesheet stack, maintenance rules, "Form controls", Tailwind
in the chat island); `reference/visual-design.md` (corners, focus, controls, motion).

## Behaviour

| Viewport | Conversation | Widget | Rail shows | Bar above composer |
| --- | --- | --- | --- | --- |
| ≥ 60rem | any | none | examples panel | not rendered visibly |
| ≥ 60rem | any | open | the widget | not rendered visibly |
| < 60rem | empty | none | examples panel as the bottom sheet | none |
| < 60rem | started | none | nothing (collapsed) until the bar is pressed | `Examples · N`, `aria-expanded` |
| < 60rem | any | open | the widget as the bottom sheet | none |

- A card does exactly what a pill did: `send(text)`; only if that returned `true`, call the
  rail with `starterWidgetCall(starter)`. The widget replaces the list in the same slot
  through the rail's existing `<ViewTransition>` (`gmt-rail-in` / `gmt-rail-out`). Closing it
  brings the list back.
- The rail's `aria-label` is `Examples` with the list, `Widget panel` with a widget (and in
  the error-boundary fallback).
- N is `CHAT_STARTERS.length`, never a literal.
- Focus: activating a card moves focus to the open widget's title. Closing a widget returns
  focus to the card for that widget when the panel is visible, otherwise to the bar. A
  widget the model opens never takes focus (the reader may be typing).
- Phone, conversation started: pressing the bar toggles the sheet. Picking a card collapses
  it again (`examplesOpen = false`), so closing that widget lands on the bar.

## Files

### Data — `apps/dox/src/lib/chat-constants.ts`

- Add, above `CHAT_STARTERS`:
  `EXAMPLE_AREAS = [{ id: "zones", label: "Zones and DST" }, { id: "intervals", label: "Intervals" }, { id: "transport", label: "Transport" }, { id: "intermodal", label: "Intermodal and billing" }] as const`
  and `type ExampleArea`.
- Add `readonly area: ExampleArea` to the `CHAT_STARTERS` element type and to every entry:
  - `zones`: showGlobe, showConverterBench, showDstInspector
  - `intervals`: showIntervalVisualizer
  - `intermodal`: showDwellLedger, showFreeTimeLedger, showBillingDeadlines
  - `transport`: the other ten.
- Add `startersByArea()`: `{ area, label, starters }[]` in `EXAMPLE_AREAS` order, each list in
  `CHAT_STARTERS` order, empty areas omitted.
- Rename "pill" to "card" or "example" in the comments; keep everything else in this file as
  it is (the file carries uncommitted TRAN-57 work — preserve it).

### Components — `apps/dox/src/components/ask/`

- **`ExamplesPanel.tsx` (new).** Root carries `not-content`. Header in the rail's existing
  header style: `<h2>` "Examples" plus the computed count. A scrolling body; per area a
  `<section aria-labelledby>` with an `<h3>` and a `<ul>`; per starter an `<li>` holding a
  native `<button type="button" class="gmt-hive-example gmt-sonar-focus" data-widget={widget}>`
  with the question in one span (`aria-labelledby` → it, so the accessible name is exactly
  the question) and a chip span holding `WIDGET_REGISTRY[widget].title`
  (`aria-describedby` → it). Ids from `useId()` (SSR-safe). Props: `onPick(starter)`.
- **`WidgetRail.tsx`.** Never returns `null` now. With no widget it renders
  `<ViewTransition key="examples" enter="gmt-rail-in" exit="gmt-rail-out" default="none">`
  around `<aside className="gmt-hive-rail" id={railId} aria-label="Examples"
  data-collapsed={collapsed || undefined}>` holding `ExamplesPanel`. With a widget, as
  today, `aria-label="Widget panel"`; the `ArtifactTitle` gets `tabIndex={-1}` and a ref so it
  can take focus. New props: `onPick`, `collapsed`, `railId`, and a way to request focus on
  the title after the widget commits (an effect keyed on `toolCallId`, gated by a flag the
  host sets only for card activation). Update the stale "collapsed to nothing" comments.
- **`ExamplesBar.tsx` (new).** A native `<button type="button"
  class="gmt-hive-examples-bar gmt-sonar-focus" aria-expanded aria-controls={railId}>`:
  `Examples`, a middle dot inside `aria-hidden`, the count, and lucide `ChevronUpIcon`
  (`aria-hidden`), rotated when expanded. Accessible name "Examples 17"-shaped, computed.
- **`DoxChat.tsx`.** Remove the `.gmt-hive-starters` block, the `Suggestion` import and the
  `CHAT_STARTERS` / `starterWidgetCall` imports. Add props:
  - `ref?: Ref<DoxChatHandle>` (React 19 ref-as-prop) with `useImperativeHandle` exposing
    `{ send(text): boolean }` — the same guarded `send`.
  - `onEmptyChange?(empty: boolean)`, fired from an effect on the raw
    `messages.length === 0` (not the deferred value).
  - `aboveComposer?: ReactNode`, rendered first inside `.gmt-hive-composer-inner`.
  Keep DoxChat host-agnostic: it knows nothing about examples.
- **`DoxPage.tsx`.** Owns `conversationStarted`, `examplesOpen`, the rail widget, a
  `chatRef`, and the focus requests. Add `toolName` to `RailWidget` so a close knows which
  card to return to. On close, after commit: if
  `window.matchMedia("(max-width: 60rem)").matches` and the conversation has started and
  `examplesOpen` is false, focus the bar; otherwise focus
  `button[data-widget="<toolName>"]` inside the rail. Read `matchMedia` only in handlers and
  effects, never during render (hydration, #418). Render the bar into `aboveComposer` only
  when the conversation has started and no widget is open. `collapsed` =
  `conversationStarted && !examplesOpen`.
- Do not delete `ai-elements/suggestion.tsx`; it becomes unused (record it in `ui-audit.md`
  P1).

### Styles — `apps/dox/src/styles/gmt-hive.css`

- Delete `.gmt-hive-starters` and `.gmt-hive-starter(:hover)`.
- Examples panel, cards, chips, area headings, the bar. Tokens only, no colour literals, no
  amber, no `[data-theme="light"]` colour blocks. Bevels from `border-radius` +
  `corner-shape: bevel`, never `clip-path`. Every font size ≥ `--gmt-text-xs` (0.75rem).
  Card text `--gmt-ice` in every state (the old hover's `--gmt-cyan-ink` is under 7:1 on a
  tinted fill in light); hover and focus change border and fill. Chip text `--gmt-ice-dim`
  with its own bevelled border, distinct from the card's. Long text wraps
  (`overflow-wrap: anywhere`); nothing may scroll sideways at 390px.
- The panel body scrolls inside the rail (`overflow-y: auto`, `min-height: 0`), at the rail's
  existing size on both layouts.
- `@media (max-width: 60rem)`: `.gmt-hive-rail[data-collapsed] { display: none }`; the bar is
  `display: none` by default and shown only inside this query.
- Reduced motion: the chevron's rotation transition and any card transition are off; the
  rail's view-transition block already covers the swap — keep it covering it.
- `@media (forced-colors: active)`: cards `ButtonFace`/`ButtonText` with a solid border; chips
  a dashed `ButtonText` border; the bar a 2px `ButtonText` border; focus as a real `outline`
  in `Highlight` (forced colours drop `box-shadow`); area headings `CanvasText`.

### Tests

- `src/lib/chat-starters.test.ts`: every enabled tool's starter has an area in
  `EXAMPLE_AREAS`; every area has at least one starter; `startersByArea()` covers every
  starter exactly once. Keep the existing assertions (no tool name in the text).
- `src/components/ask/rail-keyboard.test.tsx`: keep both existing describes; add one that
  renders `<DoxPage />` with `fetch` stubbed (`/api/brains` → 404; `/api/chat` → a
  `createUIMessageStreamResponse` text reply, no tool call — see
  `DoxChat.progress.test.tsx`). Add `@testing-library/user-event@14.6.7` as an `apps/dox`
  devDependency for real Tab / Enter / Space. Cases:
  1. The empty chat renders no starter buttons; the rail is named "Examples" and holds one
     card per `CHAT_STARTERS` entry, grouped under every `EXAMPLE_AREAS` label.
  2. Tab reaches every card, in order.
  3. Enter on one card and Space on another each send once and open that widget (use the
     converter and interval cards, not the globe); the rail is then named "Widget panel" and
     focus is on its title.
  4. Close (desktop, `matchMedia` → false): the rail is "Examples" again and focus is on the
     card for that widget.
  5. Phone (`matchMedia("(max-width: 60rem)")` → true): after a card and a close, the bar
     reads "Examples" plus `CHAT_STARTERS.length`, has `aria-expanded="false"` and has focus;
     the rail carries `data-collapsed`; pressing the bar sets `aria-expanded="true"` and
     clears it.
  6. A widget the model opens does not move focus.
- `DoxChat.progress.test.tsx`: submit the question through the composer instead of a pill;
  the seeded-widget assertion moves to the rail test.
- `DoxChat.ssr.test.tsx`: add a `renderToString(<DoxPage />)` case that renders the examples
  aside without touching a browser global.

### Docs (present tense, no history)

- `context/dox/built.md` Tier 6 "Widget tools": the pill bullets become the example cards,
  the area field and its test, the rail's two names, the phone bar, focus rules.
- `context/dox/reference/design-system.md`: a "`/dox` examples rail" subsection.
- `context/dox/ui-audit.md` P1: add `suggestion`.

## Definition of done

From `apps/dox` with `eval "$(fnm env)" && fnm use`:

1. `pnpm --filter @gmt/dox test`, `check`, `lint` green; root `pnpm run validate` green.
2. No file under `packages/gmt` changed by this work.
3. Chromium and WebKit screenshots of `/dox` at 1440×900 and 390×844, dark and light, in
   three states — empty; mid-conversation (bar collapsed on phone); widget open — against a
   built site served by `astro preview` on a free port (not 4321). `/api/chat` and
   `/api/brains` are mocked with Playwright `page.route`; no request leaves the machine and
   no AI budget is spent.
4. No sideways scroll at 390 in any state (`scrollWidth <= clientWidth`).
5. Card text, chip text, area headings and the bar measure ≥ 7:1 in both themes.
6. Keyboard only in a real browser: Tab reaches each card, Enter and Space open it, focus
   lands on the widget title, close returns it to the card (desktop) or bar (phone).
7. Forced colours (Chromium emulation): cards, chips and bar stay distinguishable and focus
   is visible. Reduced motion: no rail slide, no chevron transition.
8. Firefox: blocked on this machine — recorded, not bypassed.
