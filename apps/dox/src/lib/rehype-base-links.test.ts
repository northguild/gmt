import rehypeBaseLinks from "./rehype-base-links";

function run(node: Record<string, unknown>) {
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
