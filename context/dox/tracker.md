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
`issues/DOX-E.md`. The one item that can't close yet is `DOX-E1a` rendering in the
`/dox` widget rail, which can't exist before Tier 6 (`DOX-C3a`/`DOX-C3b`) builds that
rail. `initGlobe`/the scrubber's `mount`-shaped entry points are already rail-ready —
see the pickup note in `issues/DOX-C.md`.

² Also carries two `DOX-C3a` DoD items promoted early at explicit user request: the
real `/dox` route (hosting the same static, non-networked probe DOX-C0 built to prove
the wiring — no `useChat`, no `/api/chat`) and a header link reachable from any page.
The header link is a plain nav link, **not** `DOX-C3a`'s draggable dock — see
`issues/DOX-C.md`'s DOX-C0 section and `reference/design-system.md`'s "`/dox` and the
header link" for what that means `DOX-C3a` still owns.

³ Corrects three of this file's own numbers along the way — 591 functions not 504, a
missing `examples` field on `CorpusEntry` (added), and a latent generator bug on a
clean checkout (fixed) — and picks the provider: Vercel AI SDK (not TanStack AI, which
lacks a Google or Workers AI adapter) + Gemini 2.5 Flash. See `issues/DOX-C.md`'s
DOX-C1 section for the full measurements and reasoning. **Model name corrected under
DOX-C2** — see footnote 4.

⁴ Adds `main`/`worker/index.ts` to the previously assets-only `wrangler.jsonc`, a same-
origin `/api/chat` behind the DOX-C.md-specified validation pipeline (zod), a per-
isolate rate limiter, and the seven-section system prompt (persona, linking rules,
vocabulary, GMT core rules, retrieved chunks, tool placeholder, refusal instruction).
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

⁵ `DOX-C3a` is **done and deployed**; `DOX-C3b` has not started, which is why the row
stays In Progress. What shipped: the full chat at `/dox` over `useChat` — streaming
answers, the visible retrieval trace, link hardening against the route manifest (a
hallucinated path degrades to plain text, never a 404), the idle-timeout stall guard,
warning-vs-error classification, and one-request-at-a-time enforcement. Plus the
free-tier survival layer this story did not originally anticipate: Gemini's quota is
`PerDay·PerProject·PerModel`, so Dox keeps four brains and fails over between them
_inside a single request_, backed by a KV ledger keyed on Pacific days.

**One DoD reversal, recorded rather than dropped: the every-page draggable dock is cut.**
`DOX-C3a` specified drag, resize, focus trap and keyboard dock-position cycling. It was
never built and should not be. `DOX-C0`'s header link — a plain `<a>` plus inline SVG
carrying the Dox crystal, **zero JavaScript** — already reaches `/dox` from every page,
and `/dox` is now a deliberately chrome-free full-bleed surface. A floating dock would
duplicate that surface, and mounting a React island on every page is precisely what
would break `DOX-C0`'s "no React bundle on a reference page" property, which is
currently true by construction. The four dock DoD lines retire with it; the `/dox`
keyboard pass stays and is met. See `issues/DOX-C.md`'s `DOX-C3a` section.

`DOX-C3b` (the widget registry, and with it `DOX-E1a`'s rail — footnote 1) is the whole
of what remains. Scoping found it is larger than its spec claims: the three Tier 2
widgets are ~100% server-rendered Astro, so extracting `mount(root)` does not by itself
make them React-mountable — the open question is markup provenance, plus `destroy()`
contracts for React StrictMode and a DOM-test environment `apps/dox` does not yet have.

Parked work carries no story ID and never enters this table — see
[appendix-parked.md](appendix-parked.md).
