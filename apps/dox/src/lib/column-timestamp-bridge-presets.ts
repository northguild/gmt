/**
 * The Column Timestamp Bridge's presets (CORE-56). Data only: the inputs are
 * the vectors the library spec gives, and each preset's cards are asserted
 * against a real run in the mount test.
 *
 * This is the one module allowed to hold a literal that is a library fact (a
 * day number, a nanosecond count): they are inputs the reader can type, not
 * constants the widget computes with.
 */
import type { BridgeState } from "./column-timestamp-bridge";

export interface BridgePreset {
  id: string;
  label: string;
  description: string;
  state: BridgeState;
}

const BLANK: BridgeState = {
  mode: "encode",
  value: "",
  unit: "second",
  zone: "",
  duration: "",
  int96Form: "record",
  julianDay: "",
  nanosOfDay: "",
  bytes: "",
  int64: "",
  seconds: "",
  nanos: "",
  durSeconds: "",
  durNanos: "",
};

/** A state: the blank one with `over` written on it. */
export function stateOf(over: Partial<BridgeState>): BridgeState {
  return { ...BLANK, ...over };
}

export const BRIDGE_PRESETS: readonly BridgePreset[] = [
  {
    id: "tokyo-seconds",
    label: "A Tokyo time in a seconds column",
    description:
      "A time written in Tokyo, stored three ways. The Arrow column has a zone, so it holds the instant.",
    state: stateOf({
      value: "2024-01-01T09:00:00+09:00[Asia/Tokyo]",
      unit: "second",
      zone: "Asia/Tokyo",
      duration: "PT1H30M1.5S",
    }),
  },
  {
    id: "sub-microsecond",
    label: "Nanoseconds in a microsecond column",
    description:
      "The Arrow column keeps six digits of the fraction and drops the last three. The other two keep all nine.",
    state: stateOf({
      value: "2024-01-01T00:00:00.123456789Z",
      unit: "microsecond",
      zone: "UTC",
    }),
  },
  {
    id: "before-1970",
    label: "A moment before 1970",
    description:
      "A protobuf Timestamp counts nanos forward, so they stay positive. A Duration signs its nanos like its seconds.",
    state: stateOf({
      value: "1969-12-31T23:59:59.9999999Z",
      unit: "microsecond",
      zone: "UTC",
      duration: "-PT1.5S",
    }),
  },
  {
    id: "wall-time-zoneless",
    label: "A wall time in a column with no zone",
    description:
      "A column with no zone holds wall times. A wall time is not an instant, so Parquet and protobuf have nothing to store.",
    state: stateOf({
      value: "2024-01-01T00:00:00",
      unit: "millisecond",
    }),
  },
  {
    id: "instant-into-zoneless",
    label: "An instant in a column with no zone",
    description:
      "An instant has an offset, which a zoneless column cannot hold. The converter refuses it.",
    state: stateOf({
      value: "2024-01-01T00:00:00Z",
      unit: "millisecond",
    }),
  },
  {
    id: "int64-edge",
    label: "The last instant a nanosecond column holds",
    description: "The largest value an int64 of nanoseconds can hold.",
    state: stateOf({
      value: "2262-04-11T23:47:16.854775807Z",
      unit: "nanosecond",
      zone: "UTC",
    }),
  },
  {
    id: "past-proto-range",
    label: "A year past what protobuf allows",
    description:
      "Year 10000 is outside the range of a protobuf Timestamp. A month is not a duration it can hold either.",
    state: stateOf({
      value: "+010000-01-01T00:00:00Z",
      unit: "nanosecond",
      zone: "UTC",
      duration: "P1M",
    }),
  },
  {
    id: "decode-int96-bytes",
    label: "Decode 12 INT96 bytes",
    description: "The 12 bytes as a Parquet file stores them.",
    state: stateOf({
      mode: "decode",
      int96Form: "bytes",
      bytes: "00000000000000008c3d2500",
    }),
  },
  {
    id: "decode-int96-record",
    label: "Decode an INT96 day and nanoseconds",
    description: "A Julian day number and the nanoseconds into that day.",
    state: stateOf({
      mode: "decode",
      julianDay: "2460380",
      nanosOfDay: "45296789000000",
    }),
  },
  {
    id: "decode-int96-full-day",
    label: "Decode an INT96 with a whole day of nanoseconds",
    description:
      "The nanoseconds of a day stop one short of a full day. This one does not, so there is nothing to read.",
    state: stateOf({
      mode: "decode",
      julianDay: "2440588",
      nanosOfDay: "86400000000000",
    }),
  },
  {
    id: "decode-arrow-zoneless",
    label: "Decode an Arrow value with no zone",
    description:
      "The same int64 read from a column with no zone gives a wall time, not an instant.",
    state: stateOf({
      mode: "decode",
      unit: "nanosecond",
      int64: "-1",
    }),
  },
  {
    id: "decode-nanos-sign",
    label: "Negative nanos in each protobuf type",
    description:
      "A Timestamp refuses a negative nanos. A Duration with a zero second count takes it.",
    state: stateOf({
      mode: "decode",
      seconds: "0",
      nanos: "-1",
      durSeconds: "0",
      durNanos: "-1",
    }),
  },
];
