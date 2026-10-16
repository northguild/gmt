"""Tell a size finding this branch caused from one already in the backlog.

A size finding ("250 lines (budget 200)") on a changed file counts as new only when the file is
new at the base, or was within that budget there. Everything else is backlog.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path
from typing import Callable, Optional

SIZE_RE = re.compile(r"(\d+) (lines|chars) \(budget (\d+)\)")
NAMED_RE = re.compile(r"^(\S+) is \d+")
Reader = Callable[[str], Optional[str]]


def git_reader(root: Path, base: str) -> Reader:
    """Read a file's text at the base ref; None when it did not exist there."""
    def read(path: str) -> Optional[str]:
        out = subprocess.run(["git", "-C", str(root), "show", f"{base}:{path}"],
                             capture_output=True, text=True)
        return out.stdout if out.returncode == 0 else None
    return read


def target_file(path: str, message: str, changed: set[str]) -> str:
    """The file a finding is about: the path itself, or a file inside a skill directory."""
    if path in changed:
        return path
    named = NAMED_RE.match(message)
    name = named.group(1) if named and named.group(1).endswith(".md") else "SKILL.md"
    return f"{path}/{name}"


def caused_here(finding: tuple[str, str], changed: set[str], base: Reader) -> bool:
    """False only for a size finding that was already over budget at the base."""
    path, message = finding
    size = SIZE_RE.search(message)
    if size is None:
        return True
    file = target_file(path, message, changed)
    if file not in changed:
        return False
    old = base(file)
    if old is None:
        return True
    value = len(old.splitlines()) if size.group(2) == "lines" else len(old)
    return value <= int(size.group(3))
