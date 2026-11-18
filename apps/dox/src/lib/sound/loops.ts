/**
 * Loops that fade: a loop's own `start(c, bus)` runs on a bus gain of its own, which swells in
 * over `fadeIn` and dims over `fadeOut` before the voice's stop function runs, so neither edge
 * clicks. The loop body is ported from the audition unchanged; only this wrapper is new.
 *
 * Every time is on the audio clock. The voice's own stop (the thinking loop's ends its scheduler,
 * which has queued pings up to 0.6 s ahead) is called at once: the bus is silent after `fadeOut`,
 * well before a queued ping would sound, so nothing waits on a timer.
 */
import type { Loop } from "./voices";

export function fadedLoop(start: Loop, fadeIn: number, fadeOut: number): Loop {
  return (c, out) => {
    const bus = c.createGain();
    const now = c.currentTime;
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(1, now + fadeIn);
    bus.connect(out);
    const stop = start(c, bus);
    return () => {
      const at = c.currentTime;
      bus.gain.cancelScheduledValues(at);
      bus.gain.setValueAtTime(bus.gain.value, at);
      bus.gain.linearRampToValueAtTime(0, at + fadeOut);
      stop();
    };
  };
}
