/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeAudioContext, installFakeAudio } from "../../test/fake-audio";
import { fadedLoop } from "./loops";

let ctx: FakeAudioContext;
let stop: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  installFakeAudio();
  ctx = new FakeAudioContext();
});

afterEach(() => {
  stop?.();
  stop = undefined;
  expect(vi.getTimerCount()).toBe(0);
});

const run = (inner: () => void = () => {}) => {
  const start = vi.fn((_c: AudioContext, _bus: AudioNode) => inner);
  const master = ctx.createGain();
  stop = fadedLoop(
    start,
    0.3,
    0.15,
  )(ctx as unknown as AudioContext, master as unknown as AudioNode);
  const bus = ctx.nodes[1];
  return { start, master, bus };
};

describe("a faded loop", () => {
  it("gives the voice its own bus, which swells in over 0.3 s into the master", () => {
    const { start, master, bus } = run();
    expect(start.mock.calls[0][1]).toBe(bus);
    expect(bus.outputs).toEqual([master]);
    expect(bus.gain.of("setValueAtTime")[0].args).toEqual([0, 0]);
    expect(bus.gain.of("linearRampToValueAtTime")[0].args).toEqual([1, 0.3]);
  });

  it("dims the bus over 0.15 s from where it is and then stops the voice", () => {
    const inner = vi.fn();
    const { bus } = run(inner);
    ctx.advance(1);
    bus.gain.value = 1;
    stop?.();
    stop = undefined;
    expect(bus.gain.of("linearRampToValueAtTime").at(-1)?.args).toEqual([
      0, 1.15,
    ]);
    expect(inner).toHaveBeenCalledTimes(1);
  });
});
