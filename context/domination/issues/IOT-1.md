# IOT-1 — IoT / Continuous Time: `monotonicNow` + `deviceSync` + `deviceTimeAt`

**Scope:** Device time synchronization, monotonic timestamps, and span estimation for IoT systems.

## Gap

IoT devices may have inaccurate wall clocks (NTP drift, offline operation, hardware RTC failure). GMT needs helpers to work with device time, not assume a trusted clock source.

## Scope

- `packages/gmt/src/iot/index.ts`:
  - `monotonicNow(): string` — Returns an ISO string from a monotonic source. Resolution is milliseconds. Suitable for spans and deltas; not for wall-clock time.
  - `deviceSync(deviceTime: string, serverTime: string): { drift: number, offset: number }` — Given a device timestamp and the server's known-correct timestamp at that moment, compute the device's clock drift (rate error, ppm) and offset (static time error, ms).
  - `deviceTimeAt(serverTime: string, drift: number, offset: number): string` — Given the server's current time and known device drift/offset, estimate what the device's clock reads. Inverse of `deviceSync`.

## Design notes

- `monotonicNow` uses `Date.now()` in Node.js (not truly monotonic, but no `performance.now()` from Temporal). Document the limitation.
- `deviceSync` assumes a single measurement. For production use, multiple measurements over time improve accuracy. This is a v1 single-measurement API.
- `deviceTimeAt` uses linear extrapolation: `serverTime + offset + drift * elapsed`.

## Verification

- `deviceTimeAt` round-trips with `deviceSync`: given any `(deviceTime, serverTime)`, `deviceTimeAt(serverTime, drift, offset)` approximately equals `deviceTime`
- `monotonicNow` returns a valid ISO string
- `monotonicNow()` called twice in sequence returns increasing values (within platform limits)
- `pnpm run validate` stays green
