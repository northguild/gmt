import { describe, expect, it } from "vitest";
import {
  REGIONS,
  regionOf,
  routeWorker,
  storedFixture,
} from "./clock-check-harness.mjs";

describe("regionOf", () => {
  it("finds each checker by its path", () => {
    expect(regionOf("/check/canada-2026-clock-change/").name).toBe("canada");
    expect(regionOf("/check/morocco-2026-clock-change/").name).toBe("morocco");
  });

  it("throws on a path it does not know, instead of answering with Canada's", () => {
    expect(() => regionOf("/check/other/")).toThrow(/no checker page at/);
    expect(() => regionOf("/check/morocco-2026-clock-change")).toThrow();
  });
});

describe("routeWorker", () => {
  type Handler = (route: FakeRoute) => Promise<unknown>;
  interface FakeRoute {
    request: () => { method: () => string };
    fulfill: (answer: {
      status: number;
      headers: Record<string, string>;
      body: string;
    }) => unknown;
  }
  const fakePage = () => {
    const handlers: Handler[] = [];
    return {
      handlers,
      route: async (_pattern: string, handler: Handler) =>
        void handlers.push(handler),
    };
  };
  const call = async (handler: Handler, method: string) => {
    const answers: {
      status: number;
      headers: Record<string, string>;
      body: string;
    }[] = [];
    await handler({
      request: () => ({ method: () => method }),
      fulfill: (a) => answers.push(a),
    });
    return answers[0]!;
  };

  it("answers by method: the GET fixture for GET, the saved-times fixture for POST", async () => {
    const page = fakePage();
    await routeWorker(page, REGIONS["/check/morocco-2026-clock-change/"], {
      getFixture: { now: "x" },
    });
    expect(JSON.parse((await call(page.handlers[0]!, "GET")).body)).toEqual({
      now: "x",
    });
    const post = JSON.parse((await call(page.handlers[0]!, "POST")).body);
    expect(post).toEqual(storedFixture("Africa/Casablanca"));
  });

  it("answers a 503 and a 429 with the Worker's error shape", async () => {
    for (const status of [503, 429] as const) {
      const page = fakePage();
      await routeWorker(page, REGIONS["/check/canada-2026-clock-change/"], {
        getFixture: {},
        getStatus: status,
      });
      const answer = await call(page.handlers[0]!, "GET");
      expect(answer.status).toBe(status);
      expect(answer.headers["retry-after"]).toBe(
        status === 429 ? "42" : undefined,
      );
    }
  });

  it("holds the GET until released", async () => {
    const page = fakePage();
    const { release } = await routeWorker(
      page,
      REGIONS["/check/canada-2026-clock-change/"],
      {
        getFixture: {},
        hold: true,
      },
    );
    let done = false;
    const pending = call(page.handlers[0]!, "GET").then(() => (done = true));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(done).toBe(false);
    release();
    await pending;
    expect(done).toBe(true);
  });
});
