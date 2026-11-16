/**
 * Sentences the instrument, finance, EDI and health tools say and their pages never show: what a
 * call that gives a tool too little to read, or no instant to write, is told.
 */
import { describe, expect, it } from "vitest";
import { readArgs as readPtpArgs } from "../ptp-clock-converter";
import fix, { NEEDS_A_FIELD } from "./tools/fix-timestamp-reader";
import ptp, {
  NEEDS_ALL_THREE,
  offsetDefaultNote,
} from "./tools/ptp-clock-converter";
import {
  DROPPED_HINT,
  LOG_MAX_CHARS,
  LOG_MAX_LINES,
} from "../tai64n-log-reader";
import meter, {
  defaultValueNote as meterDefaultNote,
} from "./tools/double-precision-meter";
import counter, {
  defaultValueNote as counterDefaultNote,
} from "./tools/julian-day-counter";
import tai, {
  LINE_CUT_NOTE,
  noLabelNote,
  NO_LABEL_WRITTEN,
} from "./tools/tai64n-log-reader";
import { readArgs as readMeterArgs } from "../double-precision-meter";
import { readArgs as readCounterArgs } from "../julian-day-counter";

describe("the notes a tool adds beyond its page", () => {
  it("asks for seconds, nanoseconds and offset together when the ptp call gives only some, beside an instant", async () => {
    const result = await ptp.execute(
      { seconds: "1704067237", offset: "37", instant: "2024-01-01T00:00:00Z" },
      {},
    );
    expect(result.ok && result.notes).toContain(NEEDS_ALL_THREE);
  });

  it("says which offset a ptp instant was written with when none was given", async () => {
    const result = await ptp.execute(
      { instant: "2024-01-01T02:00:00+02:00" },
      {},
    );
    expect(result.ok && result.notes).toContain(
      offsetDefaultNote(readPtpArgs({}).offset),
    );
  });

  it("names the tai64n line that starts with no label", async () => {
    const result = await tai.execute(
      { values: "@40000000659200a500000000 ok\nnothing to read here" },
      {},
    );
    expect(result.ok && result.notes).toContain(noLabelNote(2));
  });

  it("says when toTai64n writes no label for the instant", async () => {
    const result = await tai.execute(
      {
        values: "@40000000659200a500000000 ok",
        instant: "1960-01-01T00:00:00Z",
      },
      {},
    );
    expect(result.ok && result.notes).toContain(NO_LABEL_WRITTEN);
  });

  it("asks for a stamp or an instant when the fix call has neither", async () => {
    const result = await fix.execute({}, {});
    expect(result.ok && result.notes).toContain(NEEDS_A_FIELD);
  });

  it("names the lines past the cap, and a line cut by characters", async () => {
    const lines = Array.from(
      { length: LOG_MAX_LINES + 1 },
      () => "@40000000659200a500000000 ok",
    );
    lines[0] = `${lines[0]} ${"x".repeat(LOG_MAX_CHARS)}`;
    const result = await tai.execute({ values: lines.join("\n") }, {});
    expect(result.ok && result.notes).toContain(DROPPED_HINT);
    expect(result.ok && result.notes).toContain(LINE_CUT_NOTE);
    const short = await tai.execute({ values: lines[1] }, {});
    expect(short.ok && short.notes).not.toContain(LINE_CUT_NOTE);
  });

  it("names the instant the meter measured when no value was given, and reports what it used", async () => {
    const state = readMeterArgs({});
    const result = await meter.execute({}, {});
    expect(result.ok && result.notes).toContain(meterDefaultNote(state.value));
    expect(result.ok && result.input).toMatchObject({
      value: state.value,
      scale: state.scale,
    });
    const given = await meter.execute({ value: "2024-06-15T12:00:00Z" }, {});
    expect(given.ok && given.notes).not.toContain(
      meterDefaultNote(state.value),
    );
  });

  it("names the instant the counter converted when no value was given, and reports what it used", async () => {
    const state = readCounterArgs({});
    const result = await counter.execute({}, {});
    expect(result.ok && result.notes).toContain(
      counterDefaultNote(state.value),
    );
    expect(result.ok && result.input).toMatchObject({
      value: state.value,
      read: state.read,
      scale: state.scale,
    });
    const given = await counter.execute({ value: "2024-06-15T12:00:00Z" }, {});
    expect(given.ok && given.notes).not.toContain(
      counterDefaultNote(state.value),
    );
  });
});
