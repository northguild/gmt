# Dox theme: the chat island

Part of [design-system.md](design-system.md). Rules for `/dox`: Tailwind, the composer and the
examples rail.

## Tailwind in the chat island

AI Elements needs Tailwind CSS 4, and it must not reach any other page.

1. **No Preflight, no automatic content scan** (`gmt-ask-tailwind.css`): import only
   `tailwindcss/theme.css` and `utilities.css` (with `source(none)`), name the `@source` folders
   (`ai-elements`, `ui`, `ask`) and each installed Streamdown plugin's `dist`, because Streamdown
   ships utility classes in compiled output. `preflight.css` is deliberately not imported.
2. **Import that sheet from the island's entry module, never from `customCss`.**
3. **Unlayered GMT rules beat every Tailwind utility.** `gmt-ask.css` ships a scoped `.gmt-ask`
   reset for the six collision groups: `h1` to `h6`, `textarea` / `input` / `[contenteditable]`
   (caret), `header` (`backdrop-filter`), `dialog` / `[role="dialog"]` (every Radix overlay),
   `::selection` and `body`.
4. **Bridge the palette.** shadcn's variables (`--background`, `--primary`, `--border`, `--ring`)
   map onto `--gmt-*`; `--gmt-danger` backs `--destructive`. Amber stays reserved for the sentinel.
5. **`dark:` follows `data-theme`, not the OS:** `@custom-variant dark (&:where([data-theme="dark"],
   [data-theme="dark"] *));`. Otherwise Shiki's `dark:`-gated colours pick the wrong theme for
   anyone whose OS and site theme differ.
6. **Streamdown is styled through `.gmt-ask-response`**, a class passed to every `MessageResponse`,
   with unlayered overrides in `gmt-ask.css`. Streamdown emits one `data-streamdown` attribute
   (`table-wrapper`), so there are no attribute hooks.

## The composer control bar

- The brain menu (Radix `DropdownMenu`, `menuitemradio`) and the reset clock (Popover + cmdk) sit in
  `PromptInputTools`, left of Send, and both open upward.
- The reset chip shows whatever refills next (`src/lib/quota-resets.ts`). Every format is one gmt
  call (`src/lib/reset-formats.ts`) shown with its reference link.
- **Dates render after mount only,** because the reader's zone and locale are not the server's.
  Picks persist in `localStorage` (`dox:reset-zone`, `dox:reset-format`).
- **Nothing implies "unlimited".** The dev cookie exempts its holder from the per-visitor cap,
  never from the shared pool.

## The examples rail

Starter questions are bevelled `<button>` cards in the widget rail (`ExamplesPanel.tsx`,
`gmt-hive.css`), grouped under industry headings, each with a chip naming the widget it opens.

- **Card text is `--gmt-ice` in every state.** `--gmt-cyan-ink` on the tinted hover fill is under
  7:1 in light, so hover and focus change border and fill only. Long text wraps with
  `overflow-wrap: anywhere`; nothing scrolls sideways at 390px.
- **Phone:** below 60rem, once a conversation has started, a collapsed rail is `display: none`
  (`[data-collapsed]`) and the `Examples · N` bar shows above the composer. The bar is `display:
  none` by default and switched on only inside that query, in a block after its base rule.
- **Empty phone layout:** `.gmt-hive-body[data-empty]` sizes the chat to its content and gives the
  rail `flex: 1 1 0` with a 7rem floor, so the crystal, status line and prompt are never clipped.
- **Short phone (below 44rem tall):** the empty state starts folded and drops its block padding.
  Below 35rem the body keeps a 30rem floor and `.gmt-hive-shell` scrolls as a page.
- **Fine print on a phone:** below 60rem the accuracy note and `.gmt-hive-licence` are hidden;
  `.gmt-hive-info` (44px, first in the control bar) opens both in one `popover="auto"` panel anchored
  above it, falling back to the bottom edge without anchor positioning.
- **Focus:** the widget title (`tabIndex={-1}`, focused after a card opens it) draws a cyan
  `:focus-visible` outline. In forced colours the cards, bar and title use a `Highlight` outline; the
  card and bar rules double `.gmt-sonar-focus` to out-rank `.gmt-sonar-focus:focus { outline: none }`.
- **Motion:** the chevron rotation and card transitions are off under `prefers-reduced-motion`.
- **Forced colours:** cards are `ButtonFace`/`ButtonText` with a solid border, chips a dashed
  `ButtonText` border, the bar a 2px `ButtonText` border, headings `CanvasText`, and focus a real
  `outline` in `Highlight`, because forced colours drop the `box-shadow` sonar ring.
- No colour literals, no amber, no light-theme colour block, and bevels from `corner-shape`; only the
  carousel's panel, tiles, rows and diamonds may use a `clip-path` octagon.
