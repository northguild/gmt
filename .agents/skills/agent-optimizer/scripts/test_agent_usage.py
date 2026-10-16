# /// script
# requires-python = ">=3.9"
# dependencies = ["pytest"]
# ///
"""Tests for agent-optimizer: usage.py transcript tally.

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


import usage_tally  # noqa: E402


def line(obj: dict) -> str:
    return json.dumps(obj) + "\n"


def asst(mid: str, model: str, inp: int, cr: int, cw: int, content: list | None = None) -> str:
    usage = {"input_tokens": inp, "cache_read_input_tokens": cr, "cache_creation_input_tokens": cw, "output_tokens": 5}
    msg = {"id": mid, "model": model, "usage": usage, "content": content or []}
    return line({"type": "assistant", "message": msg})


def read_use(tid: str, path: str) -> list:
    return [{"type": "tool_use", "id": tid, "name": "Read", "input": {"file_path": path}}]


def result(tid: str, text: object) -> str:
    block = {"type": "tool_result", "tool_use_id": tid, "content": text}
    return line({"type": "user", "message": {"role": "user", "content": [block]}})


@pytest.fixture
def projects(tmp_path: Path) -> Path:
    proj = tmp_path / "-proj-gmt"
    sess = proj / "sess1"
    (sess / "subagents").mkdir(parents=True)
    main = proj / "sess1.jsonl"
    main.write_text(
        asst("m1", "opus", 10, 100_000, 5_000, read_use("t1", "/r/a.md"))
        + asst("m1", "opus", 10, 100_000, 5_000)  # duplicate id: counted once
        + result("t1", "x" * 400)
        + asst("m2", "opus", 0, 200_000, 0, read_use("t2", "/r/a.md"))
        + result("t2", [{"type": "text", "text": "y" * 100}])
        + "not json\n"
    )
    sub = sess / "subagents" / "agent-abc.jsonl"
    sub.write_text(asst("s1", "sonnet", 1, 49, 0) + asst("s2", "sonnet", 1, 99, 0))
    (sess / "subagents" / "agent-abc.meta.json").write_text('{"agentType": "tester", "spawnDepth": 2}')
    other = tmp_path / "-other" / "x.jsonl"
    other.parent.mkdir()
    other.write_text(asst("o1", "haiku", 1, 1, 1))
    return tmp_path


def run(root: Path, **kw: object) -> dict:
    return usage_tally.tally(root, days=7, project_glob=kw.pop("project_glob", "*gmt*"), **kw)


def test_per_agent_model_rows(projects: Path) -> None:
    rows = {(r["agent"], r["model"]): r for r in run(projects)["rows"]}
    main = rows[("MAIN", "opus")]
    assert main["requests"] == 2
    assert main["context"] == 105_010 + 200_000
    assert main["peak"] == 200_000 and main["over_150k"] == 1
    assert main["avg"] == (105_010 + 200_000) // 2
    sub = rows[("tester", "sonnet")]
    assert sub["requests"] == 2 and sub["context"] == 150
    assert round(main["share"] + sub["share"], 1) == 100.0
    assert ("MAIN", "haiku") not in rows  # project glob excludes -other


def test_spawns_and_depth(projects: Path) -> None:
    out = run(projects)
    assert out["spawns"] == {"tester": 1}
    assert out["by_depth"] == {"0": 305_010, "2": 150}


def test_read_files_sum_result_sizes(projects: Path) -> None:
    top = run(projects)["top_reads"]
    assert top[0]["file"] == "/r/a.md" and top[0]["reads"] == 2 and top[0]["chars"] == 500


def test_days_filter_and_top(projects: Path) -> None:
    old = projects / "-proj-gmt" / "sess1.jsonl"
    os.utime(old, (1, 1))
    out = run(projects)
    assert {r["agent"] for r in out["rows"]} == {"tester"}
    assert len(usage_tally.tally(projects, 7, "*", top=1)["rows"]) == 1


def test_default_project_glob_all(projects: Path) -> None:
    assert ("MAIN", "haiku") in {(r["agent"], r["model"]) for r in usage_tally.tally(projects, 7, "*")["rows"]}


def test_cli_json_and_text(projects: Path) -> None:
    script = str(SCRIPTS / "usage.py")
    base = [sys.executable, script, "--root", str(projects), "--project-glob", "*gmt*"]
    out = json.loads(subprocess.run(base + ["--json"], capture_output=True, text=True).stdout)
    assert out["rows"] and "note" in out
    text = subprocess.run(base + ["--top", "5"], capture_output=True, text=True).stdout
    assert "MAIN" in text and "output_tokens" in text and "/r/a.md" in text
