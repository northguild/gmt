# Dox component cleanup — open items

Audit of `apps/dox/src/components`, `src/lib` (client modules) and `src/styles`. **None of
the phases below has started** (checked 2026-09-11). Read before restructuring components.

## The boundary — keep it

- **React exists only inside `/dox`** (`src/pages/dox.astro`, the one `client:*` directive).
  Every other page is Astro plus plain-DOM modules. No `client:*` directive is added elsewhere
  without a written decision.
- **`MountedWidget.tsx` is the bridge, and it is correct.** React renders an empty host;
  `renderTemplate()` writes the widget's DOM and `mount()` wires it, so the same widget
  server-renders on a docs page and string-mounts in the chat rail. Contract:
  `src/lib/widget-mount.ts`.
- **Also correct, not to be "fixed":** `widget-registry.ts`'s type erasure (its literal-key
  lookup is the no-dynamic-code guarantee), `hive/`, the Tailwind island scoping, and
  `dox.astro`'s `data-dox-shell` overrides.

## Open phases, in order

| #   | Phase                                                                                                                                            | Risk   | Δ lines        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | -------------- |
| P1  | Delete the six vendored AI Elements files nothing imports: `code-block`, `inline-citation`, `reasoning`, `sources`, `shimmer`, `tool`             | Low    | −1,412         |
| P2  | Prune `ai-elements/prompt-input.tsx` (1,483 lines) to its five used exports, **keeping the deferred `form.reset()`** that preserves a refused send | Medium | −~1,000        |
| P3  | Delete the `ui/` primitives that fall out: `badge`, `carousel`, `command`, `dialog`, `hover-card`, `scroll-area`, `select`, `tooltip` — re-trace importers first; `popover` is now used by the reset clock | Low    | −~800          |
| P4  | Move the duplicated `options()` from `dst-inspector-mount.ts` and `converter-bench-mount.ts` into `widget-ui.ts`; drop the three unrendered widget imports from the generator's reference-page template | Low    | −20            |
| P5  | Folders encode ownership: `components/vendor/` (ai-elements, ui), `chat/`, `widgets/<name>/`, `site/`. Pure moves                                  | Medium | 0              |
| P6  | Split `DoxChat.tsx` into turn, empty state and composer — for the seams, not the line count; keep its load-bearing comments                       | Medium | 0              |
| P7  | Split the large mount modules (`dst-inspector-mount.ts`, `interval-visualizer-mount.ts`) into template / mount / render                           | Medium | 0              |
| P8  | `TimezoneMap.astro` to the template + mount pattern; `PlaygroundForm.astro` (216-line inline script, rendered on every reference page) likewise — **write its client-behaviour tests first** | High   | 0              |
| P9  | Normalise imports to `~/`; one test-naming convention                                                                                            | Low    | 0              |

Also worth a typed helper: every mount module's `loadModules()` casts gmt functions through
`as`, so a signature change in `@northguild/gmt` compiles clean and fails at runtime.

## Verifying any phase

From `apps/dox`: `pnpm build` (a deleted export that is still imported fails here), `pnpm
test`, `pnpm check`, `node scripts/html-diff.mjs compare <dir>`.

- **P1–P3:** diff the island's emitted CSS — removing files Tailwind scans via `@source`
  shrinks the utility sheet, and nothing live may lose a class. Visual-snapshot `/dox` before
  and after.
- **P5:** `git mv` so history follows. Update `astro.config.mjs`'s `components` map,
  `src/virtual-starlight.d.ts`, and the Tailwind `@source` paths — Starlight resolves overrides
  by string and will not fail type-checking.
- **After any chat-touching phase**, on `/dox`: a streamed answer, a tool call opening the rail,
  the receipt's links, an over-long paste keeping its text when refused, and a keyboard-only run
  through the rail.
