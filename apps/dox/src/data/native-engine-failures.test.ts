import { KNOWN_NATIVE_FAILURES } from "../../../../scripts/lib/native-suite-tags.mjs";
import { nativeFailures } from "./native-engine-failures";

describe("nativeFailures", () => {
  it("counts each test once in the total, however many runtimes it fails on", () => {
    expect(nativeFailures.total).toBe(String(KNOWN_NATIVE_FAILURES.length));
    expect(
      new Set(KNOWN_NATIVE_FAILURES.map((row) => `${row.file} ${row.test}`))
        .size,
    ).toBe(KNOWN_NATIVE_FAILURES.length);
  });

  it("counts a test on every runtime it fails on", () => {
    for (const leg of ["node", "chromium", "firefox", "webkit"] as const) {
      expect(nativeFailures[leg]).toBe(
        String(
          KNOWN_NATIVE_FAILURES.filter((row) => row.legs.includes(leg)).length,
        ),
      );
    }
  });

  it("names a reason for every failure the page counts", () => {
    for (const row of KNOWN_NATIVE_FAILURES) expect(row.defect).not.toBe("");
  });
});
