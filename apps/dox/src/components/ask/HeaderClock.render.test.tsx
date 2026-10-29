/**
 * @vitest-environment jsdom
 *
 * The strip's clock: the reader's local time, in whatever format the shared
 * date display store holds — and never in the zone it holds.
 */
import { act, render, screen } from "@testing-library/react";
import {
  resetDateDisplay,
  setDateFormat,
  setDateZone,
} from "~/lib/date-display-store";
import { HeaderClock } from "./HeaderClock";
import { installJsdomShims } from "~/test/jsdom-shims";
import { expectNoAxeViolations } from "~/test/render-widget";

installJsdomShims();

const systemZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const clock = () => screen.getByRole("time");

describe("HeaderClock", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDateDisplay();
  });

  it("shows the current local time in the default calendar format", async () => {
    const { container } = render(<HeaderClock />);
    // Calendar against its own reference instant is always "today".
    expect(clock()).toHaveTextContent(/^today at /);
    await expectNoAxeViolations(container);
  });

  it("follows the format picked in the shared store", async () => {
    const { container } = render(<HeaderClock />);
    act(() => setDateFormat("unix-s"));
    expect(clock()).toHaveTextContent(/^\d{10}$/);
    await expectNoAxeViolations(container);
  });

  it("falls back to the calendar format for a relative pick, which would only ever say now", async () => {
    const { container } = render(<HeaderClock />);
    act(() => setDateFormat("relative-long"));
    expect(clock()).toHaveTextContent(/^today at /);
    await expectNoAxeViolations(container);
  });

  it("stays on the reader's own zone, whatever zone the store holds", async () => {
    const elsewhere =
      systemZone === "Asia/Tokyo" ? "Europe/London" : "Asia/Tokyo";
    const { container } = render(<HeaderClock />);
    act(() => {
      setDateZone(elsewhere);
      setDateFormat("iso-zoned");
    });
    expect(clock()).toHaveTextContent(`[${systemZone}]`);
    expect(clock()).toHaveTextContent(/\]$/);
    await expectNoAxeViolations(container);
  });
});
