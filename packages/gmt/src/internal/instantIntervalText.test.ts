import { mockTemporalInstantFromThrow } from "../test/mocks";
import { canonicalInstantIntervals } from "./instantIntervalText";

describe("canonicalInstantIntervals", () => {
  it.each`
    intervals                                                                    | expected
    ${[]}                                                                        | ${[]}
    ${[{ start: "2024-01-01T09:00:00.000Z", end: "2024-01-01T12:00:00+00:00" }]} | ${[{ start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" }]}
    ${[{ start: "2024-01-01T09:00:00,5z", end: "2024-01-01T12:00Z" }]}           | ${[{ start: "2024-01-01T09:00:00.5Z", end: "2024-01-01T12:00:00Z" }]}
  `("re-serialises $intervals as $expected", ({ intervals, expected }) => {
    expect(canonicalInstantIntervals(intervals)).toEqual(expected);
  });

  it("returns null when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(
      canonicalInstantIntervals([
        { start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" },
      ]),
    ).toBeNull();
  });
});
