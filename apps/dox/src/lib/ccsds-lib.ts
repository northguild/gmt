/**
 * Loads the real gmt functions the CCSDS tools call, at module granularity, and hands them
 * back as a `CcsdsLib`.
 *
 * The readers live in `timescale/parse`, the writers in `timescale/format` and the locale
 * month names in `plain/locale`. Each name is picked from its module and nothing else is read.
 *
 * A heavy module: only a tool's mount imports it. A module that fails to load, or a name it
 * no longer exports, becomes a `WidgetLoadError` rather than a dead control.
 */
import type { CcsdsLib } from "./ccsds-widgets";
import { GMT_MODULES } from "./gmt-modules";
import { pickFunctions } from "./gmt-pick";
import { WidgetLoadError } from "./widget-mount";

export async function loadCcsdsLib(): Promise<CcsdsLib> {
  try {
    const [parse, format, locale] = await Promise.all([
      GMT_MODULES["timescale/parse"](),
      GMT_MODULES["timescale/format"](),
      GMT_MODULES["plain/locale"](),
    ]);
    return {
      ...pickFunctions(parse, ["parseCcsdsAsciiA", "parseCcsdsAsciiB"]),
      ...pickFunctions(format, ["formatCcsdsAsciiA", "formatCcsdsAsciiB"]),
      ...pickFunctions(locale, ["getLocaleMonthNames"]),
    } as unknown as CcsdsLib;
  } catch (cause) {
    throw new WidgetLoadError(cause);
  }
}
