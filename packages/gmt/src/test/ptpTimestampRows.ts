/**
 * The PTP timestamp records the `iot/` tests share, written by hand from the field widths
 * (RFC 8877 section 4.3: an 80-bit timestamp, 32 bits of nanoseconds in the range 0 to 10^9 - 1,
 * so 80 - 32 = 48 bits of seconds, 0 to 2^48 - 1 = 281474976710655) and never read from the code
 * under test.
 */
import { hostileProxy, revokedProxy } from "./hostileValues";

/** A record that reads as a PTP timestamp, and why. */
export interface PtpRecordRow {
  readonly name: string;
  readonly value: unknown;
  readonly reason: string;
}

export const VALID_PTP_RECORDS: readonly PtpRecordRow[] = [
  {
    name: "zero edge",
    value: { seconds: 0n, nanoseconds: 0 },
    reason: "lower edge of both members",
  },
  {
    name: "upper edge",
    value: { seconds: 281_474_976_710_655n, nanoseconds: 999_999_999 },
    reason: "upper edge of both members (2^48 - 1)",
  },
  {
    name: "2024 bigint",
    value: { seconds: 1_704_067_237n, nanoseconds: 0 },
    reason: "the issue's 2024 timestamp",
  },
  {
    name: "number seconds",
    value: { seconds: 1_704_067_237, nanoseconds: 999_999_999 },
    reason: "number seconds",
  },
  {
    name: "number top",
    value: { seconds: 281_474_976_710_655, nanoseconds: 0 },
    reason: "the top as a number (a safe integer)",
  },
  {
    name: "negative zero",
    value: { seconds: -0, nanoseconds: -0 },
    reason: "negative zero reads as 0",
  },
  {
    name: "extra member",
    value: { seconds: 1n, nanoseconds: 1, extra: true },
    reason: "extra members are ignored",
  },
  {
    name: "inherited members",
    value: Object.create({ seconds: 1n, nanoseconds: 1 }) as unknown,
    reason: "inherited members are read, as readProtoRecord does",
  },
];

export const INVALID_PTP_RECORDS: readonly PtpRecordRow[] = [
  {
    name: "seconds -1n",
    value: { seconds: -1n, nanoseconds: 0 },
    reason: "below 0",
  },
  {
    name: "seconds 2^48 bigint",
    value: { seconds: 281_474_976_710_656n, nanoseconds: 0 },
    reason: "2^48",
  },
  {
    name: "seconds 2^48 number",
    value: { seconds: 281_474_976_710_656, nanoseconds: 0 },
    reason: "2^48 as a number: a safe integer, so the range check rejects it",
  },
  {
    name: "seconds 2^53 number",
    value: { seconds: 9_007_199_254_740_992, nanoseconds: 0 },
    reason: "not a safe integer",
  },
  {
    name: "seconds 1.5",
    value: { seconds: 1.5, nanoseconds: 0 },
    reason: "a fraction",
  },
  {
    name: "seconds string",
    value: { seconds: "1704067237", nanoseconds: 0 },
    reason: "a string",
  },
  {
    name: "nanoseconds 1e9",
    value: { seconds: 0n, nanoseconds: 1_000_000_000 },
    reason: "10^9",
  },
  {
    name: "nanoseconds -1",
    value: { seconds: 0n, nanoseconds: -1 },
    reason: "negative",
  },
  {
    name: "nanoseconds 0.5",
    value: { seconds: 0n, nanoseconds: 0.5 },
    reason: "a fraction",
  },
  {
    name: "nanoseconds bigint",
    value: { seconds: 0n, nanoseconds: 0n },
    reason: "a bigint nanoseconds",
  },
  {
    name: "protobuf nanos member",
    value: { seconds: 0n, nanos: 0 },
    reason: "the protobuf member name, not PTP's",
  },
  {
    name: "missing nanoseconds",
    value: { seconds: 0n },
    reason: "a missing member",
  },
  {
    name: "missing seconds",
    value: { nanoseconds: 0 },
    reason: "a missing member",
  },
  { name: "empty object", value: {}, reason: "a missing member" },
  { name: "null", value: null, reason: "not a record" },
  { name: "undefined", value: undefined, reason: "not a record" },
  {
    name: "ISO string",
    value: "2024-01-01T00:00:00Z",
    reason: "not a record",
  },
  { name: "bigint", value: 1_704_067_237n, reason: "not a record" },
  { name: "array", value: [], reason: "not a record" },
  {
    name: "hostile proxy",
    value: hostileProxy(),
    reason: "hostile: every trap throws",
  },
  {
    name: "revoked proxy",
    value: revokedProxy(),
    reason: "hostile: revoked",
  },
  {
    name: "throwing seconds getter",
    value: {
      get seconds(): bigint {
        throw new Error("hostile getter");
      },
      nanoseconds: 0,
    },
    reason: "hostile: the getter throws",
  },
];
