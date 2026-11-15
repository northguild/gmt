/**
 * The PTP Clock Converter's page makes claims in prose and in a code block. This guard reads the
 * page as text and holds each to a library call, so the prose cannot drift from the library.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ptpToUtc, utcToPtp } from "@northguild/gmt/iot/convert";
import { isValidPtpTimestamp } from "@northguild/gmt/iot/validate";
import { taiMinusUtc } from "@northguild/gmt/timescale/calculate";
import { CHAT_STARTERS } from "./chat-constants";
import { DOX_TOOL_DOCS } from "./dox-tools";

const page = readFileSync(
  join(__dirname, "../content/docs/tools/ptp-clock-converter.mdx"),
  "utf8",
);
const record = { seconds: 1704067237n, nanoseconds: 0 };

describe("the 37 s sentences", () => {
  it("hold to the table at the announced reading", () => {
    const utc = ptpToUtc(record, 37);
    expect(utc).toBe("2024-01-01T00:00:00Z");
    expect(taiMinusUtc(utc)).toBe(37);
    expect(page).toContain("reads 37 s later");
    expect(ptpToUtc(record, 0)).toBe("2024-01-01T00:00:37Z");
  });

  it("holds the 1 s stale offset", () => {
    expect(ptpToUtc(record, 36)).toBe("2024-01-01T00:00:01Z");
    expect(page).toContain("offset of 36 shows as 1 s apart");
  });
});

describe("the code block", () => {
  it("pastes what the library returns", () => {
    expect(page).toContain('ptpToUtc(record, 37); // "2024-01-01T00:00:00Z"');
    expect(
      isValidPtpTimestamp({ seconds: 281474976710656n, nanoseconds: 0 }),
    ).toBe(false);
    expect(utcToPtp("2024-01-01T02:00:00+02:00", 37)).toEqual(record);
    expect(utcToPtp("2016-12-31T23:59:60Z", 37)).toBeNull();
  });
});

describe("the chat starter", () => {
  it("is the page's own example", () => {
    const starter = CHAT_STARTERS.find(
      (c) => c.widget === "showPtpClockConverter",
    );
    expect(starter?.args).toEqual({
      seconds: "1704067237",
      nanoseconds: "0",
      offset: "37",
    });
    expect(DOX_TOOL_DOCS.some((d) => d.name === "showPtpClockConverter")).toBe(
      true,
    );
  });
});
