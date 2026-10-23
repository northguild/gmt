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
