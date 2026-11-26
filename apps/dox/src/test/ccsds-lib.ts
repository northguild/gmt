/**
 * The real gmt functions the CCSDS widgets' unit tests inject as a `CcsdsLib`, loaded by
 * module path so a test never needs the mount's dynamic imports.
 */
import { getLocaleMonthNames } from "@northguild/gmt/plain/locale";
import {
  formatCcsdsAsciiA,
  formatCcsdsAsciiB,
} from "@northguild/gmt/timescale/format";
import {
  parseCcsdsAsciiA,
  parseCcsdsAsciiB,
} from "@northguild/gmt/timescale/parse";
import type { CcsdsLib } from "~/lib/ccsds-widgets";

export const lib = {
  parseCcsdsAsciiA,
  parseCcsdsAsciiB,
  formatCcsdsAsciiA,
  formatCcsdsAsciiB,
  getLocaleMonthNames,
} as unknown as CcsdsLib;
