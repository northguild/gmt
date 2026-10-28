"""Tool-call classifier for usage.py --by-activity (pure, stdlib only, no I/O)."""

from __future__ import annotations

import json
import re

BROWSER_TOOLS = (
    "mcp__claude-in-chrome__", "mcp__playwright", "mcp__Claude_Browser__",
    "mcp__remote-devices__Claude_Browser__",
)
BROWSER_CMD = re.compile(
    r"playwright|chromium|webkit|firefox|grow-measure|readout-still|contrast-measure|visual-snapshot"
    r"|html-diff|globe-smoke|data-credits-check|canada-|a11y-|deploy-smoke"
    r"|grow:measure|readout:still|contrast:measure|visual:|globe:smoke|canada:still|\bgates\b"
)
TESTS_CMD = re.compile(
    r"vitest|pytest|\btsc\b|oxlint|astro check|validate|typecheck|verdict"
    r"|\bpnpm\b(?:\s+(?:--filter\s+\S+|-r|run))*\s+(?:test|check|lint)\b"
)
GH_FIRST = re.compile(r"gh\b|node scripts/pr-status\.mjs|pnpm pr-status\b")
READING_FIRST = re.compile(r"(?:cat|sed|head|tail|grep|rg|ls|find|wc|awk|jq|git (?:log|show|diff))\b")
A11Y = re.compile(
    r"a11y|axe|keyboard|tab walk|press.*Tab|focus|contrast|reduced-motion|reduced-transparency"
    r"|forced-colors|prefers-contrast",
    re.IGNORECASE,
)
# A prefix ends in `&&`, `;` or a newline (the shell writes all three), or, for VAR=value, a space.
PREFIX = re.compile(
    r'^\s*(?:eval "\$\(fnm env[^)]*\)"\s*(?:&&|;|\n)|fnm use[^&;\n]*(?:&&|;|\n)'
    r'|cd\s+\S+\s*(?:&&|;|\n)|[A-Za-z_]\w*=\S*(?:\s+|\s*;|\s*\n))'
)
HEREDOC = re.compile(r"<<-?\s*(['\"]?)(\w+)\1[^\n]*\n.*?\n\s*\2\b", re.DOTALL)
SEPARATOR = re.compile(r"&&|\|\||[;|\n]")
STEP = re.compile(r"&&|\|\||[;\n]")  # like SEPARATOR, but a pipe keeps its stages in one step


def first_command(cmd: str) -> str:
    """The first command of a shell string, after the fnm / cd / VAR=value prefixes."""
    while (m := PREFIX.match(cmd)):
        cmd = cmd[m.end():]
    return SEPARATOR.split(cmd, maxsplit=1)[0].strip()


def executed(cmd: str) -> str:
    """The steps of a shell string that are not plain reads: `grep -n firefox f` names a word, it runs nothing."""
    steps = (first_command_of(step) for step in STEP.split(HEREDOC.sub("", cmd)))
    return " ; ".join(step for step in steps if step and not READING_FIRST.match(step))


def first_command_of(step: str) -> str:
    """One step with its fnm / cd / VAR=value prefixes removed (pipes kept)."""
    while (m := PREFIX.match(step)):
        step = step[m.end():]
    return step.strip()


def classify(tool_name: str, tool_input: object) -> tuple[str, bool]:
    """(bucket, is_a11y) for one tool call. First matching bucket wins."""
    cmd = tool_input.get("command") if tool_name == "Bash" and isinstance(tool_input, dict) else None
    cmd = cmd if isinstance(cmd, str) else None
    first = first_command(cmd) if cmd is not None else ""
    if cmd:  # heredoc bodies and plain reads only name words; the rest of the string is what runs
        cmd = executed(cmd)
    if tool_name.startswith(BROWSER_TOOLS) or (cmd and BROWSER_CMD.search(cmd)):
        # The tool name is part of the haystack: a key press names its tool, not its input.
        return "browser", bool(A11Y.search(tool_name + " " + json.dumps(tool_input, default=str)))
    if cmd and TESTS_CMD.search(cmd):
        return "tests", False
    if tool_name.startswith("mcp__github__") or GH_FIRST.match(first):
        return "gh", False
    if tool_name in ("Read", "Grep", "Glob") or READING_FIRST.match(first):
        return "reading", False
    if tool_name in ("Edit", "Write", "NotebookEdit"):
        return "editing", False
    if tool_name in ("Agent", "Task", "SendMessage", "SubagentHandback"):
        return "agents", False
    return "other", False
