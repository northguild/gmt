import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRedirects, type RedirectedType } from "./redirects";
import { RENAMED_FUNCTIONS } from "./renamed-functions";
import type { TypeNode, TypeUsage } from "./type-usage";
import type { CorpusEntry } from "../../src/reference-types";

function usageOf(nodes: TypeNode[], functions: string[] = []): TypeUsage {
  return {
    types: new Map(nodes.map((n) => [n.name, n])),
    direct: new Map(),
    reach: new Map(functions.map((key) => [key, []])),
    orphans: [],
  };
}

const shared = (name: string): TypeNode => ({
  name,
  usedBy: ["a/b/one", "a/b/two"],
  input: true,
  placement: { kind: "page" },
});
const inline = (name: string, owner: string, anchor: string): TypeNode => ({
  name,
  usedBy: [owner],
  input: false,
  placement: { kind: "inline", owner, anchor },
});

const TYPES: RedirectedType[] = [
  { name: "Dwell", namespace: "transport", module: "calculate" },
  {
    name: "BusinessCalendar",
    namespace: "types",
    module: "business-calendar",
  },
];
const USAGE = usageOf(
  [
    inline("Dwell", "transport/calculate/dwellTime", "dwell"),
    shared("BusinessCalendar"),
  ],
  ["transport/calculate/dwellTime"],
);

/** The rules of a `_redirects` text: `[source, target, status]`, comments dropped. */
function rules(text: string): string[][] {
  return text
    .split("\n")
    .filter((l) => l !== "" && !l.startsWith("#"))
    .map((l) => l.split(" "));
}

describe("buildRedirects", () => {
  it("redirects both slash forms and the .md twin of each type, with a 301", () => {
    expect(rules(buildRedirects(TYPES, USAGE))).toEqual([
      [
        "/reference/transport/calculate/Dwell",
        "/reference/transport/calculate/dwellTime/#dwell",
        "301",
      ],
      [
        "/reference/transport/calculate/Dwell.md",
        "/reference/transport/calculate/dwellTime.md",
        "301",
      ],
      [
        "/reference/transport/calculate/Dwell/",
        "/reference/transport/calculate/dwellTime/#dwell",
        "301",
      ],
      [
        "/reference/types/business-calendar/BusinessCalendar",
        "/reference/types/BusinessCalendar/",
        "301",
      ],
      [
        "/reference/types/business-calendar/BusinessCalendar.md",
        "/reference/types/BusinessCalendar.md",
        "301",
      ],
      [
        "/reference/types/business-calendar/BusinessCalendar/",
        "/reference/types/BusinessCalendar/",
        "301",
      ],
    ]);
  });

  it("puts the anchor on an inline type's page target, and none on its .md twin", () => {
    const out = rules(buildRedirects([TYPES[0]], USAGE));
    const md = out.find(([source]) => source.endsWith(".md"))!;
    expect(md[1]).not.toContain("#");
    for (const [source, target] of out) {
      if (!source.endsWith(".md")) expect(target).toMatch(/\/#dwell$/);
    }
  });

  it("writes only comments and rules, one rule per line, ending with a newline", () => {
    const text = buildRedirects(TYPES, USAGE);
    expect(text.endsWith("\n")).toBe(true);
    for (const line of text.trimEnd().split("\n")) {
      expect(line).toMatch(/^(#.*|\/\S+ \/\S+ 301)$/);
    }
  });

  it("is the same text whatever order the types come in", () => {
    expect(buildRedirects([...TYPES].reverse(), USAGE)).toBe(
      buildRedirects(TYPES, USAGE),
    );
  });

  it("skips a type the usage graph does not know, rather than guess where it went", () => {
    expect(
      rules(
        buildRedirects(
          [{ name: "Unknown", namespace: "a", module: "b" }],
          usageOf([]),
        ),
      ),
    ).toEqual([]);
  });

  it("refuses a rule whose source is a page of the site", () => {
    // A function page at the old URL of a type: the redirect would hide the function.
    expect(() =>
      buildRedirects(
        [{ name: "dwell", namespace: "transport", module: "calculate" }],
        usageOf(
          [inline("dwell", "transport/calculate/dwellTime", "dwell")],
          ["transport/calculate/dwellTime", "transport/calculate/dwell"],
        ),
      ),
    ).toThrow(/\/reference\/transport\/calculate\/dwell is a page of the site/);
  });

  it("refuses two rules with one source", () => {
    expect(() => buildRedirects([TYPES[0], TYPES[0]], USAGE)).toThrow(
      /\/reference\/transport\/calculate\/Dwell has two rules/,
    );
  });

  it("refuses a rule of 1,000 characters or more than 2,000 rules", () => {
    const long = "L".repeat(1000);
    expect(() =>
      buildRedirects(
        [{ name: long, namespace: "a", module: "b" }],
        usageOf([shared(long)]),
      ),
    ).toThrow(/is over 1000 characters/);

    const many = Array.from({ length: 667 }, (_, i) => `T${i}`);
    expect(() =>
      buildRedirects(
        many.map((name) => ({ name, namespace: "a", module: "b" })),
        usageOf(many.map(shared)),
      ),
    ).toThrow(/2001 rules is over Cloudflare's limit of 2000/);
    // 666 types is 1,998 rules: under the limit.
    expect(
      rules(
        buildRedirects(
          many.slice(1).map((name) => ({ name, namespace: "a", module: "b" })),
          usageOf(many.slice(1).map(shared)),
        ),
      ),
    ).toHaveLength(1998);
  });
});

describe("buildRedirects, renamed functions", () => {
  const RENAME = [
    { from: "plain/parse/parseSql", to: "plain/parse/parseSqlDateTime" },
  ];
  const LIVE = usageOf([], ["plain/parse/parseSqlDateTime"]);

  it("writes the bare, trailing-slash and .md rules of a rename, with a 301", () => {
    expect(rules(buildRedirects([], LIVE, RENAME))).toEqual([
      [
        "/reference/plain/parse/parseSql",
        "/reference/plain/parse/parseSqlDateTime/",
        "301",
      ],
      [
        "/reference/plain/parse/parseSql.md",
        "/reference/plain/parse/parseSqlDateTime.md",
        "301",
      ],
      [
        "/reference/plain/parse/parseSql/",
        "/reference/plain/parse/parseSqlDateTime/",
        "301",
      ],
    ]);
  });

  it("refuses a rename whose target is not a function page", () => {
    expect(() => buildRedirects([], usageOf([]), RENAME)).toThrow(
      /\/reference\/plain\/parse\/parseSql is renamed to \/reference\/plain\/parse\/parseSqlDateTime, which is not a function page/,
    );
  });

  it("refuses a rename whose source is a page of the site", () => {
    expect(() =>
      buildRedirects(
        [],
        usageOf([], ["plain/parse/parseSqlDateTime", "plain/parse/parseSql"]),
        RENAME,
      ),
    ).toThrow(/\/reference\/plain\/parse\/parseSql is a page of the site/);
  });

  it("refuses a rename and a type with one source", () => {
    expect(() =>
      buildRedirects(
        [{ name: "parseSql", namespace: "plain", module: "parse" }],
        usageOf([shared("parseSql")], ["plain/parse/parseSqlDateTime"]),
        RENAME,
      ),
    ).toThrow(/\/reference\/plain\/parse\/parseSql has two rules/);
  });

  it("refuses a rename to itself", () => {
    expect(() =>
      buildRedirects([], usageOf([], ["a/b/c"]), [
        { from: "a/b/c", to: "a/b/c" },
      ]),
    ).toThrow(/is a page of the site/);
  });

  it("lists renames that all land on a function page", () => {
    const reach = RENAMED_FUNCTIONS.map((r) => r.to);
    expect(
      rules(buildRedirects([], usageOf([], reach), RENAMED_FUNCTIONS)),
    ).toHaveLength(RENAMED_FUNCTIONS.length * 3);
  });
});

describe("the generated _redirects", () => {
  const file = resolve(import.meta.dirname, "..", "..", "public", "_redirects");
  const corpusFile = resolve(
    import.meta.dirname,
    "..",
    "..",
    "src",
    "generated",
    "reference",
    "gmt-corpus.json",
  );

  it("sends the old URL of every type to the route that serves it now, and shadows no route", async () => {
    if (!existsSync(file)) return;
    const corpus = JSON.parse(
      readFileSync(corpusFile, "utf8"),
    ) as CorpusEntry[];
    const types = corpus.filter((e) => e.kind === "type");
    const out = rules(readFileSync(file, "utf8"));
    // Both slash forms and the .md twin of each type and of each renamed function.
    expect(out).toHaveLength((types.length + RENAMED_FUNCTIONS.length) * 3);

    const targetOf = new Map(out.map(([source, target]) => [source, target]));
    expect(targetOf.size).toBe(out.length);
    for (const type of types) {
      const old = `/reference/${type.namespace}/${type.module}/${type.name}`;
      // The canonical link, with the trailing slash the static host serves a page at.
      const [page, anchor] = type.url.split("#");
      const target = anchor ? `${page}/#${anchor}` : `${page}/`;
      expect(targetOf.get(old), old).toBe(target);
      expect(targetOf.get(`${old}/`), old).toBe(target);
      expect(targetOf.get(`${old}.md`), old).toBe(`${type.page}.md`);
    }

    const { referenceRoutes } = (await import(
      resolve(corpusFile, "..", "route-manifest.ts")
    )) as { referenceRoutes: ReadonlySet<string> };
    const folded = new Set([...referenceRoutes].map((r) => r.toLowerCase()));
    for (const [source, target, status] of out) {
      expect(status).toBe("301");
      const route = source.replace(/\.md$/, "").replace(/\/$/, "");
      // Not a live route, in any letter case: a redirect is applied before the asset.
      expect(folded.has(route.toLowerCase()), source).toBe(false);
      // And every target is a live route.
      const landed = target
        .split("#")[0]
        .replace(/\.md$/, "")
        .replace(/\/$/, "");
      expect(referenceRoutes.has(landed), target).toBe(true);
    }
  });
});
