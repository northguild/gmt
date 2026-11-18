// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOADING_CUE_DELAY_MS,
  showUnavailable,
  startMountCues,
} from "./widget-mount";

const cue = vi.fn();
vi.mock("./sound/cue", () => ({ cue: (name: string) => cue(name) }));

let controller: AbortController;

beforeEach(() => {
  vi.useFakeTimers();
  cue.mockClear();
  controller = new AbortController();
});

afterEach(() => {
  controller.abort();
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe("the sounds of a mount", () => {
  it("plays only Lock-in for a mount that resolves within 150 ms", () => {
    const sounds = startMountCues(controller.signal);
    vi.advanceTimersByTime(LOADING_CUE_DELAY_MS - 50);
    sounds.ready();
    vi.advanceTimersByTime(1000);
    expect(cue.mock.calls).toEqual([["ready"]]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("plays the Servo spin-up and then Lock-in for a slower mount", () => {
    const sounds = startMountCues(controller.signal);
    vi.advanceTimersByTime(300);
    sounds.ready();
    expect(cue.mock.calls).toEqual([["loading"], ["ready"]]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("plays the Servo spin-up and then the buzz for a mount that fails", () => {
    const sounds = startMountCues(controller.signal);
    vi.advanceTimersByTime(300);
    sounds.failed();
    expect(cue.mock.calls).toEqual([["loading"], ["error"]]);
  });

  it("clears the timer when the mount is aborted, and then plays nothing", () => {
    const sounds = startMountCues(controller.signal);
    controller.abort();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1000);
    sounds.ready();
    expect(cue).not.toHaveBeenCalled();
  });
});

describe("a widget that fails to load", () => {
  it("tells the reader once and plays the buzz once", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const root = document.createElement("div");
    document.body.append(root);
    showUnavailable(root, new Error("x"));
    showUnavailable(root, new Error("x"));
    expect(root.querySelectorAll("[role=status]")).toHaveLength(1);
    expect(cue.mock.calls).toEqual([["error"]]);
  });
});
