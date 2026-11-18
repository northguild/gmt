/**
 * The zones the `planet` camera centres on and the ice wall's shards land on are the zones GMT's CI
 * runs in, read from the zone-matrix data (`src/data/zone-matrix.ts`), so the Earth the deck turns
 * and the zones slide 5 counts in are one list. `places.ts` keeps its own default until this runs.
 */
import { zoneMatrixSummary } from "~/data/zone-matrix";
import { setPlanetZones } from "./places";

/** Points the planet at the matrix's zones. An empty list leaves the default in place. */
export function wirePlanetZones(
  zones: readonly string[] = zoneMatrixSummary.zones,
): void {
  if (zones.length > 0) setPlanetZones(zones);
}
