import {
  headEntries,
  isHomeId,
  jsonLd,
  ogImageKey,
  pageTitle,
  TITLE_SUFFIX,
  upsertHead,
  type HeadEntry,
  type HeadInput,
} from "./head-tags";

const SITE = "https://northguild.dev/gmt";

/** The ids of a small docs tree; `reference/zoned/calculate` has no page of its own. */
const TREE = new Map<string, string>([
  ["guides", "Guides"],
  ["guides/concepts", "Concepts"],
  ["reference", "API reference"],
  ["reference/zoned", "zoned"],
]);

function input(over: Partial<HeadInput> & Pick<HeadInput, "id">): HeadInput {
  return {
    data: { title: "Page", description: "A page." },
    siteDescription: "The site.",
    hasEntry: (id) => {
      const title = TREE.get(id);
      return title === undefined ? undefined : { title };
    },
    markdownSlug: over.id || "index",
    siteUrl: SITE,
    gmtVersion: "1.20.0",
    ...over,
  };
}

function find(entries: HeadEntry[], key: string, value: string) {
  return entries.find((e) => e.attrs?.[key] === value);
}

function ldTypes(entries: HeadEntry[]): string[] {
  return entries
    .filter((e) => e.attrs?.type === "application/ld+json")
    .map((e) => JSON.parse(e.content ?? "{}")["@type"] as string);
}

describe("pageTitle", () => {
  it("adds the suffix to a page title", () => {
    expect(pageTitle({ id: "install", data: { title: "Install" } })).toBe(
      `Install${TITLE_SUFFIX}`,
    );
    expect(TITLE_SUFFIX).toBe(" · GMT");
  });

  it("uses headTitle in place of the title when a page has one", () => {
    expect(
      pageTitle({
        id: "reference/zoned/calculate/addZoned",
        data: {
          title: "addZoned",
          headTitle: "addZoned(): add a temporal amount",
        },
      }),
    ).toBe("addZoned(): add a temporal amount · GMT");
  });

  it("leaves the home title whole, with no suffix", () => {
    const title =
      "GMT: date and time library for JavaScript, built on Temporal";
    expect(pageTitle({ id: "", data: { title } })).toBe(title);
    expect(pageTitle({ id: "index", data: { title } })).toBe(title);
  });
});

describe("headEntries", () => {
  it("writes one title entry, and names the home page a website", () => {
    const home = headEntries(
      input({ id: "", data: { title: "GMT: home", description: "D." } }),
    );
    expect(home.filter((e) => e.tag === "title")).toHaveLength(1);
    expect(find(home, "property", "og:type")?.attrs?.content).toBe("website");
    const page = headEntries(input({ id: "install" }));
    expect(find(page, "property", "og:type")?.attrs?.content).toBe("article");
  });

  it("shares headTitle as og:title and the title otherwise", () => {
    const withHead = headEntries(
      input({
        id: "reference/zoned/calculate/addZoned",
        data: {
          title: "addZoned",
          headTitle: "addZoned(): add a temporal amount",
        },
      }),
    );
    expect(find(withHead, "property", "og:title")?.attrs?.content).toBe(
      "addZoned(): add a temporal amount",
    );
    const plain = headEntries(
      input({ id: "install", data: { title: "Install" } }),
    );
    expect(find(plain, "property", "og:title")?.attrs?.content).toBe("Install");
  });

  it("points og:image and twitter:image at the page's image, 1200 by 630", () => {
    const entries = headEntries(
      input({ id: "reference/zoned/calculate/addZoned" }),
    );
    const url = `${SITE}/og/reference/zoned.png`;
    expect(find(entries, "property", "og:image")?.attrs?.content).toBe(url);
    expect(find(entries, "name", "twitter:image")?.attrs?.content).toBe(url);
    expect(find(entries, "property", "og:image:width")?.attrs?.content).toBe(
      "1200",
    );
    expect(find(entries, "property", "og:image:height")?.attrs?.content).toBe(
      "630",
    );
    expect(find(entries, "name", "twitter:card")?.attrs?.content).toBe(
      "summary_large_image",
    );
  });

  it("links the Markdown twin, and only for a page in the docs collection", () => {
    const entries = headEntries(input({ id: "install" }));
    expect(find(entries, "type", "text/markdown")?.attrs?.href).toBe(
      `${SITE}/install.md`,
    );
    const outside = headEntries(input({ id: "dox", markdownSlug: undefined }));
    expect(find(outside, "type", "text/markdown")).toBeUndefined();
    expect(ldTypes(outside)).toEqual([]);
  });

  it("writes SoftwareSourceCode on the home page only, with the package version", () => {
    const home = headEntries(
      input({
        id: "",
        data: { title: "GMT", description: "D." },
        markdownSlug: "index",
      }),
    );
    expect(ldTypes(home)).toEqual(["SoftwareSourceCode"]);
    const code = JSON.parse(
      home.find((e) => e.tag === "script")?.content ?? "{}",
    );
    expect(code.version).toBe("1.20.0");
    expect(code.name).toBe("@northguild/gmt");
    expect(ldTypes(headEntries(input({ id: "install" })))).toEqual([
      "BreadcrumbList",
    ]);
  });

  it("builds a breadcrumb that skips an ancestor with no page", () => {
    const entries = headEntries(
      input({
        id: "reference/zoned/calculate/addZoned",
        data: { title: "addZoned" },
      }),
    );
    const list = JSON.parse(
      entries.find((e) => e.tag === "script")?.content ?? "{}",
    );
    expect(
      list.itemListElement.map((item: { name: string; item?: string }) => [
        item.name,
        item.item,
      ]),
    ).toEqual([
      ["GMT", `${SITE}/`],
      ["API reference", `${SITE}/reference/`],
      ["zoned", `${SITE}/reference/zoned/`],
      ["addZoned", undefined],
    ]);
  });

  it("writes TechArticle on a guide page and not on the guides index", () => {
    const guide = headEntries(
      input({
        id: "guides/concepts/plain-vs-zoned",
        lastUpdated: { valueOf: () => 1_700_000_000_000 },
      }),
    );
    expect(ldTypes(guide)).toEqual(["BreadcrumbList", "TechArticle"]);
    const article = JSON.parse(
      guide.filter((e) => e.tag === "script")[1].content ?? "{}",
    );
    expect(article.dateModified).toBe("2023-11-14T22:13:20Z");
    expect(ldTypes(headEntries(input({ id: "guides" })))).toEqual([
      "BreadcrumbList",
    ]);
  });

  it("writes TechArticle on a migrate page and not on the migrate index", () => {
    expect(ldTypes(headEntries(input({ id: "migrate/moment" })))).toContain(
      "TechArticle",
    );
    expect(ldTypes(headEntries(input({ id: "migrate" })))).toEqual([
      "BreadcrumbList",
    ]);
  });

  it("leaves dateModified out when the page has no commit date", () => {
    const guide = headEntries(input({ id: "guides/concepts/plain-vs-zoned" }));
    const article = JSON.parse(
      guide.filter((e) => e.tag === "script")[1].content ?? "{}",
    );
    expect("dateModified" in article).toBe(false);
  });

  it("escapes < in JSON-LD so no text can close the script", () => {
    expect(jsonLd({ a: "</script><b>" })).not.toContain("<");
    expect(jsonLd({ a: "</script>" })).toContain("\\u003c/script>");
    const entries = headEntries(
      input({ id: "guides/x", data: { title: "A </script> page" } }),
    );
    for (const e of entries.filter((x) => x.tag === "script")) {
      expect(e.content).not.toContain("<");
    }
  });

  it("falls back to the site description for a page without one", () => {
    const entries = headEntries(
      input({ id: "guides/x", data: { title: "X", description: undefined } }),
    );
    const article = JSON.parse(
      entries.filter((e) => e.tag === "script")[1].content ?? "{}",
    );
    expect(article.description).toBe("The site.");
  });
});

describe("upsertHead", () => {
  it("replaces the title and the meta tags it matches, and does not duplicate them", () => {
    const base: HeadEntry[] = [
      { tag: "title", content: "Old | @northguild/gmt" },
      { tag: "meta", attrs: { property: "og:type", content: "article" } },
      { tag: "meta", attrs: { name: "twitter:card", content: "summary" } },
    ];
    let head = base;
    for (const entry of headEntries(
      input({ id: "", data: { title: "Home" } }),
    )) {
      head = upsertHead(head, entry);
    }
    for (const entry of headEntries(
      input({ id: "", data: { title: "Home" } }),
    )) {
      head = upsertHead(head, entry);
    }
    expect(head.filter((e) => e.tag === "title")).toEqual([
      { tag: "title", content: "Home" },
    ]);
    expect(head.filter((e) => e.attrs?.property === "og:type")).toHaveLength(1);
    expect(find(head, "property", "og:type")?.attrs?.content).toBe("website");
    expect(head.filter((e) => e.attrs?.name === "twitter:card")).toHaveLength(
      1,
    );
    expect(head.filter((e) => e.tag === "script")).toHaveLength(1);
  });

  it("keeps the llms.txt link beside the Markdown link", () => {
    const head = upsertHead(
      [
        {
          tag: "link",
          attrs: { rel: "alternate", type: "text/plain", href: "/llms.txt" },
        },
      ],
      {
        tag: "link",
        attrs: { rel: "alternate", type: "text/markdown", href: "/x.md" },
      },
    );
    expect(head).toHaveLength(2);
  });
});

describe("ogImageKey", () => {
  it.each([
    ["guides", "guides"],
    ["guides/concepts/plain-vs-zoned", "guides/concepts/plain-vs-zoned"],
    ["tools", "tools"],
    ["tools/dst-inspector", "tools/dst-inspector"],
    ["scenarios/x", "scenarios/x"],
    ["reference/zoned/calculate/addZoned", "reference/zoned"],
    ["reference/zoned", "reference/zoned"],
    ["reference/types/Interval", "reference/types"],
    ["reference", "site"],
    ["install", "site"],
    ["", "site"],
    ["migrate/moment", "migrate/moment"],
    ["migrate", "migrate"],
    ["compare/behaviour", "compare/behaviour"],
    ["guidesx/y", "site"],
  ])("%s -> %s", (id, key) => {
    expect(ogImageKey(id)).toBe(key);
  });
});

describe("isHomeId", () => {
  it("names the home page by either id", () => {
    expect(isHomeId("")).toBe(true);
    expect(isHomeId("index")).toBe(true);
    expect(isHomeId("guides")).toBe(false);
  });
});
