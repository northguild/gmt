/**
 * The look of a share image, in one place for the `/og/…` route and for the script that writes the
 * upload-ready images in `apps/dox/assets/share/` (`scripts/build-social-preview.ts`).
 *
 * The card is drawn with CanvasKit directly: the route's earlier engine left-aligned its text and
 * padded all four sides by one number, so it could not centre text in the 630-pixel square that a link-preview app cuts from the middle of a 1200-pixel card. The Earth
 * is a still picture (`src/assets/og-earth.webp`, made by `scripts/build-og-earth.ts`); the title
 * and, on the site card, one line are centred over the sky above it, inside that square, with a margin, so a
 * centre crop still shows all the text.
 *
 * Colours are the site's void, ice and cyan tokens as RGB triples, because the canvas takes
 * numbers and not CSS variables. Paths are relative to `apps/dox`, where the build, the script and
 * the tests all run.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CanvasKit, FontMgr, Image, Paragraph } from "canvaskit-wasm";
import sharp from "sharp";
import { getCanvasKit } from "./og-canvaskit";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
/** The square a link-preview app cuts from the middle of the card. */
export const OG_SAFE_LEFT = 285;
export const OG_SAFE_RIGHT = 915;
/** The space between the safe square's edge and the text. */
const MARGIN = 28;
const TEXT_LEFT = OG_SAFE_LEFT + MARGIN;
const TEXT_WIDTH = OG_SAFE_RIGHT - OG_SAFE_LEFT - 2 * MARGIN;

/** `--gmt-void`, the page background. */
export const OG_BACKGROUND: [number, number, number] = [3, 8, 12];
/** The cyan of the bottom edge. */
export const OG_EDGE_COLOR: [number, number, number] = [34, 211, 238];
/** The width of the cyan edge in pixels. */
export const OG_EDGE = 8;
/** `--gmt-ice`, the title. */
const ICE: [number, number, number] = [207, 234, 242];
/** `--gmt-ice-dim`, the site line and the small line above the title. */
const ICE_DIM: [number, number, number] = [152, 178, 190];

/** The title's largest size; it shrinks until it takes two lines at most. */
const TITLE_MAX = 46;
const TITLE_MIN = 20;
/** The site card's line under the title: the largest size that takes two lines, down to the least. */
const LINE_MAX = 28;
const LINE_MIN = 22;
/** The block of text is centred in the sky, from the card's top to here (above the limb's glow). */
const SKY_BOTTOM = 340;

/**
 * A share card, by kind. The site card has the title `GMT` and one line under it; every page
 * card (guide, tool, scenario, migration, comparison, reference namespace) is its title alone.
 */
export type OgCard =
  | { kind: "site"; line: string }
  | { kind: "page"; title: string };

export type OgBox = { x: number; y: number; width: number; height: number };

type OgBoxes = { eyebrow: OgBox; title: OgBox };
export type OgLayout =
  | ({ kind: "page"; titleSize: number; titleLines: number } & OgBoxes)
  | ({
      kind: "site";
      titleSize: number;
      titleLines: number;
      lineSize: number;
      lineLines: number;
      line: OgBox;
    } & OgBoxes);

const asset = (path: string) => readFileSync(resolve(process.cwd(), path));
/** A file's bytes as the exact `ArrayBuffer` CanvasKit's font loader takes. */
const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

/** The fonts and the Earth, loaded once; every card shares them. */
let shared:
  | { CanvasKit: CanvasKit; fontMgr: FontMgr; earth: Image }
  | undefined;
async function load() {
  if (shared) return shared;
  const CanvasKit = await getCanvasKit();
  const fontMgr = CanvasKit.FontMgr.FromData(
    toArrayBuffer(asset("src/assets/og-fonts/Michroma-Regular.ttf")),
    toArrayBuffer(asset("src/assets/og-fonts/JetBrainsMono-Regular.ttf")),
  );
  if (!fontMgr) throw new Error("cannot load the card fonts");
  const earth = CanvasKit.MakeImageFromEncoded(
    asset("src/assets/og-earth.webp"),
  );
  if (!earth) throw new Error("cannot decode the Earth");
  shared = { CanvasKit, fontMgr, earth };
  return shared;
}

/** The paragraphs of a card, laid out. `dispose` frees them. */
export type PlacedCard = {
  layout: OgLayout;
  paragraphs: { eyebrow: Paragraph; title: Paragraph; line?: Paragraph };
  /** The x each paragraph is drawn at, and the width it is laid out in. */
  at: { eyebrow: number; title: number; line: number; lineWidth: number };
  dispose(): void;
};

/** U+2060 WORD JOINER: it draws nothing, and Unicode line breaking (UAX #14) never breaks beside it. */
const WORD_JOINER = "\u2060";

/**
 * The title as it is laid out: each hyphen joined to its neighbours, so a name such as a
 * package's breaks at a space and never after its hyphen.
 */
export const titleForLayout = (title: string): string =>
  title.replaceAll("-", `${WORD_JOINER}-${WORD_JOINER}`);

/**
 * Lay out a card's text, centred in the safe square and in the sky above the limb. A title takes
 * the largest size that fits two lines and throws when none does; the site line does the same and
 * is broken evenly. Nothing is ever shortened. Draws nothing.
 */
export async function placeCard(card: OgCard): Promise<PlacedCard> {
  const { CanvasKit, fontMgr } = await load();
  const paragraph = (
    text: string,
    family: string,
    size: number,
    color: [number, number, number],
    lineHeight: number,
    letterSpacing = 0,
    width = TEXT_WIDTH,
  ): Paragraph => {
    const style = new CanvasKit.ParagraphStyle({
      textAlign: CanvasKit.TextAlign.Center,
      textStyle: {
        color: CanvasKit.Color(...color),
        fontFamilies: [family],
        fontSize: size,
        heightMultiplier: lineHeight,
        letterSpacing,
      },
    });
    const builder = CanvasKit.ParagraphBuilder.Make(style, fontMgr);
    builder.addText(text);
    const built = builder.build();
    builder.delete();
    built.layout(width);
    return built;
  };
  const fits = (p: Paragraph, width = TEXT_WIDTH) =>
    p.getLineMetrics().length <= 2 && p.getLongestLine() <= width;

  const titleText = card.kind === "site" ? "GMT" : card.title;
  const laidOut = titleForLayout(titleText);
  let titleSize = TITLE_MAX;
  let title = paragraph(laidOut, "Michroma", titleSize, ICE, 1.25);
  while (!fits(title) && titleSize > TITLE_MIN) {
    titleSize -= 1;
    title.delete();
    title = paragraph(laidOut, "Michroma", titleSize, ICE, 1.25);
  }
  if (!fits(title)) {
    title.delete();
    throw new Error(`share card title does not fit two lines: ${titleText}`);
  }

  let line: Paragraph | undefined;
  let lineSize = 0;
  let lineWidth = TEXT_WIDTH;
  if (card.kind === "site") {
    lineSize = LINE_MAX;
    // Broken evenly: at the word gap that makes the longer of the two lines shortest, the earlier
    // gap on a tie, so the first line is never the longer one.
    const words = card.line.split(" ");
    let best = 1;
    let bestLongest = Infinity;
    for (let at = 1; at < words.length; at++) {
      const longest = Math.max(
        words.slice(0, at).join(" ").length,
        words.slice(at).join(" ").length,
      );
      if (longest < bestLongest) {
        best = at;
        bestLongest = longest;
      }
    }
    const broken = `${words.slice(0, best).join(" ")}\n${words.slice(best).join(" ")}`;
    const make = (size: number, width: number) =>
      paragraph(broken, "JetBrains Mono", size, ICE_DIM, 1.4, 0, width);
    let candidate = make(lineSize, TEXT_WIDTH);
    while (!fits(candidate) && lineSize > LINE_MIN) {
      lineSize -= 1;
      candidate.delete();
      candidate = make(lineSize, TEXT_WIDTH);
    }
    if (!fits(candidate)) {
      candidate.delete();
      title.delete();
      throw new Error(
        `the site card line does not fit two lines: ${card.line}`,
      );
    }
    candidate.delete();
    line = make(lineSize, lineWidth);
  }

  const eyebrow = paragraph(
    "@NORTHGUILD/GMT",
    "JetBrains Mono",
    15,
    ICE_DIM,
    1.2,
    3,
  );
  const GAP_TITLE = 16;
  const GAP_LINE = 22;
  const block =
    eyebrow.getHeight() +
    GAP_TITLE +
    title.getHeight() +
    (line ? GAP_LINE + line.getHeight() : 0);
  const eyebrowY = Math.round((SKY_BOTTOM - block) / 2);
  const titleY = eyebrowY + eyebrow.getHeight() + GAP_TITLE;
  const lineY = titleY + title.getHeight() + GAP_LINE;
  const box = (
    p: Paragraph,
    y: number,
    left = TEXT_LEFT,
    width = TEXT_WIDTH,
  ): OgBox => {
    const w = p.getLongestLine();
    return { x: left + (width - w) / 2, y, width: w, height: p.getHeight() };
  };
  const lineLeft = TEXT_LEFT + (TEXT_WIDTH - lineWidth) / 2;
  const boxes = { eyebrow: box(eyebrow, eyebrowY), title: box(title, titleY) };
  const titleLines = title.getLineMetrics().length;
  const layout: OgLayout =
    line === undefined
      ? { kind: "page", titleSize, titleLines, ...boxes }
      : {
          kind: "site",
          titleSize,
          titleLines,
          lineSize,
          lineLines: line.getLineMetrics().length,
          line: box(line, lineY, lineLeft, lineWidth),
          ...boxes,
        };
  return {
    layout,
    paragraphs: { eyebrow, title, line },
    at: { eyebrow: TEXT_LEFT, title: TEXT_LEFT, line: lineLeft, lineWidth },
    dispose: () => {
      eyebrow.delete();
      title.delete();
      line?.delete();
    },
  };
}

/** Relative luminance of an sRGB colour (WCAG 2.2). */
function luminance(r: number, g: number, b: number): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export type DrawnCard = {
  /** The card's pixels, RGBA, `OG_WIDTH` by `OG_HEIGHT`, rows from the top. */
  pixels: Uint8Array;
  layout: OgLayout;
  /** WCAG contrast of each text against the brightest pixel behind it. */
  contrast: { eyebrow: number; title: number; line: number | null };
};

/** Draw a card, 1200 by 630, as raw pixels with its layout and contrast. */
export async function drawCard(card: OgCard): Promise<DrawnCard> {
  const { CanvasKit, earth } = await load();
  const placed = await placeCard(card);
  const { layout, paragraphs } = placed;
  const surface = CanvasKit.MakeSurface(OG_WIDTH, OG_HEIGHT);
  if (!surface) throw new Error("cannot make a surface");
  const canvas = surface.getCanvas();
  canvas.drawImage(earth, 0, 0);
  const edge = new CanvasKit.Paint();
  edge.setColor(CanvasKit.Color(...OG_EDGE_COLOR));
  canvas.drawRect(
    CanvasKit.XYWHRect(0, OG_HEIGHT - OG_EDGE, OG_WIDTH, OG_EDGE),
    edge,
  );

  // The brightest pixel behind each text box, before the text goes on.
  const behind = canvas.readPixels(0, 0, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    colorType: CanvasKit.ColorType.RGBA_8888,
    alphaType: CanvasKit.AlphaType.Unpremul,
    colorSpace: CanvasKit.ColorSpace.SRGB,
  }) as Uint8Array;
  const worst = (b: OgBox, color: [number, number, number]) => {
    let max = 0;
    for (let y = Math.floor(b.y); y < Math.ceil(b.y + b.height); y++) {
      for (let x = Math.floor(b.x); x < Math.ceil(b.x + b.width); x++) {
        const at = (y * OG_WIDTH + x) * 4;
        max = Math.max(
          max,
          luminance(behind[at], behind[at + 1], behind[at + 2]),
        );
      }
    }
    return (luminance(...color) + 0.05) / (max + 0.05);
  };
  const contrast = {
    eyebrow: worst(layout.eyebrow, ICE_DIM),
    title: worst(layout.title, ICE),
    line: layout.kind === "site" ? worst(layout.line, ICE_DIM) : null,
  };

  canvas.drawParagraph(paragraphs.eyebrow, placed.at.eyebrow, layout.eyebrow.y);
  canvas.drawParagraph(paragraphs.title, placed.at.title, layout.title.y);
  if (paragraphs.line && layout.kind === "site") {
    canvas.drawParagraph(paragraphs.line, placed.at.line, layout.line.y);
  }
  // A copy: the surface frees its own memory below.
  const pixels = Uint8Array.from(
    canvas.readPixels(0, 0, {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      colorType: CanvasKit.ColorType.RGBA_8888,
      alphaType: CanvasKit.AlphaType.Unpremul,
      colorSpace: CanvasKit.ColorSpace.SRGB,
    }) as Uint8Array,
  );
  edge.delete();
  surface.dispose();
  placed.dispose();
  return { pixels, layout, contrast };
}

const encode = (pixels: Uint8Array) =>
  sharp(pixels, {
    raw: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4 },
  })
    .png({
      palette: true,
      quality: 100,
      effort: 1,
      dither: 0,
      compressionLevel: 6,
    })
    .toBuffer();

/**
 * The card as the route serves it: a palette PNG. The Earth is a photograph, which is about
 * 400 KB as true colour; 256 colours bring it to about 120 KB, under the 300 KB that WhatsApp
 * will fetch for a preview. No dithering: the sky and the sea are smooth gradients that 256 colours
 * hold without it, and it costs time and bytes. Effort 1 is the quickest quantiser setting: all
 * 160 cards take about 12 s, against about 5 s for the old route with no cache.
 */
export async function renderCard(card: OgCard): Promise<Uint8Array> {
  const { pixels } = await drawCard(card);
  return encode(pixels);
}

/** The artwork alone, with no text: the sky, the Earth and the cyan edge, as a palette PNG. */
export async function renderArtwork(): Promise<Uint8Array> {
  const { CanvasKit, earth } = await load();
  const surface = CanvasKit.MakeSurface(OG_WIDTH, OG_HEIGHT);
  if (!surface) throw new Error("cannot make a surface");
  const canvas = surface.getCanvas();
  canvas.drawImage(earth, 0, 0);
  const edge = new CanvasKit.Paint();
  edge.setColor(CanvasKit.Color(...OG_EDGE_COLOR));
  canvas.drawRect(
    CanvasKit.XYWHRect(0, OG_HEIGHT - OG_EDGE, OG_WIDTH, OG_EDGE),
    edge,
  );
  const pixels = Uint8Array.from(
    canvas.readPixels(0, 0, {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      colorType: CanvasKit.ColorType.RGBA_8888,
      alphaType: CanvasKit.AlphaType.Unpremul,
      colorSpace: CanvasKit.ColorSpace.SRGB,
    }) as Uint8Array,
  );
  edge.delete();
  surface.dispose();
  return encode(pixels);
}
