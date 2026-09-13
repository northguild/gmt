---
name: grill-with-docs
description: A relentless interview to sharpen a plan or design, which also records the decisions as docs as we go.
disable-model-invocation: true
---

Interview the user about the plan or design one question at a time. Push on every assumption:
inputs and sentinels, plain vs zoned, DST and non-existent days, locale behaviour, and what
existing gmt functions already cover. Prefer questions that force a concrete example
(`input → expected output`).

Check each answer against the decisions of record before accepting it —
[AGENTS.md](../../../AGENTS.md) core rules and
[coding-standards § Calendar & zone semantics](../../../context/coding-standards.md#calendar--zone-semantics).
Flag a conflict instead of silently recording it.

As decisions settle, write them down where future agents will look: the story's
`context/domination/issues/<ID>.md` for epic work, or the relevant `context/` file for a
project-wide rule. Keep entries short — the decision, the reason, and the source.
