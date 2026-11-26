/**
 * The real gmt functions the IoT tests inject as an `IotLib`, loaded by module path so a test
 * never needs the loader's dynamic imports.
 */
import { ptpToUtc, utcToPtp } from "@northguild/gmt/iot/convert";
import { isValidPtpTimestamp } from "@northguild/gmt/iot/validate";
import { taiMinusUtc } from "@northguild/gmt/timescale/calculate";
import { getUtcNow } from "@northguild/gmt/utc/get";
import type { IotLib } from "~/lib/iot-lib";

export const iotLib = {
  ptpToUtc,
  utcToPtp,
  isValidPtpTimestamp,
  taiMinusUtc,
  getUtcNow,
} as unknown as IotLib;
