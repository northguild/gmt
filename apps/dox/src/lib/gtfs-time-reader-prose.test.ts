/**
 * The GTFS Time Reader's page makes claims in prose and in a code block. This guard reads the
 * page as text and holds each to a library call, so the prose cannot drift from the library.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatGtfsTime } from "@northguild/gmt/rail/format";
import { parseGtfsTime } from "@northguild/gmt/rail/parse";
import { isValidGtfsTime } from "@northguild/gmt/rail/validate";
import { isValidTime } from "@northguild/gmt/plain/validate";
import { DOX_TOOL_DOCS } from "./dox-tools";
import { CHAT_STARTERS } from "./chat-constants";
import {
  CLOCK_NOTE_LEAD,
  READ_PRESETS,
  WRITE_PRESETS,
} from "./gtfs-time-reader";

const page = readFileSync(
  join(__dirname, "../content/docs/tools/gtfs-time-reader.mdx"),
  "utf8",
);

describe("the keypoint", () => {
  it("states what the library gives for 25:35:00", () => {
    expect(parseGtfsTime("25:35:00")).toEqual({
      seconds: 5700,
      dayOverflow: 1,
    });
    expect(isValidTime("25:35:00")).toBe(false);
    expect(page).toContain("`25:35:00` is not an error");
  });

  it("names no date and never says since midnight", () => {
    expect(page).not.toMatch(/since midnight/i);
    expect(page).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
  });

  it("names gtfsToInstant in code font with no link", () => {
    expect(page).toContain("`gtfsToInstant`");
    expect(page).not.toMatch(/\[`?gtfsToInstant`?\]/);
    expect(CLOCK_NOTE_LEAD).not.toMatch(/since midnight/i);
  });
});

describe("no relative day is named for a GTFS time", () => {
  const banned = /next (calendar )?day|following (day|date)|tomorrow/i;
  const doc = DOX_TOOL_DOCS.find((d) => d.name === "showGtfsTimeReader");
  const starters = CHAT_STARTERS.filter(
    (c) => c.widget === "showGtfsTimeReader",
  ).map((c) => c.text);

  it("holds on the tool page", () => {
    expect(page).not.toMatch(banned);
  });

  it("holds on the chat tool text", () => {
    expect(doc).toBeDefined();
    expect(`${doc?.purpose} ${doc?.when} ${doc?.args}`).not.toMatch(banned);
  });

  it("holds on the starter", () => {
    expect(starters.length).toBeGreaterThan(0);
    for (const t of starters) expect(t).not.toMatch(banned);
  });

  it.each([
    "../content/docs/scenarios/a-gtfs-time-folded-into-one-day.mdx",
    "../content/docs/mistakes/rail.mdx",
  ])("holds on %s", (rel) => {
    expect(readFileSync(join(__dirname, rel), "utf8")).not.toMatch(banned);
  });
});

describe("the code block", () => {
  const block = /```ts\n([\s\S]*?)```/.exec(page)?.[1] ?? "";
  const calls = [...block.matchAll(/^(\w+)\((.*?)\); \/\/ (.*)$/gm)];
  const fns: Record<string, (...a: never[]) => unknown> = {
    parseGtfsTime,
    formatGtfsTime,
    isValidGtfsTime,
    isValidTime,
  } as never;

  it("holds seven calls", () => {
    expect(calls).toHaveLength(7);
  });

  it.each([0, 1, 2, 3, 4, 5, 6])(
    "call %i returns what the comment says",
    (i) => {
      const [, fn, args, expected] = calls[i]!;
      // The comment is a JavaScript literal; compare as parsed values.
      const result = (fns[fn!]! as (...a: unknown[]) => unknown)(
        ...(new Function(`return [${args}]`)() as unknown[]),
      );
      const want = new Function(`return (${expected})`)() as unknown;
      expect(result).toEqual(want);
    },
  );
});

describe("the permalinks", () => {
  it("name presets that exist", () => {
    const ids = [...page.matchAll(/%22preset%22%3A%22([\w-]+)%22/g)].map(
      (m) => m[1],
    );
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(READ_PRESETS.map((p) => p.id)).toContain(id);
    }
    expect(WRITE_PRESETS.length).toBeGreaterThan(0);
  });
});
