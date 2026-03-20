export const unixFixture = {
  seconds: "1709164800",
  milliseconds: "1709164800000",
  invalid: ["", "not-a-timestamp", "171068584", "17092170450", "-1"],
} as const;

// TODO CC remove now too complex
export const fixedNowInstant = "2024-02-29T00:00:00.000Z";
export const fixedSystemTimezone = "Europe/Helsinki";

export function mockSystemTimezone(
  timeZone: string = fixedSystemTimezone,
): () => void {
  const defaultOptions = Intl.DateTimeFormat().resolvedOptions();
  const resolvedOptionsSpy = vi
    .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
    .mockReturnValue({
      ...defaultOptions,
      timeZone,
    });

  return () => {
    resolvedOptionsSpy.mockRestore();
  };
}
