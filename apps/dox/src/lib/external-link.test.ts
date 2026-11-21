import { isExternalHref, linkTarget } from "./external-link";

describe("linkTarget", () => {
  it("opens an absolute or protocol-relative link in a new tab, with noopener noreferrer", () => {
    for (const href of [
      "https://unicode-org.atlassian.net/browse/ICU-23627",
      "http://example.org/",
      "//example.org/",
    ]) {
      expect(isExternalHref(href)).toBe(true);
      expect(linkTarget(href)).toEqual({
        target: "_blank",
        rel: "noopener noreferrer",
      });
    }
  });

  it("keeps the caller's rel tokens once each", () => {
    expect(linkTarget("https://example.org/", "me noopener")).toEqual({
      target: "_blank",
      rel: "me noopener noreferrer",
    });
  });

  it("leaves a site path, an anchor and mailto in the same tab", () => {
    for (const href of [
      "/gmt/upstream/",
      "#spare-size",
      "mailto:a@b.c",
      undefined,
    ]) {
      expect(isExternalHref(href)).toBe(false);
      expect(linkTarget(href)).toEqual({ target: undefined, rel: undefined });
    }
    expect(linkTarget("/gmt/", "me")).toEqual({ target: undefined, rel: "me" });
  });

  it("treats a site link as external when the caller says so, and the reverse", () => {
    expect(linkTarget("/gmt/tools/", undefined, true)).toEqual({
      target: "_blank",
      rel: "noopener noreferrer",
    });
    expect(linkTarget("https://example.org/", undefined, false)).toEqual({
      target: undefined,
      rel: undefined,
    });
  });
});
