/**
 * DOX-C3a (#139) — the role marker: the Dox crystal on a 3D stage.
 *
 * The geometry lives in `HiveGlyph` (shared with the site header). This file
 * owns the *stage*: a `perspective` wrapper whose inner element carries
 * `transform-style: preserve-3d`, so the crystal turns as a solid rather than
 * squashing flat.
 *
 * The turning itself is `useCrystalSpin` — Web Animations, not CSS, because a
 * CSS spin cannot stop *gracefully*: removing the class snaps to 0deg and
 * pausing freezes mid-turn. See that file for the landing.
 */
import { useId } from "react";
import { HiveGlyph } from "./HiveGlyph";
import { useCrystalSpin } from "./use-crystal-spin";

export type HiveRole = "assistant" | "user";

const LABELS: Record<HiveRole, string> = {
  assistant: "Dox",
  user: "You",
};

export function HiveNode({
  role,
  pending = false,
}: {
  role: HiveRole;
  /** Waiting on the first token: the crystal keeps turning and the halo
   * pulses, then lands square when the answer arrives. */
  pending?: boolean;
}) {
  const id = useId();
  const spinRef = useCrystalSpin(pending);

  return (
    <div className="gmt-hive-node-col">
      <div className="gmt-hive-stage" data-pending={pending || undefined}>
        {/* The halo cannot live on the crystal itself: it is a box-shadow, and
            the crystal is an SVG with transparent corners, so the shadow would
            trace a rectangle. Separate layer, same centre. */}
        <span className="gmt-hive-halo" aria-hidden="true" />
        <div className="gmt-hive-node" data-role={role} ref={spinRef}>
          <HiveGlyph idSuffix={id} />
        </div>
      </div>
      <span className="gmt-hive-label">{LABELS[role]}</span>
    </div>
  );
}
