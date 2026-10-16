#!/usr/bin/env python3
"""Tally Claude Code transcript usage per agent and model (stdlib only, read-only).

Usage:
    python3 usage.py [--days 7] [--project-glob '*gmt*'] [--root ~/.claude/projects]
                     [--top 15] [--json]

Subagent transcripts (`.../subagents/agent-<id>.jsonl`) take agentType and spawnDepth from the
sibling `.meta.json`; every other transcript is the MAIN session at depth 0.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from usage_tally import tally  # noqa: E402


def render(out: dict) -> str:
    lines = [f"Usage, last {out['days']} days, total context {out['total_context'] / 1e6:.1f}M tokens", out["note"], ""]
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


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description="Tally Claude Code transcript usage.")
    p.add_argument("--days", type=int, default=7)
    p.add_argument("--project-glob", default="*")
    p.add_argument("--root", default="~/.claude/projects")
    p.add_argument("--top", type=int, default=15)
    p.add_argument("--json", action="store_true")
    a = p.parse_args(argv)
    out = tally(Path(a.root).expanduser(), a.days, a.project_glob, a.top)
    print(json.dumps(out, indent=2) if a.json else render(out))


if __name__ == "__main__":
    main()
