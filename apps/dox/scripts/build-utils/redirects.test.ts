import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildRedirects, type RedirectedType } from "./redirects";
import { MOVED_PAGES } from "./moved-pages";
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

  it("redirects the syntax check `isLeapSecond` to `hasSecond60`, which is the function it was renamed to", () => {
    expect(RENAMED_FUNCTIONS).toContainEqual({
      from: "plain/validate/isLeapSecond",
      to: "plain/validate/hasSecond60",
    });
    expect(
      rules(
        buildRedirects(
          [],
          usageOf([], ["plain/validate/hasSecond60"]),
          RENAMED_FUNCTIONS.filter((r) => r.from.endsWith("/isLeapSecond")),
        ),
      ),
    ).toEqual([
      [
        "/reference/plain/validate/isLeapSecond",
        "/reference/plain/validate/hasSecond60/",
        "301",
      ],
      [
        "/reference/plain/validate/isLeapSecond.md",
        "/reference/plain/validate/hasSecond60.md",
        "301",
      ],
      [
        "/reference/plain/validate/isLeapSecond/",
        "/reference/plain/validate/hasSecond60/",
        "301",
      ],
    ]);
  });

  it("does not redirect the new `timescale` function of the same name: it is a different page", () => {
    const live = usageOf(
      [],
      [
        ...RENAMED_FUNCTIONS.map((r) => r.to),
        "timescale/validate/isLeapSecond",
      ],
    );
    const text = buildRedirects([], live, RENAMED_FUNCTIONS);
    expect(text).not.toContain("/reference/timescale/validate/isLeapSecond ");
  });

  it("sends each function that moved from `duty` to `workforce` to its new page, with the three rules", () => {
    const moved = RENAMED_FUNCTIONS.filter((r) => r.from.startsWith("duty/"));
    expect(moved.map((r) => r.from)).toEqual([
      "duty/calculate/dutyDayFor",
      "duty/calculate/dutyTotals",
      "duty/calculate/dutyViolations",
      "duty/calculate/evaluateDutyLog",
      "duty/calculate/longestRun",
      "duty/calculate/qualifyingRestPairs",
      "duty/calculate/qualifyingRests",
      "duty/validate/isValidDutyLog",
    ]);
    for (const r of moved) {
      expect(r.to).toBe(r.from.replace(/^duty\//, "workforce/"));
    }
    expect(
      rules(
        buildRedirects(
          [],
          usageOf(
            [],
            moved.map((r) => r.to),
          ),
          moved,
        ),
      ),
    ).toHaveLength(moved.length * 3);
  });

  it("lists renames that all land on a function page", () => {
    const reach = RENAMED_FUNCTIONS.map((r) => r.to);
    expect(
      rules(buildRedirects([], usageOf([], reach), RENAMED_FUNCTIONS)),
    ).toHaveLength(RENAMED_FUNCTIONS.length * 3);
  });
});

describe("buildRedirects, moved pages", () => {
  const MOVED = [
    { from: "/reference/duty", to: "/reference/workforce" },
    { from: "/guides/old", to: "/guides/new" },
  ];
  const ROUTES = new Set(["/reference/workforce", "/guides/new"]);

  it("writes the bare, trailing-slash and .md rules of a moved page, with a 301", () => {
    expect(rules(buildRedirects([], usageOf([]), [], MOVED, ROUTES))).toEqual([
      ["/guides/old", "/guides/new/", "301"],
      ["/guides/old.md", "/guides/new.md", "301"],
      ["/guides/old/", "/guides/new/", "301"],
      ["/reference/duty", "/reference/workforce/", "301"],
      ["/reference/duty.md", "/reference/workforce.md", "301"],
      ["/reference/duty/", "/reference/workforce/", "301"],
    ]);
  });

  it("refuses a moved page whose target is neither a page nor a route", () => {
    expect(() =>
      buildRedirects([], usageOf([]), [], MOVED, new Set(["/guides/new"])),
    ).toThrow(
      /\/reference\/duty moved to \/reference\/workforce, which is not a page or route/,
    );
  });

  it("refuses a moved page whose old path is still a page or route", () => {
    expect(() =>
      buildRedirects(
        [],
        usageOf([]),
        [],
        MOVED,
        new Set([...ROUTES, "/reference/duty"]),
      ),
    ).toThrow(/\/reference\/duty is a page of the site/);
  });

  it("refuses a moved page and a rename with one source", () => {
    expect(() =>
      buildRedirects(
        [],
        usageOf([], ["a/b/c"]),
        [{ from: "x/y/z", to: "a/b/c" }],
        [{ from: "/reference/x/y/z", to: "/reference/workforce" }],
        ROUTES,
      ),
    ).toThrow(/\/reference\/x\/y\/z has two rules/);
  });

  it("lists the three index pages the duty namespace had, and the two pages of hours of work", () => {
    expect(MOVED_PAGES).toEqual([
      { from: "/reference/duty", to: "/reference/workforce" },
      {
        from: "/reference/duty/calculate",
        to: "/reference/workforce/calculate",
      },
      { from: "/reference/duty/validate", to: "/reference/workforce/validate" },
      {
        from: "/guides/intervals/hours-of-work",
        to: "/guides/industries/workforce-hours-of-work",
      },
      { from: "/mistakes/duty", to: "/mistakes/workforce" },
    ]);
  });

  it("writes the rules of every listed move, each to a route that exists", () => {
    const routes = new Set(MOVED_PAGES.map((m) => m.to));
    expect(
      rules(buildRedirects([], usageOf([]), [], MOVED_PAGES, routes)),
    ).toHaveLength(MOVED_PAGES.length * 3);
  });
});

describe("buildRedirects with a base", () => {
  it("prefixes both sides of every rule and leaves the base-less output alone", () => {
    const plain = rules(buildRedirects(TYPES, USAGE));
    const based = rules(
      buildRedirects(TYPES, USAGE, [], [], new Set(), "/gmt"),
    );
    expect(based).toEqual(
      plain.map(([source, target, status]) => [
        `/gmt${source}`,
        `/gmt${target}`,
        status,
      ]),
    );
  });

  it("validates on the base-less routes: a moved page is still checked against them", () => {
    const moved = [{ from: "/old", to: "/new" }];
    expect(() =>
      buildRedirects([], usageOf([]), [], moved, new Set(["/new"]), "/gmt"),
    ).not.toThrow();
    // `/gmt/new` is not a route; the base is not part of the route set.
    expect(() =>
      buildRedirects([], usageOf([]), [], moved, new Set(["/gmt/new"]), "/gmt"),
    ).toThrow(/not a page or route/);
  });

  it("counts the base toward the 1,000-character limit", () => {
    const longTo = `/${"a".repeat(480)}`;
    const moved = [{ from: `/${"b".repeat(480)}`, to: longTo }];
    const routes = new Set([longTo]);
    // 481 + 482 + 11 = 974 without a base; the base adds 8 and the slash form pushes past 1,000.
    expect(() =>
      buildRedirects([], usageOf([]), [], moved, routes, ""),
    ).not.toThrow();
    expect(() =>
      buildRedirects(
        [],
        usageOf([]),
        [],
        moved,
        routes,
        "/".concat("g".repeat(30)),
      ),
    ).toThrow(/over 1000 characters/);
  });
});

describe("the generated _redirects", () => {
  const file = resolve(
    import.meta.dirname,
    "..",
    "..",
    "src",
    "generated",
    "_redirects",
  );
  const contentDir = resolve(
    import.meta.dirname,
    "..",
    "..",
    "src",
    "content",
    "docs",
  );
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
    // Every emitted path sits under the base; the checks below are on the base-less routes.
    const emitted = rules(readFileSync(file, "utf8"));
    for (const [source, target] of emitted) {
      expect(source.startsWith("/gmt/"), source).toBe(true);
      expect(target.startsWith("/gmt/"), target).toBe(true);
    }
    const out = emitted.map(([source, target, status]) => [
      source.slice("/gmt".length),
      target.slice("/gmt".length),
      status,
    ]);
    // Both slash forms and the .md twin of each type, each renamed function and each moved page.
    expect(out).toHaveLength(
      (types.length + RENAMED_FUNCTIONS.length + MOVED_PAGES.length) * 3,
    );

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
      // And every target is a live route: a reference route, or a moved page's content file.
      const landed = target
        .split("#")[0]
        .replace(/\.md$/, "")
        .replace(/\/$/, "");
      const live =
        referenceRoutes.has(landed) ||
        [".mdx", ".md"].some((ext) =>
          existsSync(resolve(contentDir, `.${landed}${ext}`)),
        );
      expect(live, target).toBe(true);
    }
  });
});
