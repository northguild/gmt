/** Ids that passed both `isValidTimeZone` checks. Whether an id names a zone is fixed by the host data. */
const validatedZones = new Set<string>();

/** Past this many ids the set clears. */
const MAX_VALIDATED_ZONES = 1024;

/**
 * Whether this id already passed `isValidTimeZone`.
 *
 * @param timeZone the identifier
 * @returns `true` for an id remembered as valid
 *
 * @example isRememberedZone("Europe/London") // false until `rememberZone("Europe/London")`
 */
export function isRememberedZone(timeZone: string): boolean {
  return validatedZones.has(timeZone);
}

/**
 * Remember an id that passed. Only a pass is stored, so hostile strings cannot grow the set;
 * past 1,024 ids the set clears.
 *
 * @param timeZone the identifier that passed
 *
 * @example rememberZone("Europe/London") // stores it
 */
export function rememberZone(timeZone: string): void {
  if (validatedZones.size >= MAX_VALIDATED_ZONES) {
    validatedZones.clear();
  }
  validatedZones.add(timeZone);
}

/** Test seam: forget every remembered id. */
export function clearValidatedZones(): void {
  validatedZones.clear();
}
