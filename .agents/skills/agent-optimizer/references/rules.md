# optimize-agent-context — rules & thresholds

Single source of truth for the budgets, lists and report format used by `scripts/optimize.py`
(constants at its top, and in `scripts/checks_personas.py` for the persona ones). Tune values
here and in those constants together.

## Size budgets

| Constant | Value | Applies to |
| --- | --- | --- |
| `ENTRY_SIZE_BUDGET` | 4000 chars | `AGENTS.md`, `CLAUDE.md` |
| `ENTRY_LINE_BUDGET` | 150 lines | entry files |
| `CONTEXT_FILE_BUDGET` | 15000 chars | each `context/**/*.md` |
| `CONTEXT_LINE_BUDGET` | 200 lines | each `context/**/*.md` |
| `PERSONA_LINE_BUDGET` | 200 lines | each persona in `.agents/*.md` |
| `SECTION_EXTRACT_CHARS` | 600 chars | a `## ` section body in an entry file |
| `CONTEXT_SIMILARITY` | 0.80 | pairwise ratio over non-blank lines |

Over a char or line budget is a warning to move detail into scoped files. Entry files are read
on nearly every task, so keep them a routing table plus a short quick reference. The same
200-line rule holds for Python and Markdown files in a skill; split instead of growing.

## Context checks

- **Recursion**: all of `context/` is scanned, including `context/domination/**` and
  `context/dox/**`.
- **Archive exclusion** (`ARCHIVE_DIR_NAME = "archive"`): anything under `context/archive/` is
  skipped for orphan, budget, line and duplicate checks.
- **Orphans**: Markdown links are followed transitively from the entry files (`AGENTS.md`,
  `CLAUDE.md`) and from every `.agents/*.md`. A context file not reached is an orphan. Links
  resolve relative to the file that holds them; `#anchors` and `?query` are dropped first.
- **Broken links**: any relative `.md` link, in an entry file, persona or context file, whose
  target is missing. `http(s):`, `mailto:`, anchor-only and absolute-path links are ignored, as
  is anything inside code fences or inline code.
- **Near-duplicates**: pairs at or above `CONTEXT_SIMILARITY` are merge candidates.

## Persona audit (`.agents/*.md`)

A persona is a top-level `.md` in `.agents/` whose YAML frontmatter has `name`.

- Line budget: `PERSONA_LINE_BUDGET`.
- `model:` must be present and not `inherit` (inherit runs on the caller's model, usually the
  most expensive).
- `model: opus` or `fable` is allowed only for names in `OPUS_ALLOWED`:
  `[architect, dox-architect, researcher, gmt-reviewer]` (planners, the researcher and the
  final standards reviewer). Every other persona stays on Sonnet or lower.
- `disallowedTools` must list `Agent`; nested spawns are banned. Comma lists and `[a, b]`
  lists both parse.

## Sync checks

- Every persona needs a symlink `.claude/agents/<name>.md` that resolves to it. Every directory
  in `.agents/skills/` needs a symlink `.claude/skills/<dir>` that resolves to it. Reported as
  `missing`, `wrong_target` (not a symlink, or points elsewhere), `dangling` (target gone) and
  `extra` (no matching source).
- `kilo.jsonc` is JSONC: `//` and `/* */` comments and trailing commas are stripped before
  parsing. Reported: personas missing from `agent` (`missing_personas`) and entries whose
  `{file:...}` prompt path does not exist (`bad_prompts`). Absent file: `{"exists": false}`.
- `KILO_EXEMPT` (in `checks_sync.py`) = `{Explore}`: personas that override a Claude Code built-in
  agent. Kilo ships its own, so they need no `kilo.jsonc` entry.

## What this skill does NOT check

- Skill files (`.agents/skills/*/SKILL.md`): that is `skill-optimizer`'s job.
- Content quality or correctness; only size, linkage, duplication, model choice and sync.

## Report format (JSON, abridged)

```json
{
  "entry_files": [{"file": "...", "chars": 2414, "lines": 87, "over_budget": false,
                   "over_line_budget": false, "section_candidates": [], "warnings": []}],
  "context": {"dir": "...", "exists": true,
              "files": [{"file": "...", "chars": 900, "lines": 40, "over_budget": false,
                         "over_line_budget": false, "linked_from": ["AGENTS.md"], "warnings": []}],
              "orphans": [], "broken_links": [{"file": "...", "link": "./x.md"}],
              "near_duplicates": []},
  "personas": [{"file": "...", "name": "tester", "lines": 90, "model": "sonnet",
                "over_line_budget": false, "warnings": []}],
  "sync": {"agents": {"missing": [], "wrong_target": [], "dangling": [], "extra": []},
           "skills": {"missing": [], "wrong_target": [], "dangling": [], "extra": []},
           "kilo": {"exists": true, "missing_personas": [], "bad_prompts": []}},
  "summary": {"orphans": 0, "broken_links": 0, "near_duplicates": 0, "over_budget_files": 0,
              "persona_warnings": 0, "symlink_problems": 0, "kilo_problems": 0}
}
```

Exit code is 0 on a successful scan (advisory). Non-zero only on a fatal argument error (path
not a directory, or no entry file found).

## Usage report (`scripts/usage.py`)

Args: `--days` (7), `--project-glob` (`*`), `--root` (`~/.claude/projects`), `--top` (15),
`--json`. Walks `<root>/<glob>/**/*.jsonl` modified within the window. Files under
`subagents/` take `agentType` and `spawnDepth` from the sibling `agent-<id>.meta.json`; all
others are `MAIN`, depth 0. Requests are de-duplicated by `message.id`. `BIG_CONTEXT = 150000`.
Output tokens are never reported (logged mid-stream, unreliable).

## Fixing findings

Applied by the human (or the agent, on request):

- **Orphan**: link it from a parent file or an entry-file routing row, or delete or archive it.
- **Over-budget entry file or section**: extract into `context/<slug>.md` and leave a link.
- **Over-budget context or persona file**: split along sub-topics and update the links.
- **Near-duplicates**: merge, or clarify scope so each file has a distinct concern.
- **Persona model**: set an explicit model; add `Agent` to `disallowedTools`.
- **Sync drift**: create the missing symlink (`ln -s`), or remove the dangling or extra one;
  add the persona to `kilo.jsonc` or fix its `{file:...}` path.
