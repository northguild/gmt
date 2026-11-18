/**
 * The ice wall's pixel probe, shared by `slides-check.mjs` (canvas-2D) and `globe-smoke.mjs` (GPU).
 *
 * With the wall hanging whole, the centre of each pane on screen must match the centre of its
 * capture. A WebGPU canvas cannot be read back from the page, so the screen side is a screenshot
 * of a small clip at each pane centre, which works on every renderer; the stage's slide text is
 * hidden for the shot so it cannot cover a centre. The capture side is the pane's own `<img>`
 * drawn on a canvas.
 *
 * Each pane must also be drawn under its caption: the wall canvas's origin plus the centre the
 * wall publishes lands on the centre of that pane's caption figure.
 */
import {
  meanColour,
  paneOffsets,
  parseCentres,
  wallMismatches,
} from "./slides-check-helpers.mjs";

/** The clip is this share of a pane's width, each way from the centre. */
const HALF_SHARE = 0.04;

/**
 * Probes the wall in `page`. Resolves to `{ problems: string[] }`: empty when every pane matches.
 * `space` is the selector of the space host that publishes `data-wall-centres`.
 */
export async function probeWall(page, space = "[data-deck-space]") {
  const info = await page.evaluate((sel) => {
    const host = document.querySelector(sel);
    const rect = host?.getBoundingClientRect();
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    const canvas = host
      ?.querySelector("canvas[data-wall-canvas]")
      ?.getBoundingClientRect();
    const figures = Array.from(document.querySelectorAll("[data-wall-pane]"));
    return {
      centres: host?.dataset.wallCentres ?? "",
      width: Number(host?.dataset.wallPaneWidth ?? 0),
      left,
      top,
      origin: canvas ? [canvas.left - left, canvas.top - top] : null,
      ids: figures.map((f) => f.dataset.wallPane),
      boxes: figures.map((f) => {
        const r = f.getBoundingClientRect();
        return [r.left - left + r.width / 2, r.top - top + r.height / 2];
      }),
    };
  }, space);
  const centres = parseCentres(info.centres);
  if (!centres || !(info.width > 0))
    return { problems: ["the wall published no pane centres or width"] };
  if (centres.length !== info.ids.length)
    return {
      problems: [
        `the wall published ${centres.length} centre(s) for ${info.ids.length} pane(s)`,
      ],
    };
  if (!info.origin) return { problems: ["the wall drew no canvas"] };
  const [ox, oy] = info.origin;
  const drawn = centres.map(([x, y]) => [ox + x, oy + y]);
  const offsets = paneOffsets(info.ids, drawn, info.boxes).map(
    (m) => `pane "${m.id}": ${m.why}`,
  );

  const half = Math.max(4, Math.round(info.width * HALF_SHARE));
  const style = await page.addStyleTag({
    // The shown slide sets its own visibility, so every descendant is hidden too, not the stage alone.
    content:
      "[data-deck-stage],[data-deck-stage] *{visibility:hidden !important}",
  });
  const pairs = [];
  try {
    for (const [i, [cx, cy]] of centres.entries()) {
      const shot = await page.screenshot({
        clip: {
          x: Math.round(info.left + ox + cx - half),
          y: Math.round(info.top + oy + cy - half),
          width: half * 2,
          height: half * 2,
        },
      });
      const read = await page.evaluate(
        async ({ png, index, share }) => {
          const decode = async () => {
            const bitmap = await createImageBitmap(
              new Blob([new Uint8Array(png)], { type: "image/png" }),
            );
            const canvas = document.createElement("canvas");
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(bitmap, 0, 0);
            return Array.from(
              ctx.getImageData(0, 0, canvas.width, canvas.height).data,
            );
          };
          const image = document.querySelectorAll("[data-wall-pane] img")[
            index
          ];
          let capture = null;
          if (image && image.naturalWidth > 0) {
            const side = Math.max(4, Math.round(image.naturalWidth * share));
            const canvas = document.createElement("canvas");
            canvas.width = side;
            canvas.height = side;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(
              image,
              (image.naturalWidth - side) / 2,
              (image.naturalHeight - side) / 2,
              side,
              side,
              0,
              0,
              side,
              side,
            );
            capture = Array.from(ctx.getImageData(0, 0, side, side).data);
          }
          return { drawn: await decode(), capture };
        },
        { png: Array.from(shot), index: i, share: HALF_SHARE * 2 },
      );
      pairs.push({
        id: info.ids[i],
        drawn: meanColour(read.drawn),
        capture: read.capture ? meanColour(read.capture) : null,
      });
    }
  } finally {
    await style.evaluate((el) => el.remove()).catch(() => {});
  }
  return {
    problems: [
      ...offsets,
      ...wallMismatches(pairs).map((m) => `pane "${m.id}": ${m.why}`),
    ],
    pairs,
  };
}
