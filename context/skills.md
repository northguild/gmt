# Skills

Skills live in `.agents/skills/` and are symlinked into `.claude/skills/`. Run them with
`/skill-name`. Vendored skills (pinned in `skills-lock.json`, installed with `npx skills add`)
are fixed upstream, not edited here.

## Story flow

```text
/plan-story      ← in the story's worktree; the branch name gives the story
  … answer the grilling questions, pick Dox tools, approve …
/clear
/implement       ← refuses to start until the plan is approved; ends with /optimize
```

## By task

| Skill | What it does |
| --- | --- |
| `/plan-story` | Plans a story from the branch name or an id: library spec, grilling, then Dox tools |
| `/implement` | Implements a planned story; a plan gate stops it until `/plan-story` approved the spec. The finalizer folds the spec into the issue file and deletes it |
| `/pipeline` | Classifies a library or Dox request and runs the specialists in order |
| `/grilling` | Design-tree interview that stress-tests a plan; `/plan-story` runs it |
| `/grill-me` | Owner-only shortcut that runs `/grilling` |
| `/grill-with-docs` | Interview-style design review that records decisions as docs |
| `/tdd` | Vertical-slice red → green reference |
| `/code-review` | GMT-specific review checklist — see the note below |
| `/research` | Research a question against primary sources into a Markdown file |
| `/prototype` | Throwaway prototype to answer a design question |
| `/handoff` | Write a handoff note for the next session |
| `/commit-message` | Drafts a ready-to-copy commit message from the current diff (read-only) |
| `/pr-desc` | Drafts a PR title and description from the branch diff (read-only) |
| `/changelog` | Rewrites the pending `.changeset/*.md` description to match CHANGELOG style |
| `/plain-english` | ISO 24495-1 plain-language rules for prose a person reads, not runs |
| `/update-readme` | Syncs the landing-page READMEs' figures, sample, namespaces and prompt |
| `/tanstack-intent` | Keeps `packages/gmt/skills/` in sync with source changes |
| `/optimize` | Runs agent-optimizer and skill-optimizer; short summary of this branch's findings |
| `/agent-optimizer` | Audits AGENTS.md, context/, personas and symlinks; reports token usage |
| `/skill-optimizer` | Audits skills for size, progressive disclosure and trigger collisions |
| `/caveman` | Terse reply mode |
| `/astro` | Astro reference for `apps/dox` |

**`/code-review` name collision.** Claude Code ships a built-in `/code-review`. If the
built-in wins, load the GMT checklist directly:
[code-review-checklist.md](./code-review-checklist.md).

## Python in skills

**Run skill scripts with `python3`** — any Python 3.9 or later, including the system `python3`
on macOS. The scripts use the standard library only (PyYAML is optional), so they need no venv:

```bash
python3 .agents/skills/optimize/scripts/run.py
```

**Tests and type checks use the shared root env.** `pyproject.toml`, `uv.lock` and `.venv` at
the repo root serve every skill; skills do not carry their own env. Run `uv sync --extra dev`
once, then `uv run pytest -q .agents/skills` (and `pyright`). The suite must also pass on
Python 3.9, since that is what `python3` is on a stock Mac.
