import { INDUSTRY_TAG_IDS } from "../../src/lib/industry-tags";
import {
  industrySidebarEntries,
  industrySidebarSource,
  readSectionPage,
} from "./industry-sidebar";

const pages = [
  { slug: "zone-planner", title: "Zone Planner", industries: ["core"] },
  { slug: "dwell-ledger", title: "Dwell Ledger", industries: ["transport"] },
  { slug: "demurrage-clock", title: "Demurrage Clock", industries: ["intermodal"] },
  { slug: "converter-bench", title: "Converter Bench", industries: ["core"] },
  { slug: "bl-date-stamp", title: "B/L Date Stamp", industries: ["intermodal"] },
];

const divider = (section: string, id: string, label: string) => ({
  label,
  link: `#${section}-${id}`,
  attrs: { "data-gmt-divider": "true", "data-gmt-industry": id },
});

describe("industrySidebarEntries", () => {
  it("puts the index first, then each industry's divider and its pages by title", () => {
    expect(industrySidebarEntries("tools", pages)).toEqual([
      { slug: "tools" },
      divider("tools", "core", "Core"),
      { slug: "tools/converter-bench" },
      { slug: "tools/zone-planner" },
      divider("tools", "intermodal", "Intermodal"),
      { slug: "tools/bl-date-stamp" },
      { slug: "tools/demurrage-clock" },
      divider("tools", "transport", "Transport"),
      { slug: "tools/dwell-ledger" },
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
    expect(scenarios).toEqual(["#scenarios-core", "#scenarios-intermodal", "#scenarios-transport"]);
    expect(scenarios.some((link) => links("mistakes").includes(link))).toBe(false);
  });

  it("leaves out an industry with no pages", () => {
    const entries = industrySidebarEntries(
      "mistakes",
      pages.filter((p) => !p.industries.includes("transport")),
    );
    expect(entries).not.toContainEqual(divider("mistakes", "transport", "Transport"));
  });

  it("lists a page under every industry it carries", () => {
    const shared = [{ slug: "both", title: "Both", industries: ["transport", "intermodal"] }];
    const hits = industrySidebarEntries("scenarios", shared).filter(
      (e) => "slug" in e && e.slug === "scenarios/both",
    );
    expect(hits).toHaveLength(2);
  });
});

describe("industrySidebarSource", () => {
  it("writes a module that exports the entries under the given name", () => {
    const source = industrySidebarSource("scenariosSidebar", "scenarios", pages);
    expect(source).toContain("export const scenariosSidebar: SidebarItem[] = [");
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
    expect(page).toEqual({ slug: "a-b-l", title: "A B/L Dated a Day Late", industries: ["intermodal"] });
    expect(readSectionPage("x", "---\ntitle: 'Quoted'\nindustries: [core, transport]\n---\n")).toEqual({
      slug: "x",
      title: "Quoted",
      industries: ["core", "transport"],
    });
  });

  it("stops on a page with no industries", () => {
    expect(() => readSectionPage("orphan", "---\ntitle: Orphan\n---\n")).toThrow(
      /orphan\.mdx has no `industries`/,
    );
  });
});
