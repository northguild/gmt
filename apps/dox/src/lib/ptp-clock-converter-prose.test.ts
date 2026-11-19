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
import { READ_PRESETS, WRITE_PRESETS } from "./ptp-clock-presets";
import {
  matchReadPreset,
  readArgs,
  type PtpClockArgs,
} from "./ptp-clock-converter";
import { decodeWidgetPermalink } from "./widget-permalink";
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

const guide = readFileSync(
  join(__dirname, "../content/docs/guides/industries/iot-ptp-time.mdx"),
  "utf8",
);

describe("the leap-second sentences", () => {
  const leap = { seconds: 1483228836n, nanoseconds: 0 };

  it("hold to the library at both offsets", () => {
    expect(ptpToUtc(leap, 36)).toBe("2017-01-01T00:00:00Z");
    expect(taiMinusUtc("2017-01-01T00:00:00Z")).toBe(37);
    expect(ptpToUtc(leap, 37)).toBe("2016-12-31T23:59:59Z");
    expect(taiMinusUtc("2016-12-31T23:59:59Z")).toBe(36);
    expect(page).toContain(
      "Inside the second inserted at the end of 2016 it is out either way.",
    );
    expect(page).toContain(
      "The count 1483228836 read with 36 is 2017-01-01T00:00:00Z, where the table says 37, and read with 37 it is 2016-12-31T23:59:59Z, where the table says 36.",
    );
  });

  it("match the leap-2016 preset", () => {
    expect(READ_PRESETS.find((p) => p.id === "leap-2016")).toMatchObject({
      seconds: "1483228836",
      nanoseconds: "0",
      offset: "36",
    });
  });
});

describe("the preset permalinks", () => {
  const pattern =
    /\?w=ptpclock&wa=%7B%22(preset|writePreset)%22%3A%22([\w-]+)%22/g;
  const ids = (text: string) => [...text.matchAll(pattern)];

  it("name presets that exist in the widget each link opens", () => {
    for (const text of [page, guide]) {
      for (const [, key, id] of ids(text)) {
        const list = key === "preset" ? READ_PRESETS : WRITE_PRESETS;
        expect(list.map((p) => p.id)).toContain(id);
      }
    }
    expect(ids(page).map((m) => m[2])).toContain("leap-2016");
    expect(ids(guide).map((m) => m[2])).toContain("leap-2016");
  });

  it("opens the same count at 37 as typed text", () => {
    const href = page.match(
      /\(([^)]*%22seconds%22%3A%221483228836%22[^)]*)\)/,
    )![1]!;
    const decoded = decodeWidgetPermalink(href.slice(href.indexOf("?")));
    expect(decoded?.kind).toBe("ptpclock");
    const state = readArgs(decoded!.args as PtpClockArgs);
    expect(state).toMatchObject({
      seconds: "1483228836",
      nanoseconds: "0",
      offset: "37",
    });
    expect(matchReadPreset(state)).toBe("custom");
  });
});

describe("the PTP now sentences", () => {
  it("hold to the table", () => {
    expect(taiMinusUtc("2016-12-31T23:59:59Z")).toBe(36);
    expect(taiMinusUtc("2017-01-01T00:00:00Z")).toBe(37);
    expect(page).toContain("37 since 2017");
    expect(taiMinusUtc("1971-06-01T00:00:00Z")).toBeNull();
    expect(page).toContain("before 1972 shows NO SIGNAL");
    expect(page).toContain("utcToPtp(now, taiMinusUtc(now))");
  });

  it("pin the 37 s a device loses with an offset of 0", () => {
    const instant = "2024-01-01T00:00:00Z";
    const zero = utcToPtp(instant, 0);
    const table = utcToPtp(instant, 37);
    expect(zero).not.toBeNull();
    expect(table).not.toBeNull();
    expect(zero!.seconds + 37n).toBe(table!.seconds);
    expect(page).toContain("37 s behind a grandmaster on the PTP timescale");
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
