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


# --- usage_activity: classify, attribution, window -------------------------------------------

import usage_activity  # noqa: E402
import usage  # noqa: E402


def bash(cmd: object) -> tuple[str, dict]:
    return "Bash", {"command": cmd}


@pytest.mark.parametrize(("name", "inp", "bucket"), [
    ("mcp__claude-in-chrome__navigate", {}, "browser"),
    ("mcp__playwright_click", {}, "browser"),
    ("mcp__Claude_Browser__click", {}, "browser"),
    ("mcp__remote-devices__Claude_Browser__click", {}, "browser"),
    *[("Bash", {"command": f"node scripts/{w} --x"}, "browser") for w in (
        "grow-measure", "readout-still", "contrast-measure", "visual-snapshot", "html-diff",
        "globe-smoke", "data-credits-check", "canada-still", "a11y-run", "deploy-smoke")],
    *[("Bash", {"command": f"pnpm {w}"}, "browser") for w in (
        "grow:measure", "readout:still", "contrast:measure", "visual:diff", "globe:smoke", "canada:still")],
    *[("Bash", {"command": f"run {w}"}, "browser") for w in ("playwright", "chromium", "webkit", "firefox")],
    ("Bash", {"command": "pnpm --filter dox gates"}, "browser"),
    *[("Bash", {"command": f"x {w}"}, "tests") for w in (
        "vitest", "pytest -q", "tsc -b", "oxlint .", "astro check", "validate", "typecheck", "verdict")],
    *[("Bash", {"command": c}, "tests") for c in (
        "pnpm test", "pnpm run check", "pnpm --filter x lint", "pnpm -r run test")],
    ("Bash", {"command": "gh pr view 3"}, "gh"),
    ("Bash", {"command": "node scripts/pr-status.mjs"}, "gh"),
    ("Bash", {"command": "pnpm pr-status"}, "gh"),
    ("mcp__github__get_issue", {}, "gh"),
    ("Read", {}, "reading"), ("Grep", {}, "reading"), ("Glob", {}, "reading"),
    *[("Bash", {"command": f"{c} f"}, "reading") for c in (
        "cat", "sed", "head", "tail", "grep", "rg", "ls", "find", "wc", "awk", "jq",
        "git log", "git show", "git diff")],
    ("Edit", {}, "editing"), ("Write", {}, "editing"), ("NotebookEdit", {}, "editing"),
    ("Agent", {}, "agents"), ("Task", {}, "agents"), ("SendMessage", {}, "agents"),
    ("SubagentHandback", {}, "agents"),
    ("WebFetch", {}, "other"),
    ("Bash", {"command": "mkdir x"}, "other"),
    ("Bash", {}, "other"),
    ("Bash", {"command": 5}, "other"),
])
def test_classify_buckets(name: str, inp: dict, bucket: str) -> None:
    assert usage_activity.classify(name, inp)[0] == bucket


def test_classify_precedence_and_first_command() -> None:
    assert usage_activity.classify(*bash("pnpm --filter dox gates"))[0] == "browser"
    assert usage_activity.classify(*bash("pnpm test && gh pr view"))[0] == "tests"
    assert usage_activity.classify(*bash("ls | grep playwright"))[0] == "reading"
    assert usage_activity.classify(*bash("grep -n firefox f && node run.mjs --firefox"))[0] == "browser"
    assert usage_activity.classify(*bash("sed -n 1p validate.ts"))[0] == "reading"
    assert usage_activity.classify(*bash("gh pr view | head"))[0] == "gh"
    assert usage_activity.classify(*bash("git status"))[0] == "other"


def test_classify_strips_prefixes() -> None:
    fnm = 'eval "$(fnm env)" && fnm use && cd /a/b && FOO=1 BAR=x gh pr list'
    assert usage_activity.classify(*bash(fnm))[0] == "gh"
    assert usage_activity.classify(*bash("cd /a && cat x"))[0] == "reading"
    assert usage_activity.classify(*bash("cd /a && echo gh"))[0] == "other"
    assert usage_activity.classify(*bash("cd /a/b; gh run view 1"))[0] == "gh"
    assert usage_activity.classify(*bash("cd /a/b\ngit show HEAD | sed -n 1p"))[0] == "reading"
    assert usage_activity.classify(*bash("W=/a/b; S=/c\ncd $W; rg x"))[0] == "reading"


def test_classify_ignores_heredoc_body() -> None:
    note = "cat > n.md <<'EOF'\nrun vitest and playwright\nEOF"
    assert usage_activity.classify(*bash(note))[0] == "reading"
    assert usage_activity.classify(*bash(note + "\npnpm test"))[0] == "tests"


def test_classify_a11y() -> None:
    assert usage_activity.classify(*bash("node scripts/a11y-run.mjs --axe")) == ("browser", True)
    assert usage_activity.classify("mcp__Claude_Browser__press_key", {"key": "Tab"}) == ("browser", True)
    assert usage_activity.classify("mcp__Claude_Browser__click", {"ref": "b"}) == ("browser", False)
    assert usage_activity.classify(*bash("cat a11y.md")) == ("reading", False)


def tool(tid: str, name: str, **inp: object) -> dict:
    return {"type": "tool_use", "id": tid, "name": name, "input": inp}


def act_rows(root: Path, **kw: object) -> dict:
    return usage_tally.tally(root, 7, "*gmt*", by_activity=True, **kw)


def test_activity_split_even_and_reply(tmp_path: Path) -> None:
    f = tmp_path / "-p-gmt" / "s.jsonl"
    f.parent.mkdir()
    f.write_text(
        asst("a", "opus", 0, 100, 0, [tool("1", "Read"), tool("2", "Bash", command="vitest")])
        + asst("b", "opus", 0, 40, 0, [])
    )
    out = act_rows(tmp_path)
    rows = {(r["agent"], r["activity"]): r for r in out["activity_rows"]}
    assert rows[("MAIN", "reading")]["context"] == 50 and rows[("MAIN", "reading")]["calls"] == 1
    assert rows[("MAIN", "tests")]["context"] == 50
    assert rows[("MAIN", "reply")]["context"] == 40 and rows[("MAIN", "reply")]["calls"] == 0


def test_activity_message_split_across_lines_counted_once(tmp_path: Path) -> None:
    f = tmp_path / "-p-gmt" / "s.jsonl"
    f.parent.mkdir()
    f.write_text(
        asst("a", "opus", 0, 90, 0, [tool("1", "Read")])
        + asst("a", "opus", 0, 90, 0, [tool("2", "Edit")])
        + asst("a", "opus", 0, 90, 0, [tool("2", "Edit")])  # repeated block line: same id
    )
    rows = {r["activity"]: r for r in act_rows(tmp_path)["activity_rows"]}
    assert rows["reading"]["context"] == 45 and rows["editing"]["context"] == 45
    assert rows["editing"]["calls"] == 1


def test_activity_rows_sum_to_agent_context(projects: Path) -> None:
    out = usage_tally.tally(projects, 7, "*gmt*", by_activity=True)
    for r in out["rows"]:
        got = sum(a["context"] for a in out["activity_rows"] if a["agent"] == r["agent"])
        assert got == pytest.approx(r["context"], abs=1)
    assert {a["agent"] for a in out["activity_rows"]} == {"MAIN", "tester"}


def test_activity_browser_line_and_a11y(tmp_path: Path) -> None:
    f = tmp_path / "-p-gmt" / "s.jsonl"
    f.parent.mkdir()
    f.write_text(
        asst("a", "opus", 0, 100, 0, [tool("1", "mcp__Claude_Browser__press_key", key="Tab")])
        + asst("b", "opus", 0, 60, 0, [tool("2", "mcp__Claude_Browser__click", ref="x")])
    )
    b = act_rows(tmp_path)["browser"]
    assert b["context"] == 160 and b["a11y"] == 100
    assert b["by_agent"]["MAIN"] == {"context": 160, "a11y": 100}
    assert b["share"] == 100.0


def test_activity_no_data_has_no_division_error(tmp_path: Path) -> None:
    out = usage_tally.tally(tmp_path, 0, "*", by_activity=True)
    assert out["activity_rows"] == [] and out["browser"]["share"] == 0
    assert out["coverage"]["days_with_data"] == 0
    assert "Coverage: transcripts on 0 of 0 days" in usage.render_activity(out)


def test_activity_unknown_subagent_keeps_name(tmp_path: Path) -> None:
    f = tmp_path / "-p-gmt" / "s" / "subagents" / "agent-z.jsonl"
    f.parent.mkdir(parents=True)
    f.write_text(asst("a", "opus", 0, 10, 0, [tool("1", "Read")]))
    assert act_rows(tmp_path)["activity_rows"][0]["agent"] == "sub?"


def test_render_unchanged_without_activity(projects: Path) -> None:
    plain = usage_tally.tally(projects, 7, "*gmt*")
    assert "activity_rows" not in plain and "coverage" not in plain
    withact = usage_tally.tally(projects, 7, "*gmt*", by_activity=True)
    assert usage.render(plain) == usage.render(withact)
    assert usage.render(plain).splitlines()[0] == "Usage, last 7 days, total context 0.3M tokens"


# --- window ---------------------------------------------------------------------------------

from datetime import date  # noqa: E402


def stamped(mid: str, ts: str, ctx: int = 10) -> str:
    usage_ = {"input_tokens": ctx, "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0}
    msg = {"id": mid, "model": "opus", "usage": usage_, "content": [tool(mid, "Read")]}
    return line({"type": "assistant", "timestamp": ts, "message": msg})


@pytest.fixture
def window_root(tmp_path: Path) -> Path:
    f = tmp_path / "-p-gmt" / "s.jsonl"
    f.parent.mkdir()
    f.write_text(
        stamped("a", "2026-09-24T23:59:59Z")        # before
        + stamped("b", "2026-09-25T00:00:00Z")      # first instant in
        + stamped("c", "2026-09-27T12:00:00Z")      # 09-26 is a gap day
        + stamped("d", "2026-09-28T23:59:59Z")      # last instant in
        + stamped("e", "2026-09-29T00:00:00Z")      # out
    )
    return tmp_path


def test_window_bounds_and_coverage(window_root: Path) -> None:
    out = usage_tally.tally(window_root, 7, "*gmt*", by_activity=True,
                            since=date(2026, 9, 25), until=date(2026, 9, 28))
    assert out["total_context"] == 30
    assert out["coverage"] == {"days_in_window": 4, "days_with_data": 3,
                               "first": "2026-09-25", "last": "2026-09-28"}
    text = usage.render_activity(out)
    assert "Coverage: transcripts on 3 of 4 days, first 2026-09-25, last 2026-09-28" in text


def run_cli(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(SCRIPTS / "usage.py"), *args], capture_output=True, text=True)


def test_cli_window_flags(window_root: Path) -> None:
    base = ["--root", str(window_root), "--project-glob", "*gmt*"]
    assert run_cli(*base, "--days", "3", "--since", "2026-09-25").returncode == 2
    assert run_cli(*base, "--days", "3", "--until", "2026-09-25").returncode == 2
    assert run_cli(*base, "--until", "2026-09-25").returncode == 2
    assert run_cli(*base, "--since", "2026-13-01").returncode == 2
    ok = run_cli(*base, "--since", "2026-09-25", "--until", "2026-09-28", "--by-activity", "--json")
    assert ok.returncode == 0 and json.loads(ok.stdout)["coverage"]["days_with_data"] == 3
    text = run_cli(*base, "--since", "2026-09-25", "--until", "2026-09-28", "--by-activity").stdout
    assert "Usage by activity" in text and "Browser checking:" in text
