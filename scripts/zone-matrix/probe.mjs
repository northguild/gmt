/**
 * Loaded into every test process with `NODE_OPTIONS=--import`. It writes one JSON line per process
 * to the file named in `ZONE_PROBE_FILE`: `{ "start": <zone when the process started>, "end":
 * <zone when it exited> }`. The runner reads a process whose zone changed while it ran (test code
 * or runner config setting `process.env.TZ`) as an override. A process that a test starts with its
 * own `TZ`, as a fixture, starts and ends in that zone, so it is not one. Worker processes inherit
 * the option and write their own line.
 */
import { appendFileSync } from "node:fs";

const file = process.env.ZONE_PROBE_FILE;
if (file) {
  const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
  const start = zone();
  process.on("exit", () => {
    try {
      appendFileSync(file, `${JSON.stringify({ start, end: zone() })}\n`);
    } catch {
      // The probe never fails a run.
    }
  });
}
