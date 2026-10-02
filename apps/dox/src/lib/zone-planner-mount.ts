/**
 * The Zone Planner as a mountable widget, for the `/dox` chat rail.
 *
 * Like the globe, the planner builds its own chrome (`initScrubber` fills a
 * host element), so the template here is only the host it fills. The page at
 * `/tools/zone-planner/` mounts the same `initScrubber` through
 * `MultiZoneScrubber.astro`, so both surfaces run one implementation.
 *
 * Nothing here imports the planner statically: the scrubber carries the
 * coordinate table and the Temporal polyfill, which stay out of the chat's first
 * download until a planner is actually opened.
 */
import { permalinkOf, seededZones, type ZonePlannerArgs } from "./zone-planner";
import { WIDGET_PAGE_PATHS } from "./widget-permalink";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";

export type { ZonePlannerArgs } from "./zone-planner";

export interface ZonePlannerTemplateOptions {
  /** Namespaces the host's id, so a planner in the rail cannot collide with the
   *  one on the page behind it. */
  idPrefix?: string;
}

/** The host `initScrubber` fills. The scrubber's own markup follows at mount. */
export function renderZonePlannerTemplate({
  idPrefix = "planner",
}: ZonePlannerTemplateOptions = {}): string {
  return (
    `<div class="gmt-scrubber-block">` +
    `<div id="${idPrefix}-host" data-role="planner-host"></div>` +
    `</div>`
  );
}

export const mountZonePlanner: MountFn<ZonePlannerArgs> = async (
  root,
  args,
  signal,
) => {
  const host = root.querySelector<HTMLElement>('[data-role="planner-host"]');
  if (!host) return onceDestroy(() => {});

  let initScrubber: typeof import("./multi-zone-scrubber").initScrubber;
  try {
    ({ initScrubber } = await import("./multi-zone-scrubber"));
  } catch (error) {
    throw new WidgetLoadError(error);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const scrubber = await initScrubber(host, {
    pinned: seededZones(args),
    ...(args.time === undefined ? {} : { time: args.time }),
    // The rail is `/dox`: a `?tz=` there would rewrite a URL no route reads, and
    // the share link has to name the planner's own page.
    syncUrl: false,
    sharePath: WIDGET_PAGE_PATHS.planner,
  });
  if (signal.aborted) {
    scrubber.destroy();
    return onceDestroy(() => {});
  }

  return onceDestroy(
    () => scrubber.destroy(),
    () => {
      const { pinned, time } = scrubber.getState();
      return pinned.length === 0 ? null : permalinkOf(pinned, time);
    },
  );
};
