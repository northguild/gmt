// @vitest-environment jsdom
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { zonedValue } from "./zoned-value";

const VALUE = "2026-11-16T09:00:00+01:00[Africa/Casablanca]";

describe("zonedValue", () => {
  it("breaks after the T, before the offset and before the [", () => {
    const fx = renderHtml(zonedValue(VALUE));
    const pieces = [...fx.host.childNodes].map((n) => n.textContent);
    expect(fx.host.querySelectorAll("wbr")).toHaveLength(3);
    expect(pieces.filter((t) => t !== "")).toEqual([
      "2026-11-16T",
      "09:00:00",
      "+01:00",
      "[Africa/Casablanca]",
    ]);
  });

  it("leaves the text unchanged", () => {
    const fx = renderHtml(zonedValue(VALUE));
    expect(fx.host).toHaveTextContent(VALUE);
  });

  it("adds no break to a value with no T, offset or zone", () => {
    const fx = renderHtml(zonedValue("not a time"));
    expect(fx.host.querySelectorAll("wbr")).toHaveLength(0);
    expect(fx.host).toHaveTextContent("not a time");
  });

  it("handles a Z-less value with a negative offset", () => {
    const fx = renderHtml(
      zonedValue("2026-11-16T09:00:00-08:00[America/Vancouver]"),
    );
    expect(fx.host.querySelectorAll("wbr")).toHaveLength(3);
  });

  it("has no accessibility violations", async () => {
    const fx = renderHtml(zonedValue(VALUE));
    await expectNoAxeViolations(fx.host);
  });
});
