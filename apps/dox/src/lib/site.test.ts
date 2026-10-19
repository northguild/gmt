import { describe, expect, it } from "vitest";
import { referenceRoutes } from "~/generated/reference/route-manifest";
import { SITE_URL, isUnderBase, stripBase, withBase } from "./site";

describe("site constants", () => {
  it("SITE_URL has no trailing slash", () => {
    expect(SITE_URL).toBe("https://northguild.dev/gmt");
  });
});

describe("withBase", () => {
  it.each([
    ["/", "/gmt/"],
    ["/install/", "/gmt/install/"],
    ["/x/?a=1#h", "/gmt/x/?a=1#h"],
    ["/llms.txt", "/gmt/llms.txt"],
    ["/gmtx", "/gmt/gmtx"],
  ])("%s -> %s", (input, expected) => {
    expect(withBase(input)).toBe(expected);
  });

  it.each(["/gmt", "/gmt/x/"])("leaves %s unchanged", (p) => {
    expect(withBase(p)).toBe(p);
  });

  it.each(["", "x", "./x", "//cdn/x", "https://a/x", "#h"])(
    "throws TypeError for %j",
    (p) => {
      expect(() => withBase(p)).toThrow(TypeError);
    },
  );
});

describe("stripBase", () => {
  it.each([
    ["/gmt", "/"],
    ["/gmt/", "/"],
    ["/gmt/a/b/", "/a/b/"],
    ["/reference/", "/reference/"],
    ["/gmtx", "/gmtx"],
  ])("%s -> %s", (input, expected) => {
    expect(stripBase(input)).toBe(expected);
  });
});

describe("isUnderBase", () => {
  it.each(["/gmt", "/gmt/", "/gmt/a"])("true for %s", (p) => {
    expect(isUnderBase(p)).toBe(true);
  });
  it.each(["/", "/gmtx", "/api/chat"])("false for %s", (p) => {
    expect(isUnderBase(p)).toBe(false);
  });
});

describe("round trip", () => {
  it("stripBase(withBase(p)) === p for every reference route", () => {
    for (const p of referenceRoutes) {
      expect(stripBase(withBase(p))).toBe(p);
    }
  });
});
