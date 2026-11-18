/**
 * @vitest-environment jsdom
 */
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installJsdomShims } from "~/test/jsdom-shims";
import { setRange } from "~/test/render-widget";
import {
  renderSettingsControl,
  type SettingsFixture,
} from "../settings-control-fixture";
import { saveSound } from "~/test/sound-storage";
import { readSound, SOUND_KEY, SOUND_VERSION } from "./settings";

installJsdomShims();

const cue = vi.fn();
vi.mock("./cue", () => ({ cue: (name: string) => cue(name) }));

let fixture: SettingsFixture | undefined;

function show() {
  fixture = renderSettingsControl();
  return fixture;
}

const mute = () => screen.getByRole("button", { name: "Mute sound" });
const fader = () => screen.getByRole("slider", { name: "Volume" });
const aura = () => screen.getByRole("switch", { name: "Aura" });
const track = (name: "Ice cavern" | "Deep drone") =>
  screen.getByRole("radio", { name });
const saved = () => JSON.parse(localStorage.getItem(SOUND_KEY) ?? "null");

beforeEach(() => {
  cue.mockClear();
});

afterEach(() => {
  fixture?.destroy();
  fixture = undefined;
  localStorage.clear();
});

describe("the sound control", () => {
  it("writes nothing on mount and shows the saved choice", () => {
    saveSound({ level: 8, muted: true, aura: false, track: "deep" });
    const before = localStorage.getItem(SOUND_KEY);
    show();
    expect(localStorage.getItem(SOUND_KEY)).toBe(before);
    expect(mute()).toHaveAttribute("aria-pressed", "true");
    expect(fader()).toHaveValue("8");
    expect(fader()).toHaveAttribute("aria-valuetext", "Volume 8 of 11, muted");
    expect(aura()).not.toBeChecked();
    expect(track("Deep drone")).toBeChecked();
    expect(track("Ice cavern")).not.toBeChecked();
  });

  it("shows sound off on a first visit and writes nothing on mount", () => {
    show();
    expect(localStorage.getItem(SOUND_KEY)).toBeNull();
    expect(mute()).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.sound).toBe("off");
    expect(fader()).toHaveAttribute("aria-valuetext", "Volume 5 of 11, muted");
    expect(track("Ice cavern")).toBeChecked();
  });

  it("turns sound on with one press of the mute button, and saves that choice", async () => {
    show();
    await userEvent.click(mute());
    expect(mute()).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement.dataset.sound).toBe("on");
    expect(saved()).toEqual({
      v: SOUND_VERSION,
      level: 5,
      muted: false,
      aura: true,
      track: "ice",
    });
  });

  it("mutes and unmutes with the mute button, keeping the level", async () => {
    saveSound({ level: 7, muted: false, aura: true });
    show();
    const user = userEvent.setup();
    await user.click(mute());
    expect(mute()).toHaveAttribute("aria-pressed", "true");
    expect(saved()).toMatchObject({ muted: true, level: 7 });
    expect(fader()).toHaveValue("7");
    expect(fader()).toHaveAttribute("aria-valuetext", "Volume 7 of 11, muted");
    await user.click(mute());
    expect(mute()).toHaveAttribute("aria-pressed", "false");
    expect(saved()).toMatchObject({ muted: false, level: 7 });
  });

  it("plays the Ice snap on the mute button, on mute and on unmute", async () => {
    saveSound();
    show();
    const user = userEvent.setup();
    await user.click(mute());
    expect(cue).toHaveBeenCalledWith("toggle");
    cue.mockClear();
    await user.click(mute());
    await vi.waitFor(() => expect(cue).toHaveBeenCalledWith("toggle"));
  });

  it("unmutes at the new level when the fader moves while muted", () => {
    saveSound({ level: 5, muted: true, aura: true });
    show();
    setRange(fader(), 9);
    expect(saved()).toMatchObject({ muted: false, level: 9 });
    expect(mute()).toHaveAttribute("aria-pressed", "false");
    expect(fader()).toHaveAttribute("aria-valuetext", "Volume 9 of 11");
  });

  it("saves the Aura switch", async () => {
    show();
    await userEvent.click(aura());
    expect(saved()).toMatchObject({ aura: false });
  });

  it("names the track choice and saves the picked track", async () => {
    show();
    expect(
      screen.getByRole("group", { name: "Aura track" }),
    ).toBeInTheDocument();
    await userEvent.click(track("Deep drone"));
    expect(saved()).toMatchObject({ track: "deep", aura: true });
    await userEvent.click(track("Ice cavern"));
    expect(saved()).toMatchObject({ track: "ice" });
  });

  it("follows another tab", () => {
    show();
    saveSound({ level: 3, muted: true, aura: false, track: "deep" });
    // oxlint-disable-next-line dox-test/no-dispatch-event -- the browser fires `storage` for a write in another tab; nothing here can press it
    window.dispatchEvent(new StorageEvent("storage", { key: SOUND_KEY }));
    expect(mute()).toHaveAttribute("aria-pressed", "true");
    expect(fader()).toHaveValue("3");
    expect(aura()).not.toBeChecked();
    expect(track("Deep drone")).toBeChecked();
    expect(readSound().level).toBe(3);
  });

  it("stops listening when destroyed", async () => {
    show().destroy();
    await userEvent.click(mute());
    expect(saved()).toBeNull();
  });
});
