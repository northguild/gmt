/**
 * Apophis's 2029 pass from three camera sites, from JPL Horizons (ssd.jpl.nasa.gov/api/horizons.api),
 * the national peer the pass's tests are held against. Instants are epoch-ms literals (UTC);
 * every query is COMMAND='99942', CENTER='coord@399', COORD_TYPE='CYLINDRICAL', SITE_COORD=<the
 * site's east longitude, its distance from the axis and its height, km: the camera's 42,164 km out>,
 * TIME_TYPE='UT', TLIST_TYPE='JD', QUANTITIES='1,9,20', ANG_FORMAT='DEG', EXTRA_PREC='YES':
 * `ra`/`dec` astrometric (Q1), `mag` APmag (Q9), `delta` the range in au (Q20).
 *
 * - `far`: 20:00 UT, longitude 150 east, latitude 0: SITE_COORD='150,42164.137,0.000'.
 * - `earth`: 20:00 UT, longitude 210 east, latitude 0: SITE_COORD='210,42164.137,0.000', the Earth
 *   between the camera and the body.
 * - `near`: 21:40 UT, longitude 321 east, latitude 27 north: SITE_COORD='321,37568.521,19142.118',
 *   4,113 km from the body, which is nearer than the Earth and in front of its disc.
 *
 * `rotation` is the globe's `[lambda, phi]` for the site: `[-longitude, -latitude]`. `cover` is what
 * `earthCover` must answer there.
 */
export const APOPHIS_SITES = [
  {
    name: "far",
    t: 1870804800000,
    rotation: [-150, -0] as const,
    ra: 145.678317693,
    dec: -1.488833654,
    mag: 4.768,
    delta: 0.00057740846362,
    cover: null,
  },
  {
    name: "earth",
    t: 1870804800000,
    rotation: [150, -0] as const,
    ra: 170.949682242,
    dec: -1.260963392,
    mag: 4.403,
    delta: 0.00065894234158,
    cover: "behind",
  },
  {
    name: "near",
    t: 1870810800000,
    rotation: [39, -27] as const,
    ra: 303.292113378,
    dec: -25.277512063,
    mag: -0.459,
    delta: 0.00002749103537,
    cover: "front",
  },
] as const;
