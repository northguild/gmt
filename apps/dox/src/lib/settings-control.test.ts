/**
 * @vitest-environment jsdom
 */
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderSettingsControl,
  type SettingsFixture,
} from "./settings-control-fixture";
import { THEME_KEY } from "./theme";

vi.mock("./sound/cue", () => ({ cue: () => true }));

/** The system's colour scheme, as the browser reports it, and its `change` event. */
let systemLight = false;
let schemeListeners: (() => void)[] = [];

function setSystem(light: boolean): void {
  systemLight = light;
  for (const listener of schemeListeners) listener();
}

beforeEach(() => {
  systemLight = false;
  schemeListeners = [];
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query.includes("light") && systemLight;
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => {
      if (query.includes("color-scheme")) schemeListeners.push(listener);
    },
    removeEventListener: () => {},
  }));
});

let fixture: SettingsFixture | undefined;

function show(): SettingsFixture {
  fixture = renderSettingsControl();
  return fixture;
}

const dark = () => screen.getByRole("switch", { name: "Dark theme" });
const shown = () => document.documentElement.dataset.theme;

afterEach(() => {
  fixture?.destroy();
  fixture = undefined;
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.unstubAllGlobals();
});

describe("the settings control", () => {
  it("holds every setting in one panel named Settings", () => {
    show();
    const panel = screen.getByRole("group", { name: "Settings" });
    expect(panel).toContainElement(dark());
    expect(panel).toContainElement(
      screen.getByRole("button", { name: "Mute sound" }),
    );
    expect(panel).toContainElement(
      screen.getByRole("slider", { name: "Volume" }),
    );
    expect(panel).toContainElement(
      screen.getByRole("switch", { name: "Aura" }),
    );
  });

  it("tells the gear button whether the panel is open, and moves focus to the theme on open", () => {
    show();
    const trigger = screen.getByRole("button", { name: "Settings" });
    fixture?.toggle("open");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(dark()).toHaveFocus();
    fixture?.toggle("closed");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});

describe("the theme switch", () => {
  it("shows the system's theme and writes nothing on mount", () => {
    systemLight = true;
    show();
    expect(dark()).not.toBeChecked();
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });

  it("shows a saved theme over the system's", () => {
    localStorage.setItem(THEME_KEY, "light");
    show();
    expect(dark()).not.toBeChecked();
  });

  it("saves a theme only while it differs from the system's", async () => {
    show();
    const user = userEvent.setup();
    await user.click(dark());
    expect(shown()).toBe("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
    await user.click(dark());
    expect(shown()).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });

  it("flips the page even when the saved theme matches the system's", async () => {
    localStorage.setItem(THEME_KEY, "dark");
    show();
    await userEvent.click(dark());
    expect(shown()).toBe("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });

  it("follows the system's scheme while nothing is saved, and not after", async () => {
    show();
    setSystem(true);
    expect(shown()).toBe("light");
    expect(dark()).not.toBeChecked();
    await userEvent.click(dark());
    setSystem(false);
    expect(shown()).toBe("dark");
    setSystem(true);
    expect(shown()).toBe("dark");
    expect(dark()).toBeChecked();
  });

  it("follows another tab", () => {
    show();
    localStorage.setItem(THEME_KEY, "light");
    // oxlint-disable-next-line dox-test/no-dispatch-event -- the browser fires `storage` for a write in another tab; nothing here can press it
    window.dispatchEvent(new StorageEvent("storage", { key: THEME_KEY }));
    expect(shown()).toBe("light");
    expect(dark()).not.toBeChecked();
  });

  it("stops listening when destroyed", async () => {
    show().destroy();
    await userEvent.click(dark());
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });
});
