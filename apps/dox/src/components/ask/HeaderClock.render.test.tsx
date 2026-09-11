/**
 * @vitest-environment jsdom
 *
 * The strip's clock: the reader's local time, in whatever format the shared
 * date display store holds — and never in the zone it holds.
 */
/// <reference types="vitest/globals" />
import { act, render } from "@testing-library/react";
import {
  resetDateDisplay,
  setDateFormat,
  setDateZone,
} from "~/lib/date-display-store";
import { HeaderClock } from "./HeaderClock";
import { installJsdomShims } from "~/test/jsdom-shims";

installJsdomShims();

const systemZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const clockText = () =>
  document.querySelector("time.gmt-hive-now")?.textContent ?? "";

describe("HeaderClock", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDateDisplay();
  });

  it("shows the current local time in the default calendar format", () => {
    render(<HeaderClock />);
    // Calendar against its own reference instant is always "today".
    expect(clockText()).toMatch(/^today at /);
  });

  it("follows the format picked in the shared store", () => {
    render(<HeaderClock />);
    act(() => setDateFormat("unix-s"));
    expect(clockText()).toMatch(/^\d{10}$/);
  });

  it("falls back to the calendar format for a relative pick, which would only ever say now", () => {
    render(<HeaderClock />);
    act(() => setDateFormat("relative-long"));
    expect(clockText()).toMatch(/^today at /);
  });

  it("stays on the reader's own zone, whatever zone the store holds", () => {
    const elsewhere =
      systemZone === "Asia/Tokyo" ? "Europe/London" : "Asia/Tokyo";
    render(<HeaderClock />);
    act(() => {
      setDateZone(elsewhere);
      setDateFormat("iso-zoned");
    });
    expect(clockText().endsWith(`[${systemZone}]`)).toBe(true);
  });
});
