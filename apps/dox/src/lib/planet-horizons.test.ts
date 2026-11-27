/* Every planet the sky places, held to its JPL Horizons pins (src/test/planet-pins.ts): where it is
   from the Earth's centre and from the camera, how far, its phase angle and its magnitude. */
import { describe, expect, it } from "vitest";
import orbitText from "../assets/sky-orbits.json?raw";
import {
  CAMERA_ROTATION,
  PLANET_PINS,
  type PlanetPin,
} from "../test/planet-pins";
import { convertUnixToUtc } from "@northguild/gmt/unix/convert";
import { bodyFrame, surfaceAt } from "./body-frame";
import { MARS_ROTATION } from "./body-rotation";
import { bodyFromCamera, LIGHT_DAYS_PER_AU, type Orbits } from "./ephemeris";
import { RAD, type Vec3 } from "./globe/pinhole";
import { DAY_MS } from "./globe/sun";
import { apparentMagnitude, type PlanetId } from "./magnitude";
import { cameraAt, precessToDate, toUnit, wrap360 } from "./sky-math";

const orbits = JSON.parse(orbitText) as Orbits;

/** The angle between a view and Horizons' right ascension and declination, arcseconds. */
function off(unit: readonly number[], ra: number, dec: number, t: number) {
  const truth = precessToDate(toUnit(ra, dec), t);
  const cos = unit[0]! * truth[0] + unit[1]! * truth[1] + unit[2]! * truth[2];
  return (Math.acos(Math.min(1, cos)) / RAD) * 3600;
}

/* Measured worst cases over the pins: 12.8 arcseconds (Saturn), a distance 5.1e-5 of itself
   (Venus), a phase 0.0076 degrees (Mars) and a magnitude 0.0015 (Mars in 2221). Horizons gives
   the magnitude to 0.001. */
const ARCSEC = 15;
const DISTANCE = 6e-5;
const PHASE = 0.01;
const MAGNITUDE = 0.002;

const rows = Object.entries(PLANET_PINS).flatMap(([id, pins]) =>
  pins.map((pin): [string, string, PlanetPin] => [
    id,
    convertUnixToUtc(pin.t).slice(0, 10),
    pin,
  ]),
);

describe("the planets against Horizons", () => {
  it.each(rows)("%s on %s", (name, _day, pin) => {
    const id = name as PlanetId;
    const geo = bodyFromCamera(orbits, id, pin.t)!;
    const cam = bodyFromCamera(
      orbits,
      id,
      pin.t,
      cameraAt(CAMERA_ROTATION, pin.t),
    )!;
    expect(off(geo.unit, pin.ra, pin.dec, pin.t)).toBeLessThan(ARCSEC);
    expect(off(cam.unit, pin.camRa, pin.camDec, pin.t)).toBeLessThan(ARCSEC);
    expect(Math.abs(geo.delta / pin.delta - 1)).toBeLessThan(DISTANCE);
    expect(Math.abs(cam.delta / pin.camDelta - 1)).toBeLessThan(DISTANCE);
    expect(Math.abs(geo.phase - pin.alpha)).toBeLessThan(PHASE);
    expect(
      Math.abs(apparentMagnitude(id, geo, pin.t) - pin.mag),
    ).toBeLessThanOrEqual(MAGNITUDE);
  });
});

/* Mars's markings read the longitude that faces the Earth, so its rotation row is held to
   Horizons' sub-observer west longitude (ObsSub-LON), at the instant the light left Mars. Measured
   worst case 0.0036 degrees, in 2221. */
describe("Mars's central meridian against Horizons", () => {
  it.each(rows.filter(([id]) => id === "mars"))(
    "on %s %s",
    (_id, _day, pin) => {
      const view = bodyFromCamera(orbits, "mars", pin.t)!;
      const frame = bodyFrame(
        MARS_ROTATION,
        pin.t - view.delta * LIGHT_DAYS_PER_AU * DAY_MS,
      );
      const east = surfaceAt(frame, view.unit.map((c) => -c) as Vec3)[0] / RAD;
      const off = wrap360(-east - pin.lon + 180) - 180;
      expect(Math.abs(off)).toBeLessThan(0.005);
    },
  );
});
