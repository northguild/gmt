# /// script
# requires-python = ">=3.9"
# dependencies = ["pytest"]
# ///
"""Tests for run.py: failing child scripts and size findings caused by the branch.

Run with:
    python3 -m pytest -q .agents/skills
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Optional

import pytest

_spec = importlib.util.spec_from_file_location("optimize_run", Path(__file__).parent / "run.py")
assert _spec is not None and _spec.loader is not None
run = importlib.util.module_from_spec(_spec)
sys.modules["optimize_run"] = run
_spec.loader.exec_module(run)

BIG = "context/domination/tracker.md"
SKILL = ".agents/skills/foo"


def reader(files: dict[str, str]):
    return lambda path: files.get(path)


def kept(found: list, base: dict[str, str], changed: set[str]) -> list:
    return run.relevant(found, changed, reader(base))


def test_report_fails_naming_script_exit_and_stderr(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / "boom.py").write_text("import sys\nprint('out')\nprint('bad thing', file=sys.stderr)\nsys.exit(3)\n")
    monkeypatch.setattr(run, "SKILLS", tmp_path)
    with pytest.raises(SystemExit) as exc:
        run.report("boom.py")
    message = str(exc.value)
    assert "boom.py" in message and "exit 3" in message and "bad thing" in message


def test_report_falls_back_to_stdout_and_parses_json(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / "err.py").write_text("import sys\nprint('{\"error\": \"no entry\"}')\nsys.exit(1)\n")
    (tmp_path / "ok.py").write_text("print('{\"a\": 1}')\n")
    monkeypatch.setattr(run, "SKILLS", tmp_path)
    with pytest.raises(SystemExit) as exc:
        run.report("err.py")
    assert "no entry" in str(exc.value)
    assert run.report("ok.py") == {"a": 1}


def test_size_finding_listed_when_file_is_new() -> None:
    found = [(BIG, "600 lines (budget 200); split into smaller scoped files")]
    assert kept(found, {}, {BIG}) == found


def test_size_finding_listed_when_base_was_within_budget() -> None:
    found = [(BIG, "250 lines (budget 200); split")]
    assert kept(found, {BIG: "x\n" * 200}, {BIG}) == found


def test_size_finding_is_backlog_when_base_was_already_over() -> None:
    found = [(BIG, "250 lines (budget 200); split")]
    assert kept(found, {BIG: "x\n" * 201}, {BIG}) == []


def test_chars_budget_uses_character_count() -> None:
    found = [("AGENTS.md", "AGENTS.md is 9000 chars (budget 4000); move detail")]
    assert kept(found, {"AGENTS.md": "x" * 8000}, {"AGENTS.md"}) == []
    assert kept(found, {"AGENTS.md": "x" * 4000}, {"AGENTS.md"}) == found


def test_skill_dir_size_finding_reads_skill_md_at_base() -> None:
    found = [(SKILL, "SKILL.md is 211 lines (budget 200); move detail to references/")]
    changed = {f"{SKILL}/SKILL.md"}
    assert kept(found, {f"{SKILL}/SKILL.md": "x\n" * 300}, changed) == []
    assert kept(found, {f"{SKILL}/SKILL.md": "x\n" * 10}, changed) == found


def test_skill_reference_size_finding_reads_that_file() -> None:
    found = [(SKILL, "references/big.md is 300 lines (budget 200); split it")]
    changed = {f"{SKILL}/references/big.md"}
    assert kept(found, {f"{SKILL}/references/big.md": "x\n" * 300}, changed) == []
    assert kept(found, {}, changed) == found


def test_size_finding_on_untouched_file_in_changed_skill_is_backlog() -> None:
    found = [(SKILL, "references/big.md is 300 lines (budget 200); split it")]
    assert kept(found, {}, {f"{SKILL}/SKILL.md"}) == []


def test_non_size_findings_on_changed_files_stay_listed() -> None:
    found = [(BIG, "broken link: gone.md"), (BIG, "orphan: no entry file or persona links to it")]
    assert kept(found, {BIG: "x\n" * 900}, {BIG}) == found
