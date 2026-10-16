"""Sync checks: .claude symlinks for personas and skills, and kilo.jsonc agent entries."""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

from checks_personas import find_personas, parse_frontmatter

FILE_PROMPT_RE = re.compile(r"\{file:([^}]+)\}")
# Claude Code built-in agents a persona overrides; Kilo ships its own, so no kilo.jsonc entry.
KILO_EXEMPT = {"Explore"}


def _links(claude_dir: Path, expected: dict[str, Path], file_names: bool) -> dict[str, list[str]]:
    """Compare a .claude/<dir> against expected {link key: source path}."""
    out: dict[str, list[str]] = {"missing": [], "wrong_target": [], "dangling": [], "extra": []}
    suffix = ".md" if file_names else ""
    present = sorted(claude_dir.iterdir()) if claude_dir.is_dir() else []
    entries = {p.name: p for p in present}
    for key, source in expected.items():
        entry = entries.get(key + suffix)
        if entry is None:
            out["missing"].append(key)
        elif not entry.is_symlink() or entry.resolve() != source.resolve():
            out["wrong_target"].append(key)
    known = {k + suffix for k in expected}
    for name, entry in entries.items():
        if name.startswith("."):
            continue
        if entry.is_symlink() and not entry.exists():
            out["dangling"].append(name)
        elif name not in known:
            out["extra"].append(name)
    return out


def check_symlinks(root: Path) -> dict[str, dict[str, list[str]]]:
    personas = {
        (parse_frontmatter(p.read_text(errors="replace")) or {})["name"]: p for p in find_personas(root)
    }
    skills_dir = root / ".agents" / "skills"
    skills = (
        {d.name: d for d in sorted(skills_dir.iterdir()) if d.is_dir() and not d.name.startswith(".")}
        if skills_dir.is_dir() else {}
    )
    return {
        "agents": _links(root / ".claude" / "agents", personas, True),
        "skills": _links(root / ".claude" / "skills", skills, False),
    }


def strip_jsonc(text: str) -> str:
    """Remove // and /* */ comments and trailing commas, leaving string contents intact."""
    out: list[str] = []
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        if c == '"':
            j = i + 1
            while j < n and text[j] != '"':
                j += 2 if text[j] == "\\" else 1
            out.append(text[i : j + 1])
            i = j + 1
        elif text.startswith("//", i):
            while i < n and text[i] != "\n":
                i += 1
        elif text.startswith("/*", i):
            end = text.find("*/", i + 2)
            i = n if end < 0 else end + 2
        else:
            out.append(c)
            i += 1
    parts = re.split(r'("(?:\\.|[^"\\])*")', "".join(out))  # odd indexes are strings
    return "".join(
        part if i % 2 else re.sub(r",(\s*[}\]])", r"\1", part) for i, part in enumerate(parts)
    )


def check_kilo(root: Path) -> dict[str, object]:
    path = root / "kilo.jsonc"
    if not path.is_file():
        return {"exists": False}
    try:
        data = json.loads(strip_jsonc(path.read_text()))
    except ValueError as exc:
        return {"exists": True, "error": f"cannot parse kilo.jsonc: {exc}"}
    agents = data.get("agent", {}) if isinstance(data, dict) else {}
    names = [(parse_frontmatter(p.read_text(errors="replace")) or {})["name"] for p in find_personas(root)]
    bad: list[dict[str, str]] = []
    for key, cfg in agents.items():
        m = FILE_PROMPT_RE.search(str(cfg.get("prompt", ""))) if isinstance(cfg, dict) else None
        if m and not os.path.exists(root / m.group(1)):
            bad.append({"agent": key, "path": m.group(1)})
    return {
        "exists": True,
        "missing_personas": sorted(n for n in names if n not in agents and n not in KILO_EXEMPT),
        "bad_prompts": bad,
    }
