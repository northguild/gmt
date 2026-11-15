/**
 * The wiring of `/pulse/`. The server renders every card; this wires each card's workaround
 * list (a disclosure) at once, then fills three reserved slots after first paint and changes
 * nothing else: each card's "Next run", the "read … ago" line, and a strip whose run history has
 * grown too old (it switches to NO SIGNAL).
 *
 * Time is gmt's, loaded from subpaths after first paint, with a `deps.now` seam for tests. There
 * is no timer and no polling: the slots are recomputed when the tab becomes visible again.
 * Aborting the signal removes that listener.
 */
import { wireDisclosure } from "~/widgets/builders/disclosure";
import { INERT_HANDLE, type WidgetHandle } from "./widget-mount";

/** A read older than this many days is too old to call "recent" (`pulse-view.ts`). */
const STALE_AFTER_DAYS = 8;

/** The gmt functions the mount uses, so a test supplies its own. */
export interface PulseLib {
  getUtcNow(): string;
  parseCronExpression(cron: string): unknown;
  cronRuns(
    expr: never,
    zone: string,
    range: { after: string; count: number },
    mode: "crontabMatch",
  ): readonly { instant: string }[];
  formatRelativeUtc(
    value: string,
    locale: string,
    options: { reference: string },
  ): string;
  diffUtc(from: string, to: string, unit: "days"): number;
}

export interface PulseDeps {
  /** The current instant. Defaults to gmt's `getUtcNow`. */
  now: () => string;
  /** The gmt functions. Defaults to the subpath imports. */
  lib: () => Promise<PulseLib>;
}

async function loadLib(): Promise<PulseLib> {
  const [get, parse, calc, format, utcCalc] = await Promise.all([
    import("@northguild/gmt/utc/get"),
    import("@northguild/gmt/recurrence/parse"),
    import("@northguild/gmt/recurrence/calculate"),
    import("@northguild/gmt/utc/format"),
    import("@northguild/gmt/utc/calculate"),
  ]);
  return {
    getUtcNow: get.getUtcNow,
    parseCronExpression: parse.parseCronExpression,
    cronRuns: calc.cronRuns as PulseLib["cronRuns"],
    formatRelativeUtc: format.formatRelativeUtc,
    diffUtc: utcCalc.diffUtc as PulseLib["diffUtc"],
  };
}

export function mountPulse(
  root: HTMLElement,
  signal: AbortSignal,
  deps: Partial<PulseDeps> = {},
): Promise<WidgetHandle> {
  if (signal.aborted) return Promise.resolve(INERT_HANDLE);
  const own = new AbortController();
  signal.addEventListener("abort", () => own.abort(), { once: true });
  const life = own.signal;
  const doc = root.ownerDocument;
  // The workaround lists open without gmt, so they work before (and if) it loads.
  for (const el of root.querySelectorAll<HTMLElement>("[data-disclosure]"))
    wireDisclosure(el, { signal: life });

  return (deps.lib ?? loadLib)().then((lib) => {
    if (life.aborted) return INERT_HANDLE;
    const now = (): string => deps.now?.() ?? lib.getUtcNow();

    const fill = (): void => {
      if (life.aborted) return;
      const at = now();
      for (const el of root.querySelectorAll<HTMLElement>(
        "[data-pulse-next]",
      )) {
        const cron = el.getAttribute("data-pulse-next") ?? "";
        const expr = lib.parseCronExpression(cron);
        if (expr === null) continue;
        const next = lib.cronRuns(
          expr as never,
          "UTC",
          { after: at, count: 1 },
          "crontabMatch",
        )[0];
        if (next === undefined) continue;
        el.textContent = lib.formatRelativeUtc(next.instant, "en", {
          reference: at,
        });
        el.closest("[data-pulse-card]")?.setAttribute("data-pulse-ready", "");
      }
      for (const el of root.querySelectorAll<HTMLElement>(
        "[data-pulse-read]",
      )) {
        const read = el.getAttribute("data-pulse-read") ?? "";
        const out = el.querySelector<HTMLElement>("[data-pulse-read-ago]");
        if (out !== null)
          out.textContent = lib.formatRelativeUtc(read, "en", {
            reference: at,
          });
      }
      for (const strip of root.querySelectorAll<HTMLElement>(
        "[data-pulse-strip-read]",
      )) {
        const read = strip.getAttribute("data-pulse-strip-read") ?? "";
        const days = Math.floor(lib.diffUtc(read, at, "days"));
        if (days <= STALE_AFTER_DAYS) continue;
        strip.setAttribute("data-signal", "lost");
        const text = strip.querySelector<HTMLElement>(
          "[data-pulse-signal-text]",
        );
        if (text !== null) text.textContent = `Run history is ${days} days old`;
        strip
          .querySelector<HTMLElement>("[data-pulse-signal]")
          ?.removeAttribute("hidden");
        strip
          .querySelector<HTMLElement>("[data-pulse-beats]")
          ?.setAttribute("hidden", "");
      }
    };

    const onVisible = (): void => {
      if (doc.visibilityState === "visible") fill();
    };
    fill();
    doc.addEventListener("visibilitychange", onVisible, { signal: life });

    return {
      destroy: () => own.abort(),
      getPermalinkState: () => null,
    };
  });
}
