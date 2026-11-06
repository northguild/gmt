import { subsolarPoint } from "./globe/sun";
import { projectPoint, RIM, toView, type Vec3 } from "./globe/pinhole";
import {
  BOX,
  bodyOnScreen,
  MIN_BODY,
  limbOnScreen,
  moonFromCamera,
  moonRaDec,
  siderealDeg,
  skyCentre,
  skyLens,
  skyToScreen,
  starViewMatrix,
  SUN_RADIUS,
  sunRaDec,
  toUnit,
  viewMatrix,
  type SkyLens,
  type Unit,
} from "./sky-math";
import * as skyMath from "./sky-math";

/** Meeus, Astronomical Algorithms 2nd ed., examples 12.a and 12.b, as Unix milliseconds: 1987-04-10T00:00:00Z and 1987-04-10T19:21:00Z. */
const MEEUS_12A = 545_011_200_000;
const MEEUS_12B = 545_080_860_000;

/** J2000 catalogue positions, degrees. */
const BETELGEUSE = { ra: 5.919529 * 15, dec: 7.407063 };
const RIGEL = { ra: 5.242298 * 15, dec: -8.20164 };
const SIRIUS = { ra: 6.752481 * 15, dec: -16.716116 };

/** The hero of the gate: 1440 x 900, the Earth's centre mid-window, radius 409 px. */
const W = 1440;
const H = 900;
const LENS = skyLens(W, H, { x: 720, y: 450, radius: 409 }, 1);

/** Where a sky position lands for a camera, through the shipped path; null when behind the camera. */
function starAt(
  star: { ra: number; dec: number },
  rotation: readonly [number, number],
  instantMs: number,
  lens: SkyLens = LENS,
): { x: number; y: number } | null {
  const out = { x: 0, y: 0 };
  return skyToScreen(
    lens,
    viewMatrix(rotation, instantMs),
    toUnit(star.ra, star.dec),
    out,
  )
    ? out
    : null;
}

const RAD = Math.PI / 180;

/** A tiny seeded generator, so the rows below are the same every run. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

describe("viewMatrix", () => {
  it("turns the sky back by the sidereal time: toView at (ra - sidereal time, dec), 20 seeded cases", () => {
    const next = seeded(7);
    for (let i = 0; i < 20; i++) {
      const rotation: [number, number] = [
        next() * 360 - 180,
        next() * 180 - 90,
      ];
      const instant = MEEUS_12A + Math.floor(next() * 1e10);
      const ra = next() * 360;
      const dec = next() * 180 - 90;
      const lambda = rotation[0] * RAD;
      const phi = rotation[1] * RAD;
      const expected = toView(
        {
          cosLambda: Math.cos(lambda),
          sinLambda: Math.sin(lambda),
          cosPhi: Math.cos(phi),
          sinPhi: Math.sin(phi),
        },
        ra - siderealDeg(instant),
        dec,
        [0, 0, 0],
      );
      const m = viewMatrix(rotation, instant);
      const [x, y, z] = toUnit(ra, dec);
      for (let k = 0; k < 3; k++)
        expect(
          m[k * 3]! * x + m[k * 3 + 1]! * y + m[k * 3 + 2]! * z,
        ).toBeCloseTo(expected[k]!, 12);
    }
  });
});

describe("starViewMatrix", () => {
  /** A Julian date as Unix milliseconds. */
  const jd = (day: number): number => (day - 2_440_587.5) * 86_400_000;
  const turned = (m: Float64Array, [x, y, z]: Unit): Vec3 =>
    [0, 1, 2].map(
      (k) => m[k * 3]! * x + m[k * 3 + 1]! * y + m[k * 3 + 2]! * z,
    ) as Vec3;
  /** The angle between two unit vectors, arcseconds. */
  const apart = (a: Vec3, b: Vec3): number =>
    (Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) / RAD) *
    3600;
  const cameras: [number, number][] = [
    [0, 0],
    [-73, 41],
    [120, -55],
  ];

  it("is viewMatrix at J2000.0", () => {
    for (const rotation of cameras) {
      const a = starViewMatrix(rotation, jd(2_451_545));
      const b = viewMatrix(rotation, jd(2_451_545));
      for (let i = 0; i < 9; i++) expect(a[i]).toBeCloseTo(b[i]!, 12);
    }
  });

  it("puts a J2000 star where the view puts its place of date: theta Persei, Meeus example 21.b, within 0.2 arcsecond", () => {
    /* 2028 November 13.19 TD: from 41.054063, 49.227750 (proper motion applied) to 41.547214, 49.348483. */
    const instant = jd(2_462_088.69);
    for (const rotation of cameras)
      expect(
        apart(
          turned(
            starViewMatrix(rotation, instant),
            toUnit(41.054_063, 49.227_75),
          ),
          turned(viewMatrix(rotation, instant), toUnit(41.547_214, 49.348_483)),
        ),
      ).toBeLessThan(0.2);
  });

  it("matches JPL Horizons' Moon of 2026-11-27 12:00 UT, 0.38 degree apart in the two axes, to 40 arcseconds of aberration and nutation", () => {
    /* Geocentric: ICRF 107.007087638, 25.655002746; apparent of date 107.428268913, 25.611513975. */
    /* 2026-11-27T12:00:00Z. */
    const instant = 1_795_780_800_000;
    const j2000 = toUnit(107.007_087_638, 25.655_002_746);
    const ofDate = toUnit(107.428_268_913, 25.611_513_975);
    const m = viewMatrix([0, 0], instant);
    expect(apart(turned(m, j2000), turned(m, ofDate))).toBeGreaterThan(1300);
    expect(
      apart(turned(starViewMatrix([0, 0], instant), j2000), turned(m, ofDate)),
    ).toBeLessThan(40);
  });
});

describe("skyLens", () => {
  it("keeps today's star-dot scale: the hero's fit to the reference box, times the zoom", () => {
    const lens = skyLens(1440, 844, { x: 600, y: 400, radius: 300 }, 2.5);
    expect(lens.dots).toBe(Math.max(1440 / BOX.width, 844 / BOX.height) * 2.5);
    expect([lens.centreX, lens.centreY, lens.radius]).toEqual([600, 400, 300]);
  });

  it("without a globe sits at the anchor with 0.45 of the short side as the Earth", () => {
    const lens = skyLens(1440, 900, null, 1);
    expect([lens.centreX, lens.centreY, lens.radius]).toEqual([576, 540, 405]);
  });
});

describe("skyToScreen", () => {
  it("draws the point behind the Earth at the Earth's centre", () => {
    for (const rotation of [
      [0, 0],
      [-73, 41],
      [120, -55],
    ] as const) {
      const centre = skyCentre(rotation, MEEUS_12B);
      const at = starAt(centre, rotation, MEEUS_12B)!;
      expect(at.x).toBeCloseTo(LENS.centreX, 6);
      expect(at.y).toBeCloseTo(LENS.centreY, 6);
    }
  });

  it("is a lens zoom: doubling the radius doubles every star's offset from the centre", () => {
    const rotation: [number, number] = [20, 10];
    const next = seeded(3);
    let seen = 0;
    for (let i = 0; i < 200; i++) {
      const star = { ra: next() * 360, dec: next() * 180 - 90 };
      const one = starAt(star, rotation, MEEUS_12A, LENS);
      const two = starAt(
        star,
        rotation,
        MEEUS_12A,
        skyLens(W, H, { x: 720, y: 450, radius: 818 }, 2),
      );
      expect(one === null).toBe(two === null);
      if (!one || !two) continue;
      seen += 1;
      expect(two.x - LENS.centreX).toBeCloseTo(2 * (one.x - LENS.centreX), 6);
      expect(two.y - LENS.centreY).toBeCloseTo(2 * (one.y - LENS.centreY), 6);
    }
    expect(seen).toBeGreaterThan(20);
  });

  it("keeps Betelgeuse, Rigel and Sirius on screen when Orion is behind the Earth", () => {
    const rotation: [number, number] = [siderealDeg(MEEUS_12A) + 180 - 85, -3];
    /* Orion spans 25 degrees: at the gate's 409 px Earth the far stars are past the corner, so a smaller Earth shows all three. */
    const small = skyLens(W, H, { x: 720, y: 450, radius: 200 }, 1);
    for (const star of [BETELGEUSE, RIGEL, SIRIUS]) {
      const at = starAt(star, rotation, MEEUS_12A, small)!;
      expect(at.x).toBeGreaterThan(0);
      expect(at.x).toBeLessThan(W);
      expect(at.y).toBeGreaterThan(0);
      expect(at.y).toBeLessThan(H);
    }
  });

  it("draws nothing for a direction behind the camera", () => {
    const rotation: [number, number] = [0, 0];
    const front = skyCentre(rotation, MEEUS_12A);
    expect(
      starAt({ ra: front.ra + 180, dec: -front.dec }, rotation, MEEUS_12A),
    ).toBeNull();
    expect(
      starAt({ ra: front.ra + 91, dec: front.dec }, rotation, MEEUS_12A),
    ).toBeNull();
    expect(
      starAt({ ra: front.ra + 89, dec: front.dec }, rotation, MEEUS_12A),
    ).not.toBeNull();
  });
});

describe("bodyOnScreen", () => {
  const rotation: [number, number] = [0, 0];
  const m = viewMatrix(rotation, MEEUS_12A);
  const centre = skyCentre(rotation, MEEUS_12A);
  const at = (dra: number, ddec: number, angular = 0.25, reach = 0) =>
    bodyOnScreen(
      LENS,
      m,
      toUnit(centre.ra + dra, centre.dec + ddec),
      angular,
      W,
      H,
      reach,
    );

  it("culls a body behind the camera and one outside the box, and keeps one inside", () => {
    expect(at(0, 0)).not.toBeNull();
    expect(at(120, 0)).toBeNull();
    expect(at(80, 0)).toBeNull();
    expect(at(10, 0)).not.toBeNull();
  });

  it("keeps a body whose glare reaches into the box, though its disc is outside", () => {
    /* 15.8 degrees east of the centre lands about 36 px past the left edge, its disc edge about 24 px. */
    expect(at(15.8, 0, 0.25, 0)).toBeNull();
    expect(at(15.8, 0, 0.25, 2)).not.toBeNull();
  });

  it("draws a 0.01 degree body at the floor, 2.5 px", () => {
    expect(at(0, 0, 0.01)?.r).toBe(MIN_BODY);
  });

  it("draws a body at its across-radius half-width on screen: two points on its angular edge, projected", () => {
    const alpha = 0.5;
    /* The view axis, in equatorial axes: the camera frame's first axis points back at the camera. */
    const axis = [-m[0]!, -m[1]!, -m[2]!];
    for (const [dra, ddec] of [
      [0, 0],
      [0, 8],
      [12, -9],
      [-15, 4],
    ] as const) {
      const unit = toUnit(centre.ra + dra, centre.dec + ddec);
      /* The edge points across the radius: off the body's direction, square to the plane it shares with the axis. */
      const across = [
        axis[1]! * unit[2] - axis[2]! * unit[1],
        axis[2]! * unit[0] - axis[0]! * unit[2],
        axis[0]! * unit[1] - axis[1]! * unit[0],
      ];
      const length = Math.hypot(...across);
      /* On the axis any direction is across: the screen's own right. */
      const n =
        length < 1e-12 ? [m[3]!, m[4]!, m[5]!] : across.map((c) => c / length);
      const edge = (sign: number) => {
        const out = { x: 0, y: 0 };
        expect(
          skyToScreen(
            LENS,
            m,
            [0, 1, 2].map(
              (k) =>
                unit[k]! * Math.cos(alpha * RAD) +
                sign * n[k]! * Math.sin(alpha * RAD),
            ) as [number, number, number],
            out,
          ),
        ).toBe(true);
        return out;
      };
      const [a, b] = [edge(1), edge(-1)];
      expect(at(dra, ddec, alpha)!.r).toBeCloseTo(
        Math.hypot(a.x - b.x, a.y - b.y) / 2,
        9,
      );
    }
  });
});

/**
 * Under one pinhole the 3D ray Q + tau s from a city Q toward the Sun projects to the 2D line from
 * proj(Q) to the vanishing point of s, which is where the Sun is drawn: the issue bounds the miss at
 * 1 degree, and it is exact to rounding.
 *
 * Where a drawn Sun can exist. The Sun is drawn only inside the hero, so its offset from the
 * Earth's centre, `radius * G * tan(theta)`, must fit between that centre and the hero's far edge.
 * At zoom 1 that holds out to 30 degrees in a wide hero (2560 x 1080 below, the Earth wholly inside
 * it at rest, as `frameSpace` keeps it). At zoom 5 the Earth's disc is five times its resting
 * radius: a Sun 20 degrees off the axis would land 5 G tan(20) = 11.9 resting radii from the
 * centre, more than any hero `frameSpace` frames (it sizes the Earth to about half the short
 * side, so that needs a hero over 5.6 times wider than tall). So at zoom 5 a drawn Sun exists only
 * just past the limb, and only in a very wide hero: 9.5 degrees in 3840 x 1080 below. Drawn Suns at
 * 20 to 30 degrees and zoom 5 are not possible and are not claimed; the vanishing-point rows cover
 * that combination as projective geometry, drawn or not.
 */
describe("the Sun lies on every lit city's line to it: drawn at 9.5, 20 and 30 degrees off the axis at zoom 1 and at 9.5 at zoom 5, and as a vanishing point at all three and both zooms", () => {
  const INSTANT = 1_793_923_200_000;
  const sun = sunRaDec(INSTANT);
  const sunPoint = subsolarPoint(INSTANT);
  const sunUnit = toUnit(sun.ra, sun.dec);

  /** The point `distance` degrees from the subsolar point at `bearing`, on the sphere. */
  function around(distance: number, bearing: number): [number, number] {
    const lat0 = sunPoint.lat * RAD;
    const d = distance * RAD;
    const b = bearing * RAD;
    const lat = Math.asin(
      Math.sin(lat0) * Math.cos(d) + Math.cos(lat0) * Math.sin(d) * Math.cos(b),
    );
    const lng =
      sunPoint.lng * RAD +
      Math.atan2(
        Math.sin(b) * Math.sin(d) * Math.cos(lat0),
        Math.cos(d) - Math.sin(lat0) * Math.sin(lat),
      );
    return [lng / RAD, lat / RAD];
  }

  const angleBetween = (
    a: { x: number; y: number },
    b: { x: number; y: number },
  ): number =>
    Math.abs(Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y)) / RAD;

  /** The old stereographic picture of the same Sun, written out here as the control. */
  function stereographicSun(
    rotation: readonly [number, number],
    zoom: number,
  ): { x: number; y: number } | null {
    const view = skyCentre(rotation, INSTANT);
    const a = view.ra * RAD;
    const d = view.dec * RAD;
    const centre = [
      Math.cos(d) * Math.cos(a),
      Math.cos(d) * Math.sin(a),
      Math.sin(d),
    ];
    const east = [-Math.sin(a), Math.cos(a), 0];
    const north = [
      -Math.sin(d) * Math.cos(a),
      -Math.sin(d) * Math.sin(a),
      Math.cos(d),
    ];
    const dot = (p: readonly number[], q: readonly number[]) =>
      p[0]! * q[0]! + p[1]! * q[1]! + p[2]! * q[2]!;
    const cosAngle = dot(sunUnit, centre);
    if (cosAngle < 0) return null;
    const scale = BOX.width / 2 / (2 * Math.tan(35 * RAD));
    const k = scale * (2 / (1 + cosAngle)) * 0.6 * zoom;
    return {
      x: LENS.centreX - k * dot(sunUnit, east),
      y: LENS.centreY - k * dot(sunUnit, north),
    };
  }

  interface Case {
    theta: number;
    zoom: number;
    rotation: [number, number];
    m: Float64Array;
    lens: SkyLens;
    trig: Parameters<typeof toView>[0];
    s: Vec3;
  }

  /** The camera whose view axis is `theta` degrees from the Sun, at `azimuth` around it. */
  function camera(
    theta: number,
    azimuth: number,
  ): Omit<Case, "theta" | "zoom" | "lens"> {
    const [lng, lat] = around(180 - theta, azimuth);
    const rotation: [number, number] = [-lng, -lat];
    const trig = {
      cosLambda: Math.cos(rotation[0] * RAD),
      sinLambda: Math.sin(rotation[0] * RAD),
      cosPhi: Math.cos(rotation[1] * RAD),
      sinPhi: Math.sin(rotation[1] * RAD),
    };
    return {
      rotation,
      trig,
      m: viewMatrix(rotation, INSTANT),
      s: toView(trig, sunPoint.lng, sunPoint.lat, [0, 0, 0]),
    };
  }

  function vanishing(c: Case): { x: number; y: number } {
    const out = { x: 0, y: 0 };
    expect(skyToScreen(c.lens, c.m, sunUnit, out)).toBe(true);
    return out;
  }

  /* The vanishing point: the 1440 x 900 hero, the Earth centred, whether or not the Sun is on screen. */
  const centred: Case[] = [];
  for (const theta of [9.5, 20, 30])
    for (const azimuth of [0, 135, 250])
      for (const zoom of [1, 5])
        centred.push({
          theta,
          zoom,
          lens: skyLens(W, H, { x: 720, y: 450, radius: 409 * zoom }, zoom),
          ...camera(theta, azimuth),
        });

  /*
   * The drawn Sun: every 5 degrees of azimuth, the Earth's centre placed at mid-height, wholly
   * inside the hero at rest, as near the middle as puts the Sun's centre on screen; a camera whose
   * Sun no such place shows is left out.
   */
  const HEROES = [
    { width: 2560, height: 1080, rest: 500, zoom: 1, thetas: [9.5, 20, 30] },
    { width: 3840, height: 1080, rest: 500, zoom: 5, thetas: [9.5] },
  ];
  const drawn: (Case & { sun: { x: number; y: number } })[] = [];
  for (const hero of HEROES)
    for (const theta of hero.thetas)
      for (let azimuth = 0; azimuth < 360; azimuth += 5) {
        const view = camera(theta, azimuth);
        const radius = hero.rest * hero.zoom;
        const offset = { x: 0, y: 0 };
        skyToScreen(
          skyLens(hero.width, hero.height, { x: 0, y: 0, radius }, hero.zoom),
          view.m,
          sunUnit,
          offset,
        );
        /* frameSpace keeps the atmosphere (1.06 radii) 16 px inside the hero at rest. */
        const inside = 1.06 * hero.rest + 16;
        const x = Math.min(
          hero.width - inside,
          Math.max(inside, (hero.width - offset.x) / 2),
        );
        const lens = skyLens(
          hero.width,
          hero.height,
          { x, y: hero.height / 2, radius },
          hero.zoom,
        );
        const sun = bodyOnScreen(
          lens,
          view.m,
          sunUnit,
          SUN_RADIUS,
          hero.width,
          hero.height,
          90,
        );
        if (
          sun &&
          sun.x >= 0 &&
          sun.x <= hero.width &&
          sun.y >= 0 &&
          sun.y <= hero.height
        )
          drawn.push({ theta, zoom: hero.zoom, lens, sun, ...view });
      }

  /** The surface points seen: every 2 degrees, and a ring at the limb. */
  function cities(trig: Case["trig"]): Vec3[] {
    const found: Vec3[] = [];
    for (let lng = -180; lng < 180; lng += 2)
      for (let lat = -88; lat <= 88; lat += 2)
        found.push(toView(trig, lng, lat, [0, 0, 0]));
    const rim = RIM + 1e-3;
    const ring = Math.sqrt(1 - rim * rim);
    for (let a = 0; a < 360; a += 36)
      found.push([rim, ring * Math.cos(a * RAD), ring * Math.sin(a * RAD)]);
    return found;
  }

  /** The worst angle, degrees, between a city's line to the Sun and its line to the drawn Sun. */
  function worst(
    c: Case,
    target: { x: number; y: number },
  ): { angle: number; checked: number } {
    let angle = 0;
    let checked = 0;
    const from = { x: 0, y: 0 };
    const to = { x: 0, y: 0 };
    const lens = {
      centreX: c.lens.centreX,
      centreY: c.lens.centreY,
      radius: c.lens.radius,
    };
    for (const q of cities(c.trig)) {
      if (
        q[0] <= RIM + 1e-3 ||
        q[0] * c.s[0] + q[1] * c.s[1] + q[2] * c.s[2] <= 0
      )
        continue;
      projectPoint(lens, q, from);
      const toSun = { x: target.x - from.x, y: target.y - from.y };
      if (Math.hypot(toSun.x, toSun.y) < 2) continue;
      for (const tau of [0.01, 0.1, 1, 10]) {
        projectPoint(
          lens,
          [q[0] + tau * c.s[0], q[1] + tau * c.s[1], q[2] + tau * c.s[2]],
          to,
        );
        angle = Math.max(
          angle,
          angleBetween({ x: to.x - from.x, y: to.y - from.y }, toSun),
        );
        checked += 1;
      }
    }
    return { angle, checked };
  }

  it("draws the Sun, through the cull, at every angle and zoom it can reach, at the place the projection gives", () => {
    for (const [theta, zoom] of [
      [9.5, 1],
      [20, 1],
      [30, 1],
      [9.5, 5],
    ] as const)
      expect(
        drawn.filter((c) => c.theta === theta && c.zoom === zoom).length,
        `drawn at ${theta} degrees, zoom ${zoom}`,
      ).toBeGreaterThanOrEqual(2);
    for (const c of drawn) {
      const place = vanishing(c);
      expect(c.sun.x).toBe(place.x);
      expect(c.sun.y).toBe(place.y);
    }
  });

  it("holds for the drawn Sun within 1 degree, and exactly, to 1e-6 degree", () => {
    let worstCase = { angle: 0, label: "" };
    let checked = 0;
    for (const c of drawn) {
      const found = worst(c, c.sun);
      checked += found.checked;
      if (found.angle > worstCase.angle)
        worstCase = {
          angle: found.angle,
          label: `${c.theta} degrees, ${c.rotation} zoom ${c.zoom}`,
        };
    }
    expect(checked).toBeGreaterThan(1000);
    expect(worstCase.angle, `worst ${worstCase.label}`).toBeLessThanOrEqual(1);
    expect(worstCase.angle, `worst ${worstCase.label}`).toBeLessThan(1e-6);
  });

  it("holds for the vanishing point within 1 degree, and exactly, to 1e-6 degree, at the centre, near the edge and at full zoom", () => {
    let worstCase = { angle: 0, label: "" };
    let checked = 0;
    for (const c of centred) {
      const found = worst(c, vanishing(c));
      checked += found.checked;
      if (found.angle > worstCase.angle)
        worstCase = {
          angle: found.angle,
          label: `${c.rotation} zoom ${c.zoom}`,
        };
    }
    expect(checked).toBeGreaterThan(1000);
    expect(worstCase.angle, `worst ${worstCase.label}`).toBeLessThanOrEqual(1);
    expect(worstCase.angle, `worst ${worstCase.label}`).toBeLessThan(1e-6);
  });

  it("control: the old stereographic Sun misses a city's line by more than 5 degrees somewhere", () => {
    let most = 0;
    for (const c of centred) {
      const old = stereographicSun(c.rotation, c.zoom);
      if (old) most = Math.max(most, worst(c, old).angle);
    }
    expect(most).toBeGreaterThan(5);
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
    const rest = starAt(BETELGEUSE, [0, 0], MEEUS_12A);
    const dragged = starAt(BETELGEUSE, [15, 0], MEEUS_12A);
    expect(dragged!.x).toBeLessThan(rest!.x);
  });

  it("moves with the clock alone, 15.0411 degrees of right ascension an hour", () => {
    const a = skyCentre([0, 0], MEEUS_12A);
    const b = skyCentre([0, 0], MEEUS_12A + 3_600_000);
    expect(b.ra - a.ra).toBeCloseTo(15.0411, 3);
  });

  it("crosses the date line without a jump", () => {
    /* A star 3 degrees from the point behind the Earth when the camera is at the date line. */
    const behind = skyCentre([180, 0], MEEUS_12A);
    const near = { ra: behind.ra + 3, dec: 3 };
    const at = (lambda: number) => starAt(near, [lambda, 0], MEEUS_12A, LENS)!;
    /* 0.2 degree of turn is about 9 px at f = 2672; a wrap error would be thousands. */
    expect(Math.abs(at(179.9).x - at(-179.9).x)).toBeLessThan(12);
  });
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

/** A great-circle angle between two positions, degrees: atan2 of the cross and dot products. */
const arc = (
  a: { ra: number; dec: number },
  b: { ra: number; dec: number },
): number => {
  const [ax, ay, az] = toUnit(a.ra, a.dec);
  const [bx, by, bz] = toUnit(b.ra, b.dec);
  const cross = Math.hypot(
    ay * bz - az * by,
    az * bx - ax * bz,
    ax * by - ay * bx,
  );
  return Math.atan2(cross, ax * bx + ay * by + az * bz) / RAD;
};

/**
 * The Moon seen from a camera 42,164.137 km (6.61 Earth radii) over a point, from JPL Horizons
 * (ssd.jpl.nasa.gov/api/horizons.api, COMMAND='301', CENTER='coord@399',
 * COORD_TYPE='CYLINDRICAL', SITE_COORD='<E lon>,<42164.137 cos lat>,<42164.137 sin lat>',
 * TIME_TYPE='UT', QUANTITIES='2,10,13,16,24', ANG_FORMAT='DEG', EXTRA_PREC='YES'): apparent RA and
 * Dec of date, illuminated fraction, angular radius (half the diameter), the sub-Sun position
 * angle and the Sun-target-observer phase angle. Instants are 2026-11 at 00:00 or 12:00 UTC.
 */
const HORIZONS = [
  {
    name: "waning crescent",
    t: 1_793_923_200_000,
    lng: 24.94,
    lat: 60.17,
    ra: 186.224258,
    dec: -9.994644,
    lit: 0.088289,
    radius: 0.248577,
    limb: 103.63,
    phase: 145.4242,
  },
  {
    name: "new",
    t: 1_794_225_600_000,
    lng: 24.94,
    lat: 60.17,
    ra: 223.932482,
    dec: -28.256291,
    lit: 0.00978,
    radius: 0.25049,
    limb: 3.39,
    phase: 168.6505,
  },
  {
    name: "waxing crescent",
    t: 1_794_441_600_000,
    lng: 24.94,
    lat: 60.17,
    ra: 258.423734,
    dec: -30.554389,
    lit: 0.072617,
    radius: 0.226091,
    limb: 287.2,
    phase: 148.7391,
  },
  {
    name: "first quarter",
    t: 1_794_916_800_000,
    lng: 24.94,
    lat: 60.17,
    ra: 330.412375,
    dec: -18.473649,
    lit: 0.508974,
    radius: 0.249029,
    limb: 249.54,
    phase: 88.9715,
  },
  {
    name: "waxing gibbous",
    t: 1_795_219_200_000,
    lng: 24.94,
    lat: 60.17,
    ra: 4.744154,
    dec: 1.755476,
    lit: 0.797245,
    radius: 0.2685,
    limb: 246.43,
    phase: 53.5203,
  },
  {
    name: "full",
    t: 1_795_478_400_000,
    lng: 24.94,
    lat: 60.17,
    ra: 46.908002,
    dec: 18.705216,
    lit: 0.988941,
    radius: 0.297773,
    limb: 259.3,
    phase: 12.0671,
  },
  {
    name: "largest, the camera under the Moon",
    t: 1_795_478_400_000,
    lng: -13.8386,
    lat: 23.3006,
    ra: 49.297801,
    dec: 23.378778,
    lit: 0.992465,
    radius: 0.310763,
    limb: 284.78,
    phase: 9.9541,
  },
  {
    name: "the camera on the Earth's far side",
    t: 1_794_916_800_000,
    lng: -179.0725,
    lat: 0,
    ra: 321.298899,
    dec: -13.024021,
    lit: 0.452473,
    radius: 0.249031,
    limb: 251.71,
    phase: 95.4552,
  },
  {
    name: "behind the Earth, as the hero sees it",
    t: 1_794_441_600_000,
    lng: 7.4929,
    lat: 0,
    ra: 256.491809,
    dec: -25.189879,
    lit: 0.059963,
    radius: 0.226273,
    limb: 279.67,
    phase: 151.6568,
  },
] as const;

/** The globe's rotation for a camera over `(lng, lat)`: it looks at `(-lambda, -phi)`. */
const over = (row: { lng: number; lat: number }): [number, number] => [
  -row.lng,
  -row.lat,
];

describe("the Moon from the camera", () => {
  it.each(HORIZONS)(
    "matches Horizons for the $name Moon: place 0.3, radius 0.5 %, lit 0.002, phase 0.3 and limb 1 degree",
    (row) => {
      const moon = moonFromCamera(row.t, over(row));
      expect(arc(moon, row)).toBeLessThan(0.3);
      expect(Math.abs(moon.radius / row.radius - 1)).toBeLessThan(0.005);
      expect(Math.abs(moon.lit - row.lit)).toBeLessThan(0.002);
      expect(Math.abs(moon.phase - row.phase)).toBeLessThan(0.3);
      expect(apart(moon.limb, row.limb)).toBeLessThan(1);
      expect(moon.ra).toBeGreaterThanOrEqual(0);
      expect(moon.ra).toBeLessThan(360);
      expect(moon.limb).toBeGreaterThanOrEqual(0);
      expect(moon.limb).toBeLessThan(360);
    },
  );

  it.each([HORIZONS[0], HORIZONS[3], HORIZONS[7]])(
    "applies the camera's parallax: the $name Moon is over 2.5 degrees from the geocentric one, and inside 0.3 of Horizons",
    (row) => {
      const moon = moonFromCamera(row.t, over(row));
      expect(arc(moon, moonRaDec(row.t))).toBeGreaterThan(2.5);
      expect(arc(moon, row)).toBeLessThan(0.3);
    },
  );

  it("draws the Moon larger from a camera under it: over 10 % above the geocentric radius", () => {
    const row = HORIZONS[6];
    expect(moonFromCamera(row.t, over(row)).radius).toBeGreaterThan(
      1.1 * moonRaDec(row.t).radius,
    );
  });

  it("is the geocentric Moon from a camera exactly opposite it: no parallax", () => {
    const t = HORIZONS[3].t;
    const at = moonRaDec(t);
    const moon = moonFromCamera(t, [siderealDeg(t) + 180 - at.ra, at.dec]);
    expect(arc(moon, at)).toBeLessThan(1e-9);
  });

  it.each([1, 5])(
    "points the bright limb at the drawn Sun on screen, at zoom %i, behind the Earth included",
    (zoom) => {
      const lens = skyLens(W, H, { x: 720, y: 450, radius: 409 * zoom }, zoom);
      const drawn: string[] = [];
      for (const row of HORIZONS) {
        const m = viewMatrix(over(row), row.t);
        const moon = moonFromCamera(row.t, over(row));
        const sun = sunRaDec(row.t);
        const moonAt = { x: 0, y: 0 };
        const sunAt = { x: 0, y: 0 };
        if (
          !skyToScreen(lens, m, toUnit(moon.ra, moon.dec), moonAt) ||
          !skyToScreen(lens, m, toUnit(sun.ra, sun.dec), sunAt)
        )
          continue;
        drawn.push(row.name);
        const toSun = Math.atan2(sunAt.y - moonAt.y, sunAt.x - moonAt.x);
        const limb = limbOnScreen(lens, m, moon, moonAt);
        const off = Math.abs((((limb - toSun) / RAD + 540) % 360) - 180);
        expect(off, row.name).toBeLessThanOrEqual(1);
      }
      expect(drawn).toContain(HORIZONS[8].name);
    },
  );

  it("replaces the geocentric moonPhase, which is gone", () => {
    expect(Object.keys(skyMath)).not.toContain("moonPhase");
  });
});
