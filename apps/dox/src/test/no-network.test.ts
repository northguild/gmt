/// <reference types="vitest/globals" />
/**
 * Proves `no-network.mjs` is live in every test worker. Without this, a guard that
 * silently stopped loading would leave every other test "passing" while nothing
 * stood between a mistake and a real, quota-spending model call.
 */
import http from "node:http";
import https from "node:https";
import type { AddressInfo } from "node:net";

describe("the test run's network guard", () => {
  it("blocks fetch to a model provider", async () => {
    await expect(
      fetch("https://generativelanguage.googleapis.com/v1beta/models"),
    ).rejects.toThrow(/may not use the network/);
  });

  it("blocks a raw https request, which bypasses fetch", async () => {
    const outcome = await new Promise<unknown>((resolve) => {
      const request = https.get("https://api.cloudflare.com/", (response) => {
        response.resume();
        resolve("reached the network");
      });
      request.on("error", resolve);
    });
    expect(String(outcome)).toMatch(/may not use the network/);
  });

  it("blocks a plain http request, which goes through the socket patch", async () => {
    const outcome = await new Promise<unknown>((resolve) => {
      const request = http.get("http://example.com/", (response) => {
        response.resume();
        resolve("reached the network");
      });
      request.on("error", resolve);
    });
    expect(String(outcome)).toMatch(/may not use the network/);
  });

  it("still allows a server the test started on loopback", async () => {
    const server = http.createServer((_request, response) =>
      response.end("local"),
    );
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/`);
      expect(await response.text()).toBe("local");
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
