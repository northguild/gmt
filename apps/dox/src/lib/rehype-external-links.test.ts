import { describe, expect, it } from "vitest";
import rehypeExternalLinks from "./rehype-external-links";

function link(href: string, rel?: string[] | string) {
  return {
    type: "element",
    tagName: "a",
    properties: rel === undefined ? { href } : { href, rel },
    children: [],
  };
}

function run(...links: ReturnType<typeof link>[]) {
  const tree = {
    type: "root",
    children: [{ type: "element", tagName: "p", children: links }],
  };
  rehypeExternalLinks()(tree);
  return links.map((l) => l.properties);
}

describe("rehypeExternalLinks", () => {
  it("opens absolute and protocol-relative links in a new tab", () => {
    expect(
      run(link("https://www.rfc-editor.org/rfc/rfc9557"), link("//tc39.es/")),
    ).toEqual([
      {
        href: "https://www.rfc-editor.org/rfc/rfc9557",
        target: "_blank",
        rel: ["noopener", "noreferrer"],
      },
      { href: "//tc39.es/", target: "_blank", rel: ["noopener", "noreferrer"] },
    ]);
  });

  it("keeps site links, anchors and mailto in the same tab", () => {
    expect(
      run(
        link("/guides/concepts/standards/"),
        link("#examples"),
        link("mailto:someone@example.com"),
      ),
    ).toEqual([
      { href: "/guides/concepts/standards/" },
      { href: "#examples" },
      { href: "mailto:someone@example.com" },
    ]);
  });

  it("adds to an existing rel without duplicating tokens", () => {
    expect(
      run(
        link("https://github.com/northguild/gmt", ["me", "noopener"]),
        link("https://cldr.unicode.org/", "nofollow"),
      ),
    ).toEqual([
      {
        href: "https://github.com/northguild/gmt",
        target: "_blank",
        rel: ["me", "noopener", "noreferrer"],
      },
      {
        href: "https://cldr.unicode.org/",
        target: "_blank",
        rel: ["nofollow", "noopener", "noreferrer"],
      },
    ]);
  });
});
