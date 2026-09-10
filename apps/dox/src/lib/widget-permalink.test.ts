/// <reference types="vitest/globals" />
import {
  decodeWidgetPermalink,
  encodeWidgetPermalink,
  WIDGET_PAGE_PATHS,
  type WidgetKind,
} from "./widget-permalink";
import { referenceRoutes } from "~/generated/reference/route-manifest";

describe("widget permalinks", () => {
  it("round-trips arguments", () => {
    const args = { zone: "Asia/Tokyo" };
    const url = encodeWidgetPermalink("globe", args);
    const decoded = decodeWidgetPermalink(url.slice(url.indexOf("?")));
    expect(decoded).toEqual({ kind: "globe", args });
  });

  it("points at the widget's own page, never at /dox", () => {
    for (const kind of Object.keys(WIDGET_PAGE_PATHS) as WidgetKind[]) {
      const url = encodeWidgetPermalink(kind, {});
      expect(url.startsWith("/")).toBe(true);
      expect(url).not.toContain("/dox");
    }
  });

  it("targets reference pages that actually exist in the manifest", () => {
    // The same rule as a citation: a link Dox produces must resolve.
    for (const kind of ["dst", "interval", "converter"] as WidgetKind[]) {
      const path = WIDGET_PAGE_PATHS[kind].replace(/\/$/, "");
      expect(referenceRoutes.has(path)).toBe(true);
    }
  });

  it("namespaces its params so two widgets on one page cannot collide", () => {
    // Every reference page imports all three widget components, so the
    // discriminant is what makes the link unambiguous.
    const url = encodeWidgetPermalink("dst", { zone: "America/New_York" });
    expect(url).toContain("w=dst");
    expect(url).toContain("wa=");
  });

  it("ignores the scrubber's legacy unnamespaced params", () => {
    expect(decodeWidgetPermalink("?tz=Asia/Tokyo&t=2026-01-01T00:00:00Z")).toBeNull();
  });

  it("treats a mangled or truncated link as absent, not as an error", () => {
    expect(decodeWidgetPermalink("?w=globe&wa=%7Bnot-json")).toBeNull();
    expect(decodeWidgetPermalink("?w=globe")).toBeNull();
    expect(decodeWidgetPermalink("")).toBeNull();
  });

  it("rejects an unknown widget kind", () => {
    expect(decodeWidgetPermalink('?w=evil&wa={"a":1}')).toBeNull();
  });
});
