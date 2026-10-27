import { convertUtcToUnix } from "@northguild/gmt";
import { BRAINS } from "../src/lib/chat-constants";
import { brainsPayload, withRecordedRequest } from "./brains-payload";
import type { UsageSnapshot } from "./usage";

const EMPTY: UsageSnapshot = { perBrain: {}, states: {}, visitor: 0 };

describe("withRecordedRequest", () => {
  it("adds one question to the visitor and the brain that answered", () => {
    const after = withRecordedRequest(
      { perBrain: { [BRAINS[0].id]: 2 }, states: {}, visitor: 3 },
      BRAINS[0],
      {},
    );
    expect(after.perBrain[BRAINS[0].id]).toBe(3);
    expect(after.visitor).toBe(4);
  });

  it("marks out every brain the walk found out", () => {
    const after = withRecordedRequest(EMPTY, BRAINS[1], {
      [BRAINS[0].id]: "spent",
    });
    expect(after.states).toEqual({ [BRAINS[0].id]: "spent" });
    expect(after.perBrain).toEqual({ [BRAINS[1].id]: 1 });
  });

  it("counts nothing when no brain answered", () => {
    const after = withRecordedRequest(EMPTY, undefined, {});
    expect(after).toEqual(EMPTY);
  });

  it("leaves the snapshot it was given alone", () => {
    const before: UsageSnapshot = { perBrain: {}, states: {}, visitor: 0 };
    withRecordedRequest(before, BRAINS[0], { [BRAINS[1].id]: "unavailable" });
    expect(before).toEqual(EMPTY);
  });
});

describe("brainsPayload", () => {
  const NOW = convertUtcToUnix("2026-06-15T19:00:00Z")!;

  it("lists every brain with what it has left", () => {
    const info = brainsPayload({
      brains: BRAINS,
      snapshot: { perBrain: { [BRAINS[0].id]: 1 }, states: {}, visitor: 1 },
      nowMs: NOW,
      dev: false,
    });
    expect(info.brains.map((brain) => brain.id)).toEqual(
      BRAINS.map((brain) => brain.id),
    );
    expect(info.brains[0].remaining).toBe(BRAINS[0].dailyLimit - 1);
    expect(info.activeBrainId).toBe(BRAINS[0].id);
    expect(info.visitor.used).toBe(1);
    expect(info.visitor.unlimited).toBe(false);
  });

  it("moves the active brain past one that is out", () => {
    const info = brainsPayload({
      brains: BRAINS,
      snapshot: { perBrain: {}, states: { [BRAINS[0].id]: "spent" }, visitor: 0 },
      nowMs: NOW,
      dev: false,
    });
    expect(info.brains[0].state).toBe("spent");
    expect(info.activeBrainId).toBe(BRAINS[1].id);
  });

  it("gives a dev no visitor cap", () => {
    const info = brainsPayload({
      brains: BRAINS,
      snapshot: EMPTY,
      nowMs: NOW,
      dev: true,
    });
    expect(info.visitor.remaining).toBeNull();
    expect(info.visitor.unlimited).toBe(true);
  });
});
