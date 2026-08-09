# optimize-skills — rules & thresholds

This file is the single source of truth for the budgets, extraction thresholds, and report
format used by `scripts/optimize.py`. Tune values here, not in the script or SKILL.md.

## Size budget

- `SIZE_BUDGET = 20000` — total characters in `SKILL.md`. Mirrors `quick_validate.py`'s
  `MAX_SKILL_CHARS` for consistency. Over budget → warning to move detail into `references/`.
- Rationale: keep the always-loaded SKILL.md small; bundle optional detail so it is only read
  on demand (progressive disclosure).

## Progressive disclosure

- `SECTION_EXTRACT_CHARS = 600` — any `## ` section whose body exceeds this many characters is
  an extraction candidate. Suggested target: `references/<slug>.md`, and the section is replaced
  in SKILL.md with a one-line link like:
  `See [references/foo.md](references/foo.md) for the full …`.

## Trigger phrases

`description` should contain at least one concrete cue so semantic matching fires. Accepted
cues (lowercased substring match): `use when`, `when the user`, `when you`, `validate`,
`optimize`, `check`, `audit`, `lint`, `verify`, `trim`, `reduce`, `enforce`.

If none match, warn: the skill may not trigger on natural phrasing. Add real user wording
("validate skills", "why isn't my skill triggering", etc.).

## Cross-skill (--all mode)

- `DESCRIPTION_SIMILARITY = 0.80` — pairwise `SequenceMatcher` ratio between two descriptions
  at or above this is reported as "similar descriptions" (risk: wrong skill used). Make the
  descriptions more distinct.
- **Duplicate names** — two skills sharing `name` are reported; a higher-priority source
  (enterprise/plugin) could shadow a personal/project skill of the same name. Rename to be
  distinct.

## Runtime readiness

- Warn if any `scripts/*.py` lacks the executable bit → `chmod +x <script>`.
- Warn on any backslash (`\`) path separator in SKILL.md → use forward slashes everywhere.
- Warn if a script is referenced but its dependencies are not documented in the skill
  `description`/references (so the runner knows what to install).

## Report format (JSON)

Single dir:

```json
{
  "dir": "/abs/path",
  "name": "skill-name",
  "chars": 1234,
  "over_budget": false,
  "section_candidates": [
    { "section": "Setup", "chars": 900, "suggest": "references/setup.md" }
  ],
  "warnings": ["..."]
}
```

`--all` wraps each in `{ "skills": [...], "inventory": { "duplicate_names": [...], "similar_descriptions": [...] } }`.

Exit code is always 0 (advisory). Non-zero only on a fatal argument error (e.g. path not a dir).

## Troubleshooting checklist (from Anthropic lesson)

- Not triggering? Improve `description` and add trigger phrases.
- Not loading? Check path (SKILL.md inside a named dir, not skills root), exact filename
  `SKILL.md`, and YAML syntax. Run `claude --debug` to see load errors.
- Wrong skill used? Make descriptions more distinct from each other.
- Being shadowed? Check the priority hierarchy (enterprise > plugin > personal/project); rename
  if needed.
- Plugin skills missing? Clear cache, restart, reinstall.
- Runtime failure? Check dependencies, script permissions (`chmod +x`), and path separators.
