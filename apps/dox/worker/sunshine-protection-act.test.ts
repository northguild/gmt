import { getDstTransitions } from "@northguild/gmt/zoned/get";
import usZones from "../src/lib/us-region-zones.json";
import { resetRateLimitState } from "./rate-limit";
import {
  computeSunshineActZones,
  handleSunshineProtectionAct,
  SUNSHINE_ACT_RATE_LIMIT,
  type SunshineActZones,
} from "./sunshine-protection-act";

// Count the year scans through the real function, so a second call can be shown to make none.
vi.mock("@northguild/gmt/zoned/get", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@northguild/gmt/zoned/get")>();
  return { ...actual, getDstTransitions: vi.fn(actual.getDstTransitions) };
});

const NOW = "2026-11-13T12:00:00Z";

function call(method = "GET", ip = "1.2.3.4", now = NOW): Promise<Response> {
  return handleSunshineProtectionAct(
    new Request("https://northguild.dev/gmt/api/sunshine-protection-act", {
      method,
      headers: { "cf-connecting-ip": ip },
    }),
    {},
    () => now,
  );
}

const row = (data: SunshineActZones, zone: string) =>
  data.zones.find((z) => z.zone === zone)!;

describe("computeSunshineActZones", () => {
  const data = computeSunshineActZones(NOW);

  it("echoes now", () => {
    expect(data.now).toBe(NOW);
  });

  it.each([
    "America/Phoenix",
    "Pacific/Honolulu",
    "America/Puerto_Rico",
    "Pacific/Guam",
    "Pacific/Pago_Pago",
  ])("%s does not change its clocks", (zone) => {
    expect(row(data, zone).observes).toBe(false);
  });

  it.each([
    "America/Denver",
    "America/New_York",
    "America/Anchorage",
    "America/Adak",
  ])("%s changes its clocks", (zone) => {
    expect(row(data, zone).observes).toBe(true);
  });

  it("gives Denver's last change as 1 November 2026 and its offset now", () => {
    const denver = row(data, "America/Denver");
    expect(denver.offset).toBe("-07:00");
    expect(denver.last).toEqual({
      instant: "2026-11-01T08:00:00Z",
      offsetBefore: "-06:00",
      offsetAfter: "-07:00",
    });
    expect(denver.next?.instant.startsWith("2027-03-14")).toBe(true);
  });

  it("gives a zone with no changes null for both", () => {
    expect(row(data, "Pacific/Honolulu").next).toBeNull();
  });

  it("has exactly one row per zone in us-region-zones.json, in its order, undrawn zones included", () => {
    expect(data.zones.map((z) => z.zone)).toEqual(usZones.zones);
    expect(data.zones.map((z) => z.zone)).toEqual(
      expect.arrayContaining(["Pacific/Midway", "Pacific/Wake"]),
    );
  });

  it("scans no year a second time", () => {
    computeSunshineActZones(NOW);
    const calls = vi.mocked(getDstTransitions).mock.calls.length;
    computeSunshineActZones("2026-11-14T12:00:00Z");
    expect(vi.mocked(getDstTransitions).mock.calls.length).toBe(calls);
  });
});

describe("GET /gmt/api/sunshine-protection-act", () => {
  beforeEach(() => resetRateLimitState());

  it("answers 200 JSON that is never cached", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as SunshineActZones;
    expect(body.now).toBe(NOW);
    expect(body.zones).toHaveLength(usZones.zones.length);
  });

  // RFC 9110 9.1: a general-purpose server supports HEAD wherever it supports GET.
  it("answers HEAD as GET with no body", async () => {
    const response = await call("HEAD");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
  });

  it("answers 405 with Allow: GET, HEAD on any other method", async () => {
    for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
      const response = await call(method);
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD");
    }
  });

  it("counts HEAD in the same bucket as GET", async () => {
    for (let i = 0; i < SUNSHINE_ACT_RATE_LIMIT.max; i++) {
      expect((await call(i % 2 ? "HEAD" : "GET")).status).toBe(200);
    }
    const blocked = await call("HEAD");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).not.toBeNull();
    expect(await blocked.text()).toBe("");
  });

  it("answers 429 after the limit, for one client only", async () => {
    for (let i = 0; i < SUNSHINE_ACT_RATE_LIMIT.max; i++) {
      expect((await call()).status).toBe(200);
    }
    const blocked = await call();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).not.toBeNull();
    expect((await call("GET", "5.6.7.8")).status).toBe(200);
  });
});
