/**
 * Read a `{ seconds, <fraction> }` record from a caller's value: the member rules that
 * `readProtoRecord` and the PTP reader share, with the name of the fraction member as a parameter.
 *
 * `seconds` may be a `bigint` or a safe-integer `number` and comes back as a `bigint`. The fraction
 * member must be an integer `number`. Both members are required: a missing one is a malformed
 * record, not a default zero. The ranges are the caller's to check, they differ by message.
 *
 * Never throws: a throwing getter, a Proxy trap or a revoked Proxy returns `null`.
 *
 * @param value candidate record
 * @param fractionMember the name of the integer member beside `seconds`
 * @returns the two members, or `null` when `value` is not a well-formed record
 *
 * @example readSecondsRecord({ seconds: 3, nanoseconds: 0 }, "nanoseconds") // { seconds: 3n, fraction: 0 }
 * @example readSecondsRecord({ seconds: 3n, nanos: 0 }, "nanoseconds") // null
 */
export function readSecondsRecord(
  value: unknown,
  fractionMember: "nanos" | "nanoseconds",
): { seconds: bigint; fraction: number } | null {
  let rawSeconds: unknown;
  let fraction: unknown;

  try {
    const record = value as Record<string, unknown>;
    rawSeconds = record.seconds;
    fraction = record[fractionMember];
  } catch {
    return null;
  }

  if (!Number.isInteger(fraction)) {
    return null;
  }

  if (Number.isSafeInteger(rawSeconds)) {
    rawSeconds = BigInt(rawSeconds as number);
  }

  return typeof rawSeconds === "bigint"
    ? { seconds: rawSeconds, fraction: fraction as number }
    : null;
}

/**
 * Read a protobuf `{ seconds, nanos }` record from a caller's value.
 *
 * `seconds` may be a `bigint` or a safe-integer `number` (protobufjs and ts-proto emit `int64`
 * as a number by default) and comes back as a `bigint`. `nanos` must be an integer `number`
 * (`int32`). Both members are required: a missing one is a malformed record, not proto3's
 * default zero. The ranges are the caller's to check, they differ by message.
 *
 * Never throws: a throwing getter, a Proxy trap or a revoked Proxy returns `null`.
 *
 * @param value candidate record
 * @returns the two members, or `null` when `value` is not a well-formed record
 *
 * @example readProtoRecord({ seconds: -1n, nanos: 5 }) // { seconds: -1n, nanos: 5 }
 * @example readProtoRecord({ seconds: 3, nanos: 0 }) // { seconds: 3n, nanos: 0 }
 * @example readProtoRecord({ seconds: "3", nanos: 0 }) // null
 * @example readProtoRecord({ seconds: 3n }) // null
 */
export function readProtoRecord(
  value: unknown,
): { seconds: bigint; nanos: number } | null {
  const record = readSecondsRecord(value, "nanos");

  return record === null
    ? null
    : { seconds: record.seconds, nanos: record.fraction };
}
