# /// script
# requires-python = ">=3.12"
# dependencies = ["pytest"]
# ///
"""Tests for agent-optimizer: recursion, transitive orphans, archive, broken links, line budgets.

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


ENTRY = "# Agents\n\n[idx](./context/index.md)\n"


def rels(root: Path, paths: list[str]) -> set[str]:
    return {Path(p).relative_to(root).as_posix() for p in paths}


def audit(root: Path) -> dict:
    return optimize.audit_context_dir(root, optimize.find_entry_files(root))


def test_recurses_subdirectories(tmp_path: Path) -> None:
    write_tree(tmp_path, {
        "AGENTS.md": ENTRY,
        "context/index.md": "[a](./domination/a.md)\n",
        "context/domination/a.md": "A\n",
        "context/dox/b.md": "B\n",
    })
    result = audit(tmp_path)
    assert rels(tmp_path, [f["file"] for f in result["files"]]) == {
        "context/index.md", "context/domination/a.md", "context/dox/b.md",
    }
    assert rels(tmp_path, result["orphans"]) == {"context/dox/b.md"}


def test_transitive_links_reach_siblings(tmp_path: Path) -> None:
    write_tree(tmp_path, {
        "AGENTS.md": ENTRY,
        "context/index.md": "[a](a.md)\n",
        "context/a.md": "[b](../context/sub/b.md#section)\n",
        "context/sub/b.md": "B\n",
    })
    assert audit(tmp_path)["orphans"] == []


def test_persona_links_make_context_reachable(tmp_path: Path) -> None:
    write_tree(tmp_path, {
        "AGENTS.md": "# Agents\n",
        ".agents/arch.md": "---\nname: arch\n---\nSee [c](../context/c.md)\n",
        "context/c.md": "C\n",
        "context/d.md": "D\n",
    })
    assert rels(tmp_path, audit(tmp_path)["orphans"]) == {"context/d.md"}


def test_archive_excluded_everywhere(tmp_path: Path) -> None:
    write_tree(tmp_path, {
        "AGENTS.md": ENTRY,
        "context/index.md": "idx\n",
        "context/archive/old.md": "x" * (optimize.CONTEXT_FILE_BUDGET + 1) + n_lines(300),
        "context/archive/old2.md": "x" * (optimize.CONTEXT_FILE_BUDGET + 1) + n_lines(300),
    })
    result = audit(tmp_path)
    assert rels(tmp_path, [f["file"] for f in result["files"]]) == {"context/index.md"}
    assert result["orphans"] == []
    assert result["near_duplicates"] == []


def test_context_line_budget(tmp_path: Path) -> None:
    write_tree(tmp_path, {
        "AGENTS.md": ENTRY,
        "context/index.md": "[a](a.md) [b](b.md)\n",
        "context/a.md": n_lines(200),
        "context/b.md": n_lines(201),
    })
    files = {Path(f["file"]).name: f for f in audit(tmp_path)["files"]}
    assert files["a.md"]["lines"] == 200 and files["a.md"]["over_line_budget"] is False
    assert files["b.md"]["lines"] == 201 and files["b.md"]["over_line_budget"] is True
    assert any("201 lines" in w for w in files["b.md"]["warnings"])


def test_entry_line_budget(tmp_path: Path) -> None:
    write_tree(tmp_path, {"AGENTS.md": "# A\n" + "\n" * 149, "CLAUDE.md": "# C\n" + "\n" * 150})
    ok, big = (optimize.audit_entry_file(tmp_path / n, tmp_path) for n in ("AGENTS.md", "CLAUDE.md"))
    assert ok["lines"] == 150 and ok["over_line_budget"] is False
    assert big["lines"] == 151 and big["over_line_budget"] is True
    assert any("151 lines" in w for w in big["warnings"])


def test_broken_links_reported_across_files(tmp_path: Path) -> None:
    write_tree(tmp_path, {
        "AGENTS.md": ENTRY,
        "context/index.md": "[gone](./gone.md) [ok](#top) [web](https://x.io/a.md) [s](a.md#x)\n",
        "context/a.md": "```\n[in fence](./fenced.md)\n```\nand `[code](./inline.md)`\n",
        ".agents/p.md": "---\nname: p\n---\n[bad](../context/missing.md)\n",
    })
    broken = {(Path(b["file"]).relative_to(tmp_path).as_posix(), b["link"]) for b in audit(tmp_path)["broken_links"]}
    assert broken == {("context/index.md", "./gone.md"), (".agents/p.md", "../context/missing.md")}


def test_links_ignore_non_md_and_anchors() -> None:
    import checks_links

    text = "[a](x.md#h) [b](y.png) [c](https://e.com/z.md) [d](mailto:a@b.md) [e](#only)"
    assert checks_links.extract_links(text) == ["x.md"]
