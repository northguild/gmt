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
  let rawSeconds: unknown;
  let nanos: unknown;

  try {
    ({ seconds: rawSeconds, nanos } = value as {
      seconds?: unknown;
      nanos?: unknown;
    });
  } catch {
    return null;
  }

  if (!Number.isInteger(nanos)) {
    return null;
  }

  if (Number.isSafeInteger(rawSeconds)) {
    rawSeconds = BigInt(rawSeconds as number);
  }

  return typeof rawSeconds === "bigint"
    ? { seconds: rawSeconds, nanos: nanos as number }
    : null;
}
