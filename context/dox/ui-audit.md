# Dox UI architecture audit

**Date:** 2026-09-10
**Scope:** `apps/dox/src/components/`, `apps/dox/src/lib/` (client modules), `apps/dox/src/pages/`, `apps/dox/src/styles/`
**Status:** Audit only. No code has been changed. Phases below are proposals awaiting sign-off.

---

## 1. Why this audit exists

The chat feature (Tier 6, `DOX-C0` → `DOX-C3b`) landed three distinct UI
technologies into one `components/` directory over four stories: Astro
components, vendored React from the AI Elements shadcn registry, and our own
React. Nothing declared the boundary between them, so the directory now reads as
one flat pile of 29 `.astro` files and 42 `.tsx` files with no signal about which
is which, what is vendored, or what is dead.

Three symptoms prompted the audit:

- a single file over 800 lines holding dozens of components;
- widget modules in `src/lib/` that are components in everything but name;
- no rule for when a thing should be `.astro` and when it should be `.tsx`.

This document establishes the boundary, names what is wrong, and proposes an
ordered plan.

### Headline numbers

| Area | Files | Lines |
| --- | ---: | ---: |
| `.astro` (all) | 29 | 2,428 |
| `components/ai-elements/` (**vendored**) | 12 | 3,658 |
| `components/ui/` (**vendored**) | 17 | 1,647 |
| `components/ask/` (**ours**) | 13 | 1,652 |
| `src/lib/` client modules (non-test) | 55 | 8,204 |
| `src/styles/` | 26 | 6,179 |

**More than half of all component code in this app is vendored (5,305 of 9,385
lines), and 6 of the 12 vendored AI Elements files have zero importers.**

---

## 2. The Astro/React boundary is already correct — it is just undocumented

The instinct behind "there is a mixing of Astro vs React components" is right
that the directory *looks* mixed. It is not. The real boundary is clean and
deliberate — it is simply invisible because everything shares one folder.

**There is exactly one React island in the entire application.**

```
src/pages/dox.astro:51   <DoxPage client:load />
```

That is the only `client:*` directive anywhere in `apps/dox`. Verified:

```bash
grep -rn "client:load\|client:idle\|client:visible\|client:only" apps/dox/src
# → one match, src/pages/dox.astro:51
```

Everything else — all 29 `.astro` files, all ~650 content pages — ships **zero
React**. The interactive widgets (globe, DST inspector, interval visualizer,
converter bench, scrubber, timezone map, playground) are plain-DOM modules in
`src/lib/`, mounted from Astro `<script>` blocks.

So the rule already in force is:

> **React exists only inside `/dox`. Every other page is Astro + plain DOM.**

This is a load-bearing property, stated in `context/dox/reference/design-system.md`
as "no React on a reference page". It is worth protecting explicitly, because
nothing in the directory layout signals it today.

### 2.1 The React ↔ plain-DOM bridge is the interesting part

`components/ask/MountedWidget.tsx` is where the two worlds meet, and it is
genuinely well-designed. React renders an empty host `<div>`; the widget's DOM is
written by `renderTemplate()` and wired by `mount()`, and React never re-renders
inside it. The contract lives in `src/lib/widget-mount.ts` (types only —
`WidgetHandle`, `MountFn`, `INERT_HANDLE`, `onceDestroy`).

This is what lets one widget serve both surfaces: an `.astro` page
server-renders `renderTemplate()` via `<Fragment set:html>`, and the chat rail
assigns the same string to `root.innerHTML`. **No change is proposed here.** It
is the best-factored part of the codebase and the audit's structural proposals
are built to preserve it.

---

## 3. Findings

### F1 — `ai-elements/prompt-input.tsx`: 1,483 lines, 5 of ~50 exports used

This is the 800+ line file. It is **vendored**, not authored here:
`components/ai-elements/README.md` records that AI Elements is a shadcn registry
whose source is copied into the repo, and that `DOX-C0` installed 12 components.

It exports roughly 50 components, hooks and contexts. Exactly **five** are
imported anywhere in the app, all by `DoxChat.tsx`:

```
PromptInput, PromptInputBody, PromptInputFooter, PromptInputSubmit, PromptInputTextarea
```

The other ~45 — the entire attachments subsystem (`PromptInputProvider`,
`usePromptInputAttachments`, `PromptInputActionAddAttachments`,
`PromptInputActionAddScreenshot`), the command palette
(`PromptInputCommand*`, 7 exports), the select cluster (`PromptInputSelect*`,
5), the hover card (`PromptInputHoverCard*`, 3), the tabs
(`PromptInputTab*`, 5), the action menu (`PromptInputActionMenu*`, 4) — are
dead. Dox's composer has no file upload, no slash commands, no model dropdown
inside the composer (the brain selector lives in the page strip), and no tabs.

**Decision taken: prune, do not split.** Splitting a vendored registry file into
per-component modules permanently forks it from upstream and turns every future
AI Elements update into a manual merge. Deleting unused exports keeps the file a
single unit that can still be diffed against upstream, and it is the change that
actually reduces the number.

The file carries two documented local modifications that **must survive any
prune** — `README.md` records the first, and `DoxChat.tsx:496-507` depends on it:

- `handleSubmit` defers `form.reset()` to the success paths, so a refused send
  keeps the reader's text. `DoxChat` signals refusal by *throwing* from
  `onSubmit`. Breaking this silently destroys a reader's over-long paste.

### F2 — Six vendored AI Elements files have zero importers

Resolved by parsing every `import { … } from ".../ai-elements/*"` in `src/`:

| File | Lines | Importers |
| --- | ---: | --- |
| `code-block.tsx` | 563 | **none** |
| `inline-citation.tsx` | 296 | **none** |
| `reasoning.tsx` | 226 | **none** |
| `sources.tsx` | 77 | **none** |
| `shimmer.tsx` | 77 | **none** (only `reasoning.tsx`, itself dead) |
| `tool.tsx` | 173 | **none** |
| `artifact.tsx` | 148 | `WidgetRail.tsx` (5 names) |
| `conversation.tsx` | 106 | `DoxChat.tsx` (3) |
| `message.tsx` | 368 | `DoxChat.tsx` (1: `MessageResponse`) |
| `prompt-input.tsx` | 1,483 | `DoxChat.tsx` (5) |
| `suggestion.tsx` | 54 | `DoxChat.tsx` (1: `Suggestion`) |
| `task.tsx` | 87 | `RetrievalTrace.tsx` (4) |

**1,412 lines across six files with no importer.** The README's status table is
partly stale on this point: it reserves `artifact.tsx` and `tool.tsx` for
`DOX-C3b`, but `DOX-C3b` has since landed — `artifact.tsx` is now wired (the
rail uses it) and `tool.tsx` still is not, because `WidgetReceipt.tsx` was built
as a purpose-made chip instead. That is a better outcome than the reservation
predicted, and `tool.tsx` should now be deleted rather than kept reserved.

The README's discipline is good and should be kept — it is the reason this
audit could be done from evidence rather than guesswork. It needs updating, not
replacing.

### F3 — Eight `components/ui/` primitives fall out once F1 and F2 are done

`components/ui/` (17 shadcn primitives, 1,647 lines) exists solely to support
`ai-elements/`. Nothing in `ask/` imports it except `BrainSelector.tsx`
(`dropdown-menu`). Tracing importers after the F1/F2 prune:

**Stays live:** `button` (8 importers), `button-group`, `input-group`, `input`,
`textarea`, `separator`, `spinner`, `collapsible` (via `task.tsx`),
`dropdown-menu` (via `BrainSelector`).

**Becomes dead:** `badge` (only `tool` + `inline-citation`), `carousel` (only
`inline-citation`), `command` + `dialog` (only the unused `PromptInputCommand*`),
`hover-card` (only `inline-citation` + unused `PromptInputHoverCard*`),
`scroll-area` (only `Suggestions`, the unused sibling of the used `Suggestion`),
`select` (only `code-block` + unused `PromptInputSelect*`), `tooltip` (only
unused exports in `prompt-input`/`message`/`artifact`).

Verified by hand for the two non-obvious cases: `PromptInputSubmit` uses
`InputGroupButton` and `Spinner`, so `input-group` and `spinner` stay.

**Estimated total removable: ~2,400 lines of vendored code**, with no change to
any rendered pixel. This must be verified by build + test rather than asserted —
see §6.

### F4 — Widget mount modules are components living in `src/lib/`

Five modules in `src/lib/` are, structurally, the largest components in the app:

| Module | Lines |
| --- | ---: |
| `dst-inspector-mount.ts` | 698 |
| `interval-visualizer-mount.ts` | 572 |
| `converter-bench-mount.ts` | 324 |
| `globe-mount.ts` | 166 |
| `widget-ui.ts` (shared helpers) | 177 |

Each contains, in one file: an `Args` interface, an HTML template function, a
`loadModules()` dynamic-import shim, several render helpers, a `setupWidget()`
closure holding all state and handlers, and the exported `MountFn`.

`dst-inspector-mount.ts` is the worst: `setupWidget()` spans **lines 416–619
(~200 lines)** and nests `render()`, `resetAndRender()` and `updateHandle()`
inside itself. `interval-visualizer-mount.ts` has the same shape at 255–508,
nesting `isIntervalValid()`, `render()`, `applyPreset()`, `clampAgainstSibling()`
and `setHandleValue()`.

Two things are wrong here, and only the second is about size:

1. **Location.** These are UI components. They live in `src/lib/` — the same
   directory as `retrieval/search.ts`, `page-markdown.ts` and `llms.ts`, which
   are build-time/server concerns. A reader looking for the DST inspector's
   markup has no reason to look in `lib/`.
2. **Internal layering.** Template, wiring, and pure formatting are interleaved.
   The template function is pure and trivially testable; the `setupWidget`
   closure is neither.

### F5 — Byte-identical duplication between mount modules

`options(values, selected)` is **character-for-character identical** in
`dst-inspector-mount.ts:78-86` and `converter-bench-mount.ts:51-59`:

```ts
function options(values: readonly string[], selected: string): string {
  return values
    .map(
      (v) =>
        `<option value="${escapeAttr(v)}"${v === selected ? " selected" : ""}>${escapeHtml(v)}</option>`,
    )
    .join("");
}
```

Both files already import `escapeAttr`/`escapeHtml` from `widget-ui.ts`. This
belongs there too.

Separately, each mount module defines its own `loadModules()` that dynamically
imports from `GMT_MODULES` and then **casts every function through `as`** to
recover its type:

```ts
getDstTransitions: getMod["getDstTransitions"] as (zone: string, year: number) => DstTransition[],
```

Not identical code, but an identical *pattern* repeated three times, and every
instance is an unchecked assertion — a signature drift in `@northguild/gmt`
would compile clean and fail at runtime. Worth a typed helper in
`gmt-modules.ts`. Flagged as a type-safety issue, not a size issue.

### F6 — `.astro` widget shells follow three different patterns

**Pattern A — template + mount (5 files, the good one).** `ConverterBench`,
`DstInspector`, `IntervalVisualizer`, `Globe`, `CodeFrame`. The `.astro` file is
a `<Fragment set:html={renderXTemplate()} />` plus a small `<script>`; all markup
and behaviour live in the paired `lib/*-mount.ts`. 32–64 lines each, most of it
docstring. This is the pattern that makes the chat rail possible, and
`scripts/html-diff.mjs` guards it.

**Pattern B — markup in Astro, behaviour in lib (2 files).**
`MultiZoneScrubber.astro`, `TimezoneMap.astro`.

`TimezoneMap.astro` is the leak: its `<script>` block builds the entire clock
panel with `innerHTML` string templates, defines `setSelected()`, and wires
click delegation — ~45 lines of widget behaviour in a page shell, while
`lib/timezone-map.ts` (295 lines) holds the rest. Neither file is the widget.
Note that `lib/zone-clock-list.ts` (254 lines) already exists as the shared
`.gmt-clock-*` row recipe, so this markup is likely duplicating a solved problem.

**Pattern C — everything inline (1 file).** `PlaygroundForm.astro` — **430
lines**: 48 lines frontmatter, 162 lines markup, and a **216-line `<script>`**
(lines 214–430) defining `highlightArg()`, `makeRow()`, `scalarControl()` and
`blockControl()`. It is the second-largest UI file in the app and the only one
with no test of its client behaviour (`PlaygroundForm.test.ts` tests the
frontmatter spec parsing only).

It is also **rendered on all 502 generated reference pages** — the single
highest-traffic interactive component in the site, and the least structured.

### F7 — Every generated reference page imports three widgets it never renders

All 502 generated reference `.mdx` files carry the same four imports:

```mdx
import PlaygroundForm from "~/components/PlaygroundForm.astro";
import IntervalVisualizer from "~/components/IntervalVisualizer.astro";
import DstInspector from "~/components/DstInspector.astro";
import ConverterBench from "~/components/ConverterBench.astro";
```

Actual render counts across all 646 content pages:

| Component | Imported | Rendered |
| --- | ---: | ---: |
| `PlaygroundForm` | 502 | **502** |
| `IntervalVisualizer` | 502 | **5** |
| `DstInspector` | 502 | **2** |
| `ConverterBench` | 502 | **2** |

Astro will not emit an unrendered component's script, so this is not a runtime
regression — but it is 1,506 unnecessary module resolutions per build, and it is
misleading to every reader of a generated page. The fix belongs in the
generator template, not in the 502 outputs.

### F8 — Three styling systems, no stated rule

1. **26 global stylesheets** (6,179 lines) listed in `astro.config.mjs`'s
   `customCss`, `gmt-*.css`, BEM-ish flat class names.
2. **Component-scoped `<style>` blocks** in 11 of 29 `.astro` files
   (`WhyDateAlternatives`, `WhyDateBug`, `HeroCopy`, `LinkButton`, `Header`,
   `Hero`, `HeroGlobe`, `Icon`, `ButtonLink`, `SectionHeading`, `dox.astro`).
3. **Tailwind v4**, scoped to the chat island via `gmt-ask-tailwind.css`
   (preflight omitted, `source(none)`, explicit `@source` list).

Each is individually justified and #3 is documented carefully in
`design-system.md`. What is missing is a rule for *which to reach for*.
`design-system.md` says only "component-scoped `<style>` blocks stay in their
`.astro` files" — which describes the status quo without deciding anything.

The practical consequence: `gmt-hive.css` is **1,143 lines**, the largest sheet
in the app, styling a React component tree that also carries Tailwind utility
classes from its vendored ancestors. Two systems style one subtree.

### F9 — Import paths, test names, and file placement are inconsistent

**Import style.** 91 `~/`-alias imports vs 59 relative `../` imports in `.ts`/
`.tsx`. `DoxChat.tsx` uses both, in adjacent lines:

```ts
import { CORPUS_SUMMARY } from "~/lib/chat-constants";      // alias
import { Conversation } from "../ai-elements/conversation";  // relative
```

**Test naming.** Four conventions coexist in `components/ask/`:

| File | Tests |
| --- | --- |
| `chat-warning.test.ts` | `chat-warning.tsx` (logic) |
| `chat-warning-render.test.tsx` | `chat-warning.tsx` (render) — different base name |
| `DoxChat.ssr.test.tsx` | `DoxChat.tsx` — infix variant |
| `rail-keyboard.test.tsx` | `WidgetRail.tsx` — **no matching source file name** |

**Untested components.** `DoxChat.tsx` has only an SSR smoke test.
`BrainSelector.tsx`, `WidgetRail.tsx` (directly), `RetrievalTrace.tsx`, and all
three `hive/` components have none.

**Widget tests use `.tsx` for non-React modules.**
`src/lib/dst-inspector-mount.test.tsx` tests a plain-DOM module; the extension
is JSX-free.

### F10 — `design-system.md` names a file that no longer exists

> "Both are imported from the chat island's entry module (`AskDoxProbe.tsx`)"

`AskDoxProbe.tsx` was deleted when `DOX-C3a` replaced the static probe. The
sheets are now imported from `DoxChat.tsx:13-15`. One-line fix, but it is the
document a future story will trust.

---

## 4. Proposed structure

The organising principle: **directory encodes rendering model and ownership**,
so that the boundary from §2 is visible from the file tree alone.

```
src/components/
  vendor/                    ← DO NOT EDIT except to re-sync. New boundary.
    ai-elements/             ← 6 files after prune (was 12)
    ui/                      ← 9 primitives after prune (was 17)
    README.md                ← moved + updated status table

  chat/                      ← React. Only rendered inside /dox.
    DoxPage.tsx              ← the island root
    DoxChat.tsx              ← transcript + composer
    ChatErrorBoundary.tsx
    transcript/              ← extracted from DoxChat (see §5, P4)
      ChatTurn.tsx
      ChatEmptyState.tsx
      ChatComposer.tsx
      chat-helpers.ts        ← widgetCallsOf, retrievalTraceOf, chatFetch, STARTERS
    warning/
      chat-warning.tsx
    citations/
      link-components.tsx
      resolve-href.ts
    retrieval/
      RetrievalTrace.tsx
    brains/
      BrainSelector.tsx
      use-brains.ts
    hive/                    ← unchanged; already correct
      HiveGlyph.tsx  HiveHub.tsx  HiveNode.tsx  use-crystal-spin.ts
    rail/
      WidgetRail.tsx
      MountedWidget.tsx
      WidgetReceipt.tsx
      widget-registry.ts
    use-idle-timeout.ts

  widgets/                   ← Astro shell + plain-DOM module, co-located.
    dst-inspector/
      DstInspector.astro     ← Pattern A shell
      template.ts            ← renderDstTemplate + Args
      mount.ts               ← mountDstInspector + setupWidget
      render.ts              ← renderTransitionTable/Ticker/ProbeResult/…
      dst-inspector.ts       ← existing pure logic, unmoved in spirit
    interval-visualizer/     ← same four-file shape
    converter-bench/
    globe/
    timezone-map/            ← Pattern B → A
    multi-zone-scrubber/
    playground-form/         ← Pattern C → A (see §5, P6)
    shared/
      widget-mount.ts        ← the MountFn/WidgetHandle contract
      widget-ui.ts           ← + options() from F5
      widget-permalink.ts
      code-frame.ts
      CodeFrame.astro

  site/                      ← Astro-only. Zero JS or one small script.
    Header.astro  Hero.astro  HeroCopy.astro  HeroGlobe.astro
    LinkButton.astro  ButtonLink.astro  Icon.astro  DoxMark.astro
    ThemeProvider.astro  ThemeSelect.astro  SocialIcons.astro  Head.astro
    GridSection.astro  SectionHeading.astro  ChartContainer.astro
    ScrollReveal.astro  Scenario.astro  Mistake.astro
    WhyDateBug.astro  WhyDateAlternatives.astro
```

`src/lib/` then keeps only what it should have kept all along: retrieval,
build-time generation, chat plumbing, and pure date/geo helpers.

### The rule this encodes

> **Astro is the default.** A component is `.astro` unless it must live inside
> the `/dox` React island.
>
> **React is confined to `components/chat/`.** No `client:*` directive is added
> outside `src/pages/dox.astro` without a written decision.
>
> **Interactive non-chat UI is Astro shell + plain-DOM mount**, split
> `template.ts` / `mount.ts`, so the same widget can be server-rendered on a docs
> page and string-mounted in the chat rail.
>
> **`components/vendor/` is not ours.** Prune to what is used; never restructure.

---

## 5. Proposed phases

Ordered so each phase is independently shippable and reviewable. Nothing here is
started.

| # | Phase | Risk | Approx. Δ lines |
| --- | --- | --- | ---: |
| P1 | Delete 6 unimported `ai-elements` files (F2) | Low | −1,412 |
| P2 | Prune `prompt-input.tsx` to its 5 used exports; preserve the `form.reset()` modification (F1) | Medium | −1,000 |
| P3 | Delete the 8 `ui/` primitives that fall out (F3) | Low | −~800 |
| P4 | Dedupe `options()` into `widget-ui.ts`; fix the 502 generated imports in the generator (F5, F7) | Low | −~20, −1,506 imports |
| P5 | Introduce `vendor/`, `chat/`, `widgets/`, `site/`; move files, no logic changes (§4) | Medium | 0 |
| P6 | Split `DoxChat.tsx` into `transcript/` (F4-adjacent) | Medium | 0 |
| P7 | Split the three large mount modules `template`/`mount`/`render` (F4) | Medium | 0 |
| P8 | `TimezoneMap` Pattern B → A; `PlaygroundForm` Pattern C → A (F6) | High | 0 |
| P9 | Normalise imports to `~/`, rename tests, update `design-system.md` (F9, F10) | Low | 0 |

**P1–P4 are the cheap, high-value ones: roughly −3,200 lines with no behaviour
change.** P5 is a pure move that makes the rest legible. P6–P8 are real
refactors and should each carry their own verification pass. P8 is marked High
because `PlaygroundForm` renders on 502 pages and its client script is untested.

### Note on P6 — `DoxChat.tsx` is not actually bloated

At 545 lines it looks like a problem, but the file is roughly 250 lines of code
and 300 lines of explanatory comment, and the comments are load-bearing (they
record why `index === messages.length - 1` is required, why there is one
`MessageResponse` per turn, why the transport is built once). **Do not strip them
to hit a line count.** The extraction in P6 is worth doing for the seams — the
empty state, the turn, and the composer are three independent things — not for
the number.

---

## 6. How to verify any of this

No phase is complete until all of these pass from `apps/dox/`:

```bash
pnpm build          # 646 pages; Astro fails loudly on a missing import
pnpm test           # 40 test files across src/ + worker/
pnpm check          # astro check — types across .astro and .tsx
node scripts/html-diff.mjs   # asserts widget markup is byte-identical
```

Additionally, per phase:

- **P1–P3 (vendored deletion).** `pnpm build` is the real gate: a deleted export
  that something still imports fails the build. Then diff the emitted CSS —
  removing `ui/` primitives that Tailwind was scanning via `@source
  "../components/ui"` will legitimately shrink the island's utility sheet, and
  that shrinkage must not touch any class the live components use. Take a
  `scripts/visual-snapshot.mjs` capture of `/dox` before and after.
- **P4 (generator).** Regenerate and confirm `git diff` touches only the four
  import lines across the 502 files, and that `<PlaygroundForm` is still present
  on every one.
- **P5 (moves).** Use `git mv` so history follows. `pnpm check` catches every
  broken path. Confirm `astro.config.mjs`'s `components:` override map and
  `src/virtual-starlight.d.ts` are updated — Starlight resolves those by string
  path and will not fail at type-check.
- **P6–P7.** `MountedWidget.test.tsx`, `rail-keyboard.test.tsx`,
  `widget-registry.test.ts` and the three `*-mount.test.tsx` files already cover
  the seams being cut. They must pass unmodified.
- **P8.** `PlaygroundForm` needs client-behaviour tests written *before* the
  move, not after. This is the one phase where the existing suite does not
  protect the change.

Manual passes on `/dox` after any chat-touching phase: send a question, confirm
streaming, a tool call opening the rail, the receipt's two links, the composer
retaining text on a refused over-long paste (F1's modification), and a
keyboard-only run through the rail.

---

## 7. What is explicitly **not** wrong

Recorded so it is not "fixed" by a later pass:

- **The `MountedWidget` React/plain-DOM bridge** (§2.1). Deliberate and correct.
- **`widget-registry.ts`'s type erasure.** The `defineWidget` /
  `AnyWidgetEntry` split is the sound way to hold a heterogeneous registry, and
  its no-dynamic-code property is a security DoD line — do not "simplify" the
  literal-key lookup into a computed one.
- **`ai-elements/README.md`'s status table.** The right instinct, kept and
  updated rather than replaced.
- **`hive/`.** Four files, one component each, one hook. Already the target shape.
- **Tailwind's island scoping.** `source(none)` + explicit `@source` + omitted
  preflight is correct and hard-won; `@source "../components/ui"` etc. must be
  re-pointed, not removed, in P5.
- **`dox.astro`'s `data-dox-shell` CSS overrides.** Ugly but correct — the
  comment explains why `StarlightPage` cannot be bypassed.
