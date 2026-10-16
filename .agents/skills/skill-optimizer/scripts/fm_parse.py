"""Frontmatter parsing for skill-optimizer: PyYAML when installed, else a small fallback.

The fallback handles `key: value`, quoted values, `>` / `|` block scalars (with `-`/`+`
chomping), and one level of nested maps (e.g. `metadata:`). It is deliberately not a YAML
implementation; anything it cannot read raises ValueError.
"""

from __future__ import annotations

import re

try:
    import yaml
except ImportError:  # system python without PyYAML
    yaml = None

KEY_RE = re.compile(r"^([A-Za-z0-9_][A-Za-z0-9_.-]*):(?:\s+(.*)|\s*)$")
BLOCK_RE = re.compile(r"^([>|])([+-]?)$")
ESCAPES = {"n": "\n", "t": "\t", '"': '"', "\\": "\\"}


def parse_frontmatter(block: str) -> object:
    """Return the parsed frontmatter (usually a dict). Raises ValueError if unreadable."""
    if yaml is not None:
        try:
            return yaml.safe_load(block)
        except yaml.YAMLError as exc:
            raise ValueError(str(exc)) from exc
    return _fallback(block)


def _scalar(raw: str) -> str:
    raw = raw.strip()
    if raw[:1] == "[" and "]" not in raw or raw[:1] == "{" and "}" not in raw:
        raise ValueError(f"unterminated flow collection: {raw}")
    if len(raw) >= 2 and raw[0] == raw[-1] == "'":
        return raw[1:-1].replace("''", "'")
    if len(raw) >= 2 and raw[0] == raw[-1] == '"':
        return re.sub(r"\\(.)", lambda m: ESCAPES.get(m.group(1), m.group(0)), raw[1:-1])
    if raw[:1] in "'\"":
        raise ValueError(f"unterminated quoted string: {raw}")
    return re.sub(r"\s+#.*$", "", raw)


def _block(style: str, chomp: str, lines: list[str]) -> str:
    while lines and not lines[-1].strip():
        lines.pop()
    indent = min((len(x) - len(x.lstrip()) for x in lines if x.strip()), default=0)
    body = [x[indent:] for x in lines]
    text = " ".join(s.strip() for s in body) if style == ">" else "\n".join(body)
    return text if chomp == "-" else text + "\n"


def _fallback(block: str) -> object:
    rows = [r.rstrip() for r in block.splitlines() if r.strip() and not r.lstrip().startswith("#")]
    if not rows:
        return None
    if rows[0].lstrip().startswith("- "):
        return [r.lstrip()[2:] for r in rows]
    if not KEY_RE.match(rows[0]):
        if len(rows) == 1:
            return _scalar(rows[0])
        raise ValueError(f"expected 'key: value', got: {rows[0]}")
    return _mapping(block.splitlines())


def _mapping(raw_lines: list[str]) -> dict[str, object]:
    out: dict[str, object] = {}
    i = 0
    while i < len(raw_lines):
        line = raw_lines[i].rstrip()
        i += 1
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        m = KEY_RE.match(line)
        if not m:
            raise ValueError(f"expected 'key: value', got: {line.strip()}")
        key, value = m.group(1), (m.group(2) or "").strip()
        child: list[str] = []
        while i < len(raw_lines) and (not raw_lines[i].strip() or raw_lines[i][:1].isspace()):
            child.append(raw_lines[i].rstrip())
            i += 1
        bm = BLOCK_RE.match(value)
        if bm:
            out[key] = _block(bm.group(1), bm.group(2), child)
        elif value:
            out[key] = _scalar(value)
        elif any(c.strip() for c in child):
            out[key] = _mapping([c.strip() for c in child])
        else:
            out[key] = None
    return out
