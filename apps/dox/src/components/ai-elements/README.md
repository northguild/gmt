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
| `artifact.tsx` | not yet wired | **Reserved for `DOX-C3b`**, which mounts a live Tier 2 widget inside it in the `/dox` rail. Do not delete |
| `tool.tsx` | not yet wired | **Reserved for `DOX-C3b`** — `ToolInput`/`ToolOutput` for a tool-call receipt in the transcript. Do not delete |
| `sources.tsx` | not wired | Deliberate, recorded in `DOX-C.md`: installed but not wired in `DOX-C3a`. Dox cites inline, in prose, against the route allowlist — a separate sources rail would duplicate that |
| `inline-citation.tsx` | not wired | Same decision as `sources.tsx` |
| `reasoning.tsx` | not wired | Nothing streams a `reasoning` part today: `worker/brains.ts` calls `streamText` without thinking enabled. It becomes relevant only if a brain with visible reasoning is added to `BRAINS` |
| `shimmer.tsx` | not wired | `DoxChat` has its own crystal placeholder derived from `status`, which is the site's own visual language rather than a generic skeleton |
| `code-block.tsx` | **superseded** | `DOX-C3a`'s "code blocks are copyable" DoD line is met by Streamdown's `code` plugin inside `message.tsx`, which is what actually renders answers. This standalone component renders a code block passed as a prop and has no caller. It is the one file here that is unlikely ever to be wired |

## If you are adding a component

Add the row. An unexplained unused file reads as an oversight, and the next
person to audit this directory should not have to re-derive which of these were
choices and which were leftovers — that audit has now been done twice.
