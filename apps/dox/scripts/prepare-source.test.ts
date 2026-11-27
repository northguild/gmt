import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readPinnedSource } from "./prepare-source.mjs";

/**
 * The pinned download the prepare scripts share. `fail` ends the process, so the tests turn
 * `process.exit` into a throw and read what it printed.
 */
const bytes = Buffer.from("a pinned file");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const pinned = {
  name: "prepare-x",
  url: "https://example.test/f",
  bytes: bytes.length,
  sha256,
  flag: "file",
};

let dir = "";
const argv = [...process.argv];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "prepare-source-"));
  vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`exit ${code}`);
  }) as never);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  process.argv = [...argv];
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const printed = () => vi.mocked(console.error).mock.calls.flat().join("\n");

describe("readPinnedSource", () => {
  it("returns a downloaded file that is the pinned one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(bytes)),
    );
    expect(await readPinnedSource(pinned)).toEqual(bytes);
  });

  it("fails with the size and hash it got and the ones it expected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("another file")),
    );
    await expect(readPinnedSource(pinned)).rejects.toThrow("exit 1");
    const got = createHash("sha256").update("another file").digest("hex");
    expect(printed()).toContain(
      `prepare-x: the source is not the pinned file (12 bytes, sha256 ${got})`,
    );
    expect(printed()).toContain(`expected ${bytes.length} bytes, ${sha256}`);
  });

  it("fails on the right hash with the wrong size", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(bytes)),
    );
    await expect(readPinnedSource({ ...pinned, bytes: 5 })).rejects.toThrow(
      "exit 1",
    );
    expect(printed()).toContain("expected 5 bytes");
  });

  it("fails on a download that is refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );
    await expect(readPinnedSource(pinned)).rejects.toThrow("exit 1");
    expect(printed()).toContain("download failed: 404 https://example.test/f");
  });

  it("reads the file the flag names and makes no request", async () => {
    const file = join(dir, "copy");
    writeFileSync(file, bytes);
    const fetching = vi.fn();
    vi.stubGlobal("fetch", fetching);
    process.argv = [...argv, "--file", file];
    expect(await readPinnedSource(pinned)).toEqual(bytes);
    expect(fetching).not.toHaveBeenCalled();
  });

  it("fails when the flag names a file that is not there", async () => {
    process.argv = [...argv, "--file", join(dir, "missing")];
    await expect(readPinnedSource(pinned)).rejects.toThrow("exit 1");
    expect(printed()).toContain("no file at");
  });
});
