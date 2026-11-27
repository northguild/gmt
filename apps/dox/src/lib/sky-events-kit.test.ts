// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { setHtml } from "~/widgets/builders";
import { at } from "~/test/events-kit";
import type { SkyEventData } from "./sky-events";
import {
  askEvents,
  eventsKit,
  mountSkyEvents,
  skyEventsInfo,
} from "./sky-events-kit";

/* A pass 13:03 to 21:00 UT, then a small body's spell; the file the kit loads is this one. */
const DATA: SkyEventData = {
  spanEndMs: at("2036-11-23T00:00:00Z"),
  events: [
    {
      id: "apophis",
      rare: true,
      startMs: at("2029-04-13T13:03:00Z"),
      endMs: at("2029-04-13T21:00:00Z"),
      closestMs: at("2029-04-13T17:46:00Z"),
      unit: "minute",
    },
    {
      id: "vesta",
      rare: true,
      startMs: at("2029-07-08T12:00:00Z"),
      endMs: at("2029-08-02T12:00:00Z"),
      unit: "day",
    },
  ],
};

let nowMs = at("2027-01-01T00:00:00Z");
vi.mock("../assets/sky-events.json?raw", () => ({
  default: JSON.stringify(DATA),
}));
vi.mock("./space-sky", () => ({
  loadClock: () =>
    Promise.resolve({
      getUnixNow: () => nowMs,
      getSystemTimeZone: () => "Europe/Stockholm",
    }),
}));

let host: HTMLElement;
let abort: AbortController;
let panel: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(navigator, "languages", "get").mockReturnValue(["sv-SE", "en-GB"]);
  host = document.createElement("div");
  /* The info button and the popover it opens, as `dataCredits` makes them; */
  const button = document.createElement("button");
  button.setAttribute("popovertarget", "about-sky");
  button.textContent = "About this sky";
  panel = document.createElement("div");
  panel.id = "about-sky";
  panel.setAttribute("popover", "");
  setHtml(panel, skyEventsInfo().lead);
  host.append(button, panel);
  document.body.append(host);
  abort = new AbortController();
  nowMs = at("2027-01-01T00:00:00Z");
});

afterEach(() => {
  vi.restoreAllMocks();
  abort.abort();
  host.remove();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});

/** The popover opens or shuts, as the browser reports it. */
function toggle(newState: "open" | "closed"): void {
  // oxlint-disable-next-line dox-test/no-dispatch-event -- jsdom has no popover to open; the browser's event is the input
  const event = Object.assign(new Event("toggle"), { newState });
  // oxlint-disable-next-line dox-test/no-dispatch-event -- jsdom has no popover to open; the browser's event is the input
  panel.dispatchEvent(event);
}

describe("the events kit", () => {
  it("loads the data and the formatters once, and keeps the reader's zone", async () => {
    expect(eventsKit()).toBeNull();
    const kit = await askEvents();
    expect(kit?.data.events).toHaveLength(2);
    expect(kit?.zone).toEqual({
      locale: "en-GB",
      timeZone: "Europe/Stockholm",
    });
    expect(eventsKit()).toBe(kit);
    expect(await askEvents()).toBe(kit);
  });
});

const TITLE = { name: "Coming up in the sky", hidden: true } as const;
/* jsdom hides a closed popover and cannot open one, so the queries look at hidden elements too; the browser gate sees the real one. */
const rows = () => screen.getAllByRole("listitem", { hidden: true });

describe("the popover's list", () => {
  it("is empty until the popover opens", () => {
    mountSkyEvents(host, abort.signal);
    expect(screen.queryByRole("heading", TITLE)).not.toBeInTheDocument();
  });

  it("is drawn on open: a heading, a row each with its times as time elements, and the note", async () => {
    mountSkyEvents(host, abort.signal);
    toggle("open");
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByRole("heading", TITLE)).toBeInTheDocument();
    expect(rows().map((row) => row.textContent)).toEqual([
      "Apophis · Asteroid · 13 April 2029, 15:03 – 23:00 · closest 19:46",
      "Vesta · Asteroid · 8 July – 2 August 2029",
    ]);
    expect(screen.getByText("15:03", { exact: false })).toHaveAttribute(
      "datetime",
      "2029-04-13T13:03:00Z",
    );
    expect(screen.getByText("23:00")).toHaveAttribute(
      "datetime",
      "2029-04-13T21:00:00Z",
    );
    expect(screen.getByText("19:46")).toHaveAttribute(
      "datetime",
      "2029-04-13T17:46:00Z",
    );
    expect(
      screen.getByText("Times in your time zone (Europe/Stockholm)."),
    ).toBeInTheDocument();
    toggle("closed");
  });

  it("is drawn again at the next edge while open, and no timer is left once it is shut", async () => {
    nowMs = at("2029-04-13T12:00:00Z");
    mountSkyEvents(host, abort.signal);
    toggle("open");
    await vi.advanceTimersByTimeAsync(0);
    expect(rows()[0]).toHaveTextContent("15:03 – 23:00");
    expect(vi.getTimerCount()).toBe(1);
    /* The pass begins an hour on: the clock moves with the timer. */
    nowMs = at("2029-04-13T13:03:00Z");
    await vi.advanceTimersByTimeAsync(
      at("2029-04-13T13:03:00Z") - at("2029-04-13T12:00:00Z"),
    );
    expect(rows()[0]).toHaveTextContent(
      "Apophis · Asteroid · In view now, until 23:00 · closest 19:46",
    );
    toggle("closed");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its timer when the page's sky ends", async () => {
    mountSkyEvents(host, abort.signal);
    toggle("open");
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);
    abort.abort();
    expect(vi.getTimerCount()).toBe(0);
  });
});
