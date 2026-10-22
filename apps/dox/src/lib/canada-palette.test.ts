import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PROBE_ZONES, serversMarkdown } from "./canada-clock-change";
import {
  MINIMUMS_INTRO,
  MINIMUMS_NOTE,
  RUNTIME_MINIMUMS,
  minimumsMarkdown,
} from "../data/canada-runtime-minimums";
import { keyPointsMarkdown, KEY_POINTS } from "../data/canada-key-points";
import { renderCanadaClockChangeTemplate } from "./canada-clock-change-mount";

/**
 * The map's class strokes against the map background (WCAG 1.4.11, 3:1). The map and its swatches
 * are `gmt-theme-dark` islands, so the dark theme's token values apply in both themes. Values are
 * read from the two stylesheets, so a change to either is measured.
 */
const styles = resolve(__dirname, "../styles");
const tokens = readFileSync(resolve(styles, "gmt-tokens.css"), "utf8");
const canada = readFileSync(resolve(styles, "canada-clock-change.css"), "utf8");

type Rgb = [number, number, number];
const darkBlock = tokens.slice(tokens.indexOf(".gmt-theme-dark {"), tokens.indexOf('[data-theme="light"] {'));
const token = (name: string): Rgb => {
  const m = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(darkBlock);
  if (!m) throw new Error(`no ${name}`);
  const h = m[1]!;
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
};
const alpha = (name: string): number => {
  const m = new RegExp(`--canada-${name}:\\s*([0-9.]+);`).exec(canada);
  if (!m) throw new Error(`no ${name}`);
  return Number(m[1]);
};
const lum = (c: Rgb) => {
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const ratio = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const mix = (a: Rgb, b: Rgb, t: number): Rgb =>
  a.map((v, i) => v * t + b[i]! * (1 - t)) as Rgb;

describe("the map's class strokes", () => {
  const sea = mix(token("--gmt-cyan"), token("--gmt-globe-casing"), alpha("sea-cyan"));
  const cases: [string, Rgb][] = [
    ["never changes: cyan", mix(token("--gmt-cyan"), sea, alpha("none-edge-a"))],
    ["still changes: gold (the dark -ink is an alias of it)", mix(token("--gmt-dst-gold"), sea, alpha("changes-edge-a"))],
    ["stops in 2026: purple ink", token("--gmt-dst-purple-ink")],
    ["selected: green", token("--gmt-globe-selected")],
  ];
  it.each(cases)("%s holds 3:1 against the map background", (_name, stroke) => {
    expect(ratio(stroke, sea)).toBeGreaterThanOrEqual(3);
  });
  it("the stopped class is the strongest fill", () => {
    expect(alpha("stopped-fill-a")).toBeGreaterThan(alpha("changes-fill-a"));
    expect(alpha("changes-fill-a")).toBeGreaterThan(alpha("none-fill-a"));
  });
});

describe("the servers card and the key points on the text surfaces", () => {
  it("the markdown twin carries the command and the expected output", () => {
    const md = serversMarkdown();
    expect(md).toContain("## Test your own servers");
    expect(md).toContain("node -e");
    expect(md).toContain("`Vancouver` -07:00");
  });
  it("puts the cards in reading order: key points, browser, map, clocks, servers, minimums, changes, help, saved times", () => {
    const html = renderCanadaClockChangeTemplate({ keyPoints: true });
    expect(html.match(/id="canada-servers-title"/g)).toHaveLength(1);
    const order = [
      "canada-keypoints-title",
      "canada-probe-title",
      "canada-map-title",
      "canada-clocks-title",
      "canada-servers-title",
      "canada-minimums-title",
      "canada-changes-title",
      "canada-help-title",
      "canada-stored-title",
    ].map((id) => html.indexOf(`id="${id}"`));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain("Once your runtime is updated, every gmt zoned function gives the right time for these places.");
    expect(html).toContain('/reference/zoned/classify/classifyStoredZoned/"');
    expect(html).toContain('data-role="copy-status" role="status"');
  });
  it("leaves the key points out of the chat copy", () => {
    expect(renderCanadaClockChangeTemplate()).not.toContain("canada-keypoints-title");
  });
  it("names the places as code chips", () => {
    const md = keyPointsMarkdown();
    for (const place of ["British Columbia", "Alberta", "Northwest Territories", "Manitoba"]) {
      expect(md).toContain(`\`${place}\``);
    }
    expect(KEY_POINTS).toHaveLength(2);
    expect(md).toContain("[Test your own servers](#canada-servers-title)");
    expect(md).toContain("[Check saved times](#canada-stored-title)");
    expect(md).toContain("For developers: three checks");
  });
});

describe("the Upgrade to at least card", () => {
  it("gives every row an https source, except the one that says to restart", () => {
    for (const row of RUNTIME_MINIMUMS) {
      if (row.name === "Mac and iPhone") {
        expect(row.sources).toEqual([]);
        continue;
      }
      expect(row.sources.length, row.name).toBeGreaterThan(0);
      for (const source of row.sources) {
        expect(source.href, `${row.name}: ${source.label}`).toMatch(/^https:\/\/[^\s]+$/);
      }
    }
  });
  it("names the same tz data release the probe facts end on", () => {
    const releases = PROBE_ZONES.map((fact) => fact.release).sort();
    expect(releases.at(-1)).toBe("2026e");
    expect(MINIMUMS_INTRO).toContain("2026e");
    const linux = RUNTIME_MINIMUMS.filter((row) => /Alpine|Ubuntu|Fedora/.test(row.name));
    for (const row of linux) {
      expect(JSON.stringify(row.parts), row.name).toContain("2026e");
    }
  });
  it("reaches the markdown twin with its sources, and carries no date or not-fixed row", () => {
    const md = minimumsMarkdown();
    expect(md).toContain("## Upgrade to at least");
    expect(md).toContain("`26.11.0`");
    expect(md).toContain("https://chromiumdash.appspot.com/releases");
    expect(serversMarkdown()).toContain("## Upgrade to at least");
    expect(md).not.toMatch(/not fixed|Windows \(|statute/i);
  });
  it("ends with one plain note about the device, and the page names no stale-browser function", () => {
    const html = renderCanadaClockChangeTemplate({ keyPoints: true });
    expect(html).toContain("gmt uses the time-zone rules of the device it runs on.");
    expect(MINIMUMS_NOTE).not.toMatch(/classifyStoredZoned|offsetMismatch|resolveLocal|convertUtcToZoned/);
    expect(minimumsMarkdown()).toContain(MINIMUMS_NOTE);
    expect(html).not.toContain("Your users\u2019 browsers may be out of date");
    expect(html).not.toContain("convertUtcToZoned");
    expect(html).not.toContain("offsetMismatch");
  });
});
