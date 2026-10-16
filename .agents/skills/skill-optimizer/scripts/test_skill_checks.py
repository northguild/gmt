# /// script
# requires-python = ">=3.9"
# dependencies = ["pytest"]
# ///
"""Tests for skill-optimizer: section, size, reference and script checks.

Run with:
    python3 -m pytest -q .agents/skills
"""

from __future__ import annotations

import importlib.util
import json
import os
import stat
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

VALID_FRONTMATTER = "name: my-skill\ndescription: 'Use when you need to validate something.'"


def make_skill(tmp_path: Path, name: str, content: str) -> Path:
    skill_dir = tmp_path / name
    skill_dir.mkdir()
    (skill_dir / "SKILL.md").write_text(content)
    return skill_dir


# ---------------------------------------------------------------------------
# load_skill — section candidates
# ---------------------------------------------------------------------------


def test_load_skill_section_candidate(tmp_path: Path) -> None:
    long_body = "a" * (optimize.SECTION_EXTRACT_CHARS + 1)
    content = (
        f"---\nname: sections\ndescription: 'use when yes'\n---\n\n## Big Section\n{long_body}\n"
    )
    skill = make_skill(tmp_path, "sections", content)
    result, _ = optimize.load_skill(skill)
    assert len(result["section_candidates"]) == 1
    cand = result["section_candidates"][0]
    assert cand["section"] == "Big Section"
    assert cand["chars"] >= len(long_body)
    assert cand["suggest"] == "references/big-section.md"


def test_load_skill_short_section_no_candidate(tmp_path: Path) -> None:
    body = "short"
    content = (
        "---\nname: short\ndescription: 'use when yes'\n---\n\n## Small\n{}\n".format(body)
    )
    skill = make_skill(tmp_path, "short", content)
    result, _ = optimize.load_skill(skill)
    assert result["section_candidates"] == []


# ---------------------------------------------------------------------------
# load_skill — size budget
# ---------------------------------------------------------------------------


def test_load_skill_over_budget(tmp_path: Path) -> None:
    big = "x" * (optimize.SIZE_BUDGET + 1)
    content = f"---\nname: big\ndescription: 'use when yes'\n---\n\n{big}"
    skill = make_skill(tmp_path, "big", content)
    result, _ = optimize.load_skill(skill)
    assert result["over_budget"] is True
    assert any("budget" in w for w in result["warnings"])


# ---------------------------------------------------------------------------
# load_skill — backslash paths
# ---------------------------------------------------------------------------


def test_load_skill_backslash_path(tmp_path: Path) -> None:
    content = (
        "---\nname: bs\ndescription: 'use when yes'\n---\n\nsee references\\foo.md\n"
    )
    skill = make_skill(tmp_path, "bs", content)
    result, _ = optimize.load_skill(skill)
    assert any("Backslash path separator" in w for w in result["warnings"])


# ---------------------------------------------------------------------------
# load_skill — local references
# ---------------------------------------------------------------------------


def test_load_skill_local_ref_not_found(tmp_path: Path) -> None:
    content = (
        "---\nname: refs\ndescription: 'use when yes'\n---\n\nSee [references/missing.md](references/missing.md).\n"
    )
    skill = make_skill(tmp_path, "refs", content)
    result, _ = optimize.load_skill(skill)
    assert any("Referenced file not found: references/missing.md" in w for w in result["warnings"])


def test_load_skill_local_ref_exists(tmp_path: Path) -> None:
    skill_dir = tmp_path / "refs-ok"
    skill_dir.mkdir()
    (skill_dir / "SKILL.md").write_text(
        "---\nname: refs-ok\ndescription: 'use when yes'\n---\n\n"
        "See [references/extra.md](references/extra.md).\n"
    )
    ref_dir = skill_dir / "references"
    ref_dir.mkdir()
    (ref_dir / "extra.md").write_text("details")
    result, _ = optimize.load_skill(skill_dir)
    assert not any("Referenced file not found" in w for w in result["warnings"])


# ---------------------------------------------------------------------------
# load_skill — script exec bit
# ---------------------------------------------------------------------------


def test_load_skill_script_not_executable(tmp_path: Path) -> None:
    skill_dir = tmp_path / "script-test"
    skill_dir.mkdir()
    (skill_dir / "SKILL.md").write_text(
        "---\nname: script-test\ndescription: 'use when yes'\n---\n\n## S\nbody\n"
    )
    scripts_dir = skill_dir / "scripts"
    scripts_dir.mkdir()
    py = scripts_dir / "run.py"
    py.write_text("# placeholder")
    os.chmod(py, stat.S_IRUSR | stat.S_IWUSR)  # rw-r--r--, no exec
    result, _ = optimize.load_skill(skill_dir)
    assert any("Script not executable" in w for w in result["warnings"])


def test_load_skill_script_executable(tmp_path: Path) -> None:
    skill_dir = tmp_path / "script-ok"
    skill_dir.mkdir()
    (skill_dir / "SKILL.md").write_text(
        "---\nname: script-ok\ndescription: 'use when yes'\n---\n\n## S\nbody\n"
    )
    scripts_dir = skill_dir / "scripts"
    scripts_dir.mkdir()
    py = scripts_dir / "run.py"
    py.write_text("# placeholder")
    os.chmod(py, stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR)
    result, _ = optimize.load_skill(skill_dir)
    assert not any("Script not executable" in w for w in result["warnings"])


