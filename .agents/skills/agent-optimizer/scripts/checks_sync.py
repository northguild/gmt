"""Sync checks: .claude symlinks for personas and skills."""

from __future__ import annotations

from pathlib import Path

from checks_personas import find_personas, parse_frontmatter


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
