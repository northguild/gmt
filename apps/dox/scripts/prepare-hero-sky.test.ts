import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodeStars } from "../src/lib/sky";
import { toUnit } from "../src/lib/sky-math";
import {
  COMMIT,
  LIST_BUDGET,
  RECORD,
  colourClass,
  pack,
} from "./prepare-hero-sky.mjs";

/**
 * The hero's star list and its share-alike sidecar.
 *
 * HYG v4.4 is offered under CC BY-SA 4.0, so the packed list is an adaptation that carries the
 * licence, the pinned commit and the hash of the catalogue it came from, and the repository's MIT
 * licence is said not to cover it.
 */
const assets = resolve(process.cwd(), "src/assets");
const bytes = readFileSync(resolve(assets, "hero-sky.bin"));
const sidecar = JSON.parse(
  readFileSync(resolve(assets, "hero-sky.json"), "utf8"),
);
const list = decodeStars(
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer,
);

/** The angle, degrees, between star `i` of a decoded list and a unit vector. */
const apart = (unit: Float64Array, i: number, [x, y, z]: number[]): number =>
  (Math.acos(
    Math.min(1, unit[i * 3]! * x + unit[i * 3 + 1]! * y + unit[i * 3 + 2]! * z),
  ) *
    180) /
  Math.PI;

describe("hero-sky.json", () => {
  it("names the catalogue, the pinned commit and its hash", () => {
    expect(sidecar.source.catalogue).toContain("HYG v4.4");
    expect(sidecar.source.commit).toBe(COMMIT);
    expect(sidecar.source.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(sidecar.source.repository).toBe(
      "https://codeberg.org/astronexus/hyg",
    );
  });

  it("carries the share-alike licence and says the MIT licence does not cover the list", () => {
    expect(sidecar.license).toBe("CC-BY-SA-4.0");
    expect(sidecar.licenseUrl).toBe(
      "https://creativecommons.org/licenses/by-sa/4.0/",
    );
    expect(sidecar.notice).toContain("CC BY-SA 4.0");
    expect(sidecar.notice).toContain("MIT");
  });
});

describe("hero-sky.bin", () => {
  it("is six bytes a star and matches the sidecar", () => {
    expect(bytes.length).toBe(RECORD * sidecar.starCount);
    expect(bytes.length).toBe(sidecar.list.bytes);
    expect(list.count).toBe(sidecar.starCount);
  });

  it("stays within the size budget", () => {
    expect(bytes.length).toBeLessThanOrEqual(LIST_BUDGET);
  });

  it("matches the hash the sidecar records", () => {
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      sidecar.list.sha256,
    );
  });

  it("holds no star fainter than the magnitude limit", () => {
    expect(Math.max(...list.mag)).toBeLessThanOrEqual(sidecar.magnitudeLimit);
  });

  it("lists the faintest stars first", () => {
    for (let i = 1; i < list.count; i++)
      expect(list.mag[i]!).toBeLessThanOrEqual(list.mag[i - 1]!);
  });

  it.each([
    ["Betelgeuse", 5.919529, 7.407063],
    ["Rigel", 5.242298, -8.20164],
    ["Sirius", 6.752481, -16.716116],
  ])(
    "places %s within 0.01 degree of its J2000 position",
    (_name, hours, dec) => {
      let nearest = Infinity;
      for (let i = 0; i < list.count; i++) {
        nearest = Math.min(
          nearest,
          apart(list.unit, i, toUnit(hours * 15, dec)),
        );
      }
      expect(nearest).toBeLessThan(0.01);
    },
  );
});

describe("pack", () => {
  const star = (id: number, mag: number, ci: number | null = 0.6) => ({
    id,
    ra: 90,
    dec: 10,
    mag,
    ci,
  });

  it("skips the Sun and anything fainter than the limit, faintest first", () => {
    const { bytes: packed, count } = pack(
      [star(0, -26.7), star(1, 1), star(2, 5.4), star(3, 6)],
      5.5,
    );
    expect(count).toBe(2);
    expect(packed.readUInt8(4)).toBe(Math.round(7.4 * 20));
    expect(packed.readUInt8(RECORD + 4)).toBe(60);
  });

  it("wraps a right ascension of 360 degrees to zero", () => {
    const { bytes: packed } = pack([{ ...star(1, 1), ra: 360 }], 5.5);
    expect(packed.readUInt16LE(0)).toBe(0);
  });

  it("sorts the colour index into four classes, and a missing one into the second", () => {
    expect([-0.2, 0.2, 0.7, 1.4, null].map(colourClass)).toEqual([
      0, 1, 2, 3, 1,
    ]);
  });
});
