import {
  STORED_MAX_BYTES,
  STORED_MAX_LINES,
  capStoredInput,
  completeStoredLine,
} from "./clock-change-stored-lines";
import { DOX_TOOL_DOCS } from "./dox-tools";

describe("capStoredInput", () => {
  const lines = (n: number) =>
    Array.from({ length: n }, (_, i) => `l${i + 1}`).join("\n");

  // STORED_MAX_LINES lines whose text and LF breaks total 19,999 bytes, joined with `joiner`.
  const filled = (joiner: string) => {
    const breaks = STORED_MAX_LINES - 1;
    const total = STORED_MAX_BYTES - 1 - breaks;
    const each = Math.floor(total / STORED_MAX_LINES);
    const rows = Array.from({ length: STORED_MAX_LINES }, (_, i) =>
      "x".repeat(each + (i < total - each * STORED_MAX_LINES ? 1 : 0)),
    );
    return rows.join(joiner);
  };

  it("keeps the line cap and cuts the next line", () => {
    const at = capStoredInput(lines(STORED_MAX_LINES));
    expect(at.lines).toHaveLength(STORED_MAX_LINES);
    expect(at.truncated).toBe(false);
    const over = capStoredInput(lines(STORED_MAX_LINES + 1));
    expect(over.lines).toHaveLength(STORED_MAX_LINES);
    expect(over.lines.at(-1)).toEqual({
      line: STORED_MAX_LINES,
      text: `l${STORED_MAX_LINES}`,
    });
    expect(over.truncated).toBe(true);
  });

  it("keeps blank lines out but their numbers in, across line-break styles", () => {
    const { lines: kept, truncated } = capStoredInput("a\r\n\r\n  \nb\rc\n");
    expect(kept).toEqual([
      { line: 1, text: "a" },
      { line: 4, text: "b" },
      { line: 5, text: "c" },
    ]);
    expect(truncated).toBe(false);
  });

  it("reads exactly 20,000 bytes and cuts at 20,001", () => {
    const exact = filled("\n"); // 19,999 bytes
    expect(new TextEncoder().encode(exact).length).toBe(19_999);
    expect(capStoredInput(exact).truncated).toBe(false);
    const atLimit = `${exact}x`; // 20,000
    expect(new TextEncoder().encode(atLimit).length).toBe(STORED_MAX_BYTES);
    expect(capStoredInput(atLimit)).toMatchObject({ truncated: false });
    const over = capStoredInput(`${atLimit}x`); // 20,001
    expect(over.truncated).toBe(true);
    // The last line is the one that grew past the limit, so it is cut whole.
    expect(over.lines.at(-1)!.line).toBe(STORED_MAX_LINES - 1);
  });

  it("cuts at the last line break when a multi-byte character straddles the byte limit", () => {
    // The fourth line is filled so its 2-byte "é" starts at byte 19,999 and ends at 20,000.
    const full = "a".repeat(5_999);
    const head = [full, full, full].join("\n");
    const room =
      STORED_MAX_BYTES - 1 - new TextEncoder().encode(`${head}\n`).length;
    const text = `${head}\n${"b".repeat(room)}é\nnext`;
    expect(new TextEncoder().encode(text).length).toBeGreaterThan(
      STORED_MAX_BYTES,
    );
    const result = capStoredInput(text);
    expect(result.truncated).toBe(true);
    // The line holding the straddling "é" is dropped whole, and no replacement character remains.
    expect(result.lines.map((l) => l.line)).toEqual([1, 2, 3]);
    expect(JSON.stringify(result.lines)).not.toContain("�");
  });

  it("keeps a line that ends exactly on the byte limit", () => {
    const head = "a".repeat(STORED_MAX_BYTES);
    const result = capStoredInput(`${head}\nz`);
    expect(result.lines).toEqual([{ line: 1, text: head }]);
    expect(result.truncated).toBe(true);
  });

  it("counts a CR LF break once, as the reader typed it", () => {
    // 19,999 bytes as typed (LF), 20,048 once every break is CR LF.
    const result = capStoredInput(filled("\r\n"));
    expect(result.lines).toHaveLength(STORED_MAX_LINES);
    expect(result.truncated).toBe(false);
    const lone = capStoredInput(filled("\r"));
    expect(lone).toMatchObject({ truncated: false });
    expect(lone.lines).toHaveLength(STORED_MAX_LINES);
  });

  it("is not truncated when only blank text is dropped", () => {
    const head = "a".repeat(STORED_MAX_BYTES);
    expect(capStoredInput(`${head}\n`)).toEqual({
      lines: [{ line: 1, text: head }],
      truncated: false,
    });
    expect(capStoredInput(`${head}\r\n  \n\t`)).toMatchObject({
      truncated: false,
    });
  });

  it("keeps nothing when one line is over the limit", () => {
    const result = capStoredInput("a".repeat(STORED_MAX_BYTES + 1));
    expect(result).toEqual({ lines: [], truncated: true });
  });
});

describe("completeStoredLine", () => {
  const zone = "America/Toronto";

  it("keeps a line that already has a bracket, trimmed", () => {
    expect(
      completeStoredLine("  2026-07-01T12:00:00-04:00[Europe/Paris] ", zone),
    ).toBe("2026-07-01T12:00:00-04:00[Europe/Paris]");
    expect(completeStoredLine("2026-07-01T12:00:00-04:00 [x]", zone)).toBe(
      "2026-07-01T12:00:00-04:00 [x]",
    );
  });

  it("turns '<time> <Zone>' into '<time>[<Zone>]'", () => {
    expect(
      completeStoredLine("2026-07-01T12:00:00-04:00   America/Edmonton", zone),
    ).toBe("2026-07-01T12:00:00-04:00[America/Edmonton]");
  });

  it("does not read an offset as a zone name in a two-word line", () => {
    expect(completeStoredLine("2026-07-01 12:00:00-04:00", zone)).toBeNull();
    expect(completeStoredLine("2026-07-01T12:00:00 -04:00", zone)).toBeNull();
    // RFC 9557 4.1: a zone part is never `.` or `..`.
    for (const name of [".", "..", "a/../b", "./a", "a/."])
      expect(
        completeStoredLine(`2026-07-01T12:00:00 ${name}`, zone),
      ).toBeNull();
    expect(completeStoredLine("2026-07-01T12:00:00 .a/_b", zone)).toBe(
      "2026-07-01T12:00:00[.a/_b]",
    );
    expect(completeStoredLine("2026-07-01T12:00:00 Etc/GMT+5", zone)).toBe(
      "2026-07-01T12:00:00[Etc/GMT+5]",
    );
  });

  it("adds the picked zone to one token", () => {
    expect(completeStoredLine("2026-07-01T12:00:00-04:00", zone)).toBe(
      "2026-07-01T12:00:00-04:00[America/Toronto]",
    );
  });

  it("returns null for anything else", () => {
    expect(completeStoredLine("a b c", zone)).toBeNull();
    expect(completeStoredLine("a b[c", zone)).toBe("a b[c");
    expect(completeStoredLine("   ", zone)).toBeNull();
    expect(completeStoredLine("", zone)).toBeNull();
  });
});

describe("the chat's description of the saved-events form", () => {
  // The chat tells the model how many lines a checker reads; a stale number promises more than
  // the Worker reads.
  it.each(["showCanadaClockChange", "showMoroccoClockChange"])(
    "%s states the shared line cap",
    (name) => {
      const purpose = DOX_TOOL_DOCS.find((doc) => doc.name === name)!.purpose;
      expect(purpose).toContain(
        `reads up to ${STORED_MAX_LINES} pasted saved events`,
      );
      expect(purpose.match(/up to (\d+) pasted/g)).toHaveLength(1);
    },
  );
});
