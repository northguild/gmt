// @vitest-environment jsdom
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { valueText } from "./value-text";

describe("valueText", () => {
  it("breaks a zoned value after the T, before the offset and before the zone", () => {
    const fx = renderHtml(
      valueText("2024-06-15T10:30:00+02:00[Europe/Berlin]"),
    );
    expect(fx.host.querySelectorAll("wbr")).toHaveLength(4);
    expect(fx.host).toHaveTextContent(
      "2024-06-15T10:30:00+02:00[Europe/Berlin]",
    );
  });

  it("lets a sentence wrap at its spaces and adds no break inside it", () => {
    const fx = renderHtml(
      valueText("+00:00 (Z, +00:00 and -00:00 are one offset)"),
    );
    expect(fx.host.querySelectorAll("wbr")).toHaveLength(0);
    expect(fx.host).toHaveTextContent(
      "+00:00 (Z, +00:00 and -00:00 are one offset)",
    );
  });

  it("returns text with no date, time or offset as it is", () => {
    const fx = renderHtml(valueText("no result"));
    expect(fx.host.querySelectorAll("span")).toHaveLength(0);
    expect(fx.host).toHaveTextContent("no result");
  });

  it("escapes text that holds markup", () => {
    const fx = renderHtml(valueText("<b>"));
    expect(fx.host.querySelector("b")).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const fx = renderHtml(
      valueText("2024-06-15T10:30:00+02:00[Europe/Berlin]"),
    );
    await expectNoAxeViolations(fx.host);
  });
});
