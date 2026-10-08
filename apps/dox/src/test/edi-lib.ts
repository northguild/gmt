/**
 * The real gmt functions the EDI widgets' unit tests inject as an `EdiLib`,
 * loaded by module path so a test never needs the mount's dynamic imports.
 */
import {
  classifyLocal,
  fromOffsetInstant,
  resolveLocal,
  toOffsetInstant,
} from "@northguild/gmt/instant/convert";
import {
  formatEdifactDtm,
  formatX12DateTimePeriod,
} from "@northguild/gmt/intermodal/format";
import {
  parseEdifactDtm,
  parseX12DateTime,
  parseX12DateTimePeriod,
  x12TimeCode,
} from "@northguild/gmt/intermodal/parse";
import {
  isValidEdifactDtm,
  isValidEdifactDtmFormat,
  isValidX12DateTimePeriod,
  isValidX12DateTimePeriodFormat,
} from "@northguild/gmt/intermodal/validate";
import {
  diffUtcAsDuration,
  maxUtc,
  minUtc,
} from "@northguild/gmt/utc/calculate";
import { isValidTimeZone } from "@northguild/gmt/zoned/validate";
import type { EdiLib } from "~/lib/edi-widgets";

export const lib = {
  parseEdifactDtm,
  formatEdifactDtm,
  isValidEdifactDtm,
  isValidEdifactDtmFormat,
  parseX12DateTime,
  parseX12DateTimePeriod,
  formatX12DateTimePeriod,
  isValidX12DateTimePeriod,
  isValidX12DateTimePeriodFormat,
  x12TimeCode,
  resolveLocal,
  classifyLocal,
  toOffsetInstant,
  fromOffsetInstant,
  isValidTimeZone,
  minUtc,
  maxUtc,
  diffUtcAsDuration,
} as unknown as EdiLib;
