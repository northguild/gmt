#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12"
# ///
"""Run agent-optimizer and skill-optimizer and print one short summary.

Usage:
    python3 .agents/skills/optimize/scripts/run.py [--all] [--usage] [--base REF] [--limit N]

By default it lists only findings in files this branch changed (vs --base, default origin/main,
plus uncommitted and untracked files) and repo-wide problems (symlinks, kilo.jsonc, duplicate
skills). Everything else is counted as backlog. --all lists every finding. Exit 1 when a listed
finding exists, else 0.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

SKILLS = Path(__file__).resolve().parents[2]
REPO = "(repo)"
Finding = tuple[str, str]


def rel(path: str, root: Path) -> str:
    try:
        return str(Path(path).relative_to(root))
    except ValueError:
        return path


def findings(ao: dict, so: dict, root: Path) -> list[Finding]:
    """Flatten both reports into (repo-relative path or (repo), message) pairs."""
    out: list[Finding] = []
    ctx = ao.get("context", {})
    for item in [*ao.get("entry_files", []), *ctx.get("files", []), *ao.get("personas", [])]:
        out += [(rel(item["file"], root), w) for w in item.get("warnings", [])]
    out += [(rel(o, root), "orphan: no entry file or persona links to it") for o in ctx.get("orphans", [])]
    out += [(rel(b["file"], root), f"broken link: {b['link']}") for b in ctx.get("broken_links", [])]
    for dup in ctx.get("near_duplicates", []):
        files = [v for v in dup.values() if isinstance(v, str)]
        out.append((rel(files[0], root) if files else REPO, f"near-duplicate: {dup}"))
    sync = ao.get("sync", {})
    for kind in ("agents", "skills"):
        for problem, names in sync.get(kind, {}).items():
            if names:
                out.append((REPO, f"sync: {kind} {problem.replace('_', ' ')}: {', '.join(names)}"))
    kilo = sync.get("kilo", {})
    if kilo.get("missing_personas"):
        out.append((REPO, f"kilo.jsonc missing: {', '.join(kilo['missing_personas'])}"))
    out += [(REPO, f"kilo.jsonc bad prompt: {b}") for b in kilo.get("bad_prompts", [])]
    for skill in so.get("skills", []):
        out += [(rel(skill["dir"], root), w) for w in skill.get("warnings", [])]
    inv = so.get("inventory", {})
    out += [(REPO, f"skills: duplicate name {d}") for d in inv.get("duplicate_names", [])]
    out += [(REPO, f"skills: similar descriptions {d}") for d in inv.get("similar_descriptions", [])]
    return out


def relevant(found: list[Finding], changed: set[str]) -> list[Finding]:
    """Keep repo-wide findings and those on a changed file (or a skill dir holding one)."""
    def hit(path: str) -> bool:
        return path == REPO or path in changed or any(c.startswith(path + "/") for c in changed)
    return [f for f in found if hit(f[0])]


def render(found: list[Finding], listed: list[Finding], limit: int) -> str:
    head = "FAIL" if listed else "PASS"
    lines = [f"{head}: {len(listed)} finding(s) to fix; {len(found) - len(listed)} backlog (run --all to list)"]
    lines += [f"- {p}: {m}" for p, m in listed[:limit]]
    if len(listed) > limit:
        lines.append(f"… {len(listed) - limit} more")
    return "\n".join(lines)


def git_lines(root: Path, *args: str) -> list[str]:
    out = subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True)
    return out.stdout.split() if out.returncode == 0 else []


def changed_files(root: Path, base: str) -> set[str]:
    return set(git_lines(root, "diff", "--name-only", f"{base}...HEAD")
               + git_lines(root, "diff", "--name-only", "HEAD")
               + git_lines(root, "ls-files", "--others", "--exclude-standard"))


def report(script: str, *args: str) -> dict:
    out = subprocess.run([sys.executable, str(SKILLS / script), *args], capture_output=True, text=True)
    return json.loads(out.stdout)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--all", action="store_true", help="list every finding, not just this branch's")
    parser.add_argument("--usage", action="store_true", help="append the 7-day token usage report")
    parser.add_argument("--base", default="origin/main", help="branch point to diff against")
    parser.add_argument("--limit", type=int, default=30, help="most findings to list")
    parser.add_argument("--root", default=".", help="repo root")
    args = parser.parse_args(argv)
    root = Path(args.root).resolve()
    ao = report("agent-optimizer/scripts/optimize.py", str(root))
    so = report("skill-optimizer/scripts/optimize.py", "--all", str(root / ".agents" / "skills"))
    found = findings(ao, so, root)
    listed = found if args.all else relevant(found, changed_files(root, args.base))
    print(render(found, listed, args.limit))
    if args.usage:
        usage = subprocess.run([sys.executable, str(SKILLS / "agent-optimizer/scripts/usage.py"),
                                "--project-glob", "*northguild-gmt*", "--top", "8"],
                               capture_output=True, text=True)
        print("\n" + usage.stdout.strip())
    return 1 if listed else 0


if __name__ == "__main__":
    sys.exit(main())
