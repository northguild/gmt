import { moonFrame, sunPole, surfaceAt } from "./body-frame";
import { precessToDate, toUnit, type Unit } from "./sky-math";

const DEG = 180 / Math.PI;
const dot = (a: Unit, b: Unit): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const apart = (a: number, b: number): number =>
  Math.abs(((a - b + 540) % 360) - 180);
/** The angle between two places on the Moon, degrees. */
const arc = (
  a: { lon: number; lat: number },
  b: { lon: number; lat: number },
): number =>
  Math.acos(Math.min(1, dot(toUnit(a.lon, a.lat), toUnit(b.lon, b.lat)))) * DEG;

/**
 * The position angle of a body's north pole from celestial north, degrees counter-clockwise, for a
 * body at right ascension `ra` and declination `dec` (degrees), as Horizons' NP.ang reads it.
 */
function northAngle(pole: Unit, ra: number, dec: number): number {
  const r = ra / DEG;
  const d = dec / DEG;
  return (
    (Math.atan2(
      dot(pole, [-Math.sin(r), Math.cos(r), 0]),
      dot(pole, [
        -Math.sin(d) * Math.cos(r),
        -Math.sin(d) * Math.sin(r),
        Math.cos(d),
      ]),
    ) *
      DEG +
      360) %
    360
  );
}

/**
 * Where the observer sits on the Moon, as Horizons gives it: the sub-observer east longitude and
 * latitude, and the position angle of the Moon's north pole from celestial north, from the
 * Moon's apparent right ascension and declination (the line of sight) and the frame.
 */
function seen(instantMs: number, ra: number, dec: number) {
  const { pole, prime } = moonFrame(instantMs);
  const observer = toUnit(ra, dec).map((x) => -x) as unknown as Unit;
  const [lon, lat] = surfaceAt({ pole, prime }, observer);
  return {
    lon: (lon * DEG + 360) % 360,
    lat: lat * DEG,
    angle: northAngle(pole, ra, dec),
  };
}

/**
 * The Moon's orientation from JPL Horizons (ssd.jpl.nasa.gov/api/horizons.api, COMMAND='301',
 * CENTER='500@399', START_TIME='2026-11-04 00:00', STOP_TIME='2026-11-18 00:01', STEP_SIZE='7 d',
 * TIME_TYPE='UT', QUANTITIES='2,14,17', ANG_FORMAT='DEG', EXTRA_PREC='YES'): the apparent right
 * ascension and declination, the sub-observer longitude and latitude (ObsSub-LON, ObsSub-LAT, in
 * the Moon's mean-Earth frame) and the north pole position angle (NP.ang), seen from the geocentre.
 */
const GEOCENTRIC = [
  {
    name: "2026-11-04",
    t: 1_793_750_400_000,
    ra: 159.940233061,
    dec: 7.343727568,
    lon: 5.577131,
    lat: 1.3982,
    angle: 20.4558,
  },
  {
    name: "2026-11-11",
    t: 1_794_355_200_000,
    ra: 245.148088011,
    dec: -26.430883319,
    lon: 2.499249,
    lat: 6.424359,
    angle: 10.001,
  },
  {
    name: "2026-11-18",
    t: 1_794_960_000_000,
    ra: 333.200143789,
    dec: -10.473073044,
    lon: 353.765266,
    lat: -0.685758,
    angle: 340.748,
  },
];

/**
 * The same from the geostationary camera site of the `moonFromCamera` pins (CENTER='coord@399',
 * COORD_TYPE='CYLINDRICAL', SITE_COORD='24.94,20973.633,36577.605', TLIST_TYPE='JD',
 * TLIST='2461350.5 2461362.0', QUANTITIES='2,14,17'; the right ascension and declination are those
 * of the `HORIZONS` pins in `sky-math.test.ts`), with the geocentre's own sub-observer point at
 * those two instants (the same query from CENTER='500@399').
 */
const CAMERA = [
  {
    name: "2026-11-06 00:00",
    t: 1_793_923_200_000,
    ra: 186.224258,
    dec: -9.994644,
    lon: 10.084519,
    lat: 7.797765,
    angle: 22.3579,
    geocentre: { lon: 5.549968, lat: 4.119144 },
  },
  {
    name: "2026-11-17 12:00",
    t: 1_794_916_800_000,
    ra: 330.412375,
    dec: -18.473649,
    lon: 355.190722,
    lat: 5.999869,
    angle: 341.2096,
    geocentre: { lon: 354.24219, lat: 0.019531 },
  },
];

describe("moonFrame", () => {
  it.each(GEOCENTRIC)(
    "matches Horizons from the geocentre on $name: sub-observer point and pole angle within 0.2 degree",
    (row) => {
      const at = seen(row.t, row.ra, row.dec);
      expect(apart(at.lon, row.lon)).toBeLessThan(0.2);
      expect(Math.abs(at.lat - row.lat)).toBeLessThan(0.2);
      expect(apart(at.angle, row.angle)).toBeLessThan(0.2);
    },
  );

  it.each(CAMERA)(
    "matches Horizons from the camera on $name, over 3 degrees from the geocentre's point",
    (row) => {
      const at = seen(row.t, row.ra, row.dec);
      expect(apart(at.lon, row.lon)).toBeLessThan(0.2);
      expect(Math.abs(at.lat - row.lat)).toBeLessThan(0.2);
      expect(apart(at.angle, row.angle)).toBeLessThan(0.2);
      /* The camera's parallax moves the sub-observer point, so a frame read for the geocentre would be wrong. */
      expect(arc(row, row.geocentre)).toBeGreaterThan(3);
    },
  );

  it("is a right-handed frame of unit vectors: the pole is square to the prime meridian", () => {
    for (const t of [
      946_728_000_000, // 2000-01-01 12:00 UTC
      1_795_564_800_000, // 2026-11-25
      4_083_955_200_000, // 2099-06-01
    ]) {
      const { pole, prime } = moonFrame(t);
      expect(Math.hypot(...pole)).toBeCloseTo(1, 12);
      expect(Math.hypot(...prime)).toBeCloseTo(1, 12);
      expect(dot(pole, prime)).toBeCloseTo(0, 12);
    }
  });

  it("turns the prime meridian once in 27.32 days", () => {
    const start = 1_793_491_200_000;
    const a = moonFrame(start).prime;
    const b = moonFrame(start + 27.321_661 * 86_400_000).prime;
    expect(Math.acos(Math.min(1, dot(a, b))) * DEG).toBeLessThan(0.5);
  });
});

/**
 * The Sun's pole from JPL Horizons (ssd.jpl.nasa.gov/api/horizons.api, COMMAND='10',
 * CENTER='500@399', TLIST_TYPE='JD', TLIST='2461056.5 2461146.5 2461237.5', TIME_TYPE='UT',
 * QUANTITIES='2,17', ANG_FORMAT='DEG', EXTRA_PREC='YES'): the apparent right ascension and
 * declination of the Sun and the north pole position angle (NP.ang), counter-clockwise from the
 * true-of-date celestial north. Three instants a season apart, where the angle runs from -26 to +4.
 */
const SUN = [
  {
    name: "2026-01-16",
    t: 1_768_521_600_000,
    ra: 297.838874205,
    dec: -20.974713643,
    angle: 354.8835,
  },
  {
    name: "2026-04-16",
    t: 1_776_297_600_000,
    ra: 24.127023505,
    dec: 10.049197628,
    angle: 334.0468,
  },
  {
    name: "2026-07-16",
    t: 1_784_160_000_000,
    ra: 115.365817855,
    dec: 21.391825205,
    angle: 4.038,
  },
];

describe("sunPole", () => {
  it.each(SUN)(
    "matches the Horizons pole position angle on $name within 0.2 degree",
    (row) => {
      expect(
        apart(northAngle(sunPole(row.t), row.ra, row.dec), row.angle),
      ).toBeLessThan(0.2);
    },
  );

  it("is a unit vector", () => {
    expect(Math.hypot(...sunPole(1_795_564_800_000))).toBeCloseTo(1, 12);
  });
});

describe("precessToDate", () => {
  it("moves the J2000 equinox 0.34 degree east and the pole of the equator not at all, in 2026", () => {
    const t = 1_795_564_800_000;
    const equinox = precessToDate([1, 0, 0], t);
    expect(Math.atan2(equinox[1], equinox[0]) * DEG).toBeGreaterThan(0.3);
    expect(Math.atan2(equinox[1], equinox[0]) * DEG).toBeLessThan(0.4);
    expect(Math.hypot(...precessToDate(toUnit(80, 20), t))).toBeCloseTo(1, 12);
  });

  it("leaves a direction alone at J2000", () => {
    const at = precessToDate(toUnit(80, 20), 946_728_000_000);
    expect(at[0]).toBeCloseTo(toUnit(80, 20)[0], 9);
    expect(at[2]).toBeCloseTo(toUnit(80, 20)[2], 9);
  });
});
