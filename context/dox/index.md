# Dox: the documentation site for `@burglekitt/gmt`

This file has been split into a progressive-disclosure directory. Read what you need:

- [overview.md](overview.md) — Context, architecture, verified findings, workspace
  integration, visual design language, verification, risks
- [story-groups.md](story-groups.md) — A–E story group summaries (the 13-story build)
- [tracker.md](tracker.md) — Issue/status table, build order
- [issues/A.md](issues/A.md) … [issues/E.md](issues/E.md) — Full per-story
  GitHub-issue-ready specs
- [appendix-parked.md](appendix-parked.md) — Researched but deliberately unscheduled
  work (audio, voice, generative-UI widgets, reactive scene). No story IDs, not in the
  sequence — read before proposing any of it, so the findings aren't re-derived.
- [example-sibling-repo-docs.md](example-sibling-repo-docs.md) — **Reference only, not a
  target.** How a sibling `@burglekitt/worktree` repo built its docs site and AI chat.
  Reviewed 2026-08-21; what was taken from it and what was rejected is recorded in
  [overview.md](overview.md) §2 "Reviewed prior art". Do not build what it describes —
  its stack and its no-retrieval design are both deliberate rejections here.

**Dox is a docs site first and a chatbot second.** Story Group A ships a real, deployed,
searchable, linkable documentation site. Everything after it is additive. If you are
picking up a story, that ordering is the point — see [overview.md](overview.md) §1.
