# /// script
# requires-python = ">=3.12"
# dependencies = ["pyyaml", "pytest"]
# ///
"""Tests for optimize.py — covers error paths that previously crashed.

Run with:
    uv run test_optimize.py
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


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

VALID_FRONTMATTER = "name: my-skill\ndescription: 'Use when you need to validate something.'"


def make_skill(tmp_path: Path, name: str, content: str) -> Path:
    skill_dir = tmp_path / name
    skill_dir.mkdir()
    (skill_dir / "SKILL.md").write_text(content)
    return skill_dir


# ---------------------------------------------------------------------------
# load_skill — happy path
# ---------------------------------------------------------------------------


def test_load_skill_valid(tmp_path: Path) -> None:
    skill = make_skill(
        tmp_path,
        "my-skill",
        f"---\n{VALID_FRONTMATTER}\n---\n\n## Overview\nShort body here.\n",
    )
    result, err = optimize.load_skill(skill)
    assert err is None
    assert result["name"] == "my-skill"
    assert result["description"] == "Use when you need to validate something."
    assert result["chars"] > 0
    assert result["over_budget"] is False
    assert result["section_candidates"] == []
    assert result["warnings"] == []


# ---------------------------------------------------------------------------
# load_skill — missing / unreadable SKILL.md
# ---------------------------------------------------------------------------


def test_load_skill_no_file(tmp_path: Path) -> None:
    result, err = optimize.load_skill(tmp_path / "nonexistent")
    assert err is None
    assert result["error"] == "SKILL.md not found"


# ---------------------------------------------------------------------------
# load_skill — frontmatter parsing edge cases (regression: NameError/AttributeError)
# ---------------------------------------------------------------------------


def test_load_skill_no_frontmatter(tmp_path: Path) -> None:
    """Previously crashed with NameError: fm was never assigned."""
    content = "Some content without frontmatter.\n\n## Section\nbody\n"
    skill = make_skill(tmp_path, "no-fm", content)
    result, err = optimize.load_skill(skill)
    assert err is None
    assert result["name"] is None
    assert any("No/invalid YAML frontmatter" in w for w in result["warnings"])


def test_load_skill_missing_close_delimiter(tmp_path: Path) -> None:
    content = "---\nname: x\ndescription: 'use when yes'\nno closing"
    skill = make_skill(tmp_path, "open-only", content)
    result, _ = optimize.load_skill(skill)
    assert any("No/invalid YAML frontmatter" in w for w in result["warnings"])


def test_load_skill_invalid_yaml(tmp_path: Path) -> None:
    """Previously crashed with NameError: yaml.YAMLError left fm unbound."""
    content = (
        "---\nname: [unclosed\n  - list\n"
        "description: 'use when yes'\n---\n\n## S\nbody\n"
    )
    skill = make_skill(tmp_path, "bad-yaml", content)
    result, err = optimize.load_skill(skill)
    assert err is None
    assert any("Invalid YAML in frontmatter" in w for w in result["warnings"])
    # fm falls back to {} so downstream access doesn't crash
    assert result["name"] is None


def test_load_skill_frontmatter_is_list(tmp_path: Path) -> None:
    """Previously crashed with AttributeError: fm was a list, not a dict."""
    content = "---\n- item1\n- item2\n---\n\ndescription: not reached\n"
    skill = make_skill(tmp_path, "fm-list", content)
    result, err = optimize.load_skill(skill)
    assert err is None
    assert any("Frontmatter must be a YAML mapping" in w for w in result["warnings"])
    assert result["name"] is None
    assert result["description"] == ""


def test_load_skill_frontmatter_is_scalar(tmp_path: Path) -> None:
    content = "---\njust a string\n---\n\n## S\nbody\n"
    skill = make_skill(tmp_path, "fm-scalar", content)
    result, _ = optimize.load_skill(skill)
    assert any("Frontmatter must be a YAML mapping" in w for w in result["warnings"])


# ---------------------------------------------------------------------------
# load_skill — validation warnings
# ---------------------------------------------------------------------------


def test_load_skill_name_mismatch(tmp_path: Path) -> None:
    content = (
        "---\nname: wrong-name\ndescription: 'use when yes'\n---\n\n## S\nbody\n"
    )
    skill = make_skill(tmp_path, "actual-name", content)
    result, _ = optimize.load_skill(skill)
    assert result["name"] == "wrong-name"
    assert any("does not match directory name" in w for w in result["warnings"])


def test_load_skill_missing_name(tmp_path: Path) -> None:
    content = (
        "---\ndescription: 'use when yes'\n---\n\n## S\nbody\n"
    )
    skill = make_skill(tmp_path, "no-name", content)
    result, _ = optimize.load_skill(skill)
    assert any("Missing/empty required field: name" in w for w in result["warnings"])


def test_load_skill_missing_description(tmp_path: Path) -> None:
    content = (
        "---\nname: no-desc\ndescription: ''\n---\n\n## S\nbody\n"
    )
    skill = make_skill(tmp_path, "no-desc", content)
    result, _ = optimize.load_skill(skill)
    assert any("Missing/empty required field: description" in w for w in result["warnings"])


def test_load_skill_no_trigger_phrase(tmp_path: Path) -> None:
    content = (
        "---\nname: trigger-test\ndescription: 'A generic description without cues'\n---\n\n## S\nbody\n"
    )
    skill = make_skill(tmp_path, "trigger-test", content)
    result, _ = optimize.load_skill(skill)
    assert any("no concrete trigger phrase" in w for w in result["warnings"])


def test_load_skill_trigger_phrase_present(tmp_path: Path) -> None:
    content = (
        "---\nname: trigger-ok\ndescription: 'Validate skills before deploying'\n---\n\n## S\nbody\n"
    )
    skill = make_skill(tmp_path, "trigger-ok", content)
    result, _ = optimize.load_skill(skill)
    assert not any("no concrete trigger phrase" in w for w in result["warnings"])


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


# ---------------------------------------------------------------------------
# find_skills
# ---------------------------------------------------------------------------


def test_find_skills(tmp_path: Path) -> None:
    make_skill(tmp_path, "skill-a", f"---\n{VALID_FRONTMATTER}\n---\n")
    make_skill(tmp_path, "skill-b", f"---\n{VALID_FRONTMATTER}\n---\n")
    non_skill = tmp_path / "not-a-skill"
    non_skill.mkdir()
    found = optimize.find_skills(tmp_path)
    names = sorted(p.name for p in found)
    assert names == ["skill-a", "skill-b"]


def test_find_skills_empty(tmp_path: Path) -> None:
    assert optimize.find_skills(tmp_path) == []


# ---------------------------------------------------------------------------
# inventory_findings
# ---------------------------------------------------------------------------


def _skill_dict(name: str, desc: str, dir_: str = "/tmp/x") -> dict:
    return {"dir": dir_, "name": name, "description": desc}


def test_inventory_no_duplicates(tmp_path: Path) -> None:
    skills = [_skill_dict("a", "use when you need to validate"), _skill_dict("b", "lint code for temporal patterns")]
    inv = optimize.inventory_findings(skills)
    assert inv["duplicate_names"] == []
    assert inv["similar_descriptions"] == []


def test_inventory_duplicate_names(tmp_path: Path) -> None:
    skills = [
        _skill_dict("same", "use when x", "/tmp/a"),
        _skill_dict("same", "use when y", "/tmp/b"),
    ]
    inv = optimize.inventory_findings(skills)
    assert len(inv["duplicate_names"]) == 1
    assert inv["duplicate_names"][0]["name"] == "same"
    assert sorted(inv["duplicate_names"][0]["dirs"]) == [str(Path("/tmp/a")), str(Path("/tmp/b"))]


def test_inventory_similar_descriptions(tmp_path: Path) -> None:
    desc_a = "validate skills before deploying"
    desc_b = "validate skills before deploying"
    skills = [_skill_dict("a", desc_a), _skill_dict("b", desc_b)]
    inv = optimize.inventory_findings(skills)
    assert len(inv["similar_descriptions"]) == 1
    assert inv["similar_descriptions"][0]["ratio"] >= optimize.DESCRIPTION_SIMILARITY


def test_inventory_distinct_descriptions(tmp_path: Path) -> None:
    skills = [
        _skill_dict("a", "use when you need to validate"),
        _skill_dict("b", "lint code for temporal patterns"),
    ]
    inv = optimize.inventory_findings(skills)
    assert inv["similar_descriptions"] == []


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------


def test_main_single_dir(tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch) -> None:
    content = "---\nname: main-test\ndescription: 'use when yes'\n---\n\n## S\nbody\n"
    skill = make_skill(tmp_path, "main-test", content)
    monkeypatch.setattr(sys, "argv", ["optimize.py", str(skill)])
    with pytest.raises(SystemExit) as exc_info:
        optimize.main()
    assert exc_info.value.code == 0
    out = json.loads(capsys.readouterr().out)
    assert out["name"] == "main-test"
    assert out["dir"] == str(skill)


def test_main_all_mode(tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch) -> None:
    make_skill(tmp_path, "skill-one", "---\nname: skill-one\ndescription: 'use when yes'\n---\n\n## Body\nx\n")
    make_skill(tmp_path, "skill-two", "---\nname: skill-two\ndescription: 'lint code for patterns'\n---\n\n## Body\ny\n")
    monkeypatch.setattr(sys, "argv", ["optimize.py", "--all", str(tmp_path)])
    with pytest.raises(SystemExit) as exc_info:
        optimize.main()
    assert exc_info.value.code == 0
    out = json.loads(capsys.readouterr().out)
    assert "skills" in out
    assert "inventory" in out
    assert len(out["skills"]) == 2
    names = sorted(s["name"] for s in out["skills"])
    assert names == ["skill-one", "skill-two"]


def test_main_not_a_directory(capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sys, "argv", ["optimize.py", "/nonexistent/path/that/does/not/exist"])
    with pytest.raises(SystemExit) as exc_info:
        optimize.main()
    assert exc_info.value.code == 1
    out = json.loads(capsys.readouterr().out)
    assert "error" in out
