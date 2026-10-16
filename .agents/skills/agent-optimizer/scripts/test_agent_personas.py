# /// script
# requires-python = ">=3.9"
# dependencies = ["pytest"]
# ///
"""Tests for agent-optimizer: persona audit.

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


import checks_personas  # noqa: E402


def persona(name: str, extra: str = "", body: str = "body\n") -> str:
    base = f"---\nname: {name}\ndescription: d\nmodel: sonnet\ndisallowedTools: Agent\n"
    return base + extra + "---\n" + body


def audit(root: Path, name: str, text: str) -> dict:
    write_tree(root, {f".agents/{name}.md": text})
    return checks_personas.audit_persona(root / f".agents/{name}.md", root)


def test_plan_constants() -> None:
    assert checks_personas.OPUS_ALLOWED == ("architect", "dox-architect", "researcher", "gmt-reviewer")
    assert checks_personas.PERSONA_LINE_BUDGET == 200
    assert optimize.OPUS_ALLOWED == checks_personas.OPUS_ALLOWED


def test_clean_persona_has_no_warnings(tmp_path: Path) -> None:
    r = audit(tmp_path, "tdd-dev", persona("tdd-dev"))
    assert r["warnings"] == [] and r["model"] == "sonnet" and r["lines"] == 7


def test_line_budget(tmp_path: Path) -> None:
    r = audit(tmp_path, "big", persona("big", body=n_lines(195)))
    assert r["lines"] == 201 and any("201 lines" in w for w in r["warnings"])


def test_missing_model(tmp_path: Path) -> None:
    text = "---\nname: x\ndisallowedTools: Agent\n---\nb\n"
    assert any("no model" in w for w in audit(tmp_path, "x", text)["warnings"])


def test_inherit_model(tmp_path: Path) -> None:
    text = persona("x").replace("model: sonnet", "model: inherit")
    assert any("inherit" in w for w in audit(tmp_path, "x", text)["warnings"])


@pytest.mark.parametrize("model", ["opus", "fable"])
def test_opus_only_for_allowed(tmp_path: Path, model: str) -> None:
    text = persona("tester").replace("model: sonnet", f"model: {model}")
    assert any("OPUS_ALLOWED" in w for w in audit(tmp_path, "tester", text)["warnings"])


@pytest.mark.parametrize("name", ["architect", "dox-architect", "researcher", "gmt-reviewer"])
def test_opus_allowed_names(tmp_path: Path, name: str) -> None:
    text = persona(name).replace("model: sonnet", "model: opus")
    assert audit(tmp_path, name, text)["warnings"] == []


def test_agent_must_be_disallowed(tmp_path: Path) -> None:
    text = persona("x").replace("disallowedTools: Agent", "disallowedTools: Edit, Write")
    assert any("Agent" in w for w in audit(tmp_path, "x", text)["warnings"])
    assert audit(tmp_path, "y", persona("y").replace("Agent", "Edit, Agent, Write"))["warnings"] == []
    assert audit(tmp_path, "z", persona("z").replace("Agent", "[Edit, Agent]"))["warnings"] == []
    missing = "---\nname: w\nmodel: sonnet\n---\nb\n"
    assert any("Agent" in w for w in audit(tmp_path, "w", missing)["warnings"])


def test_find_personas_needs_frontmatter_name(tmp_path: Path) -> None:
    write_tree(tmp_path, {
        ".agents/a.md": persona("a"),
        ".agents/Explore.md": persona("Explore"),
        ".agents/notes.md": "# no frontmatter\n",
        ".agents/skills/s/SKILL.md": persona("s"),
    })
    found = [p.name for p in checks_personas.find_personas(tmp_path)]
    assert found == ["Explore.md", "a.md"]


def test_audit_personas_lists_all(tmp_path: Path) -> None:
    write_tree(tmp_path, {".agents/a.md": persona("a"), ".agents/b.md": persona("b")})
    assert [r["name"] for r in checks_personas.audit_personas(tmp_path)] == ["a", "b"]
