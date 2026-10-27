#!/usr/bin/env python3
"""Tally Claude Code transcript usage per agent and model (stdlib only, read-only).

Usage:
    python3 usage.py [--days 7] [--project-glob '*gmt*'] [--root ~/.claude/projects]
                     [--top 15] [--json] [--by-activity] [--since YYYY-MM-DD [--until YYYY-MM-DD]]

`--since`/`--until` set an exact UTC window (both days inclusive) and replace `--days`.
`--by-activity` appends context per agent and activity (reading, tests, gh, browser, ...).

Subagent transcripts (`.../subagents/agent-<id>.jsonl`) take agentType and spawnDepth from the
sibling `.meta.json`; every other transcript is the MAIN session at depth 0.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from usage_tally import tally  # noqa: E402


def render(out: dict) -> str:
    span = f"window {out['window']}" if "window" in out else f"last {out['days']} days"
    lines = [f"Usage, {span}, total context {out['total_context'] / 1e6:.1f}M tokens", out["note"], ""]
    lines.append(f"{'agent':16} {'model':24} {'req':>6} {'ctxM':>8} {'%':>5} {'avgK':>6} {'peakK':>6} {'>150K':>6}")
    for r in out["rows"]:
        lines.append(
            f"{r['agent']:16} {r['model'][:24]:24} {r['requests']:6} {r['context'] / 1e6:8.1f} "
            f"{r['share']:5.1f} {r['avg'] / 1e3:6.0f} {r['peak'] / 1e3:6.0f} {r['over_150k']:6}"
        )
    lines += ["", "Spawns by agent type: " + (", ".join(f"{k}={v}" for k, v in out["spawns"].items()) or "none")]
    lines.append("Context by spawn depth: " + ", ".join(f"{k}={v / 1e6:.1f}M" for k, v in out["by_depth"].items()))
    lines += ["", "Most re-read files (Read tool_result chars):"]
    lines += [f"  {r['chars'] / 1e3:8.0f}K  x{r['reads']:<4} {r['file']}" for r in out["top_reads"]]
    return "\n".join(lines)


def render_activity(out: dict, top: int = 15) -> str:
    span = f"window {out['window']}" if "window" in out else f"last {out['days']} days"
    cov = out["coverage"]
    lines = [
        f"Usage by activity, {span}, total context {out['total_context'] / 1e6:.1f}M tokens",
        "Each request's context is split evenly across its tool calls; buckets are regex matches, approximate.",
        f"Coverage: transcripts on {cov['days_with_data']} of {cov['days_in_window']} days"
        + (f", first {cov['first']}, last {cov['last']}" if cov["first"] else ""),
        "",
        f"{'agent':16} {'activity':12} {'calls':>7} {'ctxM':>8} {'%':>6}",
    ]
    for r in out["activity_rows"][:top]:
        lines.append(f"{r['agent']:16} {r['activity']:12} {r['calls']:7} {r['context'] / 1e6:8.1f} {r['share']:6.1f}")
    b = out["browser"]
    lines += ["", f"Browser checking: {b['context'] / 1e6:.1f}M ({b['share']:.1f}% of context), a11y {b['a11y'] / 1e6:.1f}M"]
    lines.append("  " + " · ".join(
        f"{a} {v['context'] / 1e6:.1f}M (a11y {v['a11y'] / 1e6:.1f}M)" for a, v in b["by_agent"].items()))
    return "\n".join(lines)


def iso_date(text: str) -> date:
    try:
        return date.fromisoformat(text)
    except ValueError:
        raise argparse.ArgumentTypeError(f"not a YYYY-MM-DD date: {text!r}") from None


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description="Tally Claude Code transcript usage.")
    window = p.add_mutually_exclusive_group()
    window.add_argument("--days", type=int, default=None, help="last N days (default 7)")
    window.add_argument("--since", type=iso_date, help="window start, 00:00 UTC on this day")
    p.add_argument("--until", type=iso_date, help="window end, 24:00 UTC on this day (needs --since)")
    p.add_argument("--by-activity", action="store_true", help="also split context by activity bucket")
    p.add_argument("--project-glob", default="*")
    p.add_argument("--root", default="~/.claude/projects")
    p.add_argument("--top", type=int, default=15)
    p.add_argument("--json", action="store_true")
    a = p.parse_args(argv)
    if a.until and not a.since:
        p.error("--until needs --since")
    if a.since and a.until and a.until < a.since:
        p.error("--until is before --since")
    days = 7 if a.days is None else a.days
    out = tally(Path(a.root).expanduser(), days, a.project_glob, a.top, a.by_activity, a.since, a.until)
    if a.json:
        print(json.dumps(out, indent=2))
        return
    print(render(out))
    if a.by_activity:
        print("\n" + render_activity(out, a.top))


if __name__ == "__main__":
    main()
