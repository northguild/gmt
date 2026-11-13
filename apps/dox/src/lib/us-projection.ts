/**
 * The composite equal-area projection of the United States and its territories (CORE-90).
 *
 * Modelled on d3-geo's `albersUsa.js` (Copyright Mike Bostock, ISC licence): one conic equal-area
 * projection for each part, each clipped to its own box, so no part's geometry draws in another's
 * frame. The lower 48 and DC are EPSG:5070 and Alaska is EPSG:3338. The territories are conic
 * equal-area projections centred on their own islands.
 *
 * Equal-area, because the Proposals view is a choropleth of states: a state's area on the map must
 * be comparable. The insets are not to scale: each is zoomed on its own to fill its card, and the
 * page's caption says so.
 *
 * The lower 48 take the top of the frame. The insets sit side by side in a strip under it that
 * spans its whole width, each in its own card: `frames()` gives the cards in drawing px, for the
 * page to outline with a bevelled border, to take a press and to light up. Under the strip is a
 * band the data-credits button sits in. Each card keeps a band along its top for its label
 * (`labelPoints()`), so a label never covers the islands. A card may split into panes side by side,
 * each zoomed on its own: American Samoa's Manu'a group lies 100 km east of Tutuila, and one zoom
 * for both would draw each at half the size. The layout is in units of the lower 48's scale `k`,
 * so it holds at every scale.
 *
 * Midway, Wake and the Northern Mariana Islands north of Saipan are not drawn.
 */
import { geoConicEqualArea, geoPath } from "d3-geo";
import type {
  GeoConicProjection,
  GeoPermissibleObjects,
  GeoStream,
} from "d3-geo";

type Point = readonly [number, number];
type Box = readonly [x0: number, y0: number, x1: number, y1: number];

/** The names of the six parts. */
export type UsPartName =
  | "lower48"
  | "alaska"
  | "hawaii"
  | "puertoRico"
  | "marianas"
  | "samoa";

interface PartSpec {
  name: UsPartName;
  make: () => GeoConicProjection;
  /** The part's box, in units of the lower 48's scale, from the frame's centre. */
  box: Box;
  /** The card's panes, left to right. An empty list is the lower 48, which keeps the one scale. */
  panes: readonly Pane[];
}

interface Pane {
  /** Where the pane's land lies, `[lon, lat]`: the corners of the extent it is zoomed to. */
  reference: readonly Point[];
  /** The pane's share of its card's width; a card's shares add up to 1. */
  share: number;
}

const whole = (reference: readonly Point[]): readonly Pane[] => [
  { reference, share: 1 },
];

const conic = (
  rotate: number,
  center: Point,
  parallels: Point,
): (() => GeoConicProjection) => {
  return () =>
    geoConicEqualArea()
      .rotate([rotate, 0])
      .center([center[0], center[1]])
      .parallels([parallels[0], parallels[1]]);
};

/**
 * The strip the insets sit in, under the lower 48's box, and the band under it for the credits.
 * The band scales with the drawing but the credits button does not (32 px and an 8 px inset), so
 * the band is sized for the narrowest drawn frame, about 494 px at a 520 px checker: 0.08 k is
 * about 69 of the drawing's 800 units, 42 px there.
 */
const STRIP_TOP = 0.262;
const STRIP_BOTTOM = 0.462;
const CREDITS_BAND = 0.08;
/** The layout's lowest line, in units of `k` from the lower 48's centre. */
export const US_LAYOUT_BOTTOM = STRIP_BOTTOM + CREDITS_BAND;
const STRIP_LEFT = -0.455;
const STRIP_RIGHT = 0.455;
const GAP = 0.012;
/** The even padding inside a card, and the band along its top that holds its label. */
const CARD_PAD = 0.009;
const LABEL_BAND = 0.032;

/** The corners of a lon/lat rectangle. */
const corners = (
  lon0: number,
  lat0: number,
  lon1: number,
  lat1: number,
): Point[] => [
  [lon0, lat0],
  [lon1, lat0],
  [lon1, lat1],
  [lon0, lat1],
];

/** The five cards, left to right, each with the share of the strip's width it takes. */
const CARD_WEIGHTS: readonly [UsPartName, number][] = [
  ["alaska", 1.4],
  ["hawaii", 1],
  ["puertoRico", 1.3],
  ["marianas", 0.8],
  ["samoa", 1.3],
];

/** Each card's box in the strip: the full width, even gaps, widths in proportion to the weights. */
function stripBoxes(): Record<string, Box> {
  const total = CARD_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  const room = STRIP_RIGHT - STRIP_LEFT - GAP * (CARD_WEIGHTS.length - 1);
  const boxes: Record<string, Box> = {};
  let x = STRIP_LEFT;
  for (const [name, weight] of CARD_WEIGHTS) {
    const width = (room * weight) / total;
    boxes[name] = [x, STRIP_TOP, x + width, STRIP_BOTTOM];
    x += width + GAP;
  }
  return boxes;
}
const BOXES = stripBoxes();

/**
 * The six parts, lower 48 first. A point is tried against each part's box in this order, and a
 * point outside every box is dropped.
 */
export const US_PARTS: readonly PartSpec[] = [
  {
    name: "lower48",
    // EPSG:5070 (the equal-area projection of the conterminous states).
    make: conic(96, [-0.6, 38.7], [29.5, 45.5]),
    box: [-0.455, -0.238, 0.455, 0.238],
    panes: [],
  },
  {
    name: "alaska",
    // EPSG:3338.
    make: conic(154, [-2, 58.5], [55, 65]),
    box: BOXES["alaska"]!,
    panes: whole([
      [-156.5, 71.4],
      [-168.1, 65.6],
      [-130, 55],
      [-165.5, 54.4],
      [-176.6, 51.9],
    ]),
  },
  {
    name: "hawaii",
    make: conic(157, [-3, 19.9], [8, 18]),
    box: BOXES["hawaii"]!,
    panes: whole(corners(-160.4, 18.8, -154.7, 22.35)),
  },
  {
    name: "puertoRico",
    make: conic(66, [0, 18.2], [8, 18]),
    box: BOXES["puertoRico"]!,
    // Puerto Rico, Mona, Vieques and Culebra, and the Virgin Islands to the east.
    panes: whole(corners(-67.98, 17.6, -64.5, 18.6)),
  },
  {
    name: "marianas",
    make: conic(-145, [0, 16], [8, 18]),
    box: BOXES["marianas"]!,
    // Guam, Rota, Aguijan, Tinian and Saipan. The islands north of Saipan, 400 km of specks, are
    // not in the boundary data: the page's caption says so.
    panes: whole(corners(144.55, 13.15, 145.95, 15.4)),
  },
  {
    name: "samoa",
    make: conic(170, [0, -14.3], [-8, -18]),
    box: BOXES["samoa"]!,
    // Tutuila and Aunuu, then the Manu'a group (Ofu, Olosega and Tau) in a pane of its own.
    panes: [
      { reference: corners(-170.9, -14.42, -170.55, -14.22), share: 0.55 },
      { reference: corners(-169.71, -14.3, -169.4, -14.15), share: 0.45 },
    ],
  },
];

/** One part's frame in the drawing, in px: `[[x0, y0], [x1, y1]]`. */
export type UsFrame = readonly [Point, Point];

export interface UsComposite {
  (coordinates: [number, number]): [number, number] | null;
  invert(point: [number, number]): [number, number] | null;
  stream(stream: GeoStream): GeoStream;
  scale(): number;
  scale(value: number): UsComposite;
  translate(): [number, number];
  translate(value: [number, number]): UsComposite;
  fitExtent(
    extent: [[number, number], [number, number]],
    object: GeoPermissibleObjects,
  ): UsComposite;
  /** The frame of every part at the current scale, in drawing px. */
  frames(): Record<UsPartName, UsFrame>;
  /** The middle of the band along the top of each card, where its label sits, in drawing px. */
  labelPoints(): Record<UsPartName, Point>;
}

/** One pane, or the lower 48: its projection, and the box (drawing px) it is clipped to. */
interface Built {
  clip: UsFrame;
  projection: GeoConicProjection;
  point: GeoStream;
}

/**
 * `projection` zoomed so the extent of `reference` fills `fit` (drawing px), centred in it. A conic
 * projection's output scales with `scale`, so one measured pass at a known scale gives the one that
 * fits; then the extent's middle goes to the fit area's.
 */
function zoomed(
  projection: GeoConicProjection,
  reference: readonly Point[],
  fit: Box,
): GeoConicProjection {
  const probe = 1000;
  projection.scale(probe).translate([0, 0]);
  const projected = reference
    .map((p) => projection([p[0], p[1]]))
    .filter((p): p is [number, number] => p !== null);
  const xs = projected.map((p) => p[0]);
  const ys = projected.map((p) => p[1]);
  const zoom = Math.min(
    (fit[2] - fit[0]) / (Math.max(...xs) - Math.min(...xs)),
    (fit[3] - fit[1]) / (Math.max(...ys) - Math.min(...ys)),
  );
  return projection
    .scale(probe * zoom)
    .translate([
      (fit[0] + fit[2]) / 2 - ((Math.min(...xs) + Math.max(...xs)) / 2) * zoom,
      (fit[1] + fit[3]) / 2 - ((Math.min(...ys) + Math.max(...ys)) / 2) * zoom,
    ]);
}

/** A composite equal-area projection of the lower 48, Alaska, Hawaii and the territories. */
export function geoUsComposite(): UsComposite {
  let k = 1070;
  let tx = 480;
  let ty = 250;
  let hit: [number, number] | null = null;
  const sink: GeoStream = {
    point(x: number, y: number) {
      hit = [x, y];
    },
    lineStart() {},
    lineEnd() {},
    polygonStart() {},
    polygonEnd() {},
    sphere() {},
  };
  let parts: Built[] = [];
  let cache: GeoStream | null = null;
  let cacheStream: GeoStream | null = null;

  const frameOf = (box: Box): UsFrame => [
    [tx + box[0] * k, ty + box[1] * k],
    [tx + box[2] * k, ty + box[3] * k],
  ];

  function layout(): void {
    const epsilon = 1e-6;
    const built = (projection: GeoConicProjection, clip: UsFrame): Built => {
      projection.clipExtent([
        [clip[0][0] + epsilon, clip[0][1] + epsilon],
        [clip[1][0] - epsilon, clip[1][1] - epsilon],
      ]);
      return { clip, projection, point: projection.stream(sink) };
    };
    parts = US_PARTS.flatMap((spec) => {
      const [[x0, y0], [x1, y1]] = frameOf(spec.box);
      if (spec.panes.length === 0) {
        const projection = spec.make().scale(k).translate([tx, ty]);
        return [built(projection, frameOf(spec.box))];
      }
      // The card less an even pad and the label band along its top, split into the panes' columns
      // with a pad between them. Each pane is clipped to its column, widened to the middle of the
      // pads beside it and to the card's edges, so no pane draws in another's.
      const pad = CARD_PAD * k;
      const top = y0 + pad + LABEL_BAND * k;
      const room = x1 - x0 - pad * (spec.panes.length + 1);
      let left = x0 + pad;
      return spec.panes.map((pane, i) => {
        const right = left + room * pane.share;
        const clip: UsFrame = [
          [i === 0 ? x0 : left - pad / 2, y0],
          [i === spec.panes.length - 1 ? x1 : right + pad / 2, y1],
        ];
        const projection = zoomed(spec.make(), pane.reference, [
          left,
          top,
          right,
          y1 - pad,
        ]);
        left = right + pad;
        return built(projection, clip);
      });
    });
    cache = cacheStream = null;
  }

  const composite = ((coordinates: [number, number]) => {
    for (const part of parts) {
      hit = null;
      part.point.point(coordinates[0], coordinates[1]);
      if (hit !== null) return hit;
    }
    return null;
  }) as UsComposite;

  composite.invert = (point) => {
    // The pane whose box holds the point, else the lower 48 (the first part).
    const part =
      parts.find(
        (p) =>
          p !== parts[0] &&
          point[0] >= p.clip[0][0] &&
          point[0] < p.clip[1][0] &&
          point[1] >= p.clip[0][1] &&
          point[1] < p.clip[1][1],
      ) ?? parts[0]!;
    return part.projection.invert!(point);
  };

  composite.stream = (stream) => {
    if (cache && cacheStream === stream) return cache;
    cacheStream = stream;
    const streams = parts.map((part) => part.projection.stream(stream));
    cache = {
      point: (x, y) => streams.forEach((s) => s.point(x, y)),
      sphere: () => streams.forEach((s) => s.sphere?.()),
      lineStart: () => streams.forEach((s) => s.lineStart()),
      lineEnd: () => streams.forEach((s) => s.lineEnd()),
      polygonStart: () => streams.forEach((s) => s.polygonStart()),
      polygonEnd: () => streams.forEach((s) => s.polygonEnd()),
    };
    return cache;
  };

  composite.scale = ((value?: number) => {
    if (value === undefined) return k;
    k = value;
    layout();
    return composite;
  }) as UsComposite["scale"];

  composite.translate = ((value?: [number, number]) => {
    if (value === undefined) return [tx, ty];
    tx = +value[0];
    ty = +value[1];
    layout();
    return composite;
  }) as UsComposite["translate"];

  composite.fitExtent = (extent, object) => {
    // As d3's own fit: draw at scale 150 about the origin, measure, then scale and place.
    composite.scale(150).translate([0, 0]);
    const [[bx0, by0], [bx1, by1]] = geoPath(composite).bounds(object);
    const width = extent[1][0] - extent[0][0];
    const height = extent[1][1] - extent[0][1];
    const fit = Math.min(width / (bx1 - bx0), height / (by1 - by0));
    composite.scale(150 * fit);
    composite.translate([
      extent[0][0] + (width - fit * (bx1 + bx0)) / 2,
      extent[0][1] + (height - fit * (by1 + by0)) / 2,
    ]);
    return composite;
  };

  composite.labelPoints = () =>
    Object.fromEntries(
      US_PARTS.map((spec) => {
        const [[x0, y0], [x1]] = frameOf(spec.box);
        const point: Point = [
          (x0 + x1) / 2,
          y0 + (CARD_PAD + LABEL_BAND / 2) * k,
        ];
        return [spec.name, point];
      }),
    ) as Record<UsPartName, Point>;

  composite.frames = () =>
    Object.fromEntries(
      US_PARTS.map((spec) => [spec.name, frameOf(spec.box)]),
    ) as Record<UsPartName, UsFrame>;

  layout();
  return composite;
}
