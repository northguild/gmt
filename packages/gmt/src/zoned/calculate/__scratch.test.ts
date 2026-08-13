import { Temporal } from "@js-temporal/polyfill";
import { writeFileSync } from "node:fs";
import { endOfZoned } from "./endOfZoned";
import { startOfZoned } from "./startOfZoned";

describe("scratch", () => {
  it("prints actual outputs", () => {
    const out: string[] = [];
    const inputs = [
      ["2024-02-29T12:34:56+00:00[UTC]", "year"],
      ["2024-02-29T12:34:56+00:00[UTC]", "month"],
      ["2024-02-29T12:34:56+00:00[UTC]", "week"],
      ["2024-02-29T12:34:56+00:00[UTC]", "day"],
      ["2024-02-29T12:34:56+00:00[UTC]", "hour"],
      ["2024-02-29T12:34:56+00:00[UTC]", "minute"],
      ["2024-02-29T12:34:56+00:00[UTC]", "second"],
      ["2024-02-29T12:34:56.123+00:00[UTC]", "millisecond"],
      ["2024-02-29T12:34:56.123456+00:00[UTC]", "microsecond"],
      ["2024-02-29T12:34:56.123456789+00:00[UTC]", "nanosecond"],
    ] as const;
    for (const [v, u] of inputs) {
      out.push("EOD " + u + " => " + JSON.stringify(endOfZoned(v, u)));
    }
    for (const [v, u] of inputs) {
      out.push("SOD " + u + " => " + JSON.stringify(startOfZoned(v, u)));
    }
    const z = Temporal.ZonedDateTime.from("2024-02-29T12:34:56.123+00:00[UTC]");
    const w = z.with({ microsecond: 999, nanosecond: 999 });
    out.push("temporal raw .123 with 999,999 => " + w.toString());
    out.push("temporal prec3 => " + w.toString({ fractionalSecondDigits: 3 }));
    out.push("temporal prec6 => " + w.toString({ fractionalSecondDigits: 6 }));
    out.push("temporal prec9 => " + w.toString({ fractionalSecondDigits: 9 }));
    writeFileSync("/tmp/scratch_out.txt", out.join("\n") + "\n");
  });
});
