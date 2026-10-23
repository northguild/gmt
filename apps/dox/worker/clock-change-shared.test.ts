import { handleClockChangeCheck } from "./clock-change-shared";
import type { CheckEndpoint } from "./clock-change-shared";
import { resetRateLimitState } from "./rate-limit";

/**
 * The shared handler on its own, with a made-up endpoint: no region's zones, words or policy.
 * The regions' own tests cover what each region computes; this file covers the methods, `HEAD`,
 * the body cap, the rate limit and the form checks that every region gets from the handler.
 */
const NOW = "2030-01-01T00:00:00Z";
const URL = "https://example.test/gmt/api/demo-clock-change";
const ANSWER = { demo: true, now: NOW };

const DEMO: CheckEndpoint = {
  prefix: "demo",
  stopYear: 2030,
  policy: { max: 3, windowSeconds: 60 },
  storedZones: ["Europe/Lisbon", "Africa/Casablanca"],
  compute: (now) => ({ ...ANSWER, now }),
};

function call(
  method: string,
  init: Omit<RequestInit, "method"> = {},
  ip = "1.1.1.1",
): Promise<Response> {
  return handleClockChangeCheck(
    new Request(URL, {
      method,
      ...init,
      headers: { "cf-connecting-ip": ip, ...init.headers },
    }),
    DEMO,
    () => NOW,
  );
}

function form(fields: Record<string, string | File>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

function stream(size: number): RequestInit {
  return {
    headers: { "content-type": "text/plain" },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(size).fill(97));
        controller.close();
      },
    }),
    // @ts-expect-error `duplex` is required for a stream body and absent from the DOM type.
    duplex: "half",
  };
}

describe("handleClockChangeCheck with a made-up endpoint", () => {
  beforeEach(() => resetRateLimitState());

  it("answers 405 with Allow: GET, HEAD, POST for other methods", async () => {
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      const response = await call(method);
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD, POST");
    }
  });

  it("answers HEAD with an empty body and no-store", async () => {
    const response = await call("HEAD");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
  });

  it("answers 413 for a body over the byte limit, streamed with no content-length", async () => {
    const init = stream(65_537);
    const response = await call("POST", init);
    expect(response.status).toBe(413);
  });

  it("answers 429 with retry-after on the fourth call from one client", async () => {
    for (let i = 0; i < 3; i++) expect((await call("GET")).status).toBe(200);
    const refused = await call("GET");
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    // Another client has its own count.
    expect((await call("GET", {}, "2.2.2.2")).status).toBe(200);
  });

  it("answers 400 for a body that is not a form and for a zone outside the list", async () => {
    const json = await call("POST", {
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(json.status).toBe(400);
    expect(
      (
        await call("POST", {
          body: form({ lines: "", zone: "America/Toronto" }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("POST", {
          body: form({ lines: "x", zone: new File(["x"], "t.txt") }),
        })
      ).status,
    ).toBe(400);
  });

  it("answers 200 with the stub's answer for GET, and a checked form for POST", async () => {
    const got = await call("GET");
    expect(got.status).toBe(200);
    expect(got.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(await got.json()).toEqual(ANSWER);

    const posted = await call("POST", {
      body: form({ lines: "", zone: "Europe/Lisbon" }),
    });
    expect(posted.status).toBe(200);
    expect(await posted.json()).toEqual({
      zone: "Europe/Lisbon",
      truncated: false,
      rows: [],
    });
  });
});
