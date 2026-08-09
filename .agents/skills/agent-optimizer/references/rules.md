# optimize-agent-context — rules & thresholds

This file is the single source of truth for the budgets, extraction thresholds, and report
format used by `scripts/optimize.py`. Tune values here, not in the script or SKILL.md.

## Entry file size budget

- `ENTRY_SIZE_BUDGET = 4000` — total characters in an entry file (`AGENTS.md`, `CLAUDE.md`).
  Over budget → warning to move detail into `context/`.
- Rationale: entry files are read on (nearly) every task. Keep them a routing table plus a
  short quick-reference — bulk detail belongs in scoped `context/*.md` files loaded on demand
  (progressive disclosure).

## Progressive disclosure — entry file sections

- `SECTION_EXTRACT_CHARS = 600` — any `## ` section in an entry file whose body exceeds this
  many characters is an extraction candidate. Suggested target: `context/<slug>.md`, with the
  section replaced by a one-line link in a routing table, e.g.:
  `| [context/foo.md](./context/foo.md) | When you need … |`

## Context directory checks

- **Orphans**: any `context/*.md` file not linked from any entry file is dead weight — either
  link it (add a routing-table row) or delete it if it's stale. An orphaned file with real
  content (e.g. a large undocumented roadmap or spec) is the highest-priority finding: it's
  paying storage/maintenance cost with zero chance of ever being loaded via the documented
  discovery path.
- **Broken links**: any entry-file link pointing at a `context/*.md` (or other `.md`) file that
  doesn't exist. Fix the path or remove the row.
- `CONTEXT_FILE_BUDGET = 15000` — total characters in a single `context/*.md` file. Over budget
  → warning to split into smaller, more narrowly scoped files (e.g. split a giant
  `standards.md` into `coding-standards.md` / `testing-standards.md`, as this repo already
  does).
- `CONTEXT_SIMILARITY = 0.80` — pairwise `SequenceMatcher` ratio between two context files' full
  content at or above this is reported as "near-duplicate context files" (candidates to merge
  — two files saying almost the same thing is wasted context budget and a drift risk when only
  one gets updated).

## What this skill does NOT check

- It does not parse or validate skill files (`.agents/skills/*/SKILL.md`) — that's
  `skill-optimizer`'s job. Entry files and `context/` are a different layer (project-wide
  agent instructions vs. reusable per-task skills).
- It does not judge content quality/correctness — only size, linkage, and duplication.

## Report format (JSON)

```json
{
  "entry_files": [
    {
      "file": "/abs/path/AGENTS.md",
      "chars": 2414,
      "over_budget": false,
      "section_candidates": [
        { "section": "Core Rules", "chars": 900, "suggest": "context/core-rules.md" }
      ],
      "warnings": []
    }
  ],
  "context": {
    "dir": "/abs/path/context",
    "exists": true,
    "files": [
      { "file": "/abs/path/context/roadmap.md", "chars": 71576, "over_budget": true,
        "linked_from": [], "warnings": ["71576 chars (budget 15000); split into smaller scoped files"] }
    ],
    "orphans": ["/abs/path/context/roadmap.md"],
    "near_duplicates": []
  }
}
```

Exit code is always 0 on a successful scan (advisory). Non-zero only on a fatal argument error
(path not a directory, or no entry file found).

## Fixing findings

This skill never edits files. Typical fixes, applied by the human (or the agent, on request):

- **Orphan context file**: add a row to the routing table in every entry file (`AGENTS.md`,
  `CLAUDE.md`), or delete the file if it's stale/superseded.
- **Over-budget entry file / oversized section**: extract the section body into
  `context/<slug>.md` and replace it with a one-line link, same pattern as `## Core Rules`
  already does for this repo's own detail files.
- **Over-budget context file**: split along its natural sub-topics into two or more files, and
  update the routing table (and any other entry-file links) to list all resulting files.
- **Near-duplicate context files**: merge into one file, or clarify scope so each file covers a
  genuinely distinct concern, and update any links that pointed at the file being removed.
