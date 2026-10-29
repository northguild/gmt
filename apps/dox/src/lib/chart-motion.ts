/**
 * Chart motion policy. TanStack Charts animates its tooltip by default and keeps it immediate
 * with `motion: false`. The reduced-motion reader gets the immediate tooltip, so no sheet needs
 * a rule that switches the animation off from outside the library.
 */
export function chartTooltipMotion(): { motion?: false } {
  const reduced =
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
    false;
  return reduced ? { motion: false } : {};
}
