/**
 * The Sonar lock's shape, in one place for the sound (`voices.ts` `locate`, `kit.ts` `sonarEcho`)
 * and for the rings the globe ripples from a chosen pin (`globe-lock.ts`), so the reader sees one
 * ring for every ping and echo they hear, when they hear it.
 */

/** The sonar echo: its delay in seconds, the share of each repeat the next keeps, and its level out. */
export const SONAR_ECHO = { seconds: 0.19, feedback: 0.38, wet: 0.32 } as const;

/**
 * The Sonar ping a link press plays (`voices.ts` `click`): the ping itself and a quieter copy sent
 * to the echo, each dying away over its `release` in seconds. Shorter than the audition's 0.32 s
 * and 0.25 s at the owner's ask, so leaving a page by a link does not wait on a long tail.
 * `link-hold.ts` reads it to hold a link exactly as long as the ping and its first echo.
 */
export const SONAR_PING = {
  freq: 1180,
  peak: 0.12,
  echoPeak: 0.1,
  attack: 0.003,
  release: 0.18,
  echoRelease: 0.14,
} as const;

/** The lock's two pings, a fifth apart and `gap` seconds apart, each with a quieter send to the echo. */
export const LOCK_PINGS = {
  freqs: [880, 1320],
  gap: 0.07,
  peak: 0.07,
  echoPeak: 0.05,
} as const;

/** An echo more than this many dB under a ping is lost under it, and draws no ring. */
export const LOCK_HEARD_DB = 36;

/** One ping or echo of a lock. */
export interface LockPulse {
  /** When it sounds, in ms after the first ping. */
  atMs: number;
  /** How loud it is against a ping, in dB (0 for a ping, below 0 for an echo). */
  db: number;
}

/**
 * Every ping and every echo heard in one lock, in the order they sound. Each pass round the echo
 * keeps `feedback` of the last, so the echoes are counted from the sound's own numbers, not set.
 * The echo's gentle damping (a low-pass above both pings) is left out.
 */
export function lockPulses(): LockPulse[] {
  const pulses: LockPulse[] = LOCK_PINGS.freqs.map((_, i) => ({
    atMs: Math.round(i * LOCK_PINGS.gap * 1000),
    db: 0,
  }));
  const send = (LOCK_PINGS.echoPeak / LOCK_PINGS.peak) * SONAR_ECHO.wet;
  for (let pass = 1; ; pass++) {
    const db = 20 * Math.log10(send * SONAR_ECHO.feedback ** (pass - 1));
    if (db < -LOCK_HEARD_DB) return pulses;
    pulses.push({ atMs: Math.round(pass * SONAR_ECHO.seconds * 1000), db });
  }
}
