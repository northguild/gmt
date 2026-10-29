import { describe, expect, it } from "vitest";
import { PROBE_ZONES, serversMarkdown } from "./canada-clock-change";
import { CANADA_MINIMUMS } from "../data/canada-runtime-minimums";
import { minimumsMarkdown } from "../data/clock-change-minimums";
import { KEY_POINTS } from "../data/canada-key-points";
import { keyPointsMarkdown } from "../data/clock-change-text";
import { mapPalette } from "./zone-map.fixture";

/**
 * The map's class strokes against the map background and the land (WCAG 1.4.11, 3:1). The map and
 * its swatches are dark islands, so the dark theme's token values apply in both themes. The
 * fixture reads the values from the zone-map module, so a change to it is measured.
 */
const { sea, land, strokes, contrast } = mapPalette();

describe("the map's class strokes", () => {
  it.each(strokes)(
    "%s holds 3:1 against the map background",
    (_name, stroke) => {
      expect(contrast(stroke, sea)).toBeGreaterThanOrEqual(3);
    },
  );
  it.each(strokes)(
    "%s also holds 3:1 against the land around the zones",
    (_name, stroke) => {
      expect(contrast(stroke, land)).toBeGreaterThanOrEqual(3);
    },
  );
});

describe("the servers card and the key points on the text surfaces", () => {
  it("the markdown twin carries the command and the expected output", () => {
    const md = serversMarkdown();
    expect(md).toContain("## Test your own servers");
    expect(md).toContain("node -e");
    expect(md).toContain("`Vancouver` -07:00");
  });
  it("names the places as code chips", () => {
    const md = keyPointsMarkdown(KEY_POINTS);
    for (const place of [
      "British Columbia",
      "Alberta",
      "Northwest Territories",
      "Manitoba",
    ]) {
      expect(md).toContain(`\`${place}\``);
    }
    expect(KEY_POINTS).toHaveLength(2);
    expect(md).toContain("[Test your own servers](#canada-servers-title)");
    expect(md).toContain("[Did your saved events move?](#canada-stored-title)");
    expect(md).toContain("For developers: three checks");
  });
});

describe("the Upgrade to at least card", () => {
  it("gives every row an https source, except the one that says to restart", () => {
    for (const row of CANADA_MINIMUMS.rows) {
      if (row.name === "Mac and iPhone") {
        expect(row.sources).toEqual([]);
        continue;
      }
      expect(row.sources.length, row.name).toBeGreaterThan(0);
      for (const source of row.sources) {
        expect(source.href, `${row.name}: ${source.label}`).toMatch(
          /^https:\/\/[^\s]+$/,
        );
      }
    }
  });
  it("names the same tz data release the probe facts end on", () => {
    const releases = PROBE_ZONES.map((fact) => fact.release).sort();
    expect(releases.at(-1)).toBe("2026e");
    expect(CANADA_MINIMUMS.intro).toContain("2026e");
    const linux = CANADA_MINIMUMS.rows.filter((row) =>
      /Alpine|Ubuntu|Fedora/.test(row.name),
    );
    for (const row of linux) {
      expect(JSON.stringify(row.parts), row.name).toContain("2026e");
    }
  });
  it("reaches the markdown twin with its sources, and carries no date or not-fixed row", () => {
    const md = minimumsMarkdown(CANADA_MINIMUMS);
    expect(md).toContain("## Upgrade to at least");
    expect(md).toContain("`26.11.0`");
    expect(md).toContain("https://chromiumdash.appspot.com/releases");
    expect(serversMarkdown()).toContain("## Upgrade to at least");
    expect(md).not.toMatch(/not fixed|Windows \(|statute/i);
  });
  it("ends with one plain note about the device, and the note names no stale-browser function", () => {
    expect(CANADA_MINIMUMS.note).not.toMatch(
      /classifyStoredZoned|offsetMismatch|resolveLocal|convertUtcToZoned/,
    );
    expect(minimumsMarkdown(CANADA_MINIMUMS)).toContain(CANADA_MINIMUMS.note);
  });
});
