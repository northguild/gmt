/**
 * @vitest-environment jsdom
 *
 * The reset clock as a reader meets it: the chip, the popover, and the one
 * link to the reference. `reset-formats.test.ts` and `quota-resets.test.ts`
 * cover the rules as pure functions; this covers that they reach the DOM, and
 * that the reader's picks reach the shared date display store.
 */
/// <reference types="vitest/globals" />
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { dateDisplayStore, resetDateDisplay } from "~/lib/date-display-store";
import { ResetClock } from "./ResetClock";
import type { BrainsInfo } from "./use-brains";
import { useResetClock, type ResetClockState } from "./use-reset-clock";
import { installJsdomShims } from "~/test/jsdom-shims";

installJsdomShims();

const PACIFIC_MIDNIGHT = "2026-06-16T07:00:00.000Z";
const UTC_MIDNIGHT = "2026-06-16T00:00:00.000Z";
/** Four hours before Pacific midnight — noon in Tokyo. */
const NOW = "2026-06-16T03:00:00Z";

const INFO: BrainsInfo = {
  brains: [
    {
      id: "gemini-a",
      label: "3.8 Flash",
      provider: "google",
      remaining: 20,
      limit: 20,
      state: "ok",
    },
    {
      id: "cf-a",
      label: "GLM 4.7 Flash",
      provider: "workers-ai",
      remaining: 100,
      limit: 100,
      state: "ok",
    },
  ],
  providers: [
    { id: "google", label: "Gemini", resetsAt: PACIFIC_MIDNIGHT },
    { id: "workers-ai", label: "Workers AI", resetsAt: UTC_MIDNIGHT },
  ],
  activeBrainId: "gemini-a",
  visitor: {
    used: 0,
    limit: 5,
    remaining: 5,
    unlimited: false,
    resetsAt: PACIFIC_MIDNIGHT,
  },
};

function clockState(overrides: Partial<ResetClockState> = {}): ResetClockState {
  return {
    ready: true,
    zone: "Asia/Tokyo",
    formatId: "calendar",
    locale: "en-US",
    now: NOW,
    zones: ["UTC", "Asia/Tokyo", "Europe/London"],
    setZone: vi.fn(),
    setFormatId: vi.fn(),
    ...overrides,
  };
}

function openPanel() {
  fireEvent.click(screen.getByRole("button", { name: /reset/i }));
}

describe("ResetClock", () => {
  it("renders nothing until the reader's zone is known", () => {
    // Before mount the server and browser would disagree about the zone.
    const { container } = render(
      <ResetClock
        info={INFO}
        selectedBrainId={null}
        clock={clockState({ ready: false })}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing without a budget to read", () => {
    const { container } = render(
      <ResetClock info={null} selectedBrainId={null} clock={clockState()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows the reader's own reset in their zone and chosen format", () => {
    render(
      <ResetClock info={INFO} selectedBrainId={null} clock={clockState()} />,
    );
    // Pacific midnight is 4 PM the same day in Tokyo.
    expect(
      screen.getByRole("button", { name: /reset/i }).textContent,
    ).toContain("today at 4:00 PM");
  });

  it("lists every reset in the panel, each on its own clock", () => {
    render(
      <ResetClock info={INFO} selectedBrainId={null} clock={clockState()} />,
    );
    openPanel();
    const panel = screen.getByRole("dialog", { name: "Quota resets" });
    // Gemini and the visitor at Pacific midnight (4 PM Tokyo), Workers AI at
    // UTC midnight (9 AM Tokyo).
    expect(panel.textContent).toContain("Your questions");
    expect(panel.textContent).toContain("today at 4:00 PM");
    expect(panel.textContent).toContain("Workers AI");
    expect(panel.textContent).toContain("today at 9:00 AM");
  });

  it("reports a format pick", () => {
    const clock = clockState();
    render(<ResetClock info={INFO} selectedBrainId={null} clock={clock} />);
    openPanel();
    fireEvent.click(screen.getByRole("radio", { name: /ISO 8601 zoned/ }));
    expect(clock.setFormatId).toHaveBeenCalledWith("iso-zoned");
  });

  it("disables the zone search for a format the zone cannot change", () => {
    render(
      <ResetClock
        info={INFO}
        selectedBrainId={null}
        clock={clockState({ formatId: "unix-ms" })}
      />,
    );
    openPanel();
    const search = screen.getByPlaceholderText("Same in every zone");
    expect((search as HTMLInputElement).disabled).toBe(true);
  });

  it("links the live call to its reference page, in a new tab", () => {
    render(
      <ResetClock info={INFO} selectedBrainId={null} clock={clockState()} />,
    );
    openPanel();
    const link = screen.getByRole("link", { name: /formatCalendarUtc/ });
    expect(link.getAttribute("href")).toBe(
      "/reference/utc/format/formatCalendarUtc",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.textContent).toContain(
      'formatCalendarUtc(resetsAt, "en-US", { timeZone: "Asia/Tokyo" })',
    );
  });
});

describe("useResetClock", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDateDisplay();
  });

  it("becomes ready on the reader's own zone and the default format", () => {
    const { result } = renderHook(() => useResetClock());
    expect(result.current.ready).toBe(true);
    expect(result.current.zone).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    expect(result.current.formatId).toBe("calendar");
    expect(result.current.zones).toContain("UTC");
    // "Now" is a UTC ISO string, the value type every preset takes.
    expect(result.current.now).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it("writes the reader's picks to the shared store, which remembers them", () => {
    const { result } = renderHook(() => useResetClock());
    act(() => {
      result.current.setZone("Asia/Tokyo");
      result.current.setFormatId("http");
    });
    expect(dateDisplayStore.state).toEqual({
      formatId: "http",
      zone: "Asia/Tokyo",
    });
    expect(window.localStorage.getItem("dox:date-zone")).toBe("Asia/Tokyo");
    expect(window.localStorage.getItem("dox:date-format")).toBe("http");

    const { result: another } = renderHook(() => useResetClock());
    expect(another.current.zone).toBe("Asia/Tokyo");
    expect(another.current.formatId).toBe("http");
  });

  it("ignores a stored value it does not recognise", () => {
    window.localStorage.setItem("dox:date-zone", "Mars/Olympus_Mons");
    window.localStorage.setItem("dox:date-format", "relative-medium");
    const { result } = renderHook(() => useResetClock());
    expect(result.current.zone).not.toBe("Mars/Olympus_Mons");
    expect(result.current.formatId).toBe("calendar");
  });
});
