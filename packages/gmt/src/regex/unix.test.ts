import { unixMilliseconds, unixSeconds } from "./unix";

describe("unix regex", () => {
  describe("unixSeconds", () => {
    it("should match a valid 10-digit unix timestamp", () => {
      expect(unixSeconds.test("1638316800")).toBe(true);
    });

    it("should not match a non-numeric string", () => {
      expect(unixSeconds.test("not_a_timestamp")).toBe(false);
    });

    it("should not match a 13-digit unix timestamp", () => {
      expect(unixSeconds.test("1638316800000")).toBe(false);
    });
  });

  describe("unixMilliseconds", () => {
    it("should match a valid 13-digit unix timestamp", () => {
      expect(unixMilliseconds.test("1638316800000")).toBe(true);
    });

    it("should not match a non-numeric string", () => {
      expect(unixMilliseconds.test("not_a_timestamp")).toBe(false);
    });

    it("should not match a 10-digit unix timestamp", () => {
      expect(unixMilliseconds.test("1638316800")).toBe(false);
    });
  });
});
