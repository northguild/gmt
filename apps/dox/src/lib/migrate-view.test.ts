import {
  LIBRARY_IDS,
  VERDICTS,
  VERDICT_LABEL,
  diffsFor,
  matrix,
  rowAnchor,
} from "../data/behaviour-matrix";
import { temporalMap } from "../data/temporal-map";
import {
  VERDICT_BADGE,
  callLines,
  diffPairs,
  mapPairs,
  matrixView,
  temporalPairs,
  theirsCode,
  type CodePairView,
} from "./migrate-view";

const linkGroup = (pair: CodePairView, label: string) =>
  pair.links.find((group) => group.label === label)?.links ?? [];

describe("theirsCode", () => {
  it("prints one code span as it is", () => {
    expect(theirsCode("`DateTime.now()`")).toBe("DateTime.now()");
  });

  it("puts spans joined by commas or `or` one per line", () => {
    expect(theirsCode("`subDays(d, n)`, `subMonths(d, n)`")).toBe(
      "subDays(d, n)\nsubMonths(d, n)",
    );
    expect(theirsCode("`a()` or `b()`")).toBe("a()\nb()");
  });

  it("turns a trailing plugin name into a comment", () => {
    expect(theirsCode("`dayjs.utc(s)` (utc)")).toBe(
      "dayjs.utc(s)\n// needs the utc plugin",
    );
  });

  it("turns wording into comment lines of about 60 characters, without backticks", () => {
    const code = theirsCode(
      "The current time, from the built-in `Date` object, read once and then passed to every call that needs it",
    );
    const lines = code.split("\n");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line).toMatch(/^\/\/ /);
      expect(line.length).toBeLessThanOrEqual(64);
      expect(line).not.toContain("`");
    }
  });

  it("treats a span with words before it as wording", () => {
    expect(theirsCode("Use `a()`")).toBe("// Use a()");
  });
});

describe("callLines", () => {
  it("puts a one-line result after an arrow", () => {
    expect(callLines("f(1)", '"a"')).toBe('f(1);\n// → "a"');
  });

  it("keeps the arrow on the first line of a longer result and indents the rest", () => {
    expect(callLines("f()", "[\n  1,\n]")).toBe(
      "f();\n// → [\n//     1,\n//   ]",
    );
  });

  it("does not double the comment marker of a result written as comments", () => {
    expect(callLines("f()", "// [\n//   1,\n// ]")).toBe(
      "f();\n// → [\n//     1,\n//   ]",
    );
  });

  it("leaves no doubled marker in any GMT code on the migration pages", () => {
    const codes = [
      ...LIBRARY_IDS.flatMap((id) =>
        (["rows", "more"] as const).flatMap((part) => mapPairs(id, part)),
      ),
      ...temporalPairs(),
    ].map((pair) => pair.gmt.code);
    for (const code of codes) expect(code).not.toMatch(/\/\/ → \/\//);
  });
});

describe("mapPairs", () => {
  const all = LIBRARY_IDS.flatMap((id) =>
    (["rows", "more"] as const).flatMap((part) => mapPairs(id, part)),
  );

  it("gives every call some code on both sides", () => {
    expect(all.length).toBeGreaterThan(100);
    for (const pair of all) {
      expect(pair.theirs.code.trim()).not.toBe("");
      expect(pair.gmt.code.trim()).not.toBe("");
    }
  });

  it("opens the GMT side with its imports, or a comment when GMT has no call", () => {
    for (const pair of all) {
      const reference = linkGroup(pair, "Reference");
      if (reference.length === 0) {
        expect(pair.gmt.code).toMatch(/^\/\/ /);
        expect(pair.note).toBeUndefined();
      } else {
        expect(pair.gmt.code).toMatch(/^import /);
        for (const link of reference)
          expect(pair.gmt.code).toContain(link.text);
      }
    }
  });

  it("shows each example's result as a comment under its call", () => {
    const pair = all.find((p) => p.gmt.code.startsWith("import "));
    expect(pair?.gmt.code).toMatch(/;\n\/\/ → /);
  });

  it("titles the library side with the library's name", () => {
    const [first] = mapPairs("luxon", "rows");
    expect(first.theirs.title).toBe("Luxon");
    expect(first.gmt.title).toBe("GMT");
  });
});

describe("temporalPairs", () => {
  const pairs = temporalPairs();

  it("has one pair per row, each with its task and clauses", () => {
    expect(pairs).toHaveLength(temporalMap.length);
    pairs.forEach((pair, index) => {
      expect(pair.heading?.text).toBe(temporalMap[index].task);
      expect(linkGroup(pair, "Specification")).toHaveLength(
        temporalMap[index].clauses.length,
      );
      expect(pair.gmt.code).toMatch(/^import /);
    });
  });

  it("prints a row's note under its pair", () => {
    temporalMap.forEach((row, index) => {
      expect(pairs[index].note).toBe(row.note);
    });
    expect(temporalMap.filter((row) => row.note).length).toBeGreaterThan(0);
  });

  it("uses the written code for a call with no reference page", () => {
    const row = temporalMap.find((r) => r.gmtCode);
    const pair = pairs.find((p) => p.heading?.text === row?.task);
    expect(pair?.gmt.code).toBe(row?.gmtCode);
    expect(linkGroup(pair!, "Reference")).toHaveLength(0);
  });
});

describe("diffPairs", () => {
  it("has one pair per case the library differs in, linked to its matrix entry", () => {
    const anchors = new Set(
      matrixView().flatMap((c) => c.entries.map((entry) => entry.anchor)),
    );
    for (const id of LIBRARY_IDS) {
      const pairs = diffPairs(id);
      expect(pairs).toHaveLength(diffsFor(id).length);
      for (const pair of pairs) {
        const [full] = linkGroup(pair, "Full results");
        const anchor = rowAnchor(pair.heading!.tag!, id);
        expect(full.href).toBe(`/compare/behaviour/#${anchor}`);
        expect(anchors.has(anchor)).toBe(true);
        expect(pair.facts.map((fact) => fact.label)).toEqual([
          "Input",
          "Compared as",
          expect.stringMatching(/^(Temporal returns|Stated result)$/),
        ]);
      }
    }
  });
});

describe("matrixView", () => {
  const cases = matrixView();
  const entries = cases.flatMap((c) => c.entries);

  it("lists GMT first, then every library in the case", () => {
    cases.forEach((view, index) => {
      expect(view.entries[0]).toMatchObject({ name: "GMT", anchor: null });
      expect(view.entries).toHaveLength(
        matrix.cases[index].libraries.length + 1,
      );
    });
  });

  it("gives every library entry its own anchor", () => {
    const anchors = entries.flatMap((entry) =>
      entry.anchor ? [entry.anchor] : [],
    );
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it("puts each host of a result that varies with the host on its own comment line", () => {
    const rows = matrix.cases.flatMap((c) =>
      c.libraries.map((row) => ({
        row,
        entry: entries.find((e) => e.anchor === rowAnchor(c.id, row.library)),
      })),
    );
    const varies = rows.filter(({ row }) => row.verdict === "varies");
    expect(varies.length).toBeGreaterThan(0);
    for (const { row, entry } of varies) {
      const hostLines = entry!.code
        .split("\n")
        .filter((line) => / host: /.test(line));
      expect(hostLines).toHaveLength(row.hosts!.length);
    }
  });

  it("gives an unsupported call its reason as a comment, with no call line", () => {
    const unsupported = entries.filter(
      (entry) => entry.verdict === "unsupported",
    );
    expect(unsupported.length).toBeGreaterThan(0);
    for (const entry of unsupported) {
      for (const line of entry.code.split("\n")) expect(line).toMatch(/^\/\/ /);
    }
  });
});

describe("VERDICT_BADGE", () => {
  it("names every verdict in words, with an icon on every measured result", () => {
    for (const verdict of VERDICTS) {
      expect(VERDICT_BADGE[verdict].text).toBe(VERDICT_LABEL[verdict]);
      if (verdict !== "unsupported")
        expect(VERDICT_BADGE[verdict].icon).toBeDefined();
    }
  });
});
