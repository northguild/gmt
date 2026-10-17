import { INDUSTRY_TAG_IDS } from "../../src/lib/industry-tags";
import {
  industrySidebarEntries,
  industrySidebarSource,
  readSectionPage,
} from "./industry-sidebar";

const page = (slug: string, title: string, industries: string[]) => ({
  slug,
  title,
  description: "",
  industries,
});

const pages = [
  page("zone-planner", "Zone Planner", ["core"]),
  page("dwell-ledger", "Dwell Ledger", ["transport"]),
  page("demurrage-clock", "Demurrage Clock", ["intermodal"]),
  page("converter-bench", "Converter Bench", ["core"]),
  page("bl-date-stamp", "B/L Date Stamp", ["intermodal"]),
  page("duty-planner", "Duty Planner", ["workforce"]),
];

const divider = (section: string, id: string, label: string) => ({
  label,
  link: `#${section}-${id}`,
  attrs: { "data-gmt-divider": "true", "data-gmt-industry": id },
});

describe("industrySidebarEntries", () => {
  it("puts the index first, then each industry's divider and its pages by title, an industry after the ones it builds on", () => {
    expect(industrySidebarEntries("tools", pages)).toEqual([
      { slug: "tools" },
      divider("tools", "core", "Core"),
      { slug: "tools/converter-bench" },
      { slug: "tools/zone-planner" },
      divider("tools", "workforce", "Workforce"),
      { slug: "tools/duty-planner" },
      divider("tools", "transport", "Transport"),
      { slug: "tools/dwell-ledger" },
      divider("tools", "intermodal", "Intermodal"),
      { slug: "tools/bl-date-stamp" },
      { slug: "tools/demurrage-clock" },
    ]);
  });

  it("follows the tag order, so the menu matches the tools index", () => {
    const ids = industrySidebarEntries("tools", pages).flatMap((entry) =>
      "attrs" in entry ? [entry.attrs["data-gmt-industry"]] : [],
    );
    expect(ids).toEqual(INDUSTRY_TAG_IDS.filter((id) => ids.includes(id)));
  });

  it("names each divider by its section, so two sections never share an id", () => {
    const links = (section: string) =>
      industrySidebarEntries(section, pages).flatMap((entry) =>
        "link" in entry ? [entry.link] : [],
      );
    const scenarios = links("scenarios");
    expect(scenarios).toEqual([
      "#scenarios-core",
      "#scenarios-workforce",
      "#scenarios-transport",
      "#scenarios-intermodal",
    ]);
    expect(scenarios.some((link) => links("mistakes").includes(link))).toBe(
      false,
    );
  });

  it("leaves out an industry with no pages", () => {
    const entries = industrySidebarEntries(
      "mistakes",
      pages.filter((p) => !p.industries.includes("transport")),
    );
    expect(entries).not.toContainEqual(
      divider("mistakes", "transport", "Transport"),
    );
  });

  it("names a nested section's dividers without a slash and links its pages under the folder", () => {
    const entries = industrySidebarEntries("guides/industries", [
      page("transport-legs", "Transport: Legs", ["transport"]),
    ]);
    expect(entries).toContainEqual({ slug: "guides/industries" });
    expect(entries).toContainEqual({
      label: "Transport",
      link: "#guides-industries-transport",
      attrs: { "data-gmt-divider": "true", "data-gmt-industry": "transport" },
    });
    expect(entries).toContainEqual({
      slug: "guides/industries/transport-legs",
    });
  });

  it("lists a page under every industry it carries", () => {
    const shared = [page("both", "Both", ["transport", "intermodal"])];
    const hits = industrySidebarEntries("scenarios", shared).filter(
      (e) => "slug" in e && e.slug === "scenarios/both",
    );
    expect(hits).toHaveLength(2);
  });
});

describe("industrySidebarSource", () => {
  it("writes a module that exports the entries under the given name", () => {
    const source = industrySidebarSource(
      "scenariosSidebar",
      "scenarios",
      pages,
    );
    expect(source).toContain(
      "export const scenariosSidebar: SidebarItem[] = [",
    );
    expect(source).toContain('  {"slug":"scenarios"},');
    expect(source).toContain(
      '  {"label":"Intermodal","link":"#scenarios-intermodal","attrs":{"data-gmt-divider":"true","data-gmt-industry":"intermodal"}},',
    );
  });
});

describe("readSectionPage", () => {
  it("reads the title and industries, with or without quotes", () => {
    const page = readSectionPage(
      "a-b-l",
      '---\ntitle: "A B/L Dated a Day Late"\ndescription: x\nindustries: [intermodal]\n---\nbody',
    );
    expect(page).toEqual({
      slug: "a-b-l",
      title: "A B/L Dated a Day Late",
      description: "x",
      industries: ["intermodal"],
    });
    expect(
      readSectionPage(
        "x",
        "---\ntitle: 'Quoted'\nindustries: [core, transport]\n---\n",
      ),
    ).toEqual({
      slug: "x",
      title: "Quoted",
      description: "",
      industries: ["core", "transport"],
    });
  });

  it("reads a description written as a folded block, and a quoted one", () => {
    expect(
      readSectionPage(
        "folded",
        "---\ntitle: F\ndescription: >\n  First line\n  second line.\nindustries: [core]\n---\n",
      ).description,
    ).toBe("First line second line.");
    expect(
      readSectionPage(
        "quoted",
        '---\ntitle: Q\ndescription: "A: quoted"\nindustries: [core]\n---\n',
      ).description,
    ).toBe("A: quoted");
  });

  it("stops on a page with no industries", () => {
    expect(() =>
      readSectionPage("orphan", "---\ntitle: Orphan\n---\n"),
    ).toThrow(/orphan\.mdx has no `industries`/);
  });
});
