/**
 * The Zone Planner as a mountable widget, for the `/dox` chat rail and the tool's own page.
 *
 * The chrome is the kit's (`renderScrubberTemplate`), so the page server-renders the same
 * markup the rail draws. The wiring is `initScrubber`, which loads on demand: it carries the
 * coordinate table and the Temporal polyfill, which stay out of the first download until a
 * planner is actually opened.
 */
import type { SafeHtml } from "~/widgets/builders";
import { renderScrubberTemplate } from "~/widgets/families/zones/zone-planner-template";
import { permalinkOf, seededZones, type ZonePlannerArgs } from "./zone-planner";
import { WIDGET_PAGE_PATHS } from "./widget-permalink";
import { onceDestroy, WidgetLoadError, type MountFn } from "./widget-mount";
import { withBase } from "./site";

export type { ZonePlannerArgs } from "./zone-planner";

interface ZonePlannerTemplateOptions {
  /** Namespaces the widget's ids, so a planner in the rail cannot collide with the
   *  one on the page behind it. */
  idPrefix?: string;
}

/** The planner's markup. The tiles and every value follow at mount. */
export function renderZonePlannerTemplate({
  idPrefix = "planner",
}: ZonePlannerTemplateOptions = {}): SafeHtml {
  return renderScrubberTemplate(idPrefix);
}

export const mountZonePlanner: MountFn<ZonePlannerArgs> = async (
  root,
  args,
  signal,
) => {
  let initScrubber: typeof import("./multi-zone-scrubber").initScrubber;
  try {
    ({ initScrubber } = await import("./multi-zone-scrubber"));
  } catch (error) {
    throw new WidgetLoadError(error);
  }
  if (signal.aborted) return onceDestroy(() => {});

  const scrubber = await initScrubber(root, {
    pinned: seededZones(args),
    ...(args.time === undefined ? {} : { time: args.time }),
    // The rail is `/dox`: a `?tz=` there would rewrite a URL no route reads, and
    // the share link has to name the planner's own page.
    syncUrl: false,
    sharePath: withBase(WIDGET_PAGE_PATHS.planner),
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
