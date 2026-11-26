/**
 * The decorations a US map draws that no role reaches (they are `aria-hidden`, on purpose): the
 * inset frames and the hatched part. A test asks for them here, then asserts on the elements with
 * matchers.
 */

/** The SVG of the map in view `scope` (`sunshine-proposals`), or null until it is drawn. */
export const mapSvg = (
  root: HTMLElement,
  scope: string,
): SVGSVGElement | null =>
  root.querySelector<SVGSVGElement>(`[id="${scope}-map"] svg`);

/** The inset frames: closed outlines with 45 degree corners, drawn `aria-hidden`. */
export const insetFrames = (svg: SVGSVGElement): SVGPathElement[] =>
  [...svg.querySelectorAll<SVGPathElement>("path[aria-hidden='true']")].filter(
    (path) => /^M[\d.]+ [\d.]+ H/.test(path.getAttribute("d") ?? ""),
  );

/** The hatched parts, each with the outline it is clipped to. */
export const hatchedParts = (
  svg: SVGSVGElement,
): { hatch: SVGPathElement; clipD: string | null }[] =>
  [...svg.querySelectorAll<SVGPathElement>("path[clip-path]")].map((hatch) => {
    const id = /#(.*)\)/.exec(hatch.getAttribute("clip-path") ?? "")?.[1] ?? "";
    return {
      hatch,
      clipD:
        svg.querySelector(`[id="${CSS.escape(id)}"] path`)?.getAttribute("d") ??
        null,
    };
  });

/** The outline of the state shape named `name` (a shape is a `role="button"` path). */
export const shapeOutline = (svg: SVGSVGElement, name: string): string | null =>
  svg
    .querySelector(`path[role='button'][aria-label^="${name}"]`)
    ?.getAttribute("d") ?? null;
