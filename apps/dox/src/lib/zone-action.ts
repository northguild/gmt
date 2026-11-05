/**
 * The one action a zone choice runs, whether the reader picked it in the list, searched for it,
 * or tapped it on the Earth. Each centres the globe on the place, then selects it (card, pin,
 * list mark, readout). A zone with no coordinate is selected without a move, and `null` clears
 * the selection where the globe is.
 */
export interface ZoneActionDeps<Rotation> {
  /** The rotation that centres the zone, or null for a zone with no coordinate. */
  rotationFor(id: string): Rotation | null;
  flyTo(rotation: Rotation): void;
  select(id: string | null): void;
}

export function chooseZone<Rotation>(
  deps: ZoneActionDeps<Rotation>,
  id: string | null,
): void {
  if (id !== null) {
    const rotation = deps.rotationFor(id);
    if (rotation) deps.flyTo(rotation);
  }
  deps.select(id);
}
