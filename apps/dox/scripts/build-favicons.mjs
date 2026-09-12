/**
 * Rasterizes the hand-authored favicon SVGs in `public/` to exact-size PNGs.
 *
 * Why PNGs at all: the SVG is the crisp path and wins wherever it is supported
 * — Starlight deliberately sorts the `rel="shortcut icon"` SVG *after* any
 * extra icon links (see its utils/head.ts: "if several icons are equally
 * appropriate, the last one is used and we want to use the SVG icon when
 * supported"), so these are only reached by browsers that cannot use it. They
 * are rendered at the exact sizes the browser asks for, so a fallback never
 * has to downscale something larger and blur it.
 *
 * Why Playwright: it is already a devDependency (the visual-snapshot harness
 * uses it), so this needs no rasterizer package — `sharp`, `resvg` and
 * `satori` are all absent from this repo and stay absent.
 *
 * Deliberately NOT part of `pnpm run generate`: launching a browser on every
 * build is slow and CI-fragile, and the marks change approximately never. Run
 * `pnpm run favicons` by hand after editing an SVG and commit the output.
 */
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const publicDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
);

/** --gmt-void, dark theme (src/styles/gmt-tokens.css). */
const VOID = "#03080c";

const TARGETS = [
  { svg: "favicon.svg", out: "favicon-32.png", size: 32 },
  /* iOS composites home-screen icons onto an opaque ground of its own choosing
     and rounds the corners itself, so this one gets the site's own background
     rather than transparency, plus a margin so the rounding cannot clip the
     crystal's points. */
  {
    svg: "favicon.svg",
    out: "apple-touch-icon.png",
    size: 180,
    background: VOID,
    inset: 0.08,
  },
];

const browser = await chromium.launch();

try {
  for (const target of TARGETS) {
    const { svg, out, size, background = null, inset = 0 } = target;
    const markup = await readFile(path.join(publicDir, svg), "utf8");

    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
      /* The SVGs carry a `prefers-color-scheme` block; the raster has to
         commit to one. Dark is the site's default theme and its brighter cyan
         (#22d3ee) stays legible on a light tab strip, where the light-theme
         #0891b2 on a dark strip would not. */
      colorScheme: "dark",
    });

    /* An SVG served as a favicon is parsed as its own XML document, where a
       single stray `--` inside a comment (XML forbids them) is fatal. Nothing
       about that fails loudly: the icon simply does not render, and browsers
       keep showing whatever they already cached, so the file looks fine in
       every other context. It does still rasterize below, because the markup
       is inlined into HTML there and the HTML parser is lenient. So check it
       the way a browser tab will: load it as an image and insist it decodes. */
    const decoded = await page.evaluate(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img.naturalWidth > 0);
          img.onerror = () => resolve(false);
          img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}`;
        }),
      markup,
    );
    if (!decoded) {
      throw new Error(
        `public/${svg} does not parse as an image — it would not render as a ` +
          `favicon. Check for '--' inside an XML comment, or unescaped '&'/'<'.`,
      );
    }

    /* The SVG is inlined into the document rather than pointed at via
       `<img src="data:…">`: an SVG loaded as an image is rendered in its own
       context, where `prefers-color-scheme` does not reliably follow the
       host page, which would silently bake the light palette. */
    const box = Math.round(size * (1 - inset * 2));
    await page.setContent(
      `<!doctype html><meta charset="utf-8"><style>
         html, body {
           margin: 0;
           width: ${size}px;
           height: ${size}px;
           display: grid;
           place-items: center;
           background: ${background ?? "transparent"};
         }
         svg { display: block; width: ${box}px; height: ${box}px }
       </style>${markup}`,
      { waitUntil: "load" },
    );

    await writeFile(
      path.join(publicDir, out),
      await page.screenshot({ type: "png", omitBackground: background === null }),
    );
    await page.close();

    console.log(
      `  ${svg} → public/${out}  ${size}×${size}` +
        `  ${background ? `on ${background}` : "transparent"}`,
    );
  }
} finally {
  await browser.close();
}
