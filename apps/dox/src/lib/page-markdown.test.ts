import { prefixMarkdownLinks, stripMdx } from "./page-markdown";

describe("prefixMarkdownLinks", () => {
  it("prefixes inline links and images", () => {
    expect(prefixMarkdownLinks("[a](/install/) ![b](/img/x.png)")).toBe(
      "[a](/gmt/install/) ![b](/gmt/img/x.png)",
    );
  });

  it("keeps a link title, hash and query", () => {
    expect(prefixMarkdownLinks('[a](/x/?q=1#h "t")')).toBe(
      '[a](/gmt/x/?q=1#h "t")',
    );
  });

  it("prefixes reference definitions", () => {
    expect(prefixMarkdownLinks("[id]: /x/\n")).toBe("[id]: /gmt/x/\n");
  });

  it("prefixes angle-bracket link targets", () => {
    expect(prefixMarkdownLinks('[t](</x/>) ![i](</i.png> "t")')).toBe(
      '[t](</gmt/x/>) ![i](</gmt/i.png> "t")',
    );
    expect(prefixMarkdownLinks("[r]: </x/>\n")).toBe("[r]: </gmt/x/>\n");
  });

  it("does not double an angle-bracket target already under the base", () => {
    expect(prefixMarkdownLinks("[t](</gmt/x/>)\n[r]: </gmt/x/>")).toBe(
      "[t](</gmt/x/>)\n[r]: </gmt/x/>",
    );
  });

  it("leaves an angle-bracket target in a fence unchanged", () => {
    const md = "```md\n[t](</x/>)\n[r]: </x/>\n```\n";
    expect(prefixMarkdownLinks(md)).toBe(md);
  });

  it("prefixes raw HTML href and src", () => {
    expect(prefixMarkdownLinks('<a href="/x/"><img src="/i.png"></a>')).toBe(
      '<a href="/gmt/x/"><img src="/gmt/i.png"></a>',
    );
  });

  it("does not double a path already under the base", () => {
    expect(prefixMarkdownLinks("[a](/gmt/x/)")).toBe("[a](/gmt/x/)");
  });

  it("leaves a fenced block unchanged", () => {
    const md = "```md\n[a](/x)\n```\n";
    expect(prefixMarkdownLinks(md)).toBe(md);
  });

  it("keeps rewriting after a closed fence when an unclosed one follows", () => {
    const md = "```md\n[a](/x)\n```\n\n```\n[b](/y)\n";
    expect(prefixMarkdownLinks(md)).toBe(
      "```md\n[a](/x)\n```\n\n```\n[b](/gmt/y)\n",
    );
  });

  it("leaves an inline code span unchanged", () => {
    const md = "write `[a](/x)` then [b](/y)";
    expect(prefixMarkdownLinks(md)).toBe("write `[a](/x)` then [b](/gmt/y)");
  });

  it("leaves external, protocol-relative and hash links unchanged", () => {
    const md = "[a](https://x.dev/) [b](//cdn/x) [c](#h) [d](mailto:a@b)";
    expect(prefixMarkdownLinks(md)).toBe(md);
  });
});

describe("stripMdx fences", () => {
  it("leaves a fenced block indented under a bullet unchanged", () => {
    const md = [
      "- Reads this:",
      "",
      "  ```ts",
      '  import { x } from "y";',
      "  { space }",
      "  ```",
      "",
    ].join("\n");
    expect(stripMdx(md, { values: { space: "SPACE" } })).toBe(md);
  });
});

describe("stripMdx layout wrappers", () => {
  // The home page's shape: a layout `<div>` round a `<CardGrid>` whose cards are indented, one
  // card nested two deep and one at the margin.
  const body = [
    '<div class="gmt-home-grid">',
    "",
    "<div data-reveal-group>",
    "<CardGrid>",
    '  <Card title="Nested card" icon="star">',
    "    Built on [Temporal](https://tc39.es/proposal-temporal/), the",
    "    standard API.",
    "  </Card>",
    "",
    '<Card title="Margin card" icon="document">',
    "  Strings in, strings out.",
    "</Card>",
    "</CardGrid>",
    "</div>",
    "",
    "</div>",
  ].join("\n");
  const out = stripMdx(body, {});

  it("drops the layout <div> lines", () => {
    expect(out).not.toMatch(/^[ \t]*<\/?div\b/m);
  });

  it("leaves no card text indented, so none of it reads as a code block", () => {
    expect(out).not.toMatch(/^[ \t]+\S/m);
    expect(out).toContain(
      "**Nested card**\n\nBuilt on [Temporal](https://tc39.es/proposal-temporal/), the\nstandard API.",
    );
    expect(out).toContain("**Margin card**\n\nStrings in, strings out.");
  });

  it("leaves at most one blank line between blocks", () => {
    expect(out).not.toMatch(/\n[ \t]*\n[ \t]*\n/);
  });

  it("states a template-literal card title's figure, with no stray $", () => {
    const card = [
      '<Card title={`~${ratio(all())}× more runs`} icon="rocket">',
      "  Text.",
      "</Card>",
    ].join("\n");
    expect(stripMdx(card, { values: { "ratio(all())": "60" } })).toContain(
      "**~60× more runs**",
    );
  });
});

describe("stripMdx link prefixing", () => {
  it("emits every root-absolute link under /gmt/", () => {
    const body = [
      'import { Card } from "@astrojs/starlight/components";',
      "",
      "See [install](/install/) and [fn](/reference/plain/add/).",
      "",
      "```ts",
      "// [x](/not-a-link)",
      "```",
    ].join("\n");
    const out = stripMdx(body, { gmtVersion: "1.0.0" });
    expect(out).toContain("[install](/gmt/install/)");
    expect(out).toContain("[fn](/gmt/reference/plain/add/)");
    expect(out).toContain("// [x](/not-a-link)");
    expect(out).not.toMatch(/\]\(\/(?!gmt\/|not-a-link)/);
  });
});
