# /// script
# requires-python = ">=3.12"
# dependencies = ["pytest"]
# ///
"""Tests for agent-optimizer: .claude symlink sync and kilo.jsonc.

Run with:
    python3 -m pytest -q .agents/skills
"""

from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).parent
_spec = importlib.util.spec_from_file_location("agent_optimize", SCRIPTS / "optimize.py")
if _spec is None or _spec.loader is None:
    raise ImportError("Could not determine module spec for optimize.py")
optimize = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(optimize)


def write_tree(root: Path, files: dict[str, str]) -> Path:
    """Create files (paths relative to root, parents made as needed)."""
    for rel, content in files.items():
        p = root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content)
    return root


def n_lines(n: int) -> str:
    return "".join(f"line {i}\n" for i in range(n))


import checks_sync  # noqa: E402


def link(root: Path, rel: str, target: str) -> None:
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.symlink_to(target)


def repo(root: Path) -> Path:
    write_tree(root, {
        ".agents/a.md": "---\nname: a\n---\n",
        ".agents/skills/s1/SKILL.md": "x",
    })
    link(root, ".claude/agents/a.md", "../../.agents/a.md")
    link(root, ".claude/skills/s1", "../../.agents/skills/s1")
    return root


def test_in_sync(tmp_path: Path) -> None:
    result = checks_sync.check_symlinks(repo(tmp_path))
    for kind in ("agents", "skills"):
        assert result[kind] == {"missing": [], "wrong_target": [], "dangling": [], "extra": []}


def test_missing_links(tmp_path: Path) -> None:
    repo(tmp_path)
    write_tree(tmp_path, {".agents/b.md": "---\nname: b\n---\n", ".agents/skills/s2/SKILL.md": "x"})
    result = checks_sync.check_symlinks(tmp_path)
    assert result["agents"]["missing"] == ["b"]
    assert result["skills"]["missing"] == ["s2"]


def test_wrong_target(tmp_path: Path) -> None:
    repo(tmp_path)
    write_tree(tmp_path, {".agents/b.md": "---\nname: b\n---\n"})
    link(tmp_path, ".claude/agents/b.md", "../../.agents/a.md")
    assert checks_sync.check_symlinks(tmp_path)["agents"]["wrong_target"] == ["b"]


def test_dangling_and_extra(tmp_path: Path) -> None:
    repo(tmp_path)
    link(tmp_path, ".claude/agents/ghost.md", "../../.agents/ghost.md")
    link(tmp_path, ".claude/skills/gone", "../../.agents/skills/gone")
    write_tree(tmp_path, {".claude/agents/plain.md": "not a link", "other/x.md": "x"})
    link(tmp_path, ".claude/skills/stray", "../../other")
    result = checks_sync.check_symlinks(tmp_path)
    assert result["agents"]["dangling"] == ["ghost.md"]
    assert result["agents"]["extra"] == ["plain.md"]
    assert result["skills"]["dangling"] == ["gone"]
    assert result["skills"]["extra"] == ["stray"]


JSONC = """{
  // comment
  "agent": {
    "a": { "prompt": "{file:.agents/a.md}", }, // trailing
    "b": { "prompt": "{file:.agents/nope.md}" },
    "url": { "prompt": "http://x.io//path,}" },
  },
}
"""


def test_strip_jsonc_keeps_strings() -> None:
    data = json.loads(checks_sync.strip_jsonc(JSONC))
    assert data["agent"]["url"]["prompt"] == "http://x.io//path,}"
    assert set(data["agent"]) == {"a", "b", "url"}


def test_kilo_missing_and_bad_prompt(tmp_path: Path) -> None:
    repo(tmp_path)
    write_tree(tmp_path, {".agents/c.md": "---\nname: c\n---\n", "kilo.jsonc": JSONC})
    result = checks_sync.check_kilo(tmp_path)
    assert result["exists"] is True
    assert result["missing_personas"] == ["c"]
    assert result["bad_prompts"] == [{"agent": "b", "path": ".agents/nope.md"}]


def test_kilo_absent(tmp_path: Path) -> None:
    assert checks_sync.check_kilo(repo(tmp_path))["exists"] is False


def test_kilo_unparseable(tmp_path: Path) -> None:
    write_tree(tmp_path, {"kilo.jsonc": "{ nope"})
    assert "error" in checks_sync.check_kilo(tmp_path)


def test_kilo_exempts_claude_code_builtin_overrides(tmp_path: Path) -> None:
    repo(tmp_path)
    write_tree(tmp_path, {".agents/Explore.md": "---\nname: Explore\n---\n", "kilo.jsonc": "{\"agent\": {}}"})
    assert "Explore" not in checks_sync.check_kilo(tmp_path)["missing_personas"]
