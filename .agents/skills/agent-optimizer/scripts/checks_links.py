"""Markdown link graph for agent-optimizer: link extraction, reachability, broken links."""

from __future__ import annotations

import re
from pathlib import Path

LINK_RE = re.compile(r"\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+[\"'][^)]*[\"'])?\s*\)")
FENCE_RE = re.compile(r"^(```|~~~).*?^\1[^\n]*$", re.MULTILINE | re.DOTALL)
INLINE_CODE_RE = re.compile(r"`[^`\n]*`")


def extract_links(text: str) -> list[str]:
    """Relative `.md` link targets (anchors removed); skips URLs, anchors-only and code."""
    text = INLINE_CODE_RE.sub("", FENCE_RE.sub("", text))
    out: list[str] = []
    for raw in LINK_RE.findall(text):
        target = raw.split("#", 1)[0].split("?", 1)[0]
        if not target or re.match(r"^[A-Za-z][A-Za-z0-9+.-]*:", target) or target.startswith("/"):
            continue
        if target.endswith(".md"):
            out.append(target)
    return out


def resolve(src: Path, link: str) -> Path:
    return (src.parent / link).resolve()


def read(path: Path) -> str:
    try:
        return path.read_text(errors="replace")
    except OSError:
        return ""


def reachable(starts: list[Path]) -> tuple[set[Path], dict[Path, set[Path]]]:
    """Follow .md links transitively. Returns (reachable files, target -> direct linkers)."""
    seen: set[Path] = set()
    linkers: dict[Path, set[Path]] = {}
    queue = [p.resolve() for p in starts]
    while queue:
        cur = queue.pop()
        if cur in seen:
            continue
        seen.add(cur)
        for link in extract_links(read(cur)):
            target = resolve(cur, link)
            if target.is_file():
                linkers.setdefault(target, set()).add(cur)
                queue.append(target)
    return seen, linkers


def broken_links(files: list[Path]) -> list[dict[str, str]]:
    broken: list[dict[str, str]] = []
    for f in files:
        for link in extract_links(read(f)):
            if not resolve(f, link).is_file():
                broken.append({"file": str(f), "link": link})
    return broken
