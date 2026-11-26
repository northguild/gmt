// @vitest-environment jsdom
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../test-fixture";
import { codeString } from "./code-string";

describe("codeString", () => {
  it("quotes the text as the call prints it", () => {
    const fx = renderHtml(codeString("2026-01-01T00:00:00Z"));
    expect(fx.host).toHaveTextContent('"2026-01-01T00:00:00Z"');
  });

  it("gives a zoned value its break points after the T, before the offset and before the zone", () => {
    const fx = renderHtml(
      codeString("2026-03-08T08:00:00-03:00[America/Argentina/Buenos_Aires]"),
    );
    expect(fx.host.querySelectorAll("wbr")).toHaveLength(5);
  });

  it("adds no break to a string with no date, time or offset in it", () => {
    const fx = renderHtml(codeString("x".repeat(60)));
    expect(fx.host.querySelectorAll("wbr")).toHaveLength(0);
    expect(fx.host).toHaveTextContent(`"${"x".repeat(60)}"`);
  });

  it("lets a string with spaces wrap at them and keeps its dates whole", () => {
    const fx = renderHtml(codeString("from 2026-01-01 to 2026-02-01"));
    expect(fx.host.querySelectorAll("wbr")).toHaveLength(0);
    expect(fx.host).toHaveTextContent('"from 2026-01-01 to 2026-02-01"');
  });

  it("breaks a UUID after each hyphen", () => {
    const fx = renderHtml(codeString("017F22E2-79B0-7CC3-98C4-DC0C0C07398F"));
    expect(fx.host.querySelectorAll("wbr")).toHaveLength(4);
    expect(fx.host).toHaveTextContent('"017F22E2-79B0-7CC3-98C4-DC0C0C07398F"');
  });

  it.each(["2024-03", "--03-15", "2024-W11-3", "2024-075", "2024-03-15"])(
    "keeps the date %s whole",
    (date) => {
      const fx = renderHtml(codeString(date));
      expect(fx.host.querySelectorAll("wbr")).toHaveLength(0);
      expect(fx.host).toHaveTextContent(`"${date}"`);
    },
  );

  it("escapes a string that holds markup", () => {
    const fx = renderHtml(codeString("<b>"));
    expect(fx.host.querySelector("b")).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const fx = renderHtml(
      codeString("2024-06-15T10:30:00+02:00[Europe/Berlin]"),
    );
    await expectNoAxeViolations(fx.host);
  });
});
