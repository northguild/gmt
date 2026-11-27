import {
  isPageLinkWithoutSlash,
  resolveHref,
  underBase,
} from "./page-links.mjs";

describe("isPageLinkWithoutSlash", () => {
  it.each([
    ["/gmt/reference", true],
    ["/gmt", true],
    ["/gmt/reference/", false],
    ["/gmt/llms.txt", false],
    ["/gmt/reference/x.md", false],
    ["https://northguild.dev/gmt/tools/x?w=1#a", true],
    ["https://northguild.dev/gmt/tools/x/?w=1", false],
    ["https://northguild.dev/", false],
    ["/other", false],
    ["//cdn/x", false],
    ["https://example.com/gmt/x", false],
    ["#top", false],
    ["/gmt/gmt/x", false],
  ])("%s -> %s", (value, expected) => {
    expect(isPageLinkWithoutSlash(value)).toBe(expected);
  });
});

describe("underBase", () => {
  it("is the base and what sits under it, never a doubled base", () => {
    expect(underBase("/gmt")).toBe(true);
    expect(underBase("/gmt/x")).toBe(true);
    expect(underBase("/gmtx")).toBe(false);
    expect(underBase("/gmt/gmt")).toBe(false);
  });
});

describe("resolveHref", () => {
  const page = "http://127.0.0.1:4321/gmt/tools/dst-inspector/";

  it("resolves a relative value against the page, keeping query and hash", () => {
    expect(resolveHref("./x", page)).toBe("/gmt/tools/dst-inspector/x");
    expect(resolveHref("../x", page)).toBe("/gmt/tools/x");
    expect(resolveHref("x?a=1#h", page)).toBe(
      "/gmt/tools/dst-inspector/x?a=1#h",
    );
    expect(resolveHref("?w=1", page)).toBe("/gmt/tools/dst-inspector/?w=1");
  });

  it("leaves a root-absolute, protocol-relative, absolute or hash value as written", () => {
    for (const value of [
      "/gmt/x",
      "//cdn/x",
      "https://northguild.dev/gmt/x",
      "mailto:a@b.c",
      "#top",
      "",
    ]) {
      expect(resolveHref(value, page)).toBe(value);
    }
  });

  it("lets the predicate judge a resolved relative link", () => {
    expect(isPageLinkWithoutSlash(resolveHref("../x", page))).toBe(true);
    expect(isPageLinkWithoutSlash(resolveHref("../x/", page))).toBe(false);
  });
});
