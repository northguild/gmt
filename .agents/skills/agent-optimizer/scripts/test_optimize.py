# /// script
# requires-python = ">=3.14,<3.15"
# dependencies = ["pytest"]
# ///
"""Tests for optimize.py.

Run with:
    uv run test_optimize.py
"""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

_spec = importlib.util.spec_from_file_location(
    "optimize", Path(__file__).parent / "optimize.py"
)
if _spec is None or _spec.loader is None:
    raise ImportError("Could not determine module spec for optimize.py")
optimize = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(optimize)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def make_repo(tmp_path: Path, agents_md: str, context_files: dict[str, str] | None = None) -> Path:
    (tmp_path / "AGENTS.md").write_text(agents_md)
    context_dir = tmp_path / "context"
    if context_files:
        context_dir.mkdir()
        for name, content in context_files.items():
            (context_dir / name).write_text(content)
    return tmp_path


# ---------------------------------------------------------------------------
# find_entry_files
# ---------------------------------------------------------------------------


def test_find_entry_files_agents_only(tmp_path: Path) -> None:
    (tmp_path / "AGENTS.md").write_text("# Agents\n")
    result = optimize.find_entry_files(tmp_path)
    assert result == [tmp_path / "AGENTS.md"]


def test_find_entry_files_both(tmp_path: Path) -> None:
    (tmp_path / "AGENTS.md").write_text("# Agents\n")
    (tmp_path / "CLAUDE.md").write_text("# Claude\n")
    result = optimize.find_entry_files(tmp_path)
    assert result == [tmp_path / "AGENTS.md", tmp_path / "CLAUDE.md"]


def test_find_entry_files_none(tmp_path: Path) -> None:
    assert optimize.find_entry_files(tmp_path) == []


# ---------------------------------------------------------------------------
# audit_entry_file
# ---------------------------------------------------------------------------


def test_audit_entry_file_under_budget(tmp_path: Path) -> None:
    repo = make_repo(tmp_path, "# Agents\n\nShort content.\n")
    result = optimize.audit_entry_file(tmp_path / "AGENTS.md", repo)
    assert result["over_budget"] is False
    assert result["warnings"] == []
    assert result["section_candidates"] == []


def test_audit_entry_file_over_budget(tmp_path: Path) -> None:
    big = "x" * (optimize.ENTRY_SIZE_BUDGET + 1)
    repo = make_repo(tmp_path, f"# Agents\n\n{big}\n")
    result = optimize.audit_entry_file(tmp_path / "AGENTS.md", repo)
    assert result["over_budget"] is True
    assert any("budget" in w for w in result["warnings"])


def test_audit_entry_file_section_candidate(tmp_path: Path) -> None:
    long_body = "detail line\n" * 100
    content = f"# Agents\n\n## Big Section\n{long_body}\n## Small\nshort\n"
    repo = make_repo(tmp_path, content)
    result = optimize.audit_entry_file(tmp_path / "AGENTS.md", repo)
    sections = {c["section"] for c in result["section_candidates"]}
    assert "Big Section" in sections
    assert "Small" not in sections


def test_audit_entry_file_broken_link(tmp_path: Path) -> None:
    content = "# Agents\n\n[missing](./context/nope.md)\n"
    repo = make_repo(tmp_path, content)
    result = optimize.audit_entry_file(tmp_path / "AGENTS.md", repo)
    assert any("Broken links" in w for w in result["warnings"])


def test_audit_entry_file_valid_link_no_warning(tmp_path: Path) -> None:
    content = "# Agents\n\n[overview](./context/overview.md)\n"
    repo = make_repo(tmp_path, content, {"overview.md": "content"})
    result = optimize.audit_entry_file(tmp_path / "AGENTS.md", repo)
    assert not any("Broken links" in w for w in result["warnings"])


# ---------------------------------------------------------------------------
# audit_context_dir
# ---------------------------------------------------------------------------


def test_audit_context_dir_missing(tmp_path: Path) -> None:
    repo = make_repo(tmp_path, "# Agents\n")
    result = optimize.audit_context_dir(repo, optimize.find_entry_files(repo))
    assert result["exists"] is False
    assert result["files"] == []


def test_audit_context_dir_orphan_file(tmp_path: Path) -> None:
    content = "# Agents\n\n[overview](./context/overview.md)\n"
    repo = make_repo(
        tmp_path, content, {"overview.md": "linked", "roadmap.md": "not linked anywhere"}
    )
    result = optimize.audit_context_dir(repo, optimize.find_entry_files(repo))
    orphan_names = [Path(o).name for o in result["orphans"]]
    assert "roadmap.md" in orphan_names
    assert "overview.md" not in orphan_names


def test_audit_context_dir_linked_from(tmp_path: Path) -> None:
    content = "# Agents\n\n[overview](./context/overview.md)\n"
    repo = make_repo(tmp_path, content, {"overview.md": "linked"})
    result = optimize.audit_context_dir(repo, optimize.find_entry_files(repo))
    file_entry = next(f for f in result["files"] if Path(f["file"]).name == "overview.md")
    assert "AGENTS.md" in file_entry["linked_from"]


def test_audit_context_dir_over_budget(tmp_path: Path) -> None:
    big = "x" * (optimize.CONTEXT_FILE_BUDGET + 1)
    content = "# Agents\n\n[big](./context/big.md)\n"
    repo = make_repo(tmp_path, content, {"big.md": big})
    result = optimize.audit_context_dir(repo, optimize.find_entry_files(repo))
    file_entry = next(f for f in result["files"] if Path(f["file"]).name == "big.md")
    assert file_entry["over_budget"] is True
    assert any("budget" in w for w in file_entry["warnings"])


def test_audit_context_dir_near_duplicates(tmp_path: Path) -> None:
    content = "# Agents\n\n[a](./context/a.md)\n[b](./context/b.md)\n"
    same_text = "This is a standards document.\n" * 20
    repo = make_repo(tmp_path, content, {"a.md": same_text, "b.md": same_text})
    result = optimize.audit_context_dir(repo, optimize.find_entry_files(repo))
    assert len(result["near_duplicates"]) == 1
    pair = result["near_duplicates"][0]
    assert pair["ratio"] >= optimize.CONTEXT_SIMILARITY


def test_audit_context_dir_distinct_no_duplicates(tmp_path: Path) -> None:
    content = "# Agents\n\n[a](./context/a.md)\n[b](./context/b.md)\n"
    repo = make_repo(
        tmp_path,
        content,
        {"a.md": "Coding standards for this project.", "b.md": "Publishing steps for releases."},
    )
    result = optimize.audit_context_dir(repo, optimize.find_entry_files(repo))
    assert result["near_duplicates"] == []


# ---------------------------------------------------------------------------
# main (subprocess, end-to-end)
# ---------------------------------------------------------------------------


def test_main_not_a_directory(tmp_path: Path) -> None:
    result = subprocess.run(
        [sys.executable, str(Path(__file__).parent / "optimize.py"), str(tmp_path / "nope")],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 1
    assert "Not a directory" in result.stdout


def test_main_no_entry_file(tmp_path: Path) -> None:
    result = subprocess.run(
        [sys.executable, str(Path(__file__).parent / "optimize.py"), str(tmp_path)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 1
    assert "No entry file found" in result.stdout


def test_main_success(tmp_path: Path) -> None:
    content = "# Agents\n\n[overview](./context/overview.md)\n"
    make_repo(tmp_path, content, {"overview.md": "content"})
    result = subprocess.run(
        [sys.executable, str(Path(__file__).parent / "optimize.py"), str(tmp_path)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0
    out = json.loads(result.stdout)
    assert len(out["entry_files"]) == 1
    assert out["context"]["exists"] is True


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
