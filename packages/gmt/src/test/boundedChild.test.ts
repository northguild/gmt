import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BOUNDED_CHILD_TEST_TIMEOUT_MS,
  resolveHook,
  runInBoundedChild,
} from "./boundedChild";

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

describe(
  "runInBoundedChild on the swap leg",
  { timeout: BOUNDED_CHILD_TEST_TIMEOUT_MS },
  () => {
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
  },
);

// Vitest's default 5 s timeout is shorter than the child's 20 s bound, so a slow child failed the
// test as a Vitest timeout, and only on a loaded machine. The guard makes the omission fail every run.
describe("runInBoundedChild in a test with the default timeout", () => {
  it("refuses to start the child and names the timeout to set", async () => {
    await expect(
      runInBoundedChild(['gmt.addDate("2024-01-15", { days: 1 })']),
    ).rejects.toThrow(
      "the test's 5000 ms timeout is shorter than the child's 20000 ms bound plus 10000 ms to start it",
    );
  });

  it("starts a child whose own bound fits inside the test's timeout", async () => {
    const run = await runInBoundedChild(
      ['gmt.addDate("2024-01-15", { days: 1 })'],
      { timeoutMs: 2_000 },
    );
    expect(run.calls.map((call) => call.value)).toEqual(["2024-01-16"]);
  }, 12_000);
});
