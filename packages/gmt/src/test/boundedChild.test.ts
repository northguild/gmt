import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveHook, runInBoundedChild } from "./boundedChild";

const SWAP_ENTRY = "temporal-polyfill/full/implementation";
// Printed by `fixtures/swapEntryFixture.ts` when a child loads it.
const FIXTURE_MARKER = "swap-entry-fixture-loaded";
const FIXTURE_URL = new URL("./fixtures/swapEntryFixture.ts", import.meta.url)
  .href;

describe("resolveHook", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps nothing when neither implementation variable is set", () => {
    vi.stubEnv("GMT_NATIVE_TEMPORAL", "");
    vi.stubEnv("GMT_SWAP_ENTRY", "");
    const source = resolveHook();
    expect(source).toContain("const NATIVE_SHIM = null;");
    expect(source).toContain("const SWAP_ENTRY = null;");
  });

  it("maps the polyfill specifier to the native shim when GMT_NATIVE_TEMPORAL is 1", () => {
    vi.stubEnv("GMT_NATIVE_TEMPORAL", "1");
    vi.stubEnv("GMT_SWAP_ENTRY", "");
    const source = resolveHook();
    expect(source).toMatch(
      /const NATIVE_SHIM = "file:\/\/.*nativeTemporal\.ts";/,
    );
    expect(source).toContain("const SWAP_ENTRY = null;");
  });

  it("maps the polyfill specifier to the swap entry when GMT_SWAP_ENTRY is set", () => {
    vi.stubEnv("GMT_NATIVE_TEMPORAL", "");
    vi.stubEnv("GMT_SWAP_ENTRY", SWAP_ENTRY);
    const source = resolveHook();
    expect(source).toContain(`const SWAP_ENTRY = "${SWAP_ENTRY}";`);
    expect(source).toContain("const NATIVE_SHIM = null;");
  });

  it("throws, naming both variables, when both are set", () => {
    vi.stubEnv("GMT_NATIVE_TEMPORAL", "1");
    vi.stubEnv("GMT_SWAP_ENTRY", SWAP_ENTRY);
    expect(() => resolveHook()).toThrow(/GMT_NATIVE_TEMPORAL.*GMT_SWAP_ENTRY/);
  });
});

describe("runInBoundedChild on the swap leg", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const EXPRESSION = 'gmt.addDate("2024-01-15", { days: 1 })';

  it("loads the module GMT_SWAP_ENTRY names in place of the polyfill", async () => {
    vi.stubEnv("GMT_NATIVE_TEMPORAL", "");
    vi.stubEnv("GMT_SWAP_ENTRY", FIXTURE_URL);
    const run = await runInBoundedChild([EXPRESSION]);
    expect(run.calls.map((call) => call.value)).toContain(FIXTURE_MARKER);
  });

  it("loads the real polyfill when GMT_SWAP_ENTRY is empty", async () => {
    vi.stubEnv("GMT_NATIVE_TEMPORAL", "");
    vi.stubEnv("GMT_SWAP_ENTRY", "");
    const run = await runInBoundedChild([EXPRESSION]);
    expect(run.calls.map((call) => call.value)).toEqual(["2024-01-16"]);
  });
});
