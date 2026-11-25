/**
 * Where the globe's hover card goes: its x, kept inside the host and short of a limit, and
 * whether it hangs below its pin.
 */

/** The gap between the pin and the card's tail, in pixels. */
const TAIL = 16;

/** How far below its pin a flipped card's top hangs, in pixels. */
const DROP = 12;

/** Where the hover card goes, and whether its pin is out of sight behind chrome. */
interface TooltipPlacement {
  /** The card's centre, in host pixels. */
  x: number;
  /** The card's anchor, in host pixels: the pin, or its top edge when it hangs below. */
  y: number;
  /** True when the card hangs below its pin: above it, it would rise past `top`. */
  below: boolean;
  /** True when the pin is at or past `limit`, or the card would reach past `bottom`: what it
      points at is behind chrome. */
  occluded: boolean;
}

/**
 * Centre the hover card on its pin, kept inside the host and short of `limit`.
 *
 * Pure so the clamp is tested without a globe. Without a `limit` this is the
 * plain clamp: the card's edges stay `pad` inside the host. With one, the
 * card's right edge also stays at or short of it, and a pin at or past it is
 * `occluded`. The card sits above its pin unless it would rise past `top`, the
 * highest y in host pixels it may reach; a card that would reach past `bottom`
 * is `occluded` too.
 */
export function placeTooltip({
  x,
  y,
  top,
  bottom,
  width,
  cardWidth,
  cardHeight,
  pad,
  limit,
}: {
  x: number;
  y: number;
  top: number;
  bottom: number | null;
  width: number;
  cardWidth: number;
  cardHeight: number;
  pad: number;
  limit: number | null;
}): TooltipPlacement {
  const upper = Math.min(width - pad, limit ?? Infinity) - cardWidth / 2;
  const lower = cardWidth / 2 + pad;
  const below = y - cardHeight - TAIL < top;
  const reach = below ? y + DROP + cardHeight : y;
  return {
    x: Math.min(Math.max(x, lower), upper),
    y: below ? y + DROP : y,
    below,
    occluded:
      (limit !== null && x >= limit) || (bottom !== null && reach > bottom),
  };
}
