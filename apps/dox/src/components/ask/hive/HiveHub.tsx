/**
 * DOX-C3a (#139) — the Dox mark at logo scale, for the empty state.
 *
 * The same crystal and stage as a transcript marker (`HiveNode`), minus the
 * role label — this one is the product's mark, not a speaker's.
 *
 * It does NOT spin in. A logo that arrives spinning reads as a loading
 * indicator, which is exactly the wrong first impression on an idle page; the
 * spin belongs to "Dox is working". Instead it uses the site's existing arrival
 * gesture — the fade-and-scale the globe performs on the dashboard
 * (`gmt-globe.css`'s `.gmt-globe-canvas-ready`), same easing, same duration —
 * so the two landmark visuals on this site enter the same way.
 *
 * `useCrystalSpin(false, false)` still runs, so the hook stays the single owner
 * of this element's transform; passing `enter: false` is what suppresses the
 * turn.
 */
import { HiveGlyph } from "./HiveGlyph";
import { useCrystalSpin } from "./use-crystal-spin";

export function HiveHub() {
  const spinRef = useCrystalSpin(false, false);

  return (
    <div className="gmt-hive-stage gmt-hive-hub">
      <span className="gmt-hive-halo" aria-hidden="true" />
      <div className="gmt-hive-node" data-role="assistant" ref={spinRef}>
        <HiveGlyph idSuffix="hub" />
      </div>
    </div>
  );
}
