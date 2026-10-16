"""Persona audit for `.agents/*.md`: line budget, model choice, nested-spawn ban."""

from __future__ import annotations

import re
from pathlib import Path

# --- Budgets / lists (mirror references/rules.md) ---
PERSONA_LINE_BUDGET = 200  # lines in a persona file before a warning
# Planners, the researcher and the final standards reviewer may run on Opus/Fable.
OPUS_ALLOWED = ("architect", "dox-architect", "researcher", "gmt-reviewer")
EXPENSIVE_MODELS = ("opus", "fable")

FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---", re.DOTALL)
KEY_RE = re.compile(r"^([A-Za-z][A-Za-z0-9_-]*):[ \t]*(.*)$")


def parse_frontmatter(text: str) -> dict[str, str] | None:
    """Top-level `key: value` pairs of the YAML frontmatter, values as raw strings."""
    m = FRONTMATTER_RE.match(text)
    if not m:
        return None
    fm: dict[str, str] = {}
    for line in m.group(1).splitlines():
        km = KEY_RE.match(line)
        if km:
            fm[km.group(1)] = km.group(2).strip().strip("'\"")
    return fm


def find_personas(root: Path) -> list[Path]:
    agents = root / ".agents"
    if not agents.is_dir():
        return []
    found: list[Path] = []
    for md in sorted(agents.glob("*.md")):
        fm = parse_frontmatter(md.read_text(errors="replace"))
        if fm and fm.get("name"):
            found.append(md)
    return found


def audit_persona(path: Path, root: Path) -> dict[str, object]:
    text = path.read_text(errors="replace")
    fm = parse_frontmatter(text) or {}
    name = fm.get("name", path.stem)
    model = fm.get("model", "")
    lines = len(text.splitlines())
    warnings: list[str] = []
    if lines > PERSONA_LINE_BUDGET:
        warnings.append(f"{path.name} is {lines} lines (budget {PERSONA_LINE_BUDGET}); move detail to context/")
    if not model:
        warnings.append("no model: set an explicit model (sonnet unless the role needs more)")
    elif model.lower() == "inherit":
        warnings.append("model: inherit runs on the caller's (often most expensive) model; set one")
    elif any(x in model.lower() for x in EXPENSIVE_MODELS) and name not in OPUS_ALLOWED:
        warnings.append(f"model: {model} but {name} is not in OPUS_ALLOWED {list(OPUS_ALLOWED)}")
    disallowed = {t for t in re.split(r"[\s,\[\]]+", fm.get("disallowedTools", "")) if t}
    if "Agent" not in disallowed:
        warnings.append("disallowedTools does not list Agent (nested spawns are banned)")
    return {
        "file": str(path), "name": name, "lines": lines, "model": model or None,
        "over_line_budget": lines > PERSONA_LINE_BUDGET, "warnings": warnings,
    }


def audit_personas(root: Path) -> list[dict[str, object]]:
    return [audit_persona(p, root) for p in find_personas(root)]
