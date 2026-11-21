/**
 * The clock pins the stage lights on the Earth: which zones carry one, and the label each shows
 * (the city and its local time, read again every `CLOCK_REFRESH_MS`). The times come from gmt
 * (`ZonedNow`), imported after first paint; until it is in a pin carries its city alone.
 */
import { clockLabel, type ZonedNow } from "./clocks";

/** How often the clock pins' labels are read again, milliseconds. */
const CLOCK_REFRESH_MS = 20000;

interface ClockPinsDeps {
  host: HTMLElement | null;
  win: Window | null;
  zonedNow(): ZonedNow | null;
  /** Whether a lapse is playing: the pins then hold still and their labels are not read. */
  lapsePlaying(): boolean;
  draw(): void;
}

export interface ClockPins {
  /** Zones that carry a clock pin. */
  readonly on: ReadonlySet<string>;
  /** The label a zone's pin shows, once read. */
  label(zone: string): string | undefined;
  /** A zone's wall time as minutes since its midnight, read by gmt; `null` until gmt is in. */
  wallMinutes(zone: string): number | null;
  light(zone: string): void;
  clear(): void;
  /** Reads every lit clock's local time again, and draws when a label changed. */
  refresh(): void;
}

export function createClockPins(d: ClockPinsDeps): ClockPins {
  const on = new Set<string>();
  const labels = new Map<string, string>();
  let timer = 0;

  /** Publishes how many clock pins are lit, for the deck's gate. */
  const publish = (): void => {
    if (d.host) d.host.dataset["clocks"] = String(on.size);
  };

  function refresh(): void {
    const zonedNow = d.zonedNow();
    if (!zonedNow || d.lapsePlaying()) return;
    let changed = false;
    for (const zone of on) {
      const label = clockLabel(zone, zonedNow);
      if (labels.get(zone) !== label) {
        labels.set(zone, label);
        changed = true;
      }
    }
    if (changed) d.draw();
  }

  return {
    on,
    label: (zone) => labels.get(zone),
    wallMinutes(zone) {
      const zonedNow = d.zonedNow();
      const m = zonedNow ? /T(\d{2}):(\d{2})/.exec(zonedNow(zone)) : null;
      return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    },
    light(zone) {
      if (on.has(zone)) return;
      on.add(zone);
      publish();
      if (!timer && d.win) timer = d.win.setInterval(refresh, CLOCK_REFRESH_MS);
      refresh();
      d.draw();
    },
    clear() {
      on.clear();
      publish();
      labels.clear();
      if (timer) d.win?.clearInterval(timer);
      timer = 0;
    },
    refresh,
  };
}
