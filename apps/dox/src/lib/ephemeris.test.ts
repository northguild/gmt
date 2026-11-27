import { describe, expect, it } from "vitest";
import orbitText from "../assets/sky-orbits.json?raw";
import { CAMERA_ROTATION } from "../test/planet-pins";
import { bodyFromCamera, earthCover, type Orbits } from "./ephemeris";
import { RAD } from "./globe/pinhole";
import { loadPasses } from "./sky-pass";
import { AU, cameraAt, precessToDate, toUnit } from "./sky-math";
import { APOPHIS_SITES } from "../test/apophis-pins";

const orbits = JSON.parse(orbitText) as Orbits;
const placePass = loadPasses(orbits).place;
const DAY = 86_400_000;
const EPOCH_MS = 1_763_683_200_000;

function seen(t: number) {
  return bodyFromCamera(orbits, "vesta", t, cameraAt(CAMERA_ROTATION, t));
}

/** The angle between the view and Horizons' right ascension and declination, arcseconds. */
function off(t: number, ra: number, dec: number) {
  const unit = seen(t)!.unit;
  const truth = precessToDate(toUnit(ra, dec), t);
  const cos = unit[0] * truth[0] + unit[1] * truth[1] + unit[2] * truth[2];
  return (Math.acos(Math.min(1, cos)) / RAD) * 3600;
}

/* Horizons, COMMAND='4;' CENTER='coord@399' COORD_TYPE='CYLINDRICAL'
   SITE_COORD='30,39621.075,14420.892' TIME_TYPE='TT' TLIST_TYPE='JD' QUANTITIES='1,20'
   ANG_FORMAT='DEG' EXTRA_PREC='YES': the camera site's astrometric right ascension and declination. */
describe("Vesta from the camera", () => {
  it.each([
    [1768867200000, 306.711305739, -21.09639122],
    [1776643200000, 351.600465782, -8.167558127],
    [1785283200000, 25.997849403, 1.792648747],
    [1792195200000, 21.62471837, -3.668186729],
  ])("is within 45 arcseconds of Horizons at %d", (t, ra, dec) => {
    expect(off(t, ra, dec)).toBeLessThan(45);
  });

  it("is within 126 arcseconds at 700 days", () => {
    expect(off(1824076800000, 131.328664802, 18.361045884)).toBeLessThan(126);
  });

  it("is null 721 days from the epoch and drawn at 720", () => {
    expect(EPOCH_MS + 721 * DAY).toBe(1825977600000);
    expect(seen(EPOCH_MS + 721 * DAY)).toBeNull();
    expect(seen(EPOCH_MS + 720 * DAY)).not.toBeNull();
  });
});

/* The three sites are `apophis-pins.ts`'s: Horizons, COMMAND='99942' CENTER='coord@399'
   COORD_TYPE='CYLINDRICAL' SITE_COORD=<its longitude, rho, z> TIME_TYPE='UT' TLIST_TYPE='JD'
   QUANTITIES='1,9,20' ANG_FORMAT='DEG' EXTRA_PREC='YES'. */
describe("Apophis from the camera", () => {
  const view = ({ t, rotation }: (typeof APOPHIS_SITES)[number]) =>
    bodyFromCamera(orbits, "apophis", t, cameraAt(rotation, t), placePass)!;

  /* Measured 1.1, 1.1 and 25.1 arcseconds; the near site's is the sky's sidereal time taking UT as UTC (Horizons uses UT1, 0.17 s off: shifting it by that leaves 0.1, 0.1 and 4.4). */
  it.each(APOPHIS_SITES)(
    "is within 26 arcseconds and 0.4 km of Horizons: $name",
    (site) => {
      const { unit, delta } = view(site);
      const truth = precessToDate(toUnit(site.ra, site.dec), site.t);
      const cos = unit[0] * truth[0] + unit[1] * truth[1] + unit[2] * truth[2];
      expect((Math.acos(Math.min(1, cos)) / RAD) * 3600).toBeLessThan(26);
      expect(Math.abs(delta - site.delta) * AU * 6378.137).toBeLessThan(0.4);
    },
  );

  it("is tens of degrees from the geocentre's direction, at the site within one Earth radius of it", () => {
    const site = APOPHIS_SITES.find((one) => one.name === "near")!;
    const geocentric = bodyFromCamera(
      orbits,
      "apophis",
      site.t,
      undefined,
      placePass,
    )!.unit;
    const camera = view(site).unit;
    const cos =
      geocentric[0] * camera[0] +
      geocentric[1] * camera[1] +
      geocentric[2] * camera[2];
    expect(Math.acos(cos) / RAD).toBeGreaterThan(20);
  });

  it.each(APOPHIS_SITES)(
    "is covered by the Earth as Horizons' geometry says: $name",
    (site) => {
      expect(earthCover(cameraAt(site.rotation, site.t), view(site))).toBe(
        site.cover,
      );
    },
  );

  /* The element sets place it outside the table and hand over to it at its edges, within the sets' tolerance of 0.035 degrees. */
  const pass = orbits.passes["apophis"]!;
  const camera = (t: number) => cameraAt(APOPHIS_SITES[0]!.rotation, t);
  const unitAt = (t: number, place?: typeof placePass) =>
    bodyFromCamera(orbits, "apophis", t, camera(t), place)!.unit;
  const apart = (a: number[], b: number[]) =>
    Math.acos(Math.min(1, a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!)) / RAD;

  /* A set covers [from, to), so at the table's start the set is read a millisecond earlier. */
  it.each([
    ["start", pass.startMs - 1, pass.startMs],
    ["end", pass.endMs, pass.endMs],
  ])(
    "is placed by a set within 0.035 degrees of the table at its %s",
    (_, setMs, tableMs) => {
      const outside = {
        ...orbits,
        passes: {
          apophis: {
            ...pass,
            startMs: pass.endMs + DAY,
            endMs: pass.endMs + 2 * DAY,
          },
        },
      };
      const bySet = bodyFromCamera(
        outside,
        "apophis",
        setMs,
        camera(setMs),
        placePass,
      )!;
      expect(apart(bySet.unit, unitAt(tableMs, placePass))).toBeLessThan(0.035);
    },
  );

  it("is placed at every instant from the run instant to the span's end, and nowhere else", () => {
    const { sets } = pass;
    const first = sets[0]!.fromMs;
    const last = sets.at(-1)!.toMs;
    expect(
      bodyFromCamera(orbits, "apophis", first - 1, undefined, placePass),
    ).toBeNull();
    expect(
      bodyFromCamera(orbits, "apophis", first, undefined, placePass),
    ).not.toBeNull();
    expect(
      bodyFromCamera(orbits, "apophis", pass.endMs + DAY, undefined, placePass),
    ).not.toBeNull();
    expect(
      bodyFromCamera(orbits, "apophis", last - 1, undefined, placePass),
    ).not.toBeNull();
    expect(
      bodyFromCamera(orbits, "apophis", last, undefined, placePass),
    ).toBeNull();
  });

  it("is null until its table's chunk has loaded", () => {
    const site = APOPHIS_SITES[0]!;
    expect(bodyFromCamera(orbits, "apophis", site.t)).toBeNull();
  });
});
