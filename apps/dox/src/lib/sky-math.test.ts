import {
  BOX,
  coverFit,
  fromGalactic,
  inBox,
  inFront,
  moonPhase,
  moonRaDec,
  MAX_ANGLE,
  SCALE,
  project,
  siderealDeg,
  skyBasis,
  skyCentre,
  sunRaDec,
  toGalactic,
  toUnit,
} from "./sky-math";

/** Meeus, Astronomical Algorithms 2nd ed., examples 12.a and 12.b, as Unix milliseconds: 1987-04-10T00:00:00Z and 1987-04-10T19:21:00Z. */
const MEEUS_12A = 545_011_200_000;
const MEEUS_12B = 545_080_860_000;

/** A centre for tests that only need a view to project through. */
const ORION = { ra: 90, dec: 5 };

/** J2000 catalogue positions, degrees. */
const BETELGEUSE = { ra: 5.919529 * 15, dec: 7.407063 };
const RIGEL = { ra: 5.242298 * 15, dec: -8.20164 };
const SIRIUS = { ra: 6.752481 * 15, dec: -16.716116 };

describe("toGalactic", () => {
  it("puts the north galactic pole at b = 90 degrees", () => {
    expect(toGalactic(192.85948, 27.12825).b).toBeCloseTo(90, 4);
  });

  it("puts the galactic centre at l = 0, b = 0", () => {
    const { l, b } = toGalactic(266.405, -28.936);
    expect(Math.min(l, 360 - l)).toBeLessThan(0.01);
    expect(Math.abs(b)).toBeLessThan(0.01);
  });

  it("is undone by fromGalactic", () => {
    const { l, b } = toGalactic(88.79, 7.41);
    const back = fromGalactic(l, b);
    expect(back.ra).toBeCloseTo(88.79, 6);
    expect(back.dec).toBeCloseTo(7.41, 6);
  });
});

describe("project", () => {
  it("puts the view's centre at the middle of the box", () => {
    const at = project(90, 5, ORION);
    expect(at?.x).toBeCloseTo(BOX.width / 2, 6);
    expect(at?.y).toBeCloseTo(BOX.height / 2, 6);
  });

  it("puts east to the left and north up", () => {
    expect(project(100, 5, ORION)?.x).toBeLessThan(BOX.width / 2);
    expect(project(90, 15, ORION)?.y).toBeLessThan(BOX.height / 2);
  });

  it("returns null more than MAX_ANGLE degrees from the centre", () => {
    expect(project(270, -5, ORION)).toBeNull();
    expect(project(90 + MAX_ANGLE + 1, 5, ORION)).toBeNull();
    expect(project(90 + MAX_ANGLE - 1, 5, ORION)).not.toBeNull();
    expect(inBox(null)).toBe(false);
  });

  it("reaches the box edge 70 degrees from the centre along the centre line", () => {
    const left = project(90 + 70, 5, ORION);
    expect(left?.x).toBeGreaterThan(0);
    expect(left?.x).toBeLessThan(15);
  });

  it("keeps Betelgeuse, Rigel and Sirius inside the box when Orion is behind the Earth", () => {
    for (const star of [BETELGEUSE, RIGEL, SIRIUS])
      expect(inBox(project(star.ra, star.dec, ORION))).toBe(true);
  });
});

describe("inFront", () => {
  it("is true within 90 degrees of the view's centre and false beyond, inside MAX_ANGLE", () => {
    const basis = skyBasis(ORION);
    expect(inFront(basis, toUnit(90 + 89, 0))).toBe(true);
    expect(inFront(basis, toUnit(90 + 91, 0))).toBe(false);
    expect(project(90 + 91, 0, ORION)).not.toBeNull();
  });
});

describe("siderealDeg", () => {
  it("matches Meeus example 12.a: 1987-04-10 0h UT is 197.693195 degrees", () => {
    expect(Math.abs(siderealDeg(MEEUS_12A) - 197.693195)).toBeLessThan(0.0001);
  });

  it("matches Meeus example 12.b: 1987-04-10 19h21m UT is 128.7378734 degrees", () => {
    expect(Math.abs(siderealDeg(MEEUS_12B) - 128.7378734)).toBeLessThan(0.0001);
  });

  it("gains 360.98564736629 degrees a day and stays in [0, 360)", () => {
    const gain = siderealDeg(MEEUS_12A + 86_400_000) - siderealDeg(MEEUS_12A);
    expect(gain).toBeCloseTo(0.98564736629, 4);
    for (const at of [0, MEEUS_12B, 4e12, -3e12]) {
      expect(siderealDeg(at)).toBeGreaterThanOrEqual(0);
      expect(siderealDeg(at)).toBeLessThan(360);
    }
  });
});

describe("skyCentre", () => {
  it("looks behind the Earth: the sidereal time plus 180 degrees, minus the camera's turn", () => {
    const at = skyCentre([0, 0], MEEUS_12A);
    expect(at.ra).toBeCloseTo(17.693195, 3);
    expect(at.dec).toBe(0);
  });

  it("follows a turned camera: [90, 30] gives RA 287.693195 and Dec 30", () => {
    const at = skyCentre([90, 30], MEEUS_12A);
    expect(at.ra).toBeCloseTo(287.693195, 3);
    expect(at.dec).toBe(30);
  });

  it("clamps the declination at 89 degrees either way", () => {
    expect(skyCentre([0, 1000], MEEUS_12A).dec).toBe(89);
    expect(skyCentre([0, -1000], MEEUS_12A).dec).toBe(-89);
  });

  it("wraps the right ascension into [0, 360)", () => {
    for (const lambda of [-720, -181, 0, 181, 540]) {
      const { ra } = skyCentre([lambda, 0], MEEUS_12B);
      expect(ra).toBeGreaterThanOrEqual(0);
      expect(ra).toBeLessThan(360);
    }
  });

  it("moves a star left when the reader drags right", () => {
    const rest = project(
      BETELGEUSE.ra,
      BETELGEUSE.dec,
      skyCentre([0, 0], MEEUS_12A),
    );
    const dragged = project(
      BETELGEUSE.ra,
      BETELGEUSE.dec,
      skyCentre([15, 0], MEEUS_12A),
    );
    expect(dragged!.x).toBeLessThan(rest!.x);
  });

  it("moves with the clock alone, 15.0411 degrees of right ascension an hour", () => {
    const a = skyCentre([0, 0], MEEUS_12A);
    const b = skyCentre([0, 0], MEEUS_12A + 3_600_000);
    expect(b.ra - a.ra).toBeCloseTo(15.0411, 3);
  });

  it("crosses the date line without a jump", () => {
    const at = (lambda: number) =>
      project(
        BETELGEUSE.ra,
        BETELGEUSE.dec,
        skyCentre([lambda, 0], MEEUS_12A),
      )!;
    /* 0.2 degree of turn is under 9 box units; a wrap error would be hundreds. */
    expect(Math.abs(at(179.9).x - at(-179.9).x)).toBeLessThan(12);
  });
});

describe("coverFit", () => {
  it("covers the hero the way object-fit: cover does", () => {
    const centre = { x: 0, y: 0 };
    expect(coverFit(1440, 900, centre).scale).toBeCloseTo(0.6, 9);
    expect(coverFit(1440, 600, centre).scale).toBeCloseTo(0.6, 9);
    expect(coverFit(600, 900, centre).scale).toBeCloseTo(0.6, 9);
  });

  it("puts the box's centre at the given centre", () => {
    const fit = coverFit(1440, 900, { x: 700, y: 400 });
    expect(fit.originX).toBe(700);
    expect(fit.originY).toBe(400);
  });

  it("scales with the globe's own zoom, so the sky stays locked to the Earth it is drawn behind", () => {
    const centre = { x: 700, y: 400 };
    const rest = coverFit(1440, 900, centre);
    const zoomed = coverFit(1440, 900, centre, 2.5);
    expect(zoomed.scale).toBeCloseTo(rest.scale * 2.5, 9);
    expect(zoomed.originX).toBe(rest.originX);
    expect(zoomed.originY).toBe(rest.originY);
  });

  it.each([390, 768, 1440, 2560])(
    "reaches every corner of a hero %i px wide within the cut-off, the Earth a fifth to four fifths across",
    (width) => {
      const height = Math.round(width * 0.585);
      for (const fx of [0.2, 0.5, 0.8])
        for (const fy of [0.2, 0.5, 0.8]) {
          const fit = coverFit(width, height, {
            x: fx * width,
            y: fy * height,
          });
          for (const [x, y] of [
            [0, 0],
            [width, 0],
            [0, height],
            [width, height],
          ] as const) {
            const radius =
              Math.hypot(x - fit.originX, y - fit.originY) / fit.scale;
            const angle = 2 * Math.atan(radius / (2 * SCALE)) * (180 / Math.PI);
            expect(angle).toBeLessThan(MAX_ANGLE);
          }
        }
    },
  );
});

/* Meeus, Astronomical Algorithms 2nd ed.: 1992-04-12 and 1992-10-13, 0h TD, as Unix milliseconds (UT differs by under a minute). */
const MEEUS_47A = 703_036_800_000;
const MEEUS_25A = 718_934_400_000;

const apart = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

describe("moonRaDec", () => {
  it("matches Meeus example 47.a, RA 134.688 and Dec 13.768, within the low-precision 0.3 degree", () => {
    const at = moonRaDec(MEEUS_47A);
    expect(apart(at.ra, 134.68847)).toBeLessThan(0.3);
    expect(Math.abs(at.dec - 13.768368)).toBeLessThan(0.3);
  });

  it("gives an angular radius of 0.2725 times the parallax, near 0.25 degree at 368,410 km", () => {
    /* Meeus 47.a: distance 368,409.7 km, parallax 0.991990 degree. */
    expect(moonRaDec(MEEUS_47A).radius).toBeCloseTo(0.2725076 * 0.99199, 1);
  });
});

describe("sunRaDec", () => {
  it("matches Meeus example 25.a, RA 198.381 and Dec -7.785, within 0.1 degree", () => {
    const at = sunRaDec(MEEUS_25A);
    expect(apart(at.ra, 198.38083)).toBeLessThan(0.1);
    expect(Math.abs(at.dec + 7.78507)).toBeLessThan(0.1);
  });
});

describe("moonPhase", () => {
  it("matches Meeus example 48.a: 0.679 lit, bright limb at 285 degrees", () => {
    const { lit, limb } = moonPhase(
      { ra: 20.6579, dec: 8.6964 },
      { ra: 134.6885, dec: 13.7684 },
    );
    /* Meeus corrects the phase angle for the Sun's distance; the plain elongation is 0.001 off. */
    expect(Math.abs(lit - 0.6786)).toBeLessThan(0.002);
    expect(apart(limb, 285)).toBeLessThan(0.2);
  });

  it("is dark at new and full at the opposition", () => {
    const sun = { ra: 100, dec: 20 };
    expect(moonPhase(sun, sun).lit).toBeCloseTo(0, 9);
    expect(moonPhase(sun, { ra: 280, dec: -20 }).lit).toBeCloseTo(1, 9);
  });

  it("puts the bright limb toward the Sun: due east of the Moon for a Sun to its east", () => {
    expect(
      moonPhase({ ra: 130, dec: 0 }, { ra: 100, dec: 0 }).limb,
    ).toBeCloseTo(90, 6);
    expect(moonPhase({ ra: 70, dec: 0 }, { ra: 100, dec: 0 }).limb).toBeCloseTo(
      270,
      6,
    );
  });
});
