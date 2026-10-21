/**
 * The native-engine twin of `src/internal/temporal.ts`: the native legs alias the polyfill's
 * specifier to this file, so the whole suite runs on the host's own `Temporal`.
 *
 * Native `Temporal.Now` reads the host clock, which `vi.useFakeTimers()` and `vi.setSystemTime()`
 * cannot move. The exported namespace therefore replaces `Now` with one derived from `Date.now()`
 * by the polyfill's rule: the current millisecond plus the previous call's `ms % 1e6` as the
 * sub-millisecond nanoseconds (see `setFakeSystemTime.ts`). Everything else is the engine's.
 */
type Seam = typeof import("../internal/temporal");

const host = globalThis as unknown as { Temporal?: Seam["Temporal"] };
const hostDate = Date.prototype as unknown as {
  toTemporalInstant?: Seam["toTemporalInstant"];
};

if (
  typeof host.Temporal !== "object" ||
  typeof hostDate.toTemporalInstant !== "function"
) {
  throw new Error("native Temporal is not available on this runtime");
}

const native = host.Temporal;

// oxlint-disable-next-line @northguild/gmt-oxlint/no-date-now -- test clock fixture
let carried = BigInt(Date.now() % 1e6); // date-ban: test clock fixture — native Temporal.Now ignores fake timers

// The Instant range in nanoseconds: the Temporal spec's nsMaxInstant, 8.64e15 ms either side of
// the epoch.
const NS_MAX = 8_640_000_000_000_000n * 1_000_000n;

function epochNs(): bigint {
  // oxlint-disable-next-line @northguild/gmt-oxlint/no-date-now -- test clock fixture
  const now = Date.now(); // date-ban: test clock fixture — native Temporal.Now ignores fake timers
  const ns = BigInt(now) * 1_000_000n + carried;
  carried = BigInt(now % 1e6);
  // The polyfill clamps to the Instant range after advancing the tail, and so does this.
  return ns > NS_MAX ? NS_MAX : ns < -NS_MAX ? -NS_MAX : ns;
}

const instant = (): InstanceType<Seam["Temporal"]["Instant"]> =>
  native.Instant.fromEpochNanoseconds(epochNs());

// The zone argument is validated first, by the engine, before the clock is read: a bad argument
// throws the engine's own error and leaves the carried tail alone, as the polyfill does.
const zonedDateTimeISO = (timeZone?: string) => {
  const zone = native.Now.zonedDateTimeISO(timeZone).timeZoneId;
  return instant().toZonedDateTimeISO(zone);
};

// Not frozen: the suite spies on the members of `Now`, as it does on the polyfill's own object.
const Now = Object.defineProperty(
  {
    instant,
    timeZoneId: () => native.Now.timeZoneId(),
    zonedDateTimeISO,
    plainDateTimeISO: (timeZone?: string) =>
      zonedDateTimeISO(timeZone).toPlainDateTime(),
    plainDateISO: (timeZone?: string) =>
      zonedDateTimeISO(timeZone).toPlainDate(),
    plainTimeISO: (timeZone?: string) =>
      zonedDateTimeISO(timeZone).toPlainTime(),
  },
  Symbol.toStringTag,
  { value: "Temporal.Now", enumerable: false },
);

export const Temporal = Object.freeze(
  Object.create(native, { Now: { value: Now, enumerable: false } }),
) as Seam["Temporal"];

export const Intl = globalThis.Intl as Seam["Intl"];

export const toTemporalInstant: Seam["toTemporalInstant"] =
  hostDate.toTemporalInstant;
