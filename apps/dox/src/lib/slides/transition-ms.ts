/**
 * The first offset change of a zone in any of some local years, as gmt's instant and its epoch
 * milliseconds. The zone's jump pages (`zone-jump.ts`, read at build time) and a lapse centred on
 * a jump (`around` in `time-lapse.ts`, read after first paint) both find the jump here. The two gmt
 * functions come in as arguments, so this file imports none and each caller keeps its own way of
 * loading gmt.
 */

interface TransitionGmt {
  getDstTransitions(zone: string, year: number): readonly { instant: string }[];
  convertZonedToUnix(zoned: string): number | null;
}

export interface Transition {
  /** The change's instant, `YYYY-MM-DDTHH:MM:SSZ`. */
  instant: string;
  ms: number;
}

/** The zone's first offset change in any of `years`, or `null` for none. */
export function firstTransition(
  zone: string,
  years: readonly number[],
  gmt: TransitionGmt,
): Transition | null {
  for (const year of years) {
    const first = gmt.getDstTransitions(zone, year)[0];
    if (!first) continue;
    // A transition's instant ends in `Z`; the converter reads the offset form.
    const ms = gmt.convertZonedToUnix(
      first.instant.replace(/Z$/, "+00:00[UTC]"),
    );
    if (ms !== null) return { instant: first.instant, ms };
  }
  return null;
}
