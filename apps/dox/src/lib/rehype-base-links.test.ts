import rehypeBaseLinks, { type HastNode } from "./rehype-base-links";

function run<T extends HastNode>(node: T): T {
  rehypeBaseLinks()({ type: "root", children: [node] });
  return node;
}

function a(href: string) {
  return run({
    type: "element",
    tagName: "a",
    properties: { href },
    children: [],
  }) as { properties: { href: string } };
}

describe("rehypeBaseLinks", () => {
  it("prefixes a root-absolute link", () => {
    expect(a("/install/").properties.href).toBe("/gmt/install/");
  });

  it("keeps hash and query", () => {
    expect(a("/reference/x/#opts").properties.href).toBe(
      "/gmt/reference/x/#opts",
    );
    expect(a("/x/?a=1").properties.href).toBe("/gmt/x/?a=1");
  });

  it("does not double a path already under the base", () => {
    expect(a("/gmt/install/").properties.href).toBe("/gmt/install/");
  });

  it.each(["https://tc39.es/", "//cdn.x/", "#h", "mailto:a@b", "./x", "x"])(
    "leaves %s unchanged",
    (href) => {
      expect(a(href).properties.href).toBe(href);
    },
  );

  it("prefixes src and every srcset candidate", () => {
    const img = run({
      type: "element",
      tagName: "img",
      properties: {
        src: "/img/a.png",
        srcSet: "/img/a.png 1x, /img/a@2x.png 2x",
      },
      children: [],
    }) as { properties: { src: string; srcSet: string } };
    expect(img.properties.src).toBe("/gmt/img/a.png");
    expect(img.properties.srcSet).toBe(
      "/gmt/img/a.png 1x, /gmt/img/a@2x.png 2x",
    );
  });

  it("prefixes a string href on an MDX JSX element", () => {
    const card = run({
      type: "mdxJsxFlowElement",
      name: "LinkCard",
      attributes: [
        { type: "mdxJsxAttribute", name: "href", value: "/tools/x/" },
      ],
      children: [],
    }) as { attributes: { value: unknown }[] };
    expect(card.attributes[0].value).toBe("/gmt/tools/x/");
  });

  it("leaves an expression href on an MDX JSX element", () => {
    const expr = { type: "mdxJsxAttributeValueExpression", value: "url" };
    const card = run({
      type: "mdxJsxTextElement",
      name: "LinkCard",
      attributes: [{ type: "mdxJsxAttribute", name: "href", value: expr }],
      children: [],
    }) as { attributes: { value: unknown }[] };
    expect(card.attributes[0].value).toBe(expr);
  });

  it("prefixes srcset (either spelling) and poster on elements", () => {
    const source = run({
      type: "element",
      tagName: "source",
      properties: { srcset: "/a.webp 1x, /gmt/b.webp 2x" },
      children: [],
    }) as { properties: { srcset: string } };
    expect(source.properties.srcset).toBe("/gmt/a.webp 1x, /gmt/b.webp 2x");
    const video = run({
      type: "element",
      tagName: "video",
      properties: { poster: "/p.png" },
      children: [],
    }) as { properties: { poster: string } };
    expect(video.properties.poster).toBe("/gmt/p.png");
    const done = run({
      type: "element",
      tagName: "video",
      properties: { poster: "/gmt/p.png" },
      children: [],
    }) as { properties: { poster: string } };
    expect(done.properties.poster).toBe("/gmt/p.png");
  });

  it.each(["srcset", "srcSet"])(
    "prefixes %s and poster on an MDX JSX element, keeping descriptors",
    (name) => {
      const el = run({
        type: "mdxJsxFlowElement",
        name: "Pic",
        attributes: [
          { type: "mdxJsxAttribute", name, value: "/a.png 1x, /a@2x.png 2x" },
          { type: "mdxJsxAttribute", name: "poster", value: "/p.png" },
        ],
        children: [],
      }) as { attributes: { value: unknown }[] };
      expect(el.attributes[0].value).toBe("/gmt/a.png 1x, /gmt/a@2x.png 2x");
      expect(el.attributes[1].value).toBe("/gmt/p.png");
    },
  );

  it("does not double an MDX srcset or poster already under the base", () => {
    const el = run({
      type: "mdxJsxFlowElement",
      name: "Pic",
      attributes: [
        { type: "mdxJsxAttribute", name: "srcSet", value: "/gmt/a.png 1x" },
        { type: "mdxJsxAttribute", name: "poster", value: "/gmt/p.png" },
      ],
      children: [],
    }) as { attributes: { value: unknown }[] };
    expect(el.attributes[0].value).toBe("/gmt/a.png 1x");
    expect(el.attributes[1].value).toBe("/gmt/p.png");
  });

  function literalAttribute(text: string, value: string) {
    return {
      type: "mdxJsxAttributeValueExpression",
      value: text,
      data: {
        estree: {
          type: "Program",
          body: [
            {
              type: "ExpressionStatement",
              expression: { type: "Literal", value, raw: text },
            },
          ],
        },
      },
    };
  }

  it.each([
    ['"/x.png"', "/x.png", '"/gmt/x.png"'],
    ["'/x.png'", "/x.png", "'/gmt/x.png'"],
    ['"/gmt/x.png"', "/gmt/x.png", '"/gmt/x.png"'],
  ])(
    "rewrites the text and estree of the literal expression %s",
    (text, value, expected) => {
      const expr = literalAttribute(text, value);
      run({
        type: "mdxJsxTextElement",
        name: "img",
        attributes: [{ type: "mdxJsxAttribute", name: "src", value: expr }],
        children: [],
      });
      const literal = expr.data.estree.body[0].expression;
      expect(expr.value).toBe(expected);
      expect(literal.raw).toBe(expected);
      expect(literal.value).toBe("/gmt/x.png");
    },
  );

  it("leaves non-literal and external literal expressions alone", () => {
    const tpl = { type: "mdxJsxAttributeValueExpression", value: "`/x.png`" };
    const call = { type: "mdxJsxAttributeValueExpression", value: 'f("/x")' };
    const ext = literalAttribute(
      '"https://x.dev/a.png"',
      "https://x.dev/a.png",
    );
    run({
      type: "mdxJsxTextElement",
      name: "img",
      attributes: [
        { type: "mdxJsxAttribute", name: "src", value: tpl },
        { type: "mdxJsxAttribute", name: "srcSet", value: call },
        { type: "mdxJsxAttribute", name: "poster", value: ext },
      ],
      children: [],
    });
    expect(tpl.value).toBe("`/x.png`");
    expect(call.value).toBe('f("/x")');
    expect(ext.value).toBe('"https://x.dev/a.png"');
  });

  it("walks nested children", () => {
    const inner = {
      type: "element",
      tagName: "a",
      properties: { href: "/x/" },
      children: [],
    };
    run({ type: "element", tagName: "p", children: [inner] });
    expect(inner.properties.href).toBe("/gmt/x/");
  });
});
