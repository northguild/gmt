import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COASTLINES,
  EARTH_IMAGERY,
  NE_TAG,
  renderDataCreditsHtml,
  TBB_TAG,
  TZ_BOUNDARIES,
  type DataCredit,
} from "./data-credits";

const STACK = { id: "globe-data-credits", placement: "stack" } as const;

describe("the coastline credit", () => {
  const html = renderDataCreditsHtml([TZ_BOUNDARIES, COASTLINES], {
    id: "canada-data-credits",
    placement: "corner",
  });

  it("is listed after the time zone boundaries, naming Natural Earth as public domain", () => {
    expect(html.indexOf("<dt>Time zone boundaries</dt>")).toBeLessThan(
      html.indexOf("<dt>Coastlines</dt>"),
    );
    expect(html.replace(/<[^>]+>/g, "")).toContain(
      `Natural Earth (public domain, ${NE_TAG}).`,
    );
  });

  it("links Natural Earth and the pinned tag", () => {
    expect(html).toContain(
      '<a href="https://www.naturalearthdata.com/" rel="noopener">Natural Earth</a>',
    );
    expect(html).toContain(
      `<a href="https://github.com/nvkelso/natural-earth-vector/releases/tag/${NE_TAG}" rel="noopener">${NE_TAG}</a>`,
    );
    expect(NE_TAG).toBe("v5.1.2");
  });
});

describe("renderDataCreditsHtml", () => {
  const html = renderDataCreditsHtml([TZ_BOUNDARIES, EARTH_IMAGERY], STACK);

  it("renders one button wired to one popover", () => {
    expect(html.match(/<button /g)).toHaveLength(1);
    expect(html).toContain('popovertarget="globe-data-credits"');
    expect(html).toContain('aria-label="Data credits"');
    expect(html).toContain('<div id="globe-data-credits"');
    expect(html).toContain(" popover>");
    expect(html).toContain('class="gmt-data-credits-button"');
    expect(html).toContain('aria-hidden="true"');
  });

  it("renders every label and every part of both credits", () => {
    expect(html).toContain("<dt>Time zone boundaries</dt>");
    expect(html).toContain("<dt>Earth imagery</dt>");
    const text = html.replace(/<[^>]+>/g, "");
    expect(text).toContain(
      "© OpenStreetMap contributors, timezone-boundary-builder (ODbL).",
    );
    expect(text).toContain(
      "NASA Earth Observatory (Blue Marble Next Generation).",
    );
  });

  it("links the exact sources", () => {
    expect(html).toContain(
      '<a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap contributors</a>',
    );
    expect(html).toContain(
      `<a href="https://github.com/evansiroky/timezone-boundary-builder/releases/tag/${TBB_TAG}" rel="noopener">timezone-boundary-builder</a>`,
    );
    expect(html).toContain(
      '<a href="https://opendatacommons.org/licenses/odbl/1-0/" rel="noopener">ODbL</a>',
    );
    expect(TBB_TAG).toBe("2026e");
  });

  it("carries the placement", () => {
    const corner = renderDataCreditsHtml([TZ_BOUNDARIES], {
      id: "tz-map-data-credits",
      placement: "corner",
    });
    expect(corner.match(/data-placement="corner"/g)).toHaveLength(2);
    expect(corner).toContain('popovertarget="tz-map-data-credits"');
    const start = renderDataCreditsHtml([TZ_BOUNDARIES], {
      id: "morocco-data-credits",
      placement: "corner-start",
    });
    expect(start.match(/data-placement="corner-start"/g)).toHaveLength(2);
    expect(html.match(/data-placement="stack"/g)).toHaveLength(2);
  });

  it("escapes every interpolation", () => {
    const hostile: DataCredit = {
      label: '<img src=x onerror="a">',
      parts: ['"quoted" & <b>', { text: "<i>t</i>", href: 'x" onclick="y' }],
    };
    const out = renderDataCreditsHtml([hostile], {
      id: 'a" onclick="b',
      placement: "corner",
    });
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<b>");
    expect(out).not.toContain("<i>");
    expect(out).not.toContain('onclick="');
    expect(out).toContain("&lt;img");
    expect(out).toContain("&quot;quoted&quot; &amp; &lt;b&gt;");
    expect(out).toContain('href="x&quot; onclick=&quot;y"');
  });

  it("returns an empty string for an empty list, so a drawing with nothing to credit gets no button", () => {
    expect(renderDataCreditsHtml([], STACK)).toBe("");
  });
});

/** WCAG 2.2 SC 1.4.11: a UI component's graphic needs 3:1 against what it sits on. */
describe("the button colour", () => {
  const styles = resolve(import.meta.dirname, "..", "styles");
  const tokens = readFileSync(resolve(styles, "gmt-tokens.css"), "utf8");
  const css = readFileSync(resolve(styles, "gmt-data-credits.css"), "utf8");

  /** A token's hex in a theme's block; an alias (`var(--gmt-cyan)`) is followed once. */
  const token = (scope: RegExp, name: string): number[] => {
    const block = tokens.match(scope)?.[0] ?? "";
    const value = block.match(
      new RegExp(`--gmt-${name}:\\s*(#[0-9a-f]{6}|var\\(--gmt-[a-z0-9-]+\\))`),
    )?.[1];
    if (!value) throw new Error(`--gmt-${name} not found`);
    const alias = value.match(/^var\(--gmt-([a-z0-9-]+)\)$/)?.[1];
    if (alias) return token(scope, alias);
    return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
  };
  const lum = (rgb: number[]) => {
    const [r, g, b] = rgb.map((c) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: number[], b: number[]) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const rule = css.match(/\.gmt-data-credits-button \{[^}]*\}/)?.[0] ?? "";
  const dark = /:root,\s*\.gmt-theme-dark \{[\s\S]*?\n\}/;
  const light = /\[data-theme="light"\] \{[\s\S]*?\n\}/;

  it("is the ice token on the surface-2 token, like the stack's own buttons", () => {
    expect(rule).toContain("color: var(--gmt-ice);");
    expect(rule).toContain("background: var(--gmt-surface-2);");
  });

  it.each([
    ["dark", dark],
    ["light", light],
  ] as const)("is at least 3:1 at rest on the %s theme", (_theme, scope) => {
    expect(
      ratio(token(scope, "ice"), token(scope, "surface-2")),
    ).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ["dark", dark],
    ["light", light],
  ] as const)(
    "is at least 3:1 when hovered or open on the %s theme",
    (_theme, scope) => {
      expect(css).toMatch(
        /:has\(\+ :popover-open\) \{[^}]*color: var\(--gmt-void\);[^}]*background: var\(--gmt-cyan-ink\);/,
      );
      expect(
        ratio(token(scope, "void"), token(scope, "cyan-ink")),
      ).toBeGreaterThanOrEqual(3);
    },
  );
});
