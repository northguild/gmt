/**
 * The call table on the Bridge's page is static prose. This guard reads the
 * page as text and holds every sentinel and boundary number in it to a library
 * call, so the prose cannot drift from the library.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadColumnBridgeLib } from "./column-bridge-lib";

const page = readFileSync(
  join(__dirname, "../content/docs/tools/column-timestamp-bridge.mdx"),
  "utf8",
);

/** The cells of the table row for `fn`, backticks removed. */
const row = (fn: string) => {
  const line = page.split("\n").find((l) => l.startsWith(`| [\`${fn}\`]`));
  if (!line) throw new Error(`no table row for ${fn}`);
  return line.split("|").map((c) => c.trim().replace(/`/g, ""));
};

describe("the call table", async () => {
  const lib = await loadColumnBridgeLib();
  const bad = "not a time";

  it("names the sentinel each call returns", () => {
    const got: Record<string, unknown> = {
      toParquetInt96: lib.toParquetInt96(bad),
      fromParquetInt96: lib.fromParquetInt96({
        julianDay: 2440588,
        nanosOfDay: 86400000000000n,
      }),
      toArrowTimestamp: lib.toArrowTimestamp(bad, { unit: "second" }),
      fromArrowTimestamp: lib.fromArrowTimestamp(0n, {
        unit: "bogus" as never,
      }),
      toProtoTimestamp: lib.toProtoTimestamp(bad),
      fromProtoTimestamp: lib.fromProtoTimestamp({ seconds: 0n, nanos: -1 }),
      toProtoDuration: lib.toProtoDuration(bad),
      fromProtoDuration: lib.fromProtoDuration({ seconds: 0n, nanos: 1e10 }),
      toNanoseconds: lib.toNanoseconds(bad),
      fromNanoseconds: lib.fromNanoseconds(0n, "bogus" as never),
    };
    const show = (v: unknown) =>
      v === null
        ? "null"
        : typeof v === "bigint"
          ? `${v}n`
          : `"${String(v)}"`.replace(/^""$/, '""');
    for (const [fn, value] of Object.entries(got)) {
      expect(row(fn)[3], fn).toBe(show(value).replace(/^"(.*)"$/, '"$1"'));
    }
  });

  it("holds the INT96 day and the nanoseconds of a day", () => {
    const cell = row("toParquetInt96")[2]!;
    const epoch = lib.toParquetInt96("1970-01-01T00:00:00Z");
    expect(cell).toContain(`day ${epoch!.julianDay} is 1970-01-01`);
    const last = lib.toParquetInt96("1970-01-01T23:59:59.999999999Z");
    expect(cell).toContain(`0 to ${last!.nanosOfDay}`);
  });

  it("holds the protobuf Timestamp range", () => {
    const cell = row("toProtoTimestamp")[2]!;
    const first = lib.toProtoTimestamp("0001-01-01T00:00:00Z");
    const last = lib.toProtoTimestamp("9999-12-31T23:59:59.999999999Z");
    expect(cell).toContain(`from ${first!.seconds} to ${last!.seconds}`);
    expect(cell).toContain(`0 to ${last!.nanos}`);
    expect(lib.toProtoTimestamp("0000-12-31T23:59:59Z")).toBeNull();
  });

  it("says 0n is the epoch", () => {
    expect(lib.toNanoseconds("1970-01-01T00:00:00Z")).toBe(0n);
  });

  it("defines NO SIGNAL as the sentinel, apart from the validator row", () => {
    expect(page).toContain(
      "`NO SIGNAL` means one thing: the call returned its sentinel",
    );
    expect(page).not.toContain("only when that check fails");
    // The claim is checkable: a valid instant can still be out of the proto range.
    expect(lib.isValidInstant("9999-12-31T23:59:59Z")).toBe(true);
    expect(lib.toProtoTimestamp("+275760-09-13T00:00:00Z")).toBeNull();
  });
});
