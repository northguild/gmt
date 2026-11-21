/**
 * What a slide's reached builds say, read from the page: the stage flies before the deck tells it
 * the lapse or the held clock, so it reads them here, as the deck's own step does.
 */

/**
 * The value of `data-<attribute>` on the highest build reached (`n <= build`) that carries one, or
 * `null` when no reached build does.
 */
export function builtAttribute(
  slide: HTMLElement | undefined,
  attribute: string,
  build: number,
): string | null {
  let value: string | null = null;
  let highest = 0;
  for (const b of slide?.querySelectorAll<HTMLElement>(
    `[data-build][data-${attribute}]`,
  ) ?? []) {
    const n = Number(b.dataset["build"]);
    if (n <= build && n > highest) {
      highest = n;
      value = b.getAttribute(`data-${attribute}`);
    }
  }
  return value;
}
