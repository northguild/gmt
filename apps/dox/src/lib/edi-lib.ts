/**
 * Loads the real gmt functions the two EDI timestamp widgets need, at module
 * granularity, and hands them back as an `EdiLib` (`edi-widgets.ts`).
 *
 * `parseEdifactDtm`, `parseX12DateTime`, `parseX12DateTimePeriod` and `x12TimeCode` live in
 * `intermodal/parse`; the two formatters in `intermodal/format`; the validators
 * in `intermodal/validate`; `resolveLocal`, `classifyLocal`, `toOffsetInstant`
 * and `fromOffsetInstant` in `instant/convert`; `isValidTimeZone` in
 * `zoned/validate`; `minUtc`, `maxUtc` and `diffUtcAsDuration` in
 * `utc/calculate`. Nothing else is loaded.
 *
 * A heavy module: it is never imported statically from the chat island. Only
 * each widget's mount reaches it, inside its own `try`, so a failed import
 * becomes a `WidgetLoadError` rather than a dead control.
 */
import type { EdiLib } from "./edi-widgets";
import { GMT_MODULES } from "./gmt-modules";

export async function loadEdiLib(): Promise<EdiLib> {
  const [parse, format, validate, convert, zonedValidate, utcCalculate] =
    await Promise.all([
      GMT_MODULES["intermodal/parse"](),
      GMT_MODULES["intermodal/format"](),
      GMT_MODULES["intermodal/validate"](),
      GMT_MODULES["instant/convert"](),
      GMT_MODULES["zoned/validate"](),
      GMT_MODULES["utc/calculate"](),
    ]);
  return {
    parseEdifactDtm: parse["parseEdifactDtm"] as EdiLib["parseEdifactDtm"],
    parseX12DateTime: parse["parseX12DateTime"] as EdiLib["parseX12DateTime"],
    x12TimeCode: parse["x12TimeCode"] as EdiLib["x12TimeCode"],
    formatEdifactDtm: format["formatEdifactDtm"] as EdiLib["formatEdifactDtm"],
    parseX12DateTimePeriod: parse[
      "parseX12DateTimePeriod"
    ] as EdiLib["parseX12DateTimePeriod"],
    formatX12DateTimePeriod: format[
      "formatX12DateTimePeriod"
    ] as EdiLib["formatX12DateTimePeriod"],
    isValidEdifactDtm:
      validate["isValidEdifactDtm"] as EdiLib["isValidEdifactDtm"],
    isValidEdifactDtmFormat: validate[
      "isValidEdifactDtmFormat"
    ] as EdiLib["isValidEdifactDtmFormat"],
    isValidX12DateTimePeriod: validate[
      "isValidX12DateTimePeriod"
    ] as EdiLib["isValidX12DateTimePeriod"],
    isValidX12DateTimePeriodFormat: validate[
      "isValidX12DateTimePeriodFormat"
    ] as EdiLib["isValidX12DateTimePeriodFormat"],
    resolveLocal: convert["resolveLocal"] as EdiLib["resolveLocal"],
    classifyLocal: convert["classifyLocal"] as EdiLib["classifyLocal"],
    toOffsetInstant: convert["toOffsetInstant"] as EdiLib["toOffsetInstant"],
    fromOffsetInstant:
      convert["fromOffsetInstant"] as EdiLib["fromOffsetInstant"],
    isValidTimeZone:
      zonedValidate["isValidTimeZone"] as EdiLib["isValidTimeZone"],
    minUtc: utcCalculate["minUtc"] as EdiLib["minUtc"],
    maxUtc: utcCalculate["maxUtc"] as EdiLib["maxUtc"],
    diffUtcAsDuration:
      utcCalculate["diffUtcAsDuration"] as EdiLib["diffUtcAsDuration"],
  };
}
