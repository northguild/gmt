export const unixFixture = {
  seconds: "1709164800",
  milliseconds: "1709164800000",
  invalid: ["", "not-a-timestamp", "171068584", "17092170450", "-1"],
} as const;

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
