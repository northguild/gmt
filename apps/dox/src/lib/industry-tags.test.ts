/**
 * The industry tags on the tool, scenario, guide and mistake pages, and the declarations they
 * come from: every industry has a tag, every page has a tag, and a page's tags agree with the
 * functions it uses.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import corpus from "../generated/reference/gmt-corpus.json";
import declared from "../data/industries.json";
import {
  CORE_INDUSTRY,
  INDUSTRIES,
  INDUSTRY_ICON_PATHS,
  INDUSTRY_LAYER_IDS,
  INDUSTRY_TAG_IDS,
  OWN_NAMESPACES,
  RESERVED_INDUSTRY_IDS,
  drawsOn,
  industriesUsing,
  industryOwning,
  industrySidebarCss,
  industryTag,
  moduleCovers,
  ownNamespace,
} from "./industry-tags";

const DOCS_DIR = path.resolve(import.meta.dirname, "..", "content", "docs");

/** The sections whose pages carry a tag. An index page lists other pages and
 *  carries none. */
const TAGGED_SECTIONS = ["tools", "scenarios", "guides", "mistakes"];

/** Every namespace and `namespace/module` that exports a function, from the generated corpus. */
const functions = corpus.filter((entry) => entry.kind === "function");
const namespacesWithFunctions = new Set(functions.map((f) => f.namespace));
const modulesWithFunctions = new Set(
  functions.map((f) => `${f.namespace}/${f.module}`),
);

/**
 * What a page uses, as `[namespace, module]` pairs: the module of a reference page it links or of
 * a barrel it imports, and `[namespace, undefined]` for a link to a namespace's own index page or
 * an import of its barrel. The shared types (`/reference/types/…`) are no namespace's.
 */
export function usedModules(
  source: string,
): Array<[string, string | undefined]> {
  const used: Array<[string, string | undefined]> = [];
  for (const [, namespace, module] of source.matchAll(
    /\/reference\/([a-z]+)(?:\/([a-z]+))?(?=[/)"'#\s`]|$)/g,
  )) {
    if (namespace !== "types") used.push([namespace!, module]);
  }
  for (const [, namespace, module] of source.matchAll(
    /@northguild\/gmt\/([a-z]+)(?:\/([a-z]+))?"/g,
  )) {
    used.push([namespace!, module]);
  }
  return used;
}

/** The tags a page may carry: the industries that own or draw on what it uses, and `core` when it
 *  uses no industry's own namespace. */
export function allowedTags(
  used: ReadonlyArray<[string, string | undefined]>,
): string[] {
  const allowed = used.flatMap(([namespace, module]) => [
    ...industriesUsing(namespace, module),
  ]);
  const touchesOwn = used.some(([namespace]) =>
    OWN_NAMESPACES.includes(namespace),
  );
  return [...new Set([...allowed, ...(touchesOwn ? [] : [CORE_INDUSTRY])])];
}

const pages = TAGGED_SECTIONS.flatMap((section) =>
  (readdirSync(path.join(DOCS_DIR, section), { recursive: true }) as string[])
    .filter((file) => /\.mdx?$/.test(file) && !/(^|\/)index\.mdx?$/.test(file))
    .sort()
    .map((file) => {
      const source = readFileSync(path.join(DOCS_DIR, section, file), "utf8");
      const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
      const tagged = (frontmatter.match(/^industries:\s*\[(.*)\]$/m)?.[1] ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      return {
        page: `${section}/${file}`,
        declared: tagged,
        allowed: allowedTags(usedModules(source)),
      };
    }),
);

describe("industry declarations", () => {
  it("has a tag for core and for every declared industry, in declared order", () => {
    expect(INDUSTRY_TAG_IDS).toEqual([
      CORE_INDUSTRY,
      ...declared.map((industry) => industry.id),
    ]);
    expect(INDUSTRY_LAYER_IDS).toEqual(declared.map((industry) => industry.id));
    for (const id of INDUSTRY_TAG_IDS) {
      expect({ id, tag: industryTag(id) }).toEqual({
        id,
        tag: expect.objectContaining({ id }),
      });
    }
  });

  it("gives every tag a label, a definition and an icon that exists", () => {
    for (const id of INDUSTRY_TAG_IDS) {
      const tag = industryTag(id)!;
      expect(tag.label.length).toBeGreaterThan(0);
      expect(tag.definition.length).toBeGreaterThan(0);
      expect(Object.keys(INDUSTRY_ICON_PATHS)).toContain(tag.icon);
    }
  });

  it("reserves `core` and `space`, and no industry takes either", () => {
    expect(RESERVED_INDUSTRY_IDS).toEqual(["core", "space"]);
    for (const { id } of INDUSTRIES) {
      expect(RESERVED_INDUSTRY_IDS, id).not.toContain(id);
    }
  });

  it("knows no industry outside the list", () => {
    expect(industryTag("logistics")).toBeUndefined();
    expect(industryTag("toString")).toBeUndefined();
  });

  describe.each(
    INDUSTRIES.map((industry) => ({ ...industry, key: industry.id })),
  )("$id", (industry) => {
    it("has a lowercase one-word id that no other industry has", () => {
      expect(industry.id).toMatch(/^[a-z]+$/);
      expect(INDUSTRIES.filter((i) => i.id === industry.id)).toHaveLength(1);
    });

    it("owns a namespace named for it, or none", () => {
      if (industry.namespace !== undefined) {
        expect(industry.namespace).toBe(industry.id);
      }
      expect(ownNamespace(industry.id)).toBe(industry.namespace);
    });

    it("owns a namespace that exports a function", () => {
      if (industry.namespace === undefined) return;
      expect(namespacesWithFunctions.has(industry.namespace)).toBe(true);
    });

    it("declares the namespace named for it when that namespace exports a function", () => {
      if (!namespacesWithFunctions.has(industry.id)) return;
      expect(industry.namespace).toBe(industry.id);
    });

    it("draws on modules that exist, once each, and not on its own namespace", () => {
      const entries = [...drawsOn(industry.id)];
      expect(new Set(entries).size).toBe(entries.length);
      for (const entry of entries) {
        const exists = entry.includes("/")
          ? modulesWithFunctions.has(entry)
          : namespacesWithFunctions.has(entry);
        expect(exists, `${entry} exports a function`).toBe(true);
        expect(entry.split("/")[0], entry).not.toBe(industry.namespace);
      }
    });

    it("lists no namespace both whole and as one of its sub-modules", () => {
      const entries = [...drawsOn(industry.id)];
      for (const entry of entries.filter((e) => e.includes("/"))) {
        expect(entries, entry).not.toContain(entry.split("/")[0]);
      }
    });

    it("draws on at least one module when it owns no namespace", () => {
      if (industry.namespace !== undefined) return;
      expect(drawsOn(industry.id).length).toBeGreaterThan(0);
    });

    it("names an icon that exists", () => {
      expect(Object.keys(INDUSTRY_ICON_PATHS)).toContain(industry.icon);
    });

    it("points at a guide page, and the guide has a title in its own file", () => {
      // The rule, and nothing more: `guide` is the path of an existing guide page under
      // `content/docs/guides/`, and its title is read from that file.
      expect(industry.guide).toMatch(/^\/guides\/.+\/$/);
      const rel = industry.guide.replace(/^\/|\/$/g, "");
      const file = [`${rel}.mdx`, `${rel}.md`]
        .map((candidate) => path.join(DOCS_DIR, candidate))
        .find(existsSync);
      expect(file, `${industry.guide} is a page under guides/`).toBeDefined();
      const title = readFileSync(file!, "utf8").match(
        /^title:\s*"?(.*?)"?\s*$/m,
      )?.[1];
      expect(title?.length ?? 0).toBeGreaterThan(0);
    });
  });

  it("finds the industry that owns a namespace, and none for a Core one", () => {
    expect(OWN_NAMESPACES).toEqual(
      INDUSTRIES.flatMap((industry) => industry.namespace ?? []),
    );
    for (const namespace of OWN_NAMESPACES) {
      expect(ownNamespace(industryOwning(namespace)!)).toBe(namespace);
    }
    expect(industryOwning("plain")).toBeUndefined();
  });
});

describe("moduleCovers", () => {
  it("lets a whole namespace cover each of its modules", () => {
    expect(moduleCovers("workforce", "workforce", "calculate")).toBe(true);
    expect(moduleCovers("workforce", "workforce")).toBe(true);
  });

  it("lets a sub-module cover itself alone", () => {
    expect(moduleCovers("timescale/convert", "timescale", "convert")).toBe(
      true,
    );
    expect(moduleCovers("timescale/convert", "timescale", "calculate")).toBe(
      false,
    );
    expect(moduleCovers("timescale/convert", "timescale")).toBe(false);
  });

  it("never matches by string prefix", () => {
    expect(moduleCovers("time", "timescale", "convert")).toBe(false);
    expect(moduleCovers("timescale", "time", "convert")).toBe(false);
    expect(moduleCovers("timescale/conv", "timescale", "convert")).toBe(false);
  });
});

describe("industriesUsing", () => {
  const FIXTURE = [
    { id: "workforce", namespace: "workforce", drawsOn: [] as string[] },
    { id: "transport", namespace: "transport", drawsOn: ["workforce"] },
    { id: "gnss", namespace: "gnss", drawsOn: ["timescale/convert"] },
    { id: "maritime", namespace: undefined, drawsOn: ["gnss", "timescale"] },
  ];

  it("finds the industry that owns a namespace and every industry that draws on it, in declared order", () => {
    expect(industriesUsing("workforce", "calculate", FIXTURE)).toEqual([
      "workforce",
      "transport",
    ]);
    expect(industriesUsing("gnss", "convert", FIXTURE)).toEqual([
      "gnss",
      "maritime",
    ]);
  });

  it("finds an industry that draws on one sub-module only for that module", () => {
    expect(industriesUsing("timescale", "convert", FIXTURE)).toEqual([
      "gnss",
      "maritime",
    ]);
    expect(industriesUsing("timescale", "calculate", FIXTURE)).toEqual([
      "maritime",
    ]);
  });

  it("finds an industry that owns no namespace only by what it draws on", () => {
    expect(industriesUsing("maritime", "calculate", FIXTURE)).toEqual([]);
  });

  it("finds a namespace's index page, which no sub-module covers", () => {
    expect(industriesUsing("timescale", undefined, FIXTURE)).toEqual([
      "maritime",
    ]);
  });

  it("agrees with the declarations on the real transport and workforce layers", () => {
    expect(industriesUsing("workforce", "calculate")).toEqual([
      "workforce",
      "transport",
    ]);
    expect(industriesUsing("transport", "calculate")).toEqual([
      "transport",
      "intermodal",
    ]);
  });
});

describe("usedModules and allowedTags", () => {
  it("reads a reference link and an import as the module they name", () => {
    expect(
      usedModules(
        'See [dwell](/reference/transport/calculate/dwellTime/) and `import {} from "@northguild/gmt/workforce/calculate"`.',
      ),
    ).toEqual([
      ["transport", "calculate"],
      ["workforce", "calculate"],
    ]);
  });

  it("reads a link to a namespace's index page, or an import of its barrel, as the whole namespace", () => {
    expect(usedModules("[x](/reference/gnss/) [y](/reference/gnss)")).toEqual([
      ["gnss", undefined],
      ["gnss", undefined],
    ]);
    expect(usedModules('from "@northguild/gmt/gnss"')).toEqual([
      ["gnss", undefined],
    ]);
  });

  it("ignores the shared types, which belong to no namespace", () => {
    expect(usedModules("[T](/reference/types/Interval)")).toEqual([]);
  });

  it("allows `core` only when no industry's own namespace is used", () => {
    expect(allowedTags([["plain", "calculate"]])).toEqual([CORE_INDUSTRY]);
    // GNSS and Maritime draw on `timescale`, so they may tag a page that uses it.
    expect(allowedTags([["timescale", "convert"]])).toEqual([
      "gnss",
      "maritime",
      CORE_INDUSTRY,
    ]);
    expect(allowedTags([["transport", "calculate"]])).not.toContain(
      CORE_INDUSTRY,
    );
    expect(allowedTags([])).toEqual([CORE_INDUSTRY]);
  });

  it("allows every industry that owns or draws on a used module", () => {
    expect(allowedTags([["workforce", "calculate"]])).toEqual([
      "workforce",
      "transport",
    ]);
  });
});

describe("industry tags on pages", () => {
  it("finds pages in every tagged section", () => {
    for (const section of TAGGED_SECTIONS) {
      expect(
        pages.filter(({ page }) => page.startsWith(`${section}/`)).length,
      ).toBeGreaterThan(0);
    }
  });

  it.each(pages)("$page declares known industries", ({ declared }) => {
    expect(declared.length).toBeGreaterThan(0);
    expect(declared.filter((id) => industryTag(id) === undefined)).toEqual([]);
  });

  /*
   * A page's tag is the industry whose functions it uses. A page that uses no industry's own
   * namespace may be `core`; one that does is tagged with an industry that owns or draws on a
   * module it uses, never `core`. A page may touch a second industry in passing (the Free Time
   * Ledger points at `dwellTime` for the day count it shares) without taking that industry's
   * tag, so the declared tag is one of the allowed ones, not the whole set.
   *
   * A page carries one tag, the layer that owns the functions it runs, so it sits in one menu
   * section. An industry that draws on that layer links the page from its hub's `solves` list.
   */
  it.each(pages)(
    "$page is tagged only with industries its functions belong to",
    ({ declared, allowed }) => {
      expect(declared.length).toBeGreaterThan(0);
      expect(declared.filter((id) => !allowed.includes(id))).toEqual([]);
    },
  );

  it.each(pages)("$page carries one tag, its owner layer's", ({ declared }) => {
    expect(declared).toHaveLength(1);
  });
});

describe("IndustryTags.astro", () => {
  const source = readFileSync(
    path.resolve(import.meta.dirname, "..", "components", "IndustryTags.astro"),
    "utf8",
  );

  it("puts a tag's definition where a keyboard or touch reader can reach it, not in a title on a span", () => {
    // A `title` on a non-focusable span shows only on a mouse hover.
    expect(source).not.toMatch(/title=\{/);
    expect(source).toMatch(/<button[\s\S]*?aria-describedby=/);
  });
});

describe("the sidebar icon of an industry group", () => {
  const owners = INDUSTRIES.filter((industry) => industry.namespace);

  it("lists the industries without core", () => {
    expect(INDUSTRY_LAYER_IDS).toEqual(INDUSTRIES.map((i) => i.id));
    expect(INDUSTRY_LAYER_IDS).not.toContain(CORE_INDUSTRY);
  });

  it("sets one icon per industry that owns a namespace, on the group that holds its marked Overview link, and none for core", () => {
    const css = industrySidebarCss().split("\n");
    expect(css).toHaveLength(owners.length);
    for (const { id } of owners) {
      const rule = css.find((line) =>
        line.includes(`a[data-gmt-industry="${id}"]`),
      );
      expect(rule, id).toMatch(
        /^details:has\(> ul > li > a\[data-gmt-industry="\w+"\]\) > summary\{--gmt-industry-icon:url\("data:image\/svg\+xml,/,
      );
    }
    expect(industrySidebarCss()).not.toContain('"core"');
  });

  it("sets no rule for an industry that owns no namespace: it has no reference group", () => {
    const fixtureOwners = OWN_NAMESPACES;
    for (const { id } of INDUSTRIES.filter((i) => !i.namespace)) {
      expect(industrySidebarCss()).not.toContain(`"${id}"`);
    }
    expect(fixtureOwners).toEqual(owners.map((o) => o.namespace));
  });

  it("draws the same glyph the tag shows, in no colour of its own", () => {
    const css = industrySidebarCss();
    for (const { id } of owners) {
      const glyph = INDUSTRY_ICON_PATHS[industryTag(id)!.icon]!;
      expect(css).toContain(encodeURIComponent(glyph));
    }
    expect(decodeURIComponent(css)).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
  });

  it("gives workforce a glyph of its own, not a transport mode's", () => {
    const workforce = INDUSTRY_ICON_PATHS["industry-workforce"];
    expect(workforce).toBeDefined();
    for (const [name, paths] of Object.entries(INDUSTRY_ICON_PATHS)) {
      if (name !== "industry-workforce") expect(paths).not.toBe(workforce);
    }
  });
});

describe("the sidebar divider", () => {
  const read = (file: string) =>
    readFileSync(
      path.resolve(import.meta.dirname, "..", "components", file),
      "utf8",
    );

  it("is text that names the list after it, not a link, a group or a stop", () => {
    const sublist = read("SidebarSublist.astro");
    const divider = sublist.slice(
      sublist.indexOf("sections.map(({ divider, entries }) => ("),
    );
    const row = divider.slice(0, divider.indexOf("))\n\t}"));
    expect(row).toMatch(
      /<span id=\{dividerId\(divider\)\} class="gmt-sidebar-divider">/,
    );
    expect(row).toMatch(/labelledby=\{dividerId\(divider\)\}/);
    expect(row).not.toMatch(/<a\b|<details|<summary|tabindex|<button/);
    expect(sublist).toMatch(/aria-labelledby=\{labelledby\}/);
  });

  it("draws every divider in a list, each with its own id", () => {
    const sublist = read("SidebarSublist.astro");
    expect(sublist).toMatch(
      /sections\.push\(\{ divider: entry, entries: \[\] \}\)/,
    );
    expect(sublist).toMatch(/const dividerId = \(divider: LinkEntry\) =>/);
  });

  it("shows an industry divider's icon as decoration only", () => {
    const sublist = read("SidebarSublist.astro");
    const start = sublist.indexOf('class="gmt-sidebar-divider-icon"');
    expect(start).toBeGreaterThan(0);
    const icon = sublist.slice(
      sublist.lastIndexOf("<svg", start),
      sublist.indexOf("/>", start),
    );
    expect(icon).toMatch(/aria-hidden="true"/);
    expect(icon).toMatch(/focusable="false"/);
    expect(icon).toMatch(
      /set:html=\{industryIcon\(divider\.attrs\['data-gmt-industry'\]\)\}/,
    );
  });

  it("shows a hub link's icon as decoration only, through the attribute that is not the group-icon rule's", () => {
    const sublist = read("SidebarSublist.astro");
    const start = sublist.indexOf('class="gmt-sidebar-link-icon"');
    expect(start).toBeGreaterThan(0);
    const icon = sublist.slice(
      sublist.lastIndexOf("<svg", start),
      sublist.indexOf("/>", start),
    );
    expect(icon).toMatch(/aria-hidden="true"/);
    expect(icon).toMatch(/focusable="false"/);
    expect(icon).toMatch(
      /set:html=\{industryIcon\(entry\.attrs\['data-gmt-industry-link'\]\)\}/,
    );
    // The group-icon rule keys on `data-gmt-industry`; a hub link must not carry that one.
    expect(icon).not.toMatch(/data-gmt-industry['"\]]/);
  });

  it("is registered as the one Sidebar override", () => {
    const config = readFileSync(
      path.resolve(import.meta.dirname, "..", "..", "astro.config.mjs"),
      "utf8",
    );
    expect(config).toMatch(/Sidebar: "\.\/src\/components\/Sidebar\.astro"/);
  });
});
