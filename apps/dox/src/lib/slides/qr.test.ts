import { describe, expect, it } from "vitest";
import { MAX_VERSION, QUIET_ZONE, qrModel } from "./qr";

const NORTHGUILD = "https://northguild.dev/";
const LINKEDIN = "https://www.linkedin.com/in/craigocurtis/";

/** The modules a path of unit squares paints, as "x,y" keys. */
const painted = (path: string): Set<string> =>
  new Set(
    [...path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((m) => `${m[1]},${m[2]}`),
  );

describe("qrModel", () => {
  it("is the same code for the same address", () => {
    expect(qrModel(NORTHGUILD)).toEqual(qrModel(NORTHGUILD));
  });

  it("makes the view box the modules plus a four-module quiet zone on each side", () => {
    const { size, extent } = qrModel(NORTHGUILD);
    expect(QUIET_ZONE).toBe(4);
    expect(extent).toBe(size + 8);
  });

  it("uses error correction H: the two addresses are versions 3 and 5", () => {
    // At H a version-3 code holds 24 bytes and a version-5 code 44 (ISO/IEC 18004, table 7).
    expect(qrModel(NORTHGUILD).size).toBe(17 + 4 * 3);
    expect(qrModel(LINKEDIN).size).toBe(17 + 4 * 5);
  });

  it.each([NORTHGUILD, LINKEDIN])(
    "centres an odd hole of about 30 %% of %s, clear of the eyes, the timing lines and the alignment pattern",
    (url) => {
      const { size, hole } = qrModel(url);
      const at = hole.x - QUIET_ZONE;
      expect(hole.y).toBe(hole.x);
      expect(hole.side % 2).toBe(1);
      expect(2 * at + hole.side).toBe(size);
      expect(Math.abs(hole.side / size - 0.3)).toBeLessThan(0.05);
      expect(at).toBeGreaterThan(7);
      expect(at + hole.side - 1).toBeLessThan(size - 9);
    },
  );

  it("paints no data module inside the hole or the eyes", () => {
    const { size, modules, hole } = qrModel(LINKEDIN);
    for (const key of painted(modules)) {
      const [x, y] = key.split(",").map(Number) as [number, number];
      const inHole =
        x >= hole.x &&
        x < hole.x + hole.side &&
        y >= hole.y &&
        y < hole.y + hole.side;
      expect(inHole, key).toBe(false);
      const mx = x - QUIET_ZONE;
      const my = y - QUIET_ZONE;
      const inEye =
        (mx < 7 || mx >= size - 7) && (my < 7 || (my >= size - 7 && mx < 7));
      expect(inEye, key).toBe(false);
    }
  });

  it("draws three eyes, each a ring and a pupil", () => {
    const { eyes } = qrModel(NORTHGUILD);
    expect(eyes.match(/M/g)).toHaveLength(9);
  });

  it("refuses an address that needs a code past version 6", () => {
    expect(MAX_VERSION).toBe(6);
    expect(() => qrModel(`https://northguild.dev/${"a".repeat(80)}`)).toThrow();
  });
});
