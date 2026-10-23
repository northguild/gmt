/**
 * The epoch and precision table on the Decoder's page is static prose. This
 * guard reads the page as text and holds every date in the table to a library
 * call on a boundary vector, so the prose cannot drift from the library.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadIdentifierLib } from "./identifier-lib";

const page = readFileSync(
  join(__dirname, "../content/docs/tools/id-timestamp-decoder.mdx"),
  "utf8",
);

const row = (label: string) => {
  const line = page.split("\n").find((l) => l.startsWith(`| ${label} |`));
  if (!line) throw new Error(`no table row for ${label}`);
  return line.split("|").map((c) => c.trim().replace(/`/g, ""));
};

describe("the epoch table", async () => {
  const lib = await loadIdentifierLib();
  const uuid = (id: string) => lib.fromUuidTimestamp(id);

  it("UUID v1 and v6", () => {
    const cells = row("UUID v1 and v6");
    expect(cells[2]).toBe(uuid("00000000-0000-1000-8000-000000000000"));
    expect(cells[4]).toBe(uuid("ffffffff-ffff-1fff-bfff-ffffffffffff"));
    expect(uuid("00000000-0000-6000-8000-000000000000")).toBe(cells[2]);
  });

  it("UUID v7 and ULID", () => {
    const v7 = row("UUID v7");
    expect(v7[2]).toBe(uuid("00000000-0000-7000-8000-000000000000"));
    expect(v7[4]).toBe(uuid("ffffffff-ffff-7fff-bfff-ffffffffffff"));
    const ulid = row("ULID");
    expect(ulid[2]).toBe(lib.fromUlid("00000000000000000000000000"));
    expect(lib.fromUlid("7ZZZZZZZZZZZZZZZZZZZZZZZZZ")).toBe(v7[4]);
  });

  it("ObjectId", () => {
    const cells = row("ObjectId");
    expect(cells[2]).toBe(lib.fromObjectId("000000000000000000000000"));
    expect(cells[4]).toBe(lib.fromObjectId("ffffffffffffffffffffffff"));
  });

  it("KSUID", () => {
    const cells = row("KSUID");
    expect(cells[2]).toBe(lib.fromKsuid("000000000000000000000000000"));
    expect(cells[4]).toBe(lib.fromKsuid("aWgEPTl1tmebfsQzFP4bxwgy80V"));
  });
});
