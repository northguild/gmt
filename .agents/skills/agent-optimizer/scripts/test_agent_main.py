# /// script
# requires-python = ">=3.9"
# dependencies = ["pytest"]
# ///
"""Tests for agent-optimizer: main (end to end).

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


def make_repo(tmp_path: Path, agents_md: str, context_files: dict[str, str]) -> Path:
    write_tree(tmp_path, {"AGENTS.md": agents_md})
    return write_tree(tmp_path, {f"context/{k}": v for k, v in context_files.items()})


def test_main_not_a_directory(tmp_path: Path) -> None:
    result = subprocess.run(
        [sys.executable, str(SCRIPTS / "optimize.py"), str(tmp_path / "nope")],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 1
    assert "Not a directory" in result.stdout


def test_main_no_entry_file(tmp_path: Path) -> None:
    result = subprocess.run(
        [sys.executable, str(SCRIPTS / "optimize.py"), str(tmp_path)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 1
    assert "No entry file found" in result.stdout


def test_main_success(tmp_path: Path) -> None:
    content = "# Agents\n\n[overview](./context/overview.md)\n"
    make_repo(tmp_path, content, {"overview.md": "content"})
    result = subprocess.run(
        [sys.executable, str(SCRIPTS / "optimize.py"), str(tmp_path)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0
    out = json.loads(result.stdout)
    assert len(out["entry_files"]) == 1
    assert out["context"]["exists"] is True


def test_main_report_sections(tmp_path: Path) -> None:
    write_tree(tmp_path, {
        "AGENTS.md": "# A\n[c](./context/c.md)\n",
        "context/c.md": "C\n",
        ".agents/arch.md": "---\nname: arch\nmodel: inherit\n---\nbody\n",
    })
    result = subprocess.run(
        [sys.executable, str(SCRIPTS / "optimize.py"), str(tmp_path)],
        capture_output=True, text=True,
    )
    out = json.loads(result.stdout)
    assert result.returncode == 0
    assert [p["name"] for p in out["personas"]] == ["arch"]
    assert {"agents", "skills"} <= set(out["sync"])
    assert out["summary"]["orphans"] == 0
    assert out["summary"]["persona_warnings"] >= 1
