/**
 * A small body's absolute magnitude H and slope G from JPL's Small-Body Database
 * (`https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=<name>&phys-par=1`). The Minor Planet Center's
 * bright file carries the default G 0.15 on every row, so the generator (`prepare-sky-orbits.ts`)
 * takes the fitted pair from here. Pure parser plus one fetch; the parser's test needs no network.
 */

interface Photometry {
  H: number;
  G: number;
}

/** The query, `<name>` standing for a body's name or number. */
export const SBDB_QUERY =
  "https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=<name>&phys-par=1";

export const sbdbUrl = (sstr: string): string =>
  SBDB_QUERY.replace("<name>", encodeURIComponent(sstr));

/** H and G out of an SBDB reply; null when either is missing (a body with no fitted G is not guessed). */
export function parsePhotometry(reply: unknown): Photometry | null {
  const rows =
    (reply as { phys_par?: { name: string; value: string }[] }).phys_par ?? [];
  const read = (name: string) =>
    Number(rows.find((row) => row.name === name)?.value);
  const [H, G] = [read("H"), read("G")];
  return Number.isFinite(H) && Number.isFinite(G) ? { H, G } : null;
}

/** The orbit solution behind a reply: its id, epoch (a Julian date), date, observation count and the producer. */
interface Solution {
  id: string;
  epoch: number;
  date: string;
  observations: number;
  producer: string;
}

/** The orbit solution of an SBDB reply; null when the reply has none. */
export function parseSolution(reply: unknown): Solution | null {
  const o = (reply as { orbit?: Record<string, unknown> }).orbit;
  if (!o || typeof o.orbit_id !== "string") return null;
  return {
    id: o.orbit_id,
    epoch: Number(o.epoch),
    date: String(o.soln_date),
    observations: Number(o.n_obs_used),
    producer: String(o.producer),
  };
}

/** The fitted H and G of a body, or a thrown error naming the body. */
export async function fetchPhotometry(sstr: string): Promise<Photometry> {
  const res = await fetch(sbdbUrl(sstr));
  if (!res.ok) throw new Error(`JPL SBDB ${sstr}: HTTP ${res.status}`);
  const found = parsePhotometry(await res.json());
  if (!found) throw new Error(`JPL SBDB has no fitted H and G for ${sstr}`);
  return found;
}
