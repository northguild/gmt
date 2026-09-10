## GitHub Issues

The 23 sub-stories map onto 14 GitHub issues — #130–#142, plus **#171 for `DOX-C0`**. Each
issue appears once below; its `Story` column lists every sub-story that folds into it.
Start a branch by naming the sub-story ID (e.g. `DOX-A3a`) — the agent resolves it to the
issue number here and the full spec in `issues/<letter>.md`.

**#171 (`DOX-C0`) is the one story with its own issue** rather than a sub-story slot: the
React + Tailwind + AI Elements foundation is infrastructure rather than chat, it touches
every existing page's build, and it is independently reviewable before any chat behavior
exists. **It blocks all four other Tier 6 stories.**

**`Blocked by` is the column to read before picking work. An empty cell (`—`) means the
issue is free to start.** Entries drop out as their own row is marked `Done`, so the column
shrinks as the epic lands.

It is generated, never hand-edited. Each sub-story declares its dependencies in a
`Depends on …` line in its description block in `issues/<letter>.md`; an issue's cell is the
union of its sub-stories', mapped back to issue numbers, minus the ones already `Done`. Run
`pnpm deps:sync` to regenerate and `pnpm deps:ready` to list what is startable.

Because an issue bundles several sub-stories, its cell is coarser than the real graph — an
issue is shown blocked if _any_ of its sub-stories is. The precise chain is in the issue
files.

`Order` is the sequence to actually build these in. It follows overview.md §5:

- **Tier 0 is the MVP and is order-locked.** `DOX-A1` → `DOX-A2` → `DOX-A3a` must land in
  that sequence so every later tier is visible on a live site from the start.
- **Tier 1 onward may be reordered freely.**
- **Tier 5 (scenarios) may run in parallel with Tiers 2–4** once `DOX-B1a` exists — it is
  content work with a different skill profile and does not compete with component work.

**An issue closes when its last sub-story lands, not its first.** Do not close #132 when
`DOX-A3a` ships — `DOX-A3b` is still open against it in Tier 1. Same for #133. The
single-story issues (#130, #131, #134, #140, #141, #171, #137, #138) close on their only
sub-story.

**No changesets, no publish column.** `apps/dox` is private and is not published to
npm, so unlike `context/roadmap/`, these stories do not need a `.changeset/*.md` entry —
with one exception: if a story also modifies `packages/gmt` (for example `DOX-A3a`
deciding to stub the namespace READMEs, per overview.md §7), that change follows the
normal repo convention and does need a changeset.

| Order | Story                                       | GitHub Issue | Status       |
| ----- | ------------------------------------------- | ------------ | ------------ |
| 1     | DOX-A1                                      | #130         | Done         |
| 2     | DOX-A2                                      | #131         | Done         |
| 3     | DOX-A3 (DOX-A3a, DOX-A3b)                   | #132         | Done         |
| 4     | DOX-A5                                      | #134         | Done         |
| 5     | DOX-A4 (DOX-A4a, DOX-A4b, DOX-A4c, DOX-A4d) | #133         | Done         |
| 6     | DOX-B1 (DOX-B1a)                            | #135         | Done         |
| 7     | DOX-B2 (DOX-B2a, DOX-B2b, DOX-B2c, DOX-B2d) | #136         | Done         |
| 8     | DOX-D1                                      | #140         | Done         |
| 9     | DOX-D2                                      | #141         | Done         |
| 10    | DOX-E1 (DOX-E1a, DOX-E1b)                   | #142         | Done¹        |
| 11    | DOX-C0                                      | #171         | Done²        |
| 12    | DOX-C1                                      | #137         | Done³        |
| 13    | DOX-C2                                      | #138         | Done⁴        |
| 14    | DOX-C3 (DOX-C3a, DOX-C3b)                   | #139         | In Progress⁵ |
| 15    | DOX-C4                                      | #240         | Not started  |

¹ Every DoD item buildable outside Tier 6 is done — see the "Status" notes in
`issues/DOX-E.md`. The last open item was `DOX-E1a` rendering in the `/dox` widget rail,
which could not exist before Tier 6 built that rail. **`DOX-C3b` has now built it**: the
globe is a registered widget (`showGlobe`), and `Globe.astro` and the rail call the same
`mountGlobe`, so the globe rendering on `/tools/zoned-earth/` exercises the rail's mount
path — which jsdom cannot, having no canvas. This row closes when #139 does; it is held
open only by that issue's own last unverified line (footnote 5), not by anything left in
`DOX-E1`.

² Also carries two `DOX-C3a` DoD items promoted early at explicit user request: the
real `/dox` route (hosting the same static, non-networked probe DOX-C0 built to prove
the wiring — no `useChat`, no `/api/chat`) and a header link reachable from any page.
The header link is a plain nav link, **not** `DOX-C3a`'s draggable dock — see
`issues/DOX-C.md`'s DOX-C0 section and `reference/design-system.md`'s "`/dox` and the
header link" for what that means `DOX-C3a` still owns.

³ Corrects three of this file's own numbers along the way — 591 functions not 504
(itself since grown to 597; the corpus is now 761 chunks and `corpus-summary.test.ts`
asserts the figure the chat screen shows against the real corpus), a
missing `examples` field on `CorpusEntry` (added), and a latent generator bug on a
clean checkout (fixed) — and picks the provider: Vercel AI SDK (not TanStack AI, which
lacks a Google or Workers AI adapter) + Gemini 2.5 Flash. See `issues/DOX-C.md`'s
DOX-C1 section for the full measurements and reasoning. **Model name corrected under
DOX-C2** — see footnote 4.

⁴ Adds `main`/`worker/index.ts` to the previously assets-only `wrangler.jsonc`, a same-
origin `/api/chat` behind the DOX-C.md-specified validation pipeline (zod), a per-
isolate rate limiter, and the eight-section system prompt (persona, standing order,
linking rules, vocabulary, GMT core rules, retrieved chunks, tool placeholder,
refusal instruction — the standing order is the prompt-injection boundary, and was
missing from this list and from the section-order test until the C1–C3 remediation
pass).
Verified end-to-end against the real Gemini API, not just mocked: a grounded question
streams a correct, cited answer; a plausible-but-absent question ("parse a cron
expression with gmt") refuses; the key never appears in any response. Worker script
bundle measured at 354.88 KiB gzip (1959.32 KiB uncompressed) — well under Cloudflare's
3 MB compressed limit. **Corrects DOX-C1's model choice**: `gemini-2.5-flash` is no
longer available to new API keys as of this story (2026-09-09) — Google's own error
directs callers to `gemini-3.6-flash`, confirmed with a live call, not assumed. Vocabulary
(SKILL.md content) deliberately excludes `packages/gmt/skills/contributor/*` — those are
maintainer-workflow docs, not consumer usage vocabulary, and would risk the model
picking up "file an issue"-style tone in an end-user answer.

⁵ `DOX-C3a` is **done and deployed**. `DOX-C3b` is **code-complete with one DoD line
unverified**, which is why the row is still In Progress rather than Done — see the
paragraph at the end of this footnote. What `DOX-C3a` shipped: the full chat at `/dox` over `useChat` — streaming
answers, the visible retrieval trace, link hardening against the route manifest (a
hallucinated path degrades to plain text, never a 404), the idle-timeout stall guard,
warning-vs-error classification, and one-request-at-a-time enforcement. Plus the
free-tier survival layer this story did not originally anticipate: Gemini's quota is
`PerDay·PerProject·PerModel`, so Dox keeps nine brains (~165 requests/day
between them) and fails over between them _inside a single request_, backed by
a KV ledger keyed on Pacific days.

**One DoD reversal, recorded rather than dropped: the every-page draggable dock is cut.**
`DOX-C3a` specified drag, resize, focus trap and keyboard dock-position cycling. It was
never built and should not be. `DOX-C0`'s header link — a plain `<a>` plus inline SVG
carrying the Dox crystal, **zero JavaScript** — already reaches `/dox` from every page,
and `/dox` is now a deliberately chrome-free full-bleed surface. A floating dock would
duplicate that surface, and mounting a React island on every page is precisely what
would break `DOX-C0`'s "no React bundle on a reference page" property, which is
currently true by construction. The four dock DoD lines retire with it; the `/dox`
keyboard pass stays and is met. See `issues/DOX-C.md`'s `DOX-C3a` section.

**`DOX-C3b` is built.** All four Tier 2 widgets — the globe, the converter bench, the
interval visualizer and the DST inspector — are extracted into `mount(root)` modules with
a shared `renderTemplate()`, registered in a typed dispatch table with no dynamic code on
its path, and offered to the model. Every widget page renders identically after the
refactor, asserted by a new structural gate (`scripts/html-diff.mjs`) rather than by the
pixel diff, which cannot see a dropped attribute. The scoping note below was right that
markup provenance was the real work, and wrong that the scrub state would be the hard
part: the mount contract puts that DOM outside React entirely, so there is no re-render
for closure state to be lost across.

Three things landed that the spec did not ask for. **`ENABLED_TOOL_NAMES`** makes the
offered tools and the mountable widgets provably the same set, because an earlier state
let Dox promise a widget the panel could not show. **`escapeAttr`** closes an injection
hole the extraction itself opened — Astro escaped every interpolation and a hand-written
template string does not, while the values now reaching these templates are chosen by a
language model or decoded from a URL. And **three `/tools` pages** (DST inspector,
interval visualizer, converter bench) give the three buried widgets a destination of their
own; the permalinks now target those instead of a function's reference page.

**That line is now met.** All four widgets have been mounted from a real question to a
real Gemini brain through `/api/chat` — globe, converter bench, DST inspector and interval
visualizer — and the error cases were checked too (a question about Mars correctly renders
no widget at all).

Live testing earned its keep by finding two defects that no unit test could have caught,
both in the gap between what a model sends and what the widgets were built to receive.
**The interval visualizer drew every seeded value on a single pixel** — its timeline canvas
was hard-coded to calendar 2024, and a two-hour meeting is 0.0228% of a year. The canvas is
now a value: presets keep the fixed year (their composition depends on it), seeded and
typed values fit their own, with zero measured drift on the reference pages. And **the
system prompt was suppressing tool calls** — "Prefer prose. Call a tool only when seeing
the thing beats reading about it" produced 0 tool calls in 3 attempts on a question
matching a `Call when` line word for word. Both are written up in `issues/DOX-C.md`'s
"Live verification" section.

**What holds the row at In Progress is now a gate, not a feature.** The axis fix added one
attribute (`data-role="axis"`) to the interval template, so `html-diff` and `visual:diff`
— the gates that assert every widget page still renders identically after the extraction —
have not been re-run against it. Both need a build, which cannot run while the dev server
is up. Expect `html-diff` to report exactly that one added attribute and nothing else;
once it does, `DOX-C3` closes and only `DOX-C4` (#240) remains.

Two smaller things are also outstanding and neither blocks the row: the rewritten tool
instruction has not been re-measured live (`VISITOR_DAILY_MAX` is 5 and diagnosis spent the
day's budget), and `DOX_DEV_KEY` is still unset.

Parked work carries no story ID and never enters this table — see
[appendix-parked.md](appendix-parked.md).
