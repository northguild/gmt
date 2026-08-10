import { normalizeTimeZone } from "./normalizeTimeZone";

describe("normalizeTimeZone", () => {
  it.each`
    input                 | expected
    ${undefined}          | ${"UTC"}
    ${""}                 | ${"UTC"}
    ${"   "}              | ${"UTC"}
    ${"Invalid/Timezone"} | ${"UTC"}
    ${"America/New_Yrok"} | ${"UTC"}
    ${"null"}             | ${"UTC"}
    ${"123"}              | ${"UTC"}
    ${"america/new_york"} | ${"america/new_york"}
    ${"America"}          | ${"UTC"}
    ${"America/New/York"} | ${"UTC"}
    ${"America/New@York"} | ${"UTC"}
    ${"+05:00"}           | ${"UTC"}
    ${"UTC+5"}            | ${"UTC"}
  `(
    "returns '$expected' for invalid/missing input: $input",
    ({ input, expected }) => {
      expect(normalizeTimeZone(input as never)).toBe(expected);
    },
  );

  it("returns system timezone for 'local'", () => {
    const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(normalizeTimeZone("local")).toBe(systemTz);
  });

  it.each`
    input                    | expected
    ${"UTC"}                 | ${"UTC"}
    ${"GMT"}                 | ${"GMT"}
    ${"Etc/GMT"}             | ${"Etc/GMT"}
    ${"Etc/GMT+0"}           | ${"Etc/GMT+0"}
    ${"Etc/GMT-0"}           | ${"Etc/GMT-0"}
    ${"America/New_York"}    | ${"America/New_York"}
    ${"America/Los_Angeles"} | ${"America/Los_Angeles"}
    ${"Europe/London"}       | ${"Europe/London"}
    ${"Asia/Tokyo"}          | ${"Asia/Tokyo"}
    ${"Pacific/Auckland"}    | ${"Pacific/Auckland"}
    ${"Africa/Cairo"}        | ${"Africa/Cairo"}
    ${"Australia/Sydney"}    | ${"Australia/Sydney"}
    ${"Antarctica/McMurdo"}  | ${"Antarctica/McMurdo"}
    ${"Asia/Kolkata"}        | ${"Asia/Kolkata"}
    ${"Asia/Kathmandu"}      | ${"Asia/Kathmandu"}
    ${"Pacific/Chatham"}     | ${"Pacific/Chatham"}
    ${"Pacific/Apia"}        | ${"Pacific/Apia"}
    ${"Pacific/Niue"}        | ${"Pacific/Niue"}
  `("returns valid timezone as-is: $input", ({ input, expected }) => {
    expect(normalizeTimeZone(input)).toBe(expected);
  });
});
