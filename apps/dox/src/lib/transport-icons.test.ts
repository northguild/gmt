/**
 * @vitest-environment jsdom
 *
 * `DOMParser` needs jsdom, but nothing here is a widget — this stays a pure
 * markup test, no library import.
 */
/// <reference types="vitest/globals" />
import {
  TRANSPORT_ICON_PATHS,
  TRANSPORT_MODES,
  transportIcon,
} from "./transport-icons";

function parseSvg(markup: string): Document {
  return new DOMParser().parseFromString(markup, "image/svg+xml");
}

describe("TRANSPORT_ICON_PATHS", () => {
  it("has an icon for every listed mode, plus the generic fallback", () => {
    for (const mode of TRANSPORT_MODES) {
      expect(TRANSPORT_ICON_PATHS[mode]).toBeTruthy();
    }
    expect(TRANSPORT_ICON_PATHS.generic).toBeTruthy();
  });

  it("is well-formed markup for every entry, wrapped in an <svg>", () => {
    for (const [mode, inner] of Object.entries(TRANSPORT_ICON_PATHS)) {
      const doc = parseSvg(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${inner}</svg>`,
      );
      expect(
        doc.querySelector("parsererror"),
        `${mode} icon markup`,
      ).toBeNull();
    }
  });
});

describe("transportIcon", () => {
  it("returns a well-formed, decorative <svg> for every known mode", () => {
    for (const mode of TRANSPORT_MODES) {
      const svg = transportIcon(mode);
      expect(svg).toContain('viewBox="0 0 24 24"');
      expect(svg).toContain('aria-hidden="true"');
      const doc = parseSvg(svg);
      expect(doc.querySelector("parsererror"), mode).toBeNull();
    }
  });

  it("is case- and whitespace-insensitive to the mode tag", () => {
    expect(transportIcon(" Truck ")).toBe(transportIcon("truck"));
  });

  it("falls back to the generic icon for an unknown or blank mode", () => {
    expect(transportIcon("blimp")).toBe(transportIcon("generic"));
    expect(transportIcon("")).toBe(transportIcon("generic"));
  });

  it("gives an accessible name instead of aria-hidden when labelled", () => {
    const svg = transportIcon("ship", { label: "Ship" });
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Ship"');
    expect(svg).not.toContain("aria-hidden");
  });

  it("escapes a label used as an accessible name", () => {
    const svg = transportIcon("ship", { label: '"><script>' });
    expect(svg).not.toContain("<script>");
  });

  it("sizes and classes the svg from options", () => {
    const svg = transportIcon("air", { size: 24, className: "gmt-icon" });
    expect(svg).toContain('width="24"');
    expect(svg).toContain('height="24"');
    expect(svg).toContain('class="gmt-icon"');
  });
});
