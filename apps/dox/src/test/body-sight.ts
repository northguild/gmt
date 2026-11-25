/** What the body-painter tests share: the Moon as the sky sees it, and a canvas that hands out blank image data. */
import { vi } from "vitest";
import {
  bodyOnScreen,
  moonFromCamera,
  moonRaDec,
  siderealDeg,
  toUnit,
  viewMatrix,
  type SkyLens,
} from "../lib/sky-math";

/** The Moon at the centre of the view at `instantMs`, as a 1440 x 844 sky puts it on screen. */
export function moonSight(lens: SkyLens, instantMs: number) {
  const place = moonRaDec(instantMs);
  const rotation: [number, number] = [
    siderealDeg(instantMs) + 180 - place.ra,
    place.dec,
  ];
  const m = viewMatrix(rotation, instantMs);
  const moon = moonFromCamera(instantMs, rotation);
  const disc = bodyOnScreen(
    lens,
    m,
    toUnit(moon.ra, moon.dec),
    moon.radius,
    1440,
    844,
    0,
  )!;
  return { m, moon, disc };
}

/** Makes every canvas's context give blank image data and swallow `putImageData`; undo with `vi.restoreAllMocks()`. */
export function stubImageCanvas(putImageData = vi.fn()): void {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    (() =>
      ({
        createImageData: (width: number, height: number) => ({
          width,
          height,
          data: new Uint8ClampedArray(width * height * 4),
        }),
        putImageData,
      }) as unknown as CanvasRenderingContext2D) as never,
  );
}
