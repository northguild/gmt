import { Temporal } from "@js-temporal/polyfill";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  EARTH_HALF_ANGLE_DEG,
  MOON_OFFSET_DEG,
  getPlanetZones,
  isGeographic,
  labelOf,
  moonCameraPoint,
  pointFor,
  resolvePlace,
  rotationFor,
  setPlanetZones,
  setPoints,
  zoomFor,
} from "./places";
import { STAGE } from "~/slides/give-me-temporal/stage-data";
import { moonRaDec, siderealDeg, toUnit } from "~/lib/sky-math";
import { createCamera, project } from "~/lib/globe/camera";

// The named places come from the deck's own data; the library holds none.
beforeAll(() => setPoints(STAGE.points));
afterAll(() => setPoints({}));

/** A fixed instant, 2027-02-06 (the Chinese New Year the deck's day-off slide is about), noon UTC. */
const INSTANT = Temporal.Instant.from("2027-02-06T12:00:00Z").epochMilliseconds;
const ctx = { instantMs: INSTANT, pins: [] as [number, number][] };

/** The angle between two Earth points, degrees. */
function arc(a: readonly [number, number], b: readonly [number, number]) {
  const [x1, y1, z1] = toUnit(a[0], a[1]);
  const [x2, y2, z2] = toUnit(b[0], b[1]);
  return (
    (Math.acos(Math.max(-1, Math.min(1, x1 * x2 + y1 * y2 + z1 * z2))) * 180) /
    Math.PI
  );
}

describe("resolvePlace", () => {
  it("looks a zone up in the coordinate table", () => {
    const place = resolvePlace("Europe/Helsinki");
    expect(place).toMatchObject({ kind: "zone", zone: "Europe/Helsinki" });
    expect(isGeographic(place)).toBe(true);
    if (place.kind === "zone") {
      expect(place.lat).toBeCloseTo(60.17, 1);
      expect(place.lng).toBeCloseTo(24.97, 1);
    }
  });

  it("accepts UTC", () => {
    expect(resolvePlace("UTC")).toMatchObject({ kind: "zone", lng: 0 });
  });

  it("throws for a zone the table lacks, not a default", () => {
    expect(() => resolvePlace("Mars/Olympus_Mons")).toThrow(/coordinate table/);
  });

  it("throws for a word it does not know", () => {
    expect(() => resolvePlace("narnia")).toThrow(/Unknown slide place/);
  });

  it("resolves the keywords", () => {
    for (const kind of ["moon", "overview", "wall", "planet"] as const) {
      expect(resolvePlace(kind).kind).toBe(kind);
      expect(isGeographic(resolvePlace(kind))).toBe(false);
    }
  });

  it("resolves every point, and each one cites a source", () => {
    for (const [name, entry] of Object.entries(STAGE.points)) {
      expect(entry.source.length).toBeGreaterThan(10);
      expect(resolvePlace(name)).toMatchObject({
        kind: "point",
        label: entry.label,
      });
    }
  });

  it("names a place for a pin", () => {
    const zone = resolvePlace("Asia/Kolkata");
    const point = resolvePlace("galicia");
    if (zone.kind !== "zone" || point.kind !== "point") throw new Error("kind");
    expect(labelOf(zone)).toBe("Kolkata");
    expect(labelOf(point)).toBe("Galicia");
  });
});

describe("rotationFor", () => {
  it("negates longitude and latitude for a zone and a point", () => {
    expect(rotationFor(resolvePlace("galicia"), ctx)).toEqual([
      8.5448, -42.8782,
    ]);
    const [lam, phi] = rotationFor(resolvePlace("Asia/Tokyo"), ctx);
    expect(lam).toBeCloseTo(-139.74, 1);
    expect(phi).toBeCloseTo(-35.65, 1);
  });

  it("centres the overview and the wall on the mean of the pins", () => {
    const pins: [number, number][] = [
      [10, 0],
      [30, 0],
    ];
    const withPins = { ...ctx, pins };
    expect(rotationFor(resolvePlace("overview"), withPins)[0]).toBeCloseTo(
      -20,
      6,
    );
    expect(rotationFor(resolvePlace("wall"), withPins)).toEqual(
      rotationFor(resolvePlace("overview"), withPins),
    );
  });

  it("takes the short way over the date line for the mean", () => {
    const pins: [number, number][] = [
      [170, 0],
      [-170, 0],
    ];
    const [lam] = rotationFor(resolvePlace("overview"), { ...ctx, pins });
    expect(Math.abs(lam)).toBeCloseTo(180, 6);
  });

  it("centres the planet on the planet zones, and takes a new list", () => {
    const before = [...getPlanetZones()];
    try {
      setPlanetZones(["Asia/Tokyo"]);
      const [lng, lat] = pointFor(resolvePlace("planet"), ctx);
      expect(lng).toBeCloseTo(139.74, 1);
      expect(lat).toBeCloseTo(35.65, 1);
      expect(() => setPlanetZones(["Nowhere/Land"])).toThrow();
      expect(getPlanetZones()).toEqual(["Asia/Tokyo"]);
    } finally {
      setPlanetZones(before);
    }
  });

  it("zooms out for the views that show more than a place", () => {
    expect(zoomFor(resolvePlace("Asia/Tokyo"))).toBe(1);
    expect(zoomFor(resolvePlace("moon"))).toBeLessThan(1);
    expect(zoomFor(resolvePlace("overview"))).toBeLessThan(1);
  });
});

describe("the Moon", () => {
  it("is placed at the instant the context gives", () => {
    const later = INSTANT + 3 * 86_400_000;
    expect(
      pointFor(resolvePlace("moon"), { ...ctx, instantMs: later }),
    ).toEqual(moonCameraPoint(later));
  });

  it("looks from the antipode of the sublunar point, turned by the offset", () => {
    const { ra, dec } = moonRaDec(INSTANT);
    const sublunar: [number, number] = [ra - siderealDeg(INSTANT), dec];
    const wrapped: [number, number] = [((sublunar[0] + 540) % 360) - 180, dec];
    const camera = moonCameraPoint(INSTANT);
    // The camera's point is MOON_OFFSET_DEG from the antipode, so 180 - offset from the sublunar point.
    expect(arc(camera, wrapped)).toBeCloseTo(180 - MOON_OFFSET_DEG, 3);
  });

  it("keeps the Moon outside the Earth's disc", () => {
    const { radius } = moonRaDec(INSTANT);
    // The Moon is MOON_OFFSET_DEG off the view axis; the disc fills EARTH_HALF_ANGLE_DEG of it.
    expect(MOON_OFFSET_DEG - radius).toBeGreaterThan(EARTH_HALF_ANGLE_DEG);
  });

  it("holds at other instants", () => {
    for (let day = 0; day < 30; day += 1) {
      const instant = INSTANT + day * 86_400_000;
      const { ra, dec } = moonRaDec(instant);
      const wrapped: [number, number] = [
        ((ra - siderealDeg(instant) + 540) % 360) - 180,
        dec,
      ];
      expect(arc(moonCameraPoint(instant), wrapped)).toBeCloseTo(
        180 - MOON_OFFSET_DEG,
        3,
      );
    }
  });
});

describe("the pole over a zone's clock", () => {
  const helsinki = resolvePlace("Europe/Helsinki");
  const L = helsinki.kind === "zone" ? helsinki.lng : NaN;

  /** Where a point lands on screen, as degrees clockwise from straight up, like a clock hand. */
  function screenAngle(
    rotation: [number, number],
    lng: number,
    lat: number,
  ): number {
    const camera = createCamera(rotation);
    camera.radius = 100;
    const at = project(camera, lng, lat);
    expect(at.visible).toBe(true);
    // Screen y runs down, so "up" is minus y.
    return ((Math.atan2(at.x, -at.y) * 180) / Math.PI + 360) % 360;
  }

  it("resolves pole:<zone> to the zone's own point, and is no stop on the route", () => {
    const place = resolvePlace("pole:Europe/Helsinki");
    expect(place).toMatchObject({
      kind: "pole",
      zone: "Europe/Helsinki",
      lng: L,
    });
    expect(isGeographic(place)).toBe(false);
  });

  it("rejects a pole over an unknown zone", () => {
    expect(() => resolvePlace("pole:Mars/Olympus_Mons")).toThrow(
      /coordinate table/,
    );
  });

  it("looks straight down on the North Pole at the clock's size", () => {
    const place = resolvePlace("pole:Europe/Helsinki");
    const wallMinutes = () => 13 * 60 + 17;
    expect(pointFor(place, { ...ctx, wallMinutes })[1]).toBe(90);
    expect(zoomFor(place)).toBe(1);
  });

  it.each([
    ["00:00", 0],
    ["06:00", 6 * 60],
    ["13:17", 13 * 60 + 17],
    ["18:00", 18 * 60],
    ["23:45", 23 * 60 + 45],
  ])("puts the zone under a 24-hour hour hand at %s", (_, minutes) => {
    const place = resolvePlace("pole:Europe/Helsinki");
    const wallMinutes = (zone: string) =>
      zone === "Europe/Helsinki" ? minutes : null;
    const rotation = rotationFor(place, { ...ctx, wallMinutes });
    const hand = (minutes / 1440) * 360;
    const venue = screenAngle(
      rotation,
      L,
      helsinki.kind === "zone" ? helsinki.lat : NaN,
    );
    const off = Math.abs(((venue - hand + 540) % 360) - 180);
    expect(off).toBeLessThan(0.01);
  });

  it("puts the zone straight down, the noon hand, until the wall time is known", () => {
    const place = resolvePlace("pole:Europe/Helsinki");
    const rotation = rotationFor(place, ctx);
    expect(screenAngle(rotation, L, 60)).toBeCloseTo(180, 2);
  });

  it("draws the 24 hour marks over meridians 15 degrees apart", () => {
    const place = resolvePlace("pole:Europe/Helsinki");
    const rotation = rotationFor(place, {
      ...ctx,
      wallMinutes: () => 13 * 60 + 17,
    });
    const angles = Array.from({ length: 24 }, (_, k) =>
      screenAngle(rotation, L + 15 * k, 45),
    );
    angles.forEach((a, k) => {
      const next = angles[(k + 1) % 24]!;
      expect(Math.abs(((a - next + 540) % 360) - 180)).toBeCloseTo(15, 6);
    });
  });
});
