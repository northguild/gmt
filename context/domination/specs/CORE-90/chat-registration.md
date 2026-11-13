# Slice 7 — chat-registration: tool, widget, permalink, starter pill

Index: [index.md](index.md). Pattern: every place `showMoroccoClockChange` and `moroccoclock`
appear. `grep -rn "moroccoclock\|showMoroccoClockChange\|morocco-clock-change" apps/dox` lists
them. Rules: the tool-registration and chat-starters sections of [built.md](../../../dox/built.md).

## Names

| Thing | Value |
| ----- | ----- |
| Tool | `showUsSunshineProtectionAct` |
| Widget kind (permalink `?w=`) | `sunshineact` |
| Widget title | "Sunshine Protection Act" (the page-title exception; the tool description stays effects-only) |
| Page | `withBase("/check/us-sunshine-protection-act/")` |
| `data-widget` | `sunshine-protection-act` |

## Input schema — `apps/dox/src/lib/dox-tools.ts`

The top level stays an object, because tool calling wants one. The view is a discriminated union
inside it, so there is no bag of optional members:

```ts
export const showUsSunshineProtectionActInput = z.object({
  view: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("today"), zone: zoneSchema.optional() }),
    z.object({ kind: z.literal("proposals"), state: z.string().regex(/^[A-Z]{2}$/).optional() }),
  ]),
});
```

Doc entry, in the shape of the Morocco one:

- **purpose.** "Show a map of US time zones as the tz data has them today: which change their
  clocks and which keep the same time all year. A second view shows each state's adopted
  position on ending the clock changes, dated, and a panel of what the national proposal would
  do. Below both: evidence on how disruptive a change would be."
- **when.** "Call when the reader asks which US states or zones change their clocks, which keep
  one time all year, which states want daylight or standard time all year, what would happen if
  the US stopped changing clocks, or how a change would affect saved times."
- **args.** "view: { kind: today, zone?: one IANA id from the page's zone list } or { kind:
  proposals, state?: a two-letter state or territory code }. Never a place name."

No string names a bill, body or statute. The slice-8 word scan covers the doc entry too.

Add the tool to:

- the `DoxToolName` union;
- the docs list;
- the `tools` map;
- `ENABLED_TOOL_NAMES`.

## `apps/dox/worker/tools.ts`

Import `showUsSunshineProtectionActInput` and add the tool with `description:
docFor("showUsSunshineProtectionAct")`. Follow the Morocco entry exactly. `tools.test.ts` guards the
lists.

## `apps/dox/src/components/ask/widget-registry.ts`

`defineWidget<SunshineActArgs>` with:

- **parse.** `showUsSunshineProtectionActInput.safeParse`, refusing with the shared reason.
- **load.** A dynamic import of `~/lib/sunshine-protection-act-mount` that returns
  `renderSunshineProtectionActWidgetTemplate(idPrefix)` and `mountSunshineProtectionActWidget`. The page and the
  chat share one template function. The chat variant leaves out the guidance cards (the
  checkers leave out Key points the same way) and keeps the national panel.
- **validate.**
  - A `zone` must be in `us-region-zones.json` `zones`.
  - A `state` must be in `STATE_CODES`, a literal list of the 56 codes exported from
    `sunshine-protection-act-proposals.ts`. A test asserts it equals the `postal` set in
    `state-boundaries-us.json`, so the chat bundle never loads the geometry.
  - Anything else is refused with "`X` isn't one of the places the page lists."

## `apps/dox/src/lib/widget-permalink.ts`

- Add `"sunshineact"` to `WidgetKind`, and map it to the page.
- `seedFromLocation("sunshineact")` returns `{ view }`.
- Extend `widget-permalink.test.ts` with:
  - a `today` link that pins a zone;
  - a `proposals` link that pins a state;
  - a malformed `view` that opens on Today, unpinned.

## `CHAT_STARTERS` — `apps/dox/src/lib/chat-constants.ts`

One pill, `area: "core"`, placed **after** the first five (`CORE_TOOL_COUNT`). It goes right
after the Morocco starter, so no US example leads:

```ts
{
  text: "Which US states want to stop changing their clocks, and which already have?",
  widget: "showUsSunshineProtectionAct",
  area: "core",
  args: { view: { kind: "proposals" } },
},
```

The args name no zone, so the starter opens on no `America/New_York`.

## Hand-kept lists (the tests do not find these)

| File | Entry |
| ---- | ----- |
| `src/lib/widget-load-error.test.tsx` | `MOUNTS`: `mountSunshineProtectionActWidget` |
| `src/components/ask/widget-graph.test.ts` | `heavy`: `lib/sunshine-protection-act-mount.ts`, `lib/feature-map.ts`, `lib/us-projection.ts`, `data/sunshine-protection-act-guidance.ts` |
| `scripts/html-diff.mjs` | `PAGES`: `{ path: "check/us-sunshine-protection-act", widget: "sunshine-protection-act" }` |
| `scripts/visual-snapshot.mjs` | `PAGES`: `{ slug: "check-us-sunshine-protection-act", path: "/check/us-sunshine-protection-act/" }` |
| `scripts/grow-measure.mjs` | `PAGES`: `{ slug: "sunshine-protection-act", path: "/check/us-sunshine-protection-act/" }` |
| family CSS Module | forced-colours rules for each new class and pattern |

## Droppable

The page works with the chat deleted. Nothing in the page imports from `components/ask/`.
