"""Cross-skill checks for `--all` mode: duplicate names and near-duplicate descriptions."""

from __future__ import annotations

from difflib import SequenceMatcher
from typing import cast

DESCRIPTION_SIMILARITY = 0.80  # pairwise ratio >= this => "similar descriptions" warning


def inventory_findings(skills: list[dict[str, object]]) -> dict[str, list[dict[str, object]]]:
    named: list[dict[str, object]] = [s for s in skills if s.get("name")]
    duplicates: list[dict[str, object]] = []
    seen: dict[str, list[str]] = {}
    for s in named:
        name = cast(str, s["name"])
        dir_ = cast(str, s["dir"])
        seen.setdefault(name, []).append(dir_)
    for n, dirs in seen.items():
        if len(dirs) > 1:
            duplicates.append({"name": n, "dirs": dirs})

    similar: list[dict[str, object]] = []
    descs: list[tuple[str, str]] = [
        (cast(str, s["name"]), cast(str, s.get("description", "")) or "") for s in named
    ]
    for i in range(len(descs)):
        for j in range(i + 1, len(descs)):
            a = descs[i][1].lower()
            b = descs[j][1].lower()
            if a and b and SequenceMatcher(None, a, b).ratio() >= DESCRIPTION_SIMILARITY:
                similar.append({
                    "a": descs[i][0],
                    "b": descs[j][0],
                    "ratio": round(SequenceMatcher(None, a, b).ratio(), 2),
                })

    return {"duplicate_names": duplicates, "similar_descriptions": similar}
