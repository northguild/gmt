/**
 * The current time in the `/dox` strip — in the reader's own zone, in the app's
 * chosen date format.
 *
 * Reads the format from `lib/date-display-store.ts`, so picking a format in the
 * reset clock's popover changes this too. The zone is deliberately NOT the
 * store's: this is the reader's local time, whatever zone they chose to view
 * resets in.
 *
 * "Now" is gmt's `getUtcNow()`, a UTC ISO string — the value type every preset
 * takes, so the clock renders it with exactly the call the popover shows.
 *
 * A relative preset cannot make a clock — the distance from now to now is
 * always "now" — so those fall back to the calendar preset here
 * (`liveClockFormat`), while the reset chip keeps its "in 4 hours".
 *
 * Renders nothing until mount, for the same reason every date in the chat does:
 * the server's zone and locale are not the reader's (#418).
 */
import { getSystemTimeZone, getUtcNow } from "@northguild/gmt";
import { useSelector } from "@tanstack/react-store";
import { useEffect, useState } from "react";
import { dateDisplayStore, hydrateDateDisplay } from "~/lib/date-display-store";
import { liveClockFormat } from "~/lib/reset-formats";

/** Seconds show in several presets (local date-time, UTC, HTTP, Unix). */
const TICK_MS = 1_000;

interface LocalClock {
  zone: string;
  locale: string;
  now: string;
}

export function HeaderClock() {
  const formatId = useSelector(dateDisplayStore, (state) => state.formatId);
  const [clock, setClock] = useState<LocalClock | null>(null);

  useEffect(() => {
    hydrateDateDisplay();

    const zone = getSystemTimeZone() || "UTC";
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const tick = () => setClock({ zone, locale, now: getUtcNow() });
    tick();

    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  if (!clock) return null;

  const preset = liveClockFormat(formatId);
  const text = preset.format(clock.now, {
    timeZone: clock.zone,
    locale: clock.locale,
    now: clock.now,
  });
  if (text === "") return null;

  return (
    <time
      className="gmt-hive-now"
      dateTime={clock.now}
      title={`${preset.fnName} · ${clock.zone}`}
    >
      {text}
    </time>
  );
}
