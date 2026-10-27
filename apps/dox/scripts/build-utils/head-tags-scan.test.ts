import {
  attributesOf,
  decodeEntities,
  editPath,
  scanHead,
} from "./head-tags-scan";

const PAGE = `<!doctype html><html><head>
<title>addDate(): add units &amp; more · GMT</title>
<meta name="description" content="Adds &quot;units&quot; to a date.">
<meta content="noindex, follow" name="robots">
<meta property="og:title" content="addDate()">
<meta property="og:image" content="https://northguild.dev/gmt/og/reference/plain.png">
<meta name="twitter:image" content="https://northguild.dev/gmt/og/reference/plain.png">
<link rel="canonical" href="https://northguild.dev/gmt/reference/plain/calculate/addDate/">
<link rel="alternate" type="text/markdown" href="https://northguild.dev/gmt/reference/plain/calculate/addDate.md">
<link rel="stylesheet" href="/x.css">
<script type="application/ld+json">{"@type":"BreadcrumbList"}</script>
<script>var a = 1;</script>
</head><body>
<a class="sl-flex" href="https://github.com/northguild/gmt/edit/main/packages/gmt/src/plain/calculate/addDate.ts">Edit page</a>
<a href="/elsewhere/">x</a>
</body></html>`;

describe("scanHead", () => {
  it("reads a description whose quoted value holds a `>`", () => {
    const html =
      '<meta name="description" content="annotation [u-ca=<id>] of a date">';
    expect(scanHead(html).description).toBe("annotation [u-ca=<id>] of a date");
  });

  it("reads the title with its entities decoded", () => {
    expect(scanHead(PAGE).titles).toEqual([
      "addDate(): add units & more · GMT",
    ]);
  });

  it("reads the description, the robots hint and the share tags in any attribute order", () => {
    const scan = scanHead(PAGE);
    expect(scan.description).toBe('Adds "units" to a date.');
    expect(scan.noindex).toBe(true);
    expect(scan.ogTitle).toBe("addDate()");
    expect(scan.ogImage).toBe(
      "https://northguild.dev/gmt/og/reference/plain.png",
    );
    expect(scan.twitterImage).toBe(scan.ogImage);
  });

  it("reads the canonical link, the Markdown alternates and the JSON-LD blocks", () => {
    const scan = scanHead(PAGE);
    expect(scan.canonical).toBe(
      "https://northguild.dev/gmt/reference/plain/calculate/addDate/",
    );
    expect(scan.markdownAlternates).toEqual([
      "https://northguild.dev/gmt/reference/plain/calculate/addDate.md",
    ]);
    expect(scan.jsonLd).toEqual(['{"@type":"BreadcrumbList"}']);
  });

  it("finds the edit link and no other anchor", () => {
    const scan = scanHead(PAGE);
    expect(scan.editLinks).toEqual([
      "https://github.com/northguild/gmt/edit/main/packages/gmt/src/plain/calculate/addDate.ts",
    ]);
    expect(editPath(scan.editLinks[0])).toBe(
      "packages/gmt/src/plain/calculate/addDate.ts",
    );
  });

  it("reports a page with no tags as empty", () => {
    const scan = scanHead("<html><head></head><body></body></html>");
    expect(scan.titles).toEqual([]);
    expect(scan.description).toBeUndefined();
    expect(scan.noindex).toBe(false);
    expect(scan.jsonLd).toEqual([]);
    expect(scan.editLinks).toEqual([]);
  });

  it("counts two title elements as two", () => {
    expect(scanHead("<title>a</title><title>b</title>").titles).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("attributesOf and decodeEntities", () => {
  it("reads quoted, single-quoted, unquoted and bare attributes", () => {
    expect(attributesOf(`<meta name="a" content='b' x=c hidden>`)).toEqual({
      name: "a",
      content: "b",
      x: "c",
      hidden: "",
    });
  });

  it("decodes the entities Astro writes", () => {
    expect(
      decodeEntities("a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39;"),
    ).toBe("a & b <c> \"d\" 'e'");
  });
});
