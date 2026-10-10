/**
 * Loads the real gmt functions the two EDI timestamp widgets need, at module
 * granularity, and hands them back as an `EdiLib` (`edi-widgets.ts`).
 *
 * The three classifiers, the per-kind parsers and `x12TimeCodeOffset` and
 * `x12TimeCodeZone` live in `intermodal/parse`; the per-kind formatters in
 * `intermodal/format`; `resolveLocal`, `classifyLocal`, `toOffsetInstant` and
 * `fromOffsetInstant` in `instant/convert`; `isValidTimeZone` in
 * `zoned/validate`; `minUtc`, `maxUtc` and `diffUtcAsDuration` in
 * `utc/calculate`. Nothing else is loaded.
 *
 * A heavy module: it is never imported statically from the chat island. Only
 * each widget's mount reaches it, inside its own `try`, so a failed import
 * becomes a `WidgetLoadError` rather than a dead control.
 */
import type { EdiLib } from "./edi-widgets";
import { GMT_MODULES } from "./gmt-modules";

const PARSE_NAMES = [
  "classifyEdifactDtmFormat",
  "parseEdifactDate",
  "parseEdifactTime",
  "parseEdifactDateTime",
  "parseEdifactOffsetDateTime",
  "parseEdifactDatePeriod",
  "parseEdifactDateTimePeriod",
  "classifyX12DateTimePeriodFormat",
  "parseX12Date",
  "parseX12Time",
  "parseX12DateTime",
  "parseX12DateRange",
  "parseX12DateTimeRange",
  "parseX12DateAndTime",
  "classifyX12TimeCode",
  "x12TimeCodeOffset",
  "x12TimeCodeZone",
] as const;

const FORMAT_NAMES = [
  "formatEdifactDate",
  "formatEdifactTime",
  "formatEdifactDateTime",
  "formatEdifactOffsetDateTime",
  "formatEdifactDatePeriod",
  "formatEdifactDateTimePeriod",
  "formatX12Date",
  "formatX12Time",
  "formatX12TimeElement",
  "formatX12DateTime",
  "formatX12DateRange",
  "formatX12DateTimeRange",
] as const;

const CONVERT_NAMES = [
  "resolveLocal",
  "classifyLocal",
  "toOffsetInstant",
  "fromOffsetInstant",
] as const;

const UTC_NAMES = ["minUtc", "maxUtc", "diffUtcAsDuration"] as const;

export async function loadEdiLib(): Promise<EdiLib> {
  const [parse, format, convert, zonedValidate, utcCalculate] =
    await Promise.all([
      GMT_MODULES["intermodal/parse"](),
      GMT_MODULES["intermodal/format"](),
      GMT_MODULES["instant/convert"](),
      GMT_MODULES["zoned/validate"](),
      GMT_MODULES["utc/calculate"](),
    ]);
  const pick = (module: Record<string, unknown>, names: readonly string[]) =>
    Object.fromEntries(names.map((name) => [name, module[name]]));
  return {
    ...pick(parse, PARSE_NAMES),
    ...pick(format, FORMAT_NAMES),
    ...pick(convert, CONVERT_NAMES),
    ...pick(utcCalculate, UTC_NAMES),
    isValidTimeZone: zonedValidate["isValidTimeZone"],
  } as unknown as EdiLib;
}
