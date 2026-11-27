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
import { bodyFromCamera, type Orbits } from "./ephemeris";
import { RAD } from "./globe/pinhole";
import { apparentMagnitude, type PlanetId } from "./magnitude";
import { cameraAt, precessToDate, toUnit } from "./sky-math";

const orbits = JSON.parse(orbitText) as Orbits;

/** The angle between a view and Horizons' right ascension and declination, arcseconds. */
function off(unit: readonly number[], ra: number, dec: number, t: number) {
  const truth = precessToDate(toUnit(ra, dec), t);
  const cos = unit[0]! * truth[0] + unit[1]! * truth[1] + unit[2]! * truth[2];
  return (Math.acos(Math.min(1, cos)) / RAD) * 3600;
}

/* Measured worst cases over the pins: 12.8 arcseconds (Saturn), a distance 5.1e-5 of itself
   (Venus), a phase 0.0076 degrees (Mars) and a magnitude 0.001. Mars's magnitude leaves out
   Mallama's rotation and season corrections, worth up to 0.095. */
const ARCSEC = 15;
const DISTANCE = 6e-5;
const PHASE = 0.01;
const MAGNITUDE: Partial<Record<PlanetId, number>> = { mars: 0.1 };

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
    ).toBeLessThanOrEqual(MAGNITUDE[id] ?? 0.002);
  });
});
