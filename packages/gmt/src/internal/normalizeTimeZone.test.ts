import { normalizeTimeZone } from "./normalizeTimeZone";

describe("normalizeTimeZone", () => {
  it("should return UTC if no timezone provided", () => {
    expect(normalizeTimeZone()).toBe("UTC");
  });

  it("should return UTC if invalid timezone provided", () => {
    expect(normalizeTimeZone("Invalid/Timezone")).toBe("UTC");
  });

  it("should return system timezone if 'local' provided", () => {
    const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(normalizeTimeZone("local")).toBe(systemTz);
  });

  it("should return valid timezone as is", () => {
    expect(normalizeTimeZone("America/New_York")).toBe("America/New_York");
  });
});
