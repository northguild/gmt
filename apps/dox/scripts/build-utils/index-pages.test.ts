import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  firstSentence,
  renderIndexPages,
  type IndexedIndustry,
  type IndexInput,
} from "./index-pages";

const INPUT: IndexInput = {
  pages: [
    {
      namespace: "transport",
      module: "calculate",
      name: "dwellTime",
      url: "/reference/transport/calculate/dwellTime",
      description: "Measure how long something sat. It counts local days.",
    },
    {
      namespace: "transport",
      module: "calculate",
      name: "cutoffAt",
      url: "/reference/transport/calculate/cutoffAt",
      description: "",
    },
    {
      namespace: "transport",
      module: "compare",
      name: "isLate",
      url: "/reference/transport/compare/isLate",
      description: "True when `a < b`.",
    },
    {
      namespace: "regex",
      module: "date",
      name: "year",
      url: "/reference/regex/date/year",
      description: "Four digits",
    },
  ],
  sharedTypes: [
    {
      name: "Interval",
      url: "/reference/types/Interval",
      description: "A span between two instants. Half-open.",
    },
    {
      name: "BusinessCalendar",
      url: "/reference/types/BusinessCalendar",
      description: "",
    },
  ],
  inlineTypes: [
    {
      name: "Dwell",
      url: "/reference/transport/calculate/dwellTime#dwell",
      description: "What `dwellTime` returns: elapsed time.",
      namespace: "transport",
      module: "calculate",
    },
  ],
};

function pageAt(route: string, input: IndexInput = INPUT) {
  const page = renderIndexPages(input).find((p) => p.route === route);
  expect(page, `index page ${route}`).toBeDefined();
  return page!;
}

/** The body of an index page: its lines after the frontmatter, blank lines dropped. */
function body(mdx: string): string[] {
  return mdx
    .slice(mdx.indexOf("\n---\n", 3) + 5)
    .split("\n")
    .filter((l) => l !== "");
}

describe("firstSentence", () => {
  it.each`
    description                                        | sentence
    ${"Add a day. Returns a string."}                  | ${"Add a day."}
    ${"Add a day."}                                    | ${"Add a day."}
    ${"Four digits"}                                   | ${"Four digits"}
    ${""}                                              | ${""}
    ${"Is it late? Returns a boolean."}                | ${"Is it late?"}
    ${"Uses ISO 8601.1 numbering, 1 to 7. Then more."} | ${"Uses ISO 8601.1 numbering, 1 to 7."}
    ${"Accepts a unit, e.g. `day`. Then more."}        | ${"Accepts a unit, e.g. `day`."}
    ${"Reads `a. b` as one token. Then more."}         | ${"Reads `a. b` as one token."}
    ${"Wrapped over\ntwo lines. Then more."}           | ${"Wrapped over two lines."}
  `("reads $sentence from $description", ({ description, sentence }) => {
    expect(firstSentence(description)).toBe(sentence);
  });
});

describe("renderIndexPages", () => {
  it("emits the root, the types section, each namespace and each module, and nothing else", () => {
    expect(renderIndexPages(INPUT).map((p) => [p.route, p.file])).toEqual([
      ["/reference", "index.mdx"],
      ["/reference/types", "types/index.mdx"],
      ["/reference/regex", "regex/index.mdx"],
      ["/reference/regex/date", "regex/date/index.mdx"],
      ["/reference/transport", "transport/index.mdx"],
      ["/reference/transport/calculate", "transport/calculate/index.mdx"],
      ["/reference/transport/compare", "transport/compare/index.mdx"],
    ]);
  });

  it("writes the slug and the block form of sidebar order in the frontmatter", () => {
    const { mdx } = pageAt("/reference/transport/calculate");
    expect(mdx.split("\n").slice(0, 9)).toEqual([
      "---",
      'title: "transport/calculate"',
      'description: "The calculate module of the transport namespace of @northguild/gmt."',
      'slug: "reference/transport/calculate"',
      "editUrl: false",
      "sidebar:",
      "  order: 0",
      "---",
      "",
    ]);
    for (const page of renderIndexPages(INPUT)) {
      expect(page.mdx, page.route).toContain(
        `slug: ${JSON.stringify(page.route.slice(1))}\neditUrl: false\nsidebar:\n  order: 0\n---\n`,
      );
      expect(page.mdx, page.route).not.toContain("sidebar: {");
    }
  });

  it("lists the namespaces on the root page as bare links, with a link to Types", () => {
    expect(body(pageAt("/reference").mdx)).toEqual([
      "## For any industry",
      "These namespaces work in any industry. Each is named for the kind of value it works on.",
      "- [`regex`](/reference/regex)",
      "- [`transport`](/reference/transport)",
      "## Types",
      "- [Types](/reference/types)",
    ]);
  });

  it("lists the shared types, then the types documented with their function, linked to their anchors", () => {
    expect(body(pageAt("/reference/types").mdx)).toEqual([
      "## Shared types",
      // No description: the bare link, with nothing put in its place.
      "- [`BusinessCalendar`](/reference/types/BusinessCalendar)",
      "- [`Interval`](/reference/types/Interval): A span between two instants.",
      "## Documented with their function",
      "- [`Dwell`](/reference/transport/calculate/dwellTime#dwell): What `dwellTime` returns: elapsed time.",
    ]);
  });

  it("lists a namespace's modules, each with its functions and regexes, alphabetical", () => {
    expect(body(pageAt("/reference/transport").mdx)).toEqual([
      "## [calculate](/reference/transport/calculate)",
      "- [`cutoffAt`](/reference/transport/calculate/cutoffAt)",
      "- [`dwellTime`](/reference/transport/calculate/dwellTime): Measure how long something sat.",
      "## [compare](/reference/transport/compare)",
      "- [`isLate`](/reference/transport/compare/isLate): True when `a < b`.",
    ]);
  });

  it("lists a module's pages, and the inline types those pages hold", () => {
    expect(body(pageAt("/reference/transport/calculate").mdx)).toEqual([
      "- [`cutoffAt`](/reference/transport/calculate/cutoffAt)",
      "- [`dwellTime`](/reference/transport/calculate/dwellTime): Measure how long something sat.",
      "## Types",
      "- [`Dwell`](/reference/transport/calculate/dwellTime#dwell): What `dwellTime` returns: elapsed time.",
    ]);
    expect(body(pageAt("/reference/transport/compare").mdx)).toEqual([
      "- [`isLate`](/reference/transport/compare/isLate): True when `a < b`.",
    ]);
  });

  it("links root-absolute everywhere: a relative link would resolve under the index's own path", () => {
    for (const page of renderIndexPages(INPUT)) {
      for (const [, url] of page.mdx.matchAll(/\]\(([^)]+)\)/g)) {
        expect(url, page.route).toMatch(/^\/reference(\/|$)/);
      }
    }
  });

  it("makes a summary safe for MDX outside its code spans", () => {
    const { mdx } = pageAt("/reference/types", {
      pages: [],
      sharedTypes: [
        {
          name: "Disambiguation",
          url: "/reference/types/Disambiguation",
          description: "used like from(item, { disambiguation }) when `a < b`",
        },
      ],
      inlineTypes: [],
    });
    expect(mdx).toContain(
      "used like from(item, &#123; disambiguation &#125;) when `a < b`",
    );
  });

  it("emits no types section when there is no type, and no namespace index without a page", () => {
    const routes = renderIndexPages({
      pages: [INPUT.pages[3]],
      sharedTypes: [],
      inlineTypes: [],
    }).map((p) => p.route);
    expect(routes).toEqual([
      "/reference",
      "/reference/regex",
      "/reference/regex/date",
    ]);
    expect(
      pageAt("/reference", {
        pages: [INPUT.pages[3]],
        sharedTypes: [],
        inlineTypes: [],
      }).mdx,
    ).not.toContain("Types");
  });
});

describe("ensure-sidebar-order.mjs on the generated form", () => {
  it("changes nothing in a generated index page, and would rewrite the inline form every run", () => {
    // Run the real script's rule on real files: it only ever touches src/content/docs, so
    // the function is lifted out of it and run on a scratch copy.
    const script = readFileSync(
      join(import.meta.dirname, "..", "ensure-sidebar-order.mjs"),
      "utf8",
    );
    const fn = script.slice(script.indexOf("function ensureOrder0"));
    const dir = mkdtempSync(join(tmpdir(), "dox-index-"));
    try {
      const runner = join(dir, "run.mjs");
      writeFileSync(
        runner,
        `${fn}\nimport { readFileSync } from "node:fs";\nconst input = readFileSync(process.argv[2], "utf8");\nprocess.stdout.write(ensureOrder0(input));\n`,
      );
      const run = (mdx: string) => {
        const file = join(dir, "page.mdx");
        writeFileSync(file, mdx);
        return execFileSync(process.execPath, [runner, file], {
          encoding: "utf8",
        });
      };
      const generated = pageAt("/reference/types").mdx;
      expect(run(generated)).toBe(generated);

      const inline = generated.replace(
        "sidebar:\n  order: 0",
        "sidebar: { order: 0 }",
      );
      const once = run(inline);
      expect(once).not.toBe(inline);
      expect(run(once)).not.toBe(once);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Industry namespaces
// ---------------------------------------------------------------------------

/** An industry that owns a namespace and draws on nothing. */
const WORKFORCE: IndexedIndustry = {
  id: "workforce",
  label: "Workforce",
  definition: "People's working time",
  icon: "industry-workforce",
  namespace: "workforce",
  drawsOn: [],
};

/** An industry that owns a namespace and draws on another industry's. */
const TRANSPORT: IndexedIndustry = {
  id: "transport",
  label: "Transport",
  definition: "Legs and dwell.",
  icon: "industry-transport",
  namespace: "transport",
  drawsOn: ["workforce"],
};

/** A layer other industries draw on, which draws on a Core namespace. */
const GNSS: IndexedIndustry = {
  id: "gnss",
  label: "GNSS",
  definition: "Satellite time.",
  icon: "industry-gnss",
  namespace: "gnss",
  drawsOn: ["timescale"],
};

/** An industry that owns no namespace and draws on a whole layer and one sub-module. */
const MARITIME: IndexedIndustry = {
  id: "maritime",
  label: "Maritime",
  definition: "Laytime and tides.",
  icon: "industry-maritime",
  drawsOn: ["gnss", "timescale/convert", "workforce"],
};

const page = (namespace: string, module: string, name: string) => ({
  namespace,
  module,
  name,
  url: `/reference/${namespace}/${module}/${name}`,
  description: `The ${name} function.`,
});

const WITH_INDUSTRIES: IndexInput = {
  ...INPUT,
  pages: [
    ...INPUT.pages,
    page("workforce", "calculate", "dutyDayFor"),
    page("gnss", "convert", "gnssWeekToUtc"),
    page("timescale", "convert", "toTAI"),
  ],
  industries: [WORKFORCE, TRANSPORT, GNSS, MARITIME],
};

describe("renderIndexPages with industries", () => {
  it("splits the root page into the namespaces no industry owns and `By industry`, each industry with its icon, hub, definition, namespace and the modules it draws on", () => {
    expect(body(pageAt("/reference", WITH_INDUSTRIES).mdx)).toEqual([
      'import Icon from "../../../components/Icon.astro";',
      "## For any industry",
      "These namespaces work in any industry. Each is named for the kind of value it works on.",
      "- [`regex`](/reference/regex)",
      "- [`timescale`](/reference/timescale)",
      "## By industry",
      "Each industry has a namespace of its own, draws on the layers above it, or both.",
      '- <Icon name="industry-workforce" size="1.1em" class="gmt-ref-industry-icon" /> [Workforce](/industries/workforce/): People\'s working time. Its namespace is [`workforce`](/reference/workforce).',
      '- <Icon name="industry-transport" size="1.1em" class="gmt-ref-industry-icon" /> [Transport](/industries/transport/): Legs and dwell. Its namespace is [`transport`](/reference/transport). Draws on [`workforce`](/reference/workforce).',
      '- <Icon name="industry-gnss" size="1.1em" class="gmt-ref-industry-icon" /> [GNSS](/industries/gnss/): Satellite time. Its namespace is [`gnss`](/reference/gnss). Draws on [`timescale`](/reference/timescale).',
      '- <Icon name="industry-maritime" size="1.1em" class="gmt-ref-industry-icon" /> [Maritime](/industries/maritime/): Laytime and tides. Draws on [`gnss`](/reference/gnss), [`timescale/convert`](/reference/timescale/convert), and [`workforce`](/reference/workforce).',
      "## Types",
      "- [Types](/reference/types)",
    ]);
  });

  it("lists an industry that owns no namespace, and names no namespace for it", () => {
    const only: IndexInput = { ...INPUT, industries: [MARITIME] };
    const line = body(pageAt("/reference", only).mdx).find((l) =>
      l.includes("Maritime"),
    );
    expect(line).toBeDefined();
    expect(line).not.toContain("Its namespace");
  });

  it("keeps a namespace an industry only draws on among the general ones, and a namespace it owns out of them", () => {
    const root = body(pageAt("/reference", WITH_INDUSTRIES).mdx);
    const forAnyIndustry = root.slice(
      root.indexOf("## For any industry") + 1,
      root.indexOf("## By industry"),
    );
    expect(forAnyIndustry).toContain("- [`timescale`](/reference/timescale)");
    expect(forAnyIndustry).not.toContain(
      "- [`workforce`](/reference/workforce)",
    );
    expect(forAnyIndustry).not.toContain("- [`gnss`](/reference/gnss)");
  });

  it("has no `By industry` section, and no icon import, when no industry is declared", () => {
    const mdx = pageAt("/reference").mdx;
    expect(mdx).not.toContain("By industry");
    expect(mdx).not.toContain("import");
  });

  it("tags the overview, the function-module indexes and nothing else with the industry that owns the namespace", () => {
    const tagged = renderIndexPages(WITH_INDUSTRIES)
      .filter((p) => /^industries: \[/m.test(p.mdx))
      .map((p) => [p.route, p.mdx.match(/^industries: \[(\w+)\]$/m)?.[1]]);
    expect(tagged).toEqual([
      ["/reference/gnss", "gnss"],
      ["/reference/gnss/convert", "gnss"],
      ["/reference/transport", "transport"],
      ["/reference/transport/calculate", "transport"],
      ["/reference/transport/compare", "transport"],
      ["/reference/workforce", "workforce"],
      ["/reference/workforce/calculate", "workforce"],
    ]);
  });

  it("puts the tag in the block frontmatter before `sidebar`, so ensure-sidebar-order leaves it alone", () => {
    const { mdx } = pageAt("/reference/transport", WITH_INDUSTRIES);
    expect(mdx).toContain(
      'slug: "reference/transport"\neditUrl: false\nindustries: [transport]\nsidebar:\n  order: 0\n---\n',
    );
  });

  it("opens an industry's own namespace with one line that points at its hub, above the module lists", () => {
    const lines = body(pageAt("/reference/transport", WITH_INDUSTRIES).mdx);
    expect(lines.slice(0, 2)).toEqual([
      "The Transport industry's own namespace. What it solves, and the guides and tools that show it, are on [Transport](/industries/transport/).",
      "## [calculate](/reference/transport/calculate)",
    ]);
  });

  it("no longer carries the industry's pain points: they live on its hub", () => {
    const { mdx } = pageAt("/reference/transport", WITH_INDUSTRIES);
    expect(mdx).not.toContain("What these functions solve");
    expect(mdx).not.toContain("Start with the guide");
  });

  it("leaves a general namespace overview as it was", () => {
    expect(pageAt("/reference/regex", WITH_INDUSTRIES).mdx).toBe(
      pageAt("/reference/regex").mdx,
    );
    expect(pageAt("/reference/timescale", WITH_INDUSTRIES).mdx).not.toContain(
      "industries:",
    );
  });
});
