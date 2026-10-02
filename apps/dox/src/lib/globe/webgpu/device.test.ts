/// <reference types="vitest/globals" />

/**
 * The error-scope helpers never hold a scope open across an `await`.
 *
 * A device's error scopes are one stack, and the device is shared: two globes
 * on one page — the landing hero and the `/dox` rail — draw through the same
 * one. A scope left open while its owner awaits catches whatever the other
 * globe does meanwhile, and the pops cross over: one globe reports the other's
 * error and falls back for nothing, while the one that really failed carries on
 * with an invalid object. So every push is popped in the same synchronous run,
 * and only the popped promises are awaited.
 */

import { describe, expect, it } from "vitest";
import { createCheckedShaderModule, withValidation } from "./device";

/** A device that records the order of scope and creation calls. */
function fakeDevice(errors: { validation?: string; memory?: string } = {}) {
  const log: string[] = [];
  const stack: string[] = [];
  const device = {
    pushErrorScope(filter: string) {
      log.push(`push ${filter}`);
      stack.push(filter);
    },
    popErrorScope() {
      const filter = stack.pop();
      log.push(`pop ${filter}`);
      const message =
        filter === "validation" ? errors.validation : errors.memory;
      return Promise.resolve(message ? { message } : null);
    },
    createShaderModule({ label }: { label: string }) {
      log.push(`module ${label}`);
      return { getCompilationInfo: async () => ({ messages: [] }) };
    },
  };
  return { device: device as unknown as GPUDevice, log };
}

describe("withValidation", () => {
  it("pops both scopes before it yields", async () => {
    const { device, log } = fakeDevice();
    const result = withValidation(device, "work", () => {
      log.push("work");
      return 42;
    });
    // Synchronously, before anything is awaited.
    expect(log).toEqual([
      "push validation",
      "push out-of-memory",
      "work",
      "pop out-of-memory",
      "pop validation",
    ]);
    await expect(result).resolves.toBe(42);
  });

  it("rejects with the error a scope caught", async () => {
    const { device } = fakeDevice({ memory: "texture too large" });
    await expect(withValidation(device, "upload", () => 1)).rejects.toThrow(
      "upload: texture too large",
    );
  });

  it("still pops both scopes when the work throws", async () => {
    const { device, log } = fakeDevice();
    const result = withValidation(device, "work", () => {
      throw new Error("boom");
    });
    expect(log.filter((entry) => entry.startsWith("pop"))).toHaveLength(2);
    await expect(result).rejects.toThrow("boom");
  });

  it("refuses asynchronous work, which would hold the scopes across an await", async () => {
    const { device, log } = fakeDevice();
    const result = withValidation(device, "work", () => Promise.resolve(1));
    expect(log.filter((entry) => entry.startsWith("pop"))).toHaveLength(2);
    await expect(result).rejects.toThrow(/synchronous/);
  });
});

describe("createCheckedShaderModule", () => {
  it("pops its scope before awaiting the compiler", async () => {
    const { device, log } = fakeDevice();
    const module = createCheckedShaderModule(device, "globe-test", "");
    expect(log).toEqual([
      "push validation",
      "module globe-test",
      "pop validation",
    ]);
    await expect(module).resolves.toBeDefined();
  });

  it("rejects when the scope caught a validation error", async () => {
    const { device } = fakeDevice({ validation: "bad shader" });
    await expect(
      createCheckedShaderModule(device, "globe-test", ""),
    ).rejects.toThrow('shader "globe-test" failed validation: bad shader');
  });
});
