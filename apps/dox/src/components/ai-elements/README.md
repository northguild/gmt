# AI Elements — what is wired, and what is not

These files are **vendored**, not a dependency. AI Elements is a shadcn registry:
its source is copied into the repo (`components.json`, style `new-york`), so we
own and re-theme every component here. `DOX-C0` installed 12 of them rather than
`all`.

Five years of "why is this file here?" is avoidable with a table, so:

| File | Status | Notes |
| --- | --- | --- |
| `conversation.tsx` | **wired** | `DoxChat` — the scroll container (`use-stick-to-bottom`) |
| `message.tsx` | **wired** | `DoxChat` — Streamdown rendering. **Locally modified:** the `streamdownPlugins` / `streamdownControls` block turns the download control off and leaves copy on |
| `prompt-input.tsx` | **wired** | `DoxChat` — the composer. **Locally modified:** `form.reset()` is deferred to the success paths so a refused send keeps the reader's text (see the comment in `handleSubmit`) |
| `suggestion.tsx` | **wired** | `DoxChat` — the empty-state pills |
| `task.tsx` | **wired** | `RetrievalTrace` — the collapsible retrieval trace |
| `artifact.tsx` | **wired** | `WidgetRail` — the panel a mounted widget sits in on `/dox` |
| `tool.tsx` | not wired | The transcript's tool-call receipt is the purpose-built `WidgetReceipt` chip instead. Candidate for deletion — `context/dox/ui-audit.md` P1 |
| `sources.tsx` | not wired | Deliberate: Dox cites inline, in prose, against the route allowlist — a separate sources rail would duplicate that |
| `inline-citation.tsx` | not wired | Same decision as `sources.tsx` |
| `reasoning.tsx` | not wired | Reasoning never reaches the browser: the Worker streams with `sendReasoning: false` (`worker/chat-handler.ts`) |
| `shimmer.tsx` | not wired | `DoxChat` has its own crystal placeholder derived from `status`, which is the site's own visual language rather than a generic skeleton |
| `code-block.tsx` | **superseded** | Copyable code blocks come from Streamdown's `code` plugin inside `message.tsx`, which is what actually renders answers. This standalone component renders a code block passed as a prop and has no caller |

## If you are adding a component

Add the row. An unexplained unused file reads as an oversight, and the next
person to audit this directory should not have to re-derive which of these were
choices and which were leftovers — that audit has now been done twice.
