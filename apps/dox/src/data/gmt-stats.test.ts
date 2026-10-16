import corpus from "../generated/reference/gmt-corpus.json";
import declared from "./industries.json";
import {
  coreFunctions,
  coreNamespaces,
  formatCount,
  formatNamespaceList,
  gmtStats,
  industryFunctions,
  industryNamespaces,
  runsPerTest,
} from "./gmt-stats";
import {
  competitorComparisons,
  competitorExecutionRange,
  competitorStatRange,
  executionRatio,
  largestCompetitorSuite,
} from "./library-comparison";

describe("gmtStats", () => {
  it("describes the packages/gmt suite only", () => {
    expect(gmtStats.suite).toBe("packages/gmt");
  });

  it("runs every test once per Node version per timezone", () => {
    expect(gmtStats.executions).toBe(gmtStats.tests * runsPerTest);
  });

  it("totals public functions across the namespaces", () => {
    const total = gmtStats.byNamespace.reduce((sum, row) => sum + row.count, 0);
    expect(total).toBe(gmtStats.functions);
  });

  it("lists namespaces largest first", () => {
    const counts = gmtStats.byNamespace.map((row) => row.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it("names only exporting namespaces as an industry's own", () => {
    const namespaces = gmtStats.byNamespace.map((row) => row.namespace);
    for (const industry of gmtStats.industryNamespaces) {
      expect(namespaces).toContain(industry);
    }
  });

  it("splits every namespace into core or an industry's own", () => {
    expect(coreNamespaces.length + industryNamespaces.length).toBe(
      gmtStats.byNamespace.length,
    );
    expect(coreFunctions + industryFunctions).toBe(gmtStats.functions);
  });
});

// The stacked "By industry" chart and the README's industry line read these, so they are
// re-derived here from the two sources they come from: the reference corpus and the declarations
// in industries.json. A fixture row below states what a shared layer must look like.
describe("industry figures", () => {
  const functions = corpus.filter((e) => e.kind === "function");
  const countIn = (module: string) =>
    functions.filter((f) =>
      module.includes("/")
        ? `${f.namespace}/${f.module}` === module
        : f.namespace === module,
    ).length;

  it("re-derives each industry's own count and what it draws on from the corpus", () => {
    expect(
      gmtStats.industryLayers.map(({ id, label, own, drawsOn }) => ({
        id,
        label,
        own,
        drawsOn,
      })),
    ).toEqual(
      declared.map((industry) => ({
        id: industry.id,
        label: industry.label,
        own: "namespace" in industry ? countIn(industry.namespace) : 0,
        drawsOn: industry.drawsOn.map((module) => ({
          module,
          count: countIn(module),
          shared: declared.some(
            (other) =>
              "namespace" in other && other.namespace === module.split("/")[0],
          ),
        })),
      })),
    );
  });

  it("lists the industries' own namespaces in the order of the function counts", () => {
    const owned = declared.flatMap((i) =>
      "namespace" in i ? i.namespace : [],
    );
    expect(gmtStats.industryNamespaces).toEqual(
      gmtStats.byNamespace
        .map((row) => row.namespace)
        .filter((namespace) => owned.includes(namespace)),
    );
  });

  it("counts a function in one own namespace only, and the distinct total once", () => {
    const own = gmtStats.industryLayers.map((layer) => layer.own);
    expect(gmtStats.industryFunctions).toBe(own.reduce((a, b) => a + b, 0));
    const owners = functions.filter((f) =>
      gmtStats.industryNamespaces.includes(f.namespace),
    );
    expect(owners).toHaveLength(gmtStats.industryFunctions);
    expect(
      new Set(owners.map((f) => `${f.namespace}/${f.module}/${f.name}`)).size,
    ).toBe(owners.length);
    expect(coreFunctions + industryFunctions).toBe(gmtStats.functions);
  });

  it("gives a layer another industry draws on the count of that industry's own namespace, and counts it once", () => {
    // Intermodal draws on transport: its transport segment is Transport's own count, and the
    // distinct total counts those functions in Transport's column alone.
    const byId = new Map(gmtStats.industryLayers.map((l) => [l.id, l]));
    const intermodal = byId.get("intermodal");
    const transport = byId.get("transport");
    const segment = intermodal?.drawsOn.find((d) => d.module === "transport");
    expect(segment).toEqual({
      module: "transport",
      count: transport?.own,
      shared: true,
    });
    const industrySum = gmtStats.industryLayers.reduce(
      (sum, l) => sum + l.own,
      0,
    );
    const withDrawnOn = gmtStats.industryLayers.reduce(
      (sum, l) => sum + l.own + l.drawsOn.reduce((a, d) => a + d.count, 0),
      0,
    );
    expect(gmtStats.industryFunctions).toBe(industrySum);
    expect(withDrawnOn).toBeGreaterThan(industrySum);
  });

  it("names a Core module as not shared", () => {
    for (const layer of gmtStats.industryLayers) {
      for (const drawn of layer.drawsOn) {
        const owned = gmtStats.industryNamespaces.includes(
          drawn.module.split("/")[0]!,
        );
        expect(drawn.shared, `${layer.id} draws on ${drawn.module}`).toBe(
          owned,
        );
      }
    }
  });
});

describe("formatNamespaceList", () => {
  it("lists namespaces as code, joined as prose", () => {
    expect(
      formatNamespaceList([
        { namespace: "plain", count: 2 },
        { namespace: "zoned", count: 1 },
        { namespace: "utc", count: 1 },
      ]),
    ).toBe("`plain`, `zoned`, and `utc`");
  });
});

// why-gmt.mdx states these as facts, so a data change that falsifies one must
// fail here rather than ship.
describe("claims the why-gmt copy makes", () => {
  it("GMT's suite outnumbers every alternative's", () => {
    expect(gmtStats.tests).toBeGreaterThan(
      largestCompetitorSuite().stats.tests,
    );
  });

  it("`plain` and `zoned` are the two largest core namespaces", () => {
    expect(
      coreNamespaces
        .slice(0, 2)
        .map((row) => row.namespace)
        .sort(),
    ).toEqual(["plain", "zoned"]);
  });

  it("there is at least one industry layer beside the core", () => {
    expect(industryNamespaces.length).toBeGreaterThan(0);
    expect(coreNamespaces.length).toBeGreaterThan(0);
  });

  it("GMT's CI executions exceed every alternative's", () => {
    expect(gmtStats.executions).toBeGreaterThan(competitorExecutionRange().max);
  });
});

describe("competitor comparisons", () => {
  it("finds the alternative with the largest suite", () => {
    const tests = competitorComparisons.map((l) => l.stats.tests);
    expect(largestCompetitorSuite().stats.tests).toBe(Math.max(...tests));
  });

  it("spans the fewest to the most alternative executions", () => {
    const executions = competitorComparisons.map((l) => l.stats.executions);
    expect(competitorExecutionRange()).toEqual({
      min: Math.min(...executions),
      max: Math.max(...executions),
    });
  });

  // Expected ranges come from each library's entry in library-measurements.json: locale test
  // files 0 (@internationalized/date, Luxon, date-fns) to 139 (Moment.js), tz/DST test files
  // 0 (most) to 8 (Spacetime), Node versions 1 (date-fns, Day.js, @internationalized/date) to
  // 4 (Luxon). A new or re-measured library that moves a range must fail here, so the why-gmt
  // table is re-checked rather than silently changing.
  it.each`
    stat              | min  | max
    ${"locales"}      | ${0} | ${139}
    ${"timezones"}    | ${0} | ${8}
    ${"nodeVersions"} | ${1} | ${4}
  `(
    "spans $stat from $min to $max across the alternatives",
    ({ stat, min, max }) => {
      expect(competitorStatRange(stat)).toEqual({ min, max });
    },
  );

  it("rounds GMT's executions to a whole multiple", () => {
    expect(executionRatio(gmtStats.executions)).toBe(1);
    expect(Number.isInteger(executionRatio(3))).toBe(true);
  });
});

describe("formatCount", () => {
  it("groups thousands in the reader's locale", () => {
    expect(formatCount(374820)).toBe(
      new Intl.NumberFormat(undefined).format(374820),
    );
  });
});
