# /// script
# requires-python = ">=3.9"
# dependencies = ["pytest"]
# ///
"""Tests for agent-optimizer: usage.py --days window applied per transcript line.

Run with:
    python3 -m pytest -q .agents/skills
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import usage_tally  # noqa: E402


def stamp(days_ago: float) -> str:
    when = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return when.strftime("%Y-%m-%dT%H:%M:%S.123Z")


def req(mid: str, ts: str | None, context: int) -> str:
    msg = {"id": mid, "model": "opus", "usage": {"input_tokens": context}, "content": []}
    obj: dict = {"type": "assistant", "message": msg}
    if ts is not None:
        obj["timestamp"] = ts
    return json.dumps(obj) + "\n"


def tally(tmp_path: Path, text: str) -> dict:
    (tmp_path / "-proj").mkdir()
    (tmp_path / "-proj" / "s.jsonl").write_text(text)  # mtime is now: passes the prefilter
    return usage_tally.tally(tmp_path, days=7)


def test_old_line_in_a_fresh_file_is_not_counted(tmp_path: Path) -> None:
    out = tally(tmp_path, req("old", stamp(30), 1000) + req("new", stamp(1), 10))
    assert out["total_context"] == 10
    assert out["rows"][0]["requests"] == 1


def test_line_without_timestamp_is_kept(tmp_path: Path) -> None:
    out = tally(tmp_path, req("a", None, 5) + req("old", stamp(30), 1000))
    assert out["total_context"] == 5


def test_bad_timestamp_is_kept(tmp_path: Path) -> None:
    assert tally(tmp_path, req("a", "not a date", 7))["total_context"] == 7
