import {
  industriesSidebarSource,
  painPointItem,
  renderIndustryHubs,
  type HubIndustry,
  type HubInput,
  type HubSectionPage,
} from "./industry-pages";
import type { IndexedPage } from "./index-pages";

/** An industry that owns a namespace and draws on nothing. */
const WORKFORCE: HubIndustry = {
  id: "workforce",
  label: "Workforce",
  definition: "People's working time.",
  guide: "/guides/intervals/hours-of-work/",
  guideTitle: "Hours of Work",
  about: "Workforce is working time.",
  solves: [
    {
      problem: "A duty day is not midnight.",
      answer: "{{dutyDayFor}} reads the operator's day.",
      see: [{ label: "guide", href: "/guides/intervals/hours-of-work/" }],
    },
  ],
  namespace: "workforce",
  drawsOn: [],
};

/** An industry that owns a namespace and draws on another industry's whole namespace. */
const TRANSPORT: HubIndustry = {
  id: "transport",
  label: "Transport",
  definition: "Legs and dwell.",
  guide: "/guides/industries/transport-legs-and-dwell/",
  guideTitle: "Transport: Legs and Dwell",
  about: "Transport is moving goods.",
  solves: [
    {
      problem: "A hold-up is hours, not days.",
      answer:
        "{{dwellTime}} counts both, and {{dutyDayFor}} reads a driver's day.",
      see: [],
    },
  ],
  namespace: "transport",
  drawsOn: ["workforce"],
};

/** An industry that owns one namespace and draws on a Core namespace. */
const GNSS: HubIndustry = {
  id: "gnss",
  label: "GNSS",
  definition: "Satellite time.",
  guide: "/guides/industries/gnss-x/",
  guideTitle: "GNSS: X",
  about: "GNSS is satellites.",
  solves: [
    {
      problem: "A week repeats.",
      answer:
        "{{gnssWeekToUtc}} takes the era, and {{toTAI}} carries a leap second.",
      see: [],
    },
  ],
  namespace: "gnss",
  drawsOn: ["timescale"],
};

/** An industry that owns no namespace and draws on a whole layer and one sub-module. */
const MARITIME: HubIndustry = {
  id: "maritime",
  label: "Maritime",
  definition: "Ships and their clocks.",
  guide: "/guides/industries/maritime-x/",
  guideTitle: "Maritime: X",
  about: "Maritime is ships.",
  solves: [
    {
      problem: "A receiver's date is early.",
      answer: "{{gnssWeekToUtc}} reads the week, and {{toTAI}} the second.",
      see: [],
    },
  ],
  drawsOn: ["gnss", "timescale/convert"],
};

const fn = (namespace: string, module: string, name: string): IndexedPage => ({
  namespace,
  module,
  name,
  url: `/reference/${namespace}/${module}/${name}`,
  description: `The ${name} function. It has a second sentence.`,
});

const PAGES: IndexedPage[] = [
  fn("workforce", "calculate", "dutyDayFor"),
  fn("workforce", "validate", "isValidDutyLog"),
  fn("transport", "calculate", "dwellTime"),
  fn("gnss", "convert", "gnssWeekToUtc"),
  fn("timescale", "convert", "toTAI"),
  fn("timescale", "convert", "fromTAI"),
  fn("timescale", "calculate", "taiMinusUtc"),
  fn("plain", "calculate", "addDays"),
];

const section = (
  kind: HubSectionPage["section"],
  slug: string,
  title: string,
  industries: string[],
  description = "",
): HubSectionPage => ({
  section: kind,
  slug,
  title,
  description,
  industries,
});

const SECTION_PAGES: HubSectionPage[] = [
  section(
    "tools",
    "dwell-ledger",
    "Dwell Ledger",
    ["transport"],
    "Count dwell.",
  ),
  section("tools", "zone-planner", "Zone Planner", ["core"], "A core tool."),
  section(
    "tools",
    "crossing-clock",
    "Crossing Clock",
    ["transport", "maritime"],
    "Time a crossing.",
  ),
  section(
    "guides",
    "industries/transport-legs-and-dwell",
    "Transport: Legs and Dwell",
    ["transport"],
    "Legs.",
  ),
  section(
    "scenarios",
    "transit-across-dst",
    "A Rail Leg Across Spring-Forward",
    ["transport"],
  ),
  section("mistakes", "transport", "Transport", ["transport"], "Mistakes."),
];

const INPUT: HubInput = {
  industries: [WORKFORCE, TRANSPORT, GNSS, MARITIME],
  pages: PAGES,
  sectionPages: SECTION_PAGES,
};

function hub(id: string, input: HubInput = INPUT): string {
  const file = renderIndustryHubs(input).find((f) => f.file === `${id}.mdx`);
  expect(file, `${id}.mdx`).toBeDefined();
  return file!.mdx;
}

/** The body of a page: its lines after the frontmatter, blank lines dropped. */
const body = (mdx: string): string[] =>
  mdx
    .slice(mdx.indexOf("\n---\n", 3) + 5)
    .split("\n")
    .filter((l) => l !== "");

const headings = (mdx: string): string[] =>
  body(mdx).filter((l) => /^#{2,3} /.test(l));

describe("renderIndustryHubs", () => {
  it("writes the index first, then one page per industry in declared order", () => {
    expect(renderIndustryHubs(INPUT).map((f) => f.file)).toEqual([
      "index.mdx",
      "workforce.mdx",
      "transport.mdx",
      "gnss.mdx",
      "maritime.mdx",
    ]);
  });

  it("opens a hub with the industry's tag, title and definition in block frontmatter", () => {
    expect(hub("transport").split("\n").slice(0, 7)).toEqual([
      "---",
      'title: "Transport"',
      'description: "Legs and dwell."',
      "industries: [transport]",
      "sidebar:",
      "  order: 0",
      "---",
    ]);
  });

  it("orders a hub: what it is, what it solves, the guide, its own functions, what it draws on, then the pages that carry its tag", () => {
    const lines = body(hub("transport"));
    expect(lines[0]).toBe("Transport is moving goods.");
    expect(headings(hub("transport"))).toEqual([
      "## What these functions solve",
      "## Its own functions",
      "### [`transport`](/reference/transport)",
      "## Functions it draws on",
      "### [`workforce`](/reference/workforce)",
      "## Guides",
      "## Tools",
      "## Scenarios",
      "## Mistakes",
    ]);
    const solve = lines.indexOf("## What these functions solve");
    const guide = lines.findIndex((l) => l.startsWith("Start with the guide"));
    expect(guide).toBeGreaterThan(solve);
    expect(guide).toBeLessThan(lines.indexOf("## Its own functions"));
    expect(lines[guide]).toBe(
      "Start with the guide: [Transport: Legs and Dwell](/guides/industries/transport-legs-and-dwell/).",
    );
  });

  it("links each token of a pain point to its function, and lists the pages that show it", () => {
    expect(body(hub("workforce"))).toContain(
      "- **A duty day is not midnight.** [`dutyDayFor`](/reference/workforce/calculate/dutyDayFor) reads the operator's day. See [guide](/guides/intervals/hours-of-work/).",
    );
  });

  it("lets a token name a function of a layer the industry draws on", () => {
    expect(body(hub("transport"))).toContain(
      "- **A hold-up is hours, not days.** [`dwellTime`](/reference/transport/calculate/dwellTime) counts both, and [`dutyDayFor`](/reference/workforce/calculate/dutyDayFor) reads a driver's day.",
    );
  });

  it("lists an industry's own functions under its module, each with its first sentence", () => {
    const lines = body(hub("workforce"));
    const own = lines.slice(lines.indexOf("## Its own functions"));
    expect(own.slice(0, 6)).toEqual([
      "## Its own functions",
      "### [`workforce`](/reference/workforce)",
      "**[calculate](/reference/workforce/calculate)**",
      "- [`dutyDayFor`](/reference/workforce/calculate/dutyDayFor): The dutyDayFor function.",
      "**[validate](/reference/workforce/validate)**",
      "- [`isValidDutyLog`](/reference/workforce/validate/isValidDutyLog): The isValidDutyLog function.",
    ]);
  });

  it("follows the heading of a shared industry layer with a line that links its hub", () => {
    const lines = body(hub("transport"));
    const at = lines.indexOf("### [`workforce`](/reference/workforce)");
    expect(lines[at + 1]).toBe(
      "Part of the [Workforce](/industries/workforce/) industry layer.",
    );
  });

  it("adds no such line under a Core namespace", () => {
    expect(hub("gnss")).not.toContain("industry layer.");
    const lines = body(hub("gnss"));
    const at = lines.indexOf("### [`timescale`](/reference/timescale)");
    expect(at).toBeGreaterThan(-1);
    expect(lines[at + 1]).toBe(
      "**[calculate](/reference/timescale/calculate)**",
    );
  });

  it("lists only a sub-module's own functions under its heading", () => {
    const lines = body(hub("maritime"));
    const at = lines.indexOf(
      "### [`timescale/convert`](/reference/timescale/convert)",
    );
    expect(at).toBeGreaterThan(-1);
    expect(lines.slice(at + 1, at + 4)).toEqual([
      "**[convert](/reference/timescale/convert)**",
      "- [`fromTAI`](/reference/timescale/convert/fromTAI): The fromTAI function.",
      "- [`toTAI`](/reference/timescale/convert/toTAI): The toTAI function.",
    ]);
    expect(hub("maritime")).not.toContain("taiMinusUtc");
  });

  it("lists a whole drawn-on namespace by module, a sub-module beside it by itself, for an industry that owns no namespace", () => {
    expect(headings(hub("maritime"))).toEqual([
      "## What these functions solve",
      "## Functions it draws on",
      "### [`gnss`](/reference/gnss)",
      "### [`timescale/convert`](/reference/timescale/convert)",
      "## Tools",
    ]);
    expect(hub("maritime")).not.toContain("## Its own functions");
    expect(hub("maritime")).toContain(
      "Part of the [GNSS](/industries/gnss/) industry layer.",
    );
  });

  it("leaves out the section of an industry that draws on nothing, and an empty page section", () => {
    const workforce = headings(hub("workforce"));
    expect(workforce).not.toContain("## Functions it draws on");
    expect(workforce).not.toContain("## Guides");
    expect(workforce).not.toContain("## Tools");
    expect(workforce).not.toContain("## Scenarios");
    expect(workforce).not.toContain("## Mistakes");
  });

  it("lists every page whose tag holds the industry, by title, with its description", () => {
    const lines = body(hub("transport"));
    const tools = lines.slice(lines.indexOf("## Tools") + 1);
    expect(tools.slice(0, 2)).toEqual([
      "- [Crossing Clock](/tools/crossing-clock/): Time a crossing.",
      "- [Dwell Ledger](/tools/dwell-ledger/): Count dwell.",
    ]);
    expect(lines).toContain(
      "- [Transport: Legs and Dwell](/guides/industries/transport-legs-and-dwell/): Legs.",
    );
    // A page with no description is a bare link.
    expect(lines).toContain(
      "- [A Rail Leg Across Spring-Forward](/scenarios/transit-across-dst/)",
    );
    // A page of another industry is not here.
    expect(hub("transport")).not.toContain("Zone Planner");
  });

  it("lists a page under every industry its tag holds", () => {
    expect(hub("maritime")).toContain(
      "[Crossing Clock](/tools/crossing-clock/)",
    );
    expect(hub("transport")).toContain(
      "[Crossing Clock](/tools/crossing-clock/)",
    );
  });

  it("is plain Markdown: no import, no component", () => {
    for (const { mdx } of renderIndustryHubs(INPUT)) {
      expect(mdx).not.toMatch(/^import /m);
      expect(mdx).not.toMatch(/<[A-Z]/);
    }
  });

  it("stops when a pain point names a function outside the industry's own namespace and the modules it draws on", () => {
    const outside: HubIndustry = {
      ...WORKFORCE,
      solves: [
        { problem: "Nothing.", answer: "{{dwellTime}} is not here.", see: [] },
      ],
    };
    expect(() =>
      renderIndustryHubs({ ...INPUT, industries: [outside] }),
    ).toThrow(
      /the workforce overview names dwellTime.*src\/lib\/industry-overview\.ts/,
    );
  });

  it("stops on a function of a sub-module the industry does not draw on", () => {
    const wrongModule: HubIndustry = {
      ...MARITIME,
      solves: [
        {
          problem: "A second.",
          answer: "{{taiMinusUtc}} is in another module.",
          see: [],
        },
      ],
    };
    expect(() =>
      renderIndustryHubs({ ...INPUT, industries: [wrongModule] }),
    ).toThrow(/names taiMinusUtc/);
  });
});

describe("painPointItem", () => {
  it("ends a pain point with the pages that show it, and none when it has none", () => {
    expect(
      painPointItem({ id: "x" }, { problem: "P.", answer: "A.", see: [] }, []),
    ).toBe("- **P.** A.");
  });
});

describe("the index of the hubs", () => {
  const index = () =>
    renderIndustryHubs(INPUT).find((f) => f.file === "index.mdx")!.mdx;

  it("lists every industry, with the namespace it owns and the modules it draws on", () => {
    expect(body(index()).slice(1)).toEqual([
      "- [Workforce](/industries/workforce/): People's working time. Its namespace is [`workforce`](/reference/workforce).",
      "- [Transport](/industries/transport/): Legs and dwell. Its namespace is [`transport`](/reference/transport). Draws on [`workforce`](/reference/workforce).",
      "- [GNSS](/industries/gnss/): Satellite time. Its namespace is [`gnss`](/reference/gnss). Draws on [`timescale`](/reference/timescale).",
      "- [Maritime](/industries/maritime/): Ships and their clocks. Draws on [`gnss`](/reference/gnss) and [`timescale/convert`](/reference/timescale/convert).",
    ]);
  });

  it("is titled `By industry`, carries no tag and holds still under ensure-sidebar-order", () => {
    expect(index().split("\n").slice(0, 5)).toEqual([
      "---",
      'title: "By industry"',
      expect.stringMatching(/^description: /),
      "sidebar:",
      "  order: 0",
    ]);
    expect(index()).not.toContain("industries: [");
  });
});

describe("industriesSidebarSource", () => {
  const source = industriesSidebarSource(INPUT.industries);

  it("writes the overview first, then one link per industry in declared order", () => {
    const entries = source
      .split("\n")
      .filter((l) => l.startsWith("  {"))
      .map((l) => JSON.parse(l.trim().replace(/,$/, "")));
    expect(entries).toEqual([
      { label: "Overview", slug: "industries" },
      ...INPUT.industries.map(({ id, label }) => ({
        label,
        slug: `industries/${id}`,
        attrs: { "data-gmt-industry-link": id },
      })),
    ]);
  });

  it("marks each link with `data-gmt-industry-link` and never `data-gmt-industry`", () => {
    expect(source.match(/data-gmt-industry-link/g)).toHaveLength(4);
    // The group-icon rule keys on `data-gmt-industry`: a link carrying it would paint the
    // Industries group's own summary.
    expect(source.replace(/data-gmt-industry-link/g, "")).not.toContain(
      "data-gmt-industry",
    );
  });

  it("exports the group's items under the name astro.config.mjs imports", () => {
    expect(source).toContain(
      "export const industriesSidebar: SidebarItem[] = [",
    );
    expect(source.startsWith("// GENERATED FILE — do not edit by hand.")).toBe(
      true,
    );
  });
});
