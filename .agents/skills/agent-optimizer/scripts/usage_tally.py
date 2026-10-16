"""Transcript tally for usage.py: per-agent context, spawn counts, depth totals, Read re-reads."""

from __future__ import annotations

import glob
import json
import os
import time
from datetime import datetime, timezone
from collections import Counter, defaultdict
from pathlib import Path

BIG_CONTEXT = 150_000  # requests above this many context tokens are counted separately
NOTE = (
    "Transcript output_tokens are logged mid-stream and unreliable, so they are not reported. "
    "Context = input + cache_read + cache_creation tokens per request."
)


def agent_of(path: Path) -> tuple[str, int, bool]:
    """(agent type, spawn depth, is_subagent) from the transcript path and its .meta.json."""
    if "subagents" not in path.parts:
        return "MAIN", 0, False
    try:
        meta = json.loads(path.with_suffix(".meta.json").read_text())
    except (OSError, ValueError):
        return "sub?", 1, True
    return str(meta.get("agentType", "?")), int(meta.get("spawnDepth", 1)), True


def result_size(content: object) -> int:
    if isinstance(content, str):
        return len(content)
    if isinstance(content, list):
        return sum(len(b.get("text", "")) if isinstance(b, dict) else len(str(b)) for b in content)
    return len(json.dumps(content))


def too_old(raw_ts: object, cutoff: float) -> bool:
    """True when a line's ISO 8601 `timestamp` is before the cutoff (epoch seconds).

    A line with no timestamp, or one that does not parse, is kept: its file already passed the
    mtime prefilter, and dropping unknown lines would hide real usage.
    """
    if not isinstance(raw_ts, str):
        return False
    try:
        when = datetime.fromisoformat(raw_ts[:-1] + "+00:00" if raw_ts.endswith("Z") else raw_ts)
    except ValueError:
        return False
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    return when.timestamp() < cutoff


def scan_file(path: Path, agg: dict, depth_ctx: Counter, reads: dict, cutoff: float = 0.0) -> None:
    agent, depth, _ = agent_of(path)
    seen: set[str] = set()
    pending: dict[str, str] = {}
    with open(path, errors="ignore") as fh:
        for raw in fh:
            try:
                entry = json.loads(raw)
                msg = entry.get("message") or {}
            except (ValueError, AttributeError):
                continue
            if too_old(entry.get("timestamp"), cutoff):
                continue
            if not isinstance(msg, dict):
                continue
            content = msg.get("content")
            for block in content if isinstance(content, list) else []:
                if not isinstance(block, dict):
                    continue
                if block.get("type") == "tool_use" and block.get("name") == "Read":
                    pending[block["id"]] = str((block.get("input") or {}).get("file_path", "?"))
                elif block.get("type") == "tool_result" and block.get("tool_use_id") in pending:
                    entry = reads[pending[block["tool_use_id"]]]
                    entry["reads"] += 1
                    entry["chars"] += result_size(block.get("content"))
            usage = msg.get("usage")
            mid = msg.get("id")
            if not isinstance(usage, dict) or mid in seen:
                continue
            seen.add(mid)
            ctx = sum(int(usage.get(k) or 0) for k in (
                "input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"))
            row = agg[(agent, str(msg.get("model", "?")))]
            row["requests"] += 1
            row["context"] += ctx
            row["peak"] = max(row["peak"], ctx)
            row["over_150k"] += ctx > BIG_CONTEXT
            depth_ctx[str(depth)] += ctx


def tally(root: Path, days: int = 7, project_glob: str = "*", top: int = 15) -> dict[str, object]:
    cutoff = time.time() - days * 86400
    agg: dict = defaultdict(Counter)
    depth_ctx: Counter = Counter()
    reads: dict = defaultdict(Counter)
    spawns: Counter = Counter()
    pattern = os.path.join(str(root), project_glob, "**", "*.jsonl")
    for name in sorted(glob.glob(pattern, recursive=True)):
        path = Path(name)
        if os.path.getmtime(path) < cutoff:
            continue
        agent, _, is_sub = agent_of(path)
        spawns[agent] += is_sub
        scan_file(path, agg, depth_ctx, reads, cutoff)
    total = sum(r["context"] for r in agg.values()) or 1
    rows = [
        {"agent": a, "model": m, "requests": r["requests"], "context": r["context"],
         "share": round(100 * r["context"] / total, 1), "avg": r["context"] // max(r["requests"], 1),
         "peak": r["peak"], "over_150k": r["over_150k"]}
        for (a, m), r in agg.items()
    ]
    rows.sort(key=lambda r: -r["context"])
    top_reads = sorted(
        ({"file": f, "reads": v["reads"], "chars": v["chars"]} for f, v in reads.items()),
        key=lambda r: -r["chars"],
    )
    return {
        "note": NOTE, "days": days, "total_context": sum(r["context"] for r in agg.values()),
        "rows": rows[:top],
        "spawns": {k: v for k, v in spawns.most_common() if v},
        "by_depth": dict(sorted(depth_ctx.items())),
        "top_reads": top_reads[:top],
    }
