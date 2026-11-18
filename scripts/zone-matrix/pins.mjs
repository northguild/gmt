/**
 * Finds where a suite's own scripts or CI pin the host zone.
 *
 * A pin in a script or CI file (`TZ=`, `cross-env TZ`, a YAML `TZ:` entry) is bypassed because the
 * runner sets the zone itself and calls the test binary directly. A pin in test code
 * (`process.env.TZ =`) is not bypassed; `probe.mjs` finds out at run time whether it won.
 */

const SCRIPT_PINS = [/\bTZ=/, /cross-env\s+TZ/, /^\s*TZ:\s/];
const CODE_PINS = [/process\.env\.TZ\s*=/, /process\.env\[["']TZ["']\]\s*=/];

/**
 * @param {{ file: string, text: string }[]} files
 * @returns {{ file: string, line: number, text: string, level: "script" | "code" }[]}
 */
export function scanPins(files) {
  const found = [];
  for (const { file, text } of files) {
    text.split("\n").forEach((line, i) => {
      const code = CODE_PINS.some((re) => re.test(line));
      const script = SCRIPT_PINS.some((re) => re.test(line));
      if (code || script) {
        found.push({
          file,
          line: i + 1,
          text: line.trim().slice(0, 200),
          level: code ? "code" : "script",
        });
      }
    });
  }
  return found;
}

/** The zone a pin line names, when it names one. */
export function zoneOfPin(text) {
  return (
    /\bTZ[=:]\s*["']?([A-Za-z]+(?:\/[A-Za-z_+\-0-9]+)*)/.exec(text)?.[1] ?? null
  );
}

/**
 * Two zone names are the same zone when ICU resolves them to the same canonical name.
 * @param {string} a
 * @param {string} b
 */
export function sameZone(a, b) {
  const canon = (z) => {
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: z }).resolvedOptions()
        .timeZone;
    } catch {
      return z;
    }
  };
  return canon(a) === canon(b);
}

/**
 * One line `probe.mjs` wrote: the zone a process started in and the zone it ended in.
 * @param {string} line
 * @returns {{ start: string, end: string }}
 */
export function parseProbeLine(line) {
  const p = JSON.parse(line);
  if (typeof p?.start !== "string" || typeof p?.end !== "string")
    throw new Error(`not a probe line: ${line}`);
  return p;
}

/**
 * Turns the probe lines of a run into the override record, or null when the requested zone held.
 *
 * A process overrides the zone when its zone changed while it ran: `process.env.TZ =` in test code,
 * a global setup or a runner's test-env setting. A process a test starts with an explicit `TZ`
 * starts in that zone and keeps it; it is a fixture, not an override. A run in which no process
 * started in the requested zone never ran there, and is an override too. A runner that starts its
 * workers with another `TZ` from a script or CI file is found by `scanPins`, not here.
 * @param {string} requested
 * @param {string[]} seen probe lines
 * @param {{ file: string, line: number }[]} codePins pins found by the scan, in test code
 */
export function overrideOf(requested, seen, codePins) {
  const runs = seen.map(parseProbeLine);
  if (!runs.length) return null;
  const changed = runs.find((r) => !sameZone(r.start, r.end));
  const zone =
    changed?.end ??
    (runs.some((r) => sameZone(r.start, requested)) ? null : runs[0].start);
  if (!zone) return null;
  const pin = codePins[0];
  return { file: pin?.file ?? null, line: pin?.line ?? null, zone };
}
