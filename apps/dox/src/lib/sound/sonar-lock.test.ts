import { lockPulses } from "./sonar-lock";

describe("the Sonar lock's pulses", () => {
  it("are its two pings, then every echo heard, each a repeat of the echo's delay quieter", () => {
    const pulses = lockPulses().map(({ atMs, db }) => ({
      atMs,
      db: Math.round(db * 10) / 10,
    }));
    // An echo keeps 38% of the last each pass: −12.8, −21.2, −29.6 dB, and −38.0 dB is lost.
    expect(pulses).toEqual([
      { atMs: 0, db: 0 },
      { atMs: 70, db: 0 },
      { atMs: 190, db: -12.8 },
      { atMs: 380, db: -21.2 },
      { atMs: 570, db: -29.6 },
    ]);
  });
});
