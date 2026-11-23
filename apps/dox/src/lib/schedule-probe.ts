/**
 * Names the parts of an operating schedule the library refuses, by asking the library again.
 *
 * Every probe is `isValid` on a schedule of one part, built from the reader's own values. The
 * site states no rule of its own: it holds no list of weekday keys, time patterns, date limits or
 * zone rules, and the library says what it takes. Pure and DOM-free: the caller passes the
 * validator (`isValidOperatingSchedule`, from `loadHoursLib`).
 *
 * The probe reads only `timeZone`, `weekly`, `holidays` and `overrides`, the fields of the
 * `OperatingSchedule` type. A key the library ignores is never probed. A schedule's text is
 * capped by `SCHEDULE_TEXT_MAX`, so the number of probes is bounded.
 */

/** What asking the library again found. */
export type ScheduleProbe =
  /** The whole value is accepted. */
  | { kind: "accepted" }
  /** The zone is refused. Nothing else is probed without a zone. */
  | { kind: "zone-refused" }
  /** One or more parts are refused on their own, as JSON paths such as `weekly["8"]`. */
  | { kind: "parts-refused"; parts: readonly string[] }
  /** Every part is accepted on its own and the whole is refused. */
  | { kind: "refused-together" };

type Validator = (value: unknown) => boolean;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The refused parts of `weekly`: a bad key, then a bad window under a good key. */
function weeklyParts(
  zone: unknown,
  weekly: unknown,
  isValid: Validator,
): string[] {
  const probe = (w: unknown): boolean => isValid({ timeZone: zone, weekly: w });
  if (!isPlainObject(weekly)) return probe(weekly) ? [] : ["weekly"];
  const parts: string[] = [];
  for (const key of Object.keys(weekly)) {
    const path = `weekly[${JSON.stringify(key)}]`;
    if (!probe({ [key]: [] })) {
      parts.push(path);
      continue;
    }
    const windows = weekly[key];
    if (Array.isArray(windows)) {
      windows.forEach((w, i) => {
        if (!probe({ [key]: [w] })) parts.push(`${path}[${i}]`);
      });
    } else if (!probe({ [key]: windows })) {
      parts.push(path);
    }
  }
  return parts;
}

/** The refused parts of a field that is a list of entries (`holidays`, `overrides`). */
function listParts(
  name: "holidays" | "overrides",
  zone: unknown,
  list: unknown,
  isValid: Validator,
): string[] {
  const probe = (v: unknown): boolean =>
    isValid({ timeZone: zone, weekly: {}, [name]: v });
  if (!Array.isArray(list)) return probe(list) ? [] : [name];
  const parts: string[] = [];
  list.forEach((entry, i) => {
    if (!probe([entry])) parts.push(`${name}[${i}]`);
  });
  return parts;
}

/**
 * Probes `value`, a parsed schedule, one part at a time. `value` is whatever `JSON.parse`
 * returned, so it may be anything.
 */
export function probeScheduleParts(
  value: unknown,
  isValid: Validator,
): ScheduleProbe {
  if (isValid(value)) return { kind: "accepted" };
  if (!isPlainObject(value)) return { kind: "refused-together" };
  const zone = value["timeZone"];
  if (!isValid({ timeZone: zone, weekly: {} })) return { kind: "zone-refused" };
  const parts = [
    ...weeklyParts(zone, value["weekly"], isValid),
    ...("holidays" in value && value["holidays"] !== undefined
      ? listParts("holidays", zone, value["holidays"], isValid)
      : []),
    ...("overrides" in value && value["overrides"] !== undefined
      ? listParts("overrides", zone, value["overrides"], isValid)
      : []),
  ];
  return parts.length === 0
    ? { kind: "refused-together" }
    : { kind: "parts-refused", parts };
}
