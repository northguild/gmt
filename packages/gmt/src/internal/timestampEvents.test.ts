import { Temporal } from "@js-temporal/polyfill";
import { hostileProxy, revokedProxy } from "../test/noThrow";
import { mockTemporalInstantFromThrow } from "../test/mocks";
import { parseTimestampEvents } from "./timestampEvents";

/** Epoch nanoseconds of an instant string, read by the polyfill. */
const ns = (value: string): bigint =>
  Temporal.Instant.from(value).epochNanoseconds;

describe("parseTimestampEvents", () => {
  it("returns each event with its instants, in recording order", () => {
    // Recorded 12:00, 08:00 and 10:00: the order becomes 08:00, 10:00, 12:00.
    expect(
      parseTimestampEvents([
        {
          classifier: "ACT",
          at: "2024-06-15T11:58:00Z",
          recordedAt: "2024-06-15T12:00:00Z",
        },
        {
          classifier: "PLN",
          at: "2024-06-15T12:00:00+02:00",
          recordedAt: "2024-06-15T08:00:00Z",
        },
        {
          classifier: "EST",
          at: "2024-06-15T12:10:00Z",
          recordedAt: "2024-06-15T10:00:00Z",
        },
      ]),
    ).toEqual([
      {
        classifier: "PLN",
        at: "2024-06-15T12:00:00+02:00",
        atNanoseconds: ns("2024-06-15T10:00:00Z"),
        recordedNanoseconds: ns("2024-06-15T08:00:00Z"),
      },
      {
        classifier: "EST",
        at: "2024-06-15T12:10:00Z",
        atNanoseconds: ns("2024-06-15T12:10:00Z"),
        recordedNanoseconds: ns("2024-06-15T10:00:00Z"),
      },
      {
        classifier: "ACT",
        at: "2024-06-15T11:58:00Z",
        atNanoseconds: ns("2024-06-15T11:58:00Z"),
        recordedNanoseconds: ns("2024-06-15T12:00:00Z"),
      },
    ]);
  });

  it("keeps the input order of events recorded at the same instant", () => {
    // 10:00Z and 12:00+02:00 are the same instant: the later index stays later.
    const parsed = parseTimestampEvents([
      {
        classifier: "EST",
        at: "2024-06-15T12:00:00Z",
        recordedAt: "2024-06-15T10:00:00Z",
      },
      {
        classifier: "EST",
        at: "2024-06-15T13:00:00Z",
        recordedAt: "2024-06-15T12:00:00+02:00",
      },
    ]);
    expect(parsed?.map((event) => event.at)).toEqual([
      "2024-06-15T12:00:00Z",
      "2024-06-15T13:00:00Z",
    ]);
  });

  it("echoes at as written, a bracket it never reads included", () => {
    const at = "2024-06-15T12:00:00Z[Not/AZone]";
    expect(
      parseTimestampEvents([
        { classifier: "EST", at, recordedAt: "2024-06-15T10:00:00Z" },
      ])?.[0]?.at,
    ).toBe(at);
  });

  it("returns an empty array for an empty list", () => {
    expect(parseTimestampEvents([])).toEqual([]);
  });

  const valid = {
    classifier: "EST",
    at: "2024-06-15T12:00:00Z",
    recordedAt: "2024-06-15T10:00:00Z",
  };

  it("reads a null-prototype event like a plain object", () => {
    expect(
      parseTimestampEvents([Object.assign(Object.create(null), valid)]),
    ).toEqual([
      {
        classifier: "EST",
        at: "2024-06-15T12:00:00Z",
        atNanoseconds: ns("2024-06-15T12:00:00Z"),
        recordedNanoseconds: ns("2024-06-15T10:00:00Z"),
      },
    ]);
  });

  it.each`
    event                                              | why
    ${{ ...valid, classifier: "act" }}                 | ${"a lower-case classifier"}
    ${{ ...valid, classifier: "ETA" }}                 | ${"a classifier outside PLN/EST/REQ/ACT"}
    ${{ ...valid, classifier: undefined }}             | ${"no classifier"}
    ${{ ...valid, at: "2024-06-15T12:00:00" }}         | ${"a zoneless at"}
    ${{ ...valid, at: "" }}                            | ${"an empty at"}
    ${{ ...valid, at: 1718452800 }}                    | ${"a numeric at"}
    ${{ ...valid, recordedAt: "2024-06-15T10:00:00" }} | ${"a zoneless recordedAt"}
    ${{ ...valid, recordedAt: 1718445600 }}            | ${"a numeric recordedAt"}
    ${{ ...valid, at: "2016-12-31T23:59:60Z" }}        | ${"a leap second"}
    ${null}                                            | ${"a null event"}
    ${"EST"}                                           | ${"a string event"}
  `("returns null when one event has $why", ({ event }) => {
    expect(parseTimestampEvents([valid, event])).toBeNull();
  });

  it.each`
    events                             | why
    ${"events"}                        | ${"a string"}
    ${null}                            | ${"null"}
    ${{ 0: valid, length: 1 }}         | ${"an array-like object"}
    ${Object.assign([], { 1: valid })} | ${"a sparse list: a hole is not an event"}
  `("returns null for $why instead of a list", ({ events }) => {
    expect(parseTimestampEvents(events)).toBeNull();
  });

  it.each`
    make                    | label
    ${() => hostileProxy()} | ${"a Proxy that throws on any trap"}
    ${() => revokedProxy()} | ${"a revoked Proxy"}
  `("returns null for $label as the list or an event", ({ make }) => {
    expect(parseTimestampEvents(make())).toBeNull();
    expect(parseTimestampEvents([make()])).toBeNull();
  });

  it("returns null for an event whose getter throws", () => {
    const hostile = {
      classifier: "EST",
      at: "2024-06-15T12:00:00Z",
      get recordedAt(): string {
        throw new Error("hostile getter");
      },
    };
    expect(parseTimestampEvents([hostile])).toBeNull();
  });

  it("returns null when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(parseTimestampEvents([valid])).toBeNull();
  });
});
