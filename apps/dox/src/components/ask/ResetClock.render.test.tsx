/**
 * @vitest-environment jsdom
 *
 * The reset clock as a reader meets it: the chip, the popover, and the one
 * link to the reference. `reset-formats.test.ts` and `quota-resets.test.ts`
 * cover the rules as pure functions; this covers that they reach the DOM, and
 * that the reader's picks reach the shared date display store.
 */
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { dateDisplayStore, resetDateDisplay } from "~/lib/date-display-store";
import { ResetClock } from "./ResetClock";
import type { BrainsInfo } from "./use-brains";
import { useResetClock, type ResetClockState } from "./use-reset-clock";
import { installJsdomShims } from "~/test/jsdom-shims";
import { expectNoAxeViolations } from "~/test/render-widget";

installJsdomShims();

const PACIFIC_MIDNIGHT = "2026-06-16T07:00:00Z";
const UTC_MIDNIGHT = "2026-06-16T00:00:00Z";
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

async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /reset/i }));
  return screen.findByRole("dialog", { name: "Quota resets" });
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
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing without a budget to read", () => {
    const { container } = render(
      <ResetClock info={null} selectedBrainId={null} clock={clockState()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the reader's own reset in their zone and chosen format", async () => {
    const { container } = render(
      <ResetClock info={INFO} selectedBrainId={null} clock={clockState()} />,
    );
    // Pacific midnight is 4 PM the same day in Tokyo.
    const chip = screen.getByRole("button", { name: /reset/i });
    expect(chip).toHaveTextContent("today at 4:00 PM");
    expect(chip).toHaveAccessibleName(/today at 4:00 PM/);
    await expectNoAxeViolations(container);
  });

  it("lists every reset in the panel, each on its own clock", async () => {
    const user = userEvent.setup();
    render(
      <ResetClock info={INFO} selectedBrainId={null} clock={clockState()} />,
    );
    const panel = await openPanel(user);
    // Gemini and the visitor at Pacific midnight (4 PM Tokyo), Workers AI at
    // UTC midnight (9 AM Tokyo).
    expect(panel).toHaveTextContent("Your questions");
    expect(panel).toHaveTextContent("today at 4:00 PM");
    expect(panel).toHaveTextContent("Workers AI");
    expect(panel).toHaveTextContent("today at 9:00 AM");
    await expectNoAxeViolations(panel);
  });

  it("reports a format pick", async () => {
    const user = userEvent.setup();
    const clock = clockState();
    render(<ResetClock info={INFO} selectedBrainId={null} clock={clock} />);
    const panel = await openPanel(user);
    await user.click(screen.getByRole("radio", { name: /ISO 8601 zoned/ }));
    expect(clock.setFormatId).toHaveBeenCalledWith("iso-zoned");
    await expectNoAxeViolations(panel);
  });

  it("disables the zone search for a format the zone cannot change", async () => {
    const user = userEvent.setup();
    render(
      <ResetClock
        info={INFO}
        selectedBrainId={null}
        clock={clockState({ formatId: "unix-ms" })}
      />,
    );
    const panel = await openPanel(user);
    expect(screen.getByPlaceholderText("Same in every zone")).toBeDisabled();
    await expectNoAxeViolations(panel);
  });

  it("links the live call to its reference page, in a new tab", async () => {
    const user = userEvent.setup();
    render(
      <ResetClock info={INFO} selectedBrainId={null} clock={clockState()} />,
    );
    const panel = await openPanel(user);
    const link = screen.getByRole("link", { name: /formatCalendarUtc/ });
    expect(link).toHaveAttribute(
      "href",
      "/gmt/reference/utc/format/formatCalendarUtc",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveTextContent(
      'formatCalendarUtc(resetsAt, "en-US", { timeZone: "Asia/Tokyo" })',
    );
    await expectNoAxeViolations(panel);
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
