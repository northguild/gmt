import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it, vi } from "vitest";
import { subsolarPoint } from "~/lib/globe/sun";
import {
  aimBody,
  AIM_ZOOMS,
  boxRadius,
  subBodyPoint,
  type AimLens,
  type Box,
} from "./sky-aim";
import { bodyRow, type SkyBodyId } from "./sky-registry";
import {
  moonRaDec,
  siderealDeg,
  skyLens,
  toUnit,
  viewMatrix,
  bodyOnScreen,
} from "./sky-math";

const INSTANTS = [
  "2027-02-06T00:00:00Z",
  "2027-02-06T12:00:00Z",
  "2027-04-20T06:30:00Z",
  "2027-07-01T18:45:00Z",
  "2027-09-23T03:10:00Z",
  "2027-12-21T21:00:00Z",
].map((text) => Temporal.Instant.from(text).epochMilliseconds);

const BODIES: SkyBodyId[] = ["sun", "moon"];
/** The pinhole's focal length at zoom 1 for a 374 px disc (G = sqrt(P^2 - 1)). */
const FOCAL = 374 * Math.sqrt(6.6107 ** 2 - 1);

const LENSES: { name: string; lens: AimLens; avoid: Box[] }[] = [
  {
    name: "1440x900 with a right-hand drawer",
    lens: {
      width: 1440,
      height: 900,
      centre: { x: 720, y: 450 },
      focalAtRest: FOCAL,
      rotation: [0, 0],
    },
    avoid: [{ left: 1060, top: 0, right: 1440, bottom: 900 }],
  },
  {
    name: "1280x720",
    lens: {
      width: 1280,
      height: 720,
      centre: { x: 640, y: 360 },
      focalAtRest: FOCAL * 0.7,
      rotation: [20, 10],
    },
    avoid: [],
  },
  {
    name: "390x844 with a bottom sheet",
    lens: {
      width: 390,
      height: 844,
      centre: { x: 195, y: 400 },
      focalAtRest: FOCAL * 0.3,
      rotation: [-40, 20],
    },
    avoid: [{ left: 0, top: 640, right: 390, bottom: 844 }],
  },
];

/** The body's disc where the aim says it lands. */
function landing(
  body: SkyBodyId,
  instantMs: number,
  lens: AimLens,
  rotation: readonly [number, number],
  zoom: number,
) {
  const row = bodyRow(body);
  const at = row.place(instantMs, rotation)!;
  return bodyOnScreen(
    skyLens(lens.width, lens.height, {
      x: lens.centre.x,
      y: lens.centre.y,
      radius: zoom * lens.focalAtRest * Math.tan(Math.asin(1 / 6.6107)),
    }),
    viewMatrix(rotation, instantMs),
    toUnit(at.ra, at.dec),
    at.radius,
    lens.width,
    lens.height,
    row.reach,
  );
}

describe("aimBody", () => {
  for (const { name, lens, avoid } of LENSES) {
    for (const body of BODIES) {
      it(`${body} lands clear beside the limb: ${name}`, () => {
        for (const instant of INSTANTS) {
          const aim = aimBody(body, instant, lens, avoid);
          expect(aim, `${body} at ${instant}`).not.toBeNull();
          if (!aim) continue;
          const shown = landing(body, instant, lens, aim.rotation, aim.zoom);
          expect(shown).not.toBeNull();
          if (!shown) continue;
          const earth =
            aim.zoom * lens.focalAtRest * Math.tan(Math.asin(1 / 6.6107));
          const away = Math.hypot(
            shown.x - lens.centre.x,
            shown.y - lens.centre.y,
          );
          expect(away).toBeGreaterThan(earth + shown.r);
          const box = boxRadius(body, shown.r);
          expect(shown.x - box).toBeGreaterThanOrEqual(15);
          expect(shown.y - box).toBeGreaterThanOrEqual(15);
          expect(shown.x + box).toBeLessThanOrEqual(lens.width - 15);
          expect(shown.y + box).toBeLessThanOrEqual(lens.height - 15);
          for (const rect of avoid) {
            const dx =
              shown.x - Math.max(rect.left, Math.min(shown.x, rect.right));
            const dy =
              shown.y - Math.max(rect.top, Math.min(shown.y, rect.bottom));
            expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(box - 0.5);
          }
          expect(AIM_ZOOMS).toContain(aim.zoom);
        }
      });
    }
  }

  it("takes zoom 2 in a roomy hero and a smaller one in a cramped hero", () => {
    const roomy = {
      lens: {
        width: 3200,
        height: 2000,
        centre: { x: 1600, y: 1000 },
        focalAtRest: FOCAL,
        rotation: [0, 0] as const,
      },
    };
    const cramped = LENSES[2]!;
    for (const body of BODIES) {
      expect(aimBody(body, INSTANTS[1]!, roomy.lens, [])?.zoom).toBe(2);
      const small = aimBody(body, INSTANTS[1]!, cramped.lens, cramped.avoid);
      expect(small).not.toBeNull();
    }
  });

  it("gives null for a lens covered by one rectangle", () => {
    const lens: AimLens = {
      width: 200,
      height: 200,
      centre: { x: 100, y: 100 },
      focalAtRest: FOCAL * 0.1,
      rotation: [0, 0],
    };
    const cover: Box[] = [{ left: 0, top: 0, right: 200, bottom: 200 }];
    for (const body of BODIES)
      expect(aimBody(body, INSTANTS[0]!, lens, cover)).toBeNull();
  });

  it("aims the Moon by its parallax, nearly a degree or more from a geocentric aim (least near apogee)", () => {
    const { lens, avoid } = LENSES[0]!;
    const row = bodyRow("moon");
    for (const instant of INSTANTS) {
      const seen = aimBody("moon", instant, lens, avoid)!;
      const spy = vi
        .spyOn(row, "place")
        .mockImplementation((at) => moonRaDec(at));
      let geo;
      try {
        geo = aimBody("moon", instant, lens, avoid)!;
      } finally {
        spy.mockRestore();
      }
      const apart = Math.hypot(
        ((seen.rotation[0] - geo.rotation[0] + 540) % 360) - 180,
        seen.rotation[1] - geo.rotation[1],
      );
      expect(apart).toBeGreaterThan(0.9);
    }
  });
});

describe("subBodyPoint", () => {
  it("is the subsolar point for the Sun", () => {
    for (const instant of INSTANTS) {
      const [lng, lat] = subBodyPoint("sun", instant);
      const sun = subsolarPoint(instant);
      expect(lat).toBeCloseTo(sun.lat, 6);
      expect(((lng - sun.lng + 540) % 360) - 180).toBeCloseTo(0, 6);
    }
  });

  it("is the sublunar point for the Moon", () => {
    for (const instant of INSTANTS.slice(0, 3)) {
      const { ra, dec } = moonRaDec(instant);
      const expected = toUnit(ra - siderealDeg(instant), dec);
      const [lng, lat] = subBodyPoint("moon", instant);
      const got = toUnit(lng, lat);
      for (const i of [0, 1, 2] as const)
        expect(got[i]).toBeCloseTo(expected[i], 9);
    }
  });
});
