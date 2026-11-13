/**
 * @vitest-environment jsdom
 *
 * The GTFS Time Reader end to end: template, mount, interact, assert, against the real
 * `@northguild/gmt`, through roles and accessible names the way a person meets the page.
 */
import { screen } from "@testing-library/dom";
import type { LoadedWidget } from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import {
  CLOCK_NOTE_LEAD,
  NOTHING_TYPED,
  WRITE_REASONS,
  type GtfsTimeReaderArgs,
} from "./gtfs-time-reader";
import {
  mountGtfsTimeReader,
  renderGtfsTimeReaderTemplate,
} from "./gtfs-time-reader-mount";

installJsdomShims();

const entry: LoadedWidget<GtfsTimeReaderArgs> = {
  renderTemplate: renderGtfsTimeReaderTemplate,
  mount: mountGtfsTimeReader,
};

let live: RenderedWidget | null = null;

const open = async (args: GtfsTimeReaderArgs = {}): Promise<RenderedWidget> => {
  live?.destroy();
  live = await renderWidget(entry as LoadedWidget<never>, { args });
  return live;
};

afterEach(() => {
  live?.destroy();
  live = null;
});

const secondsBox = () =>
  screen.getByRole("textbox", { name: "Seconds (time of day)" });
const daysBox = () =>
  screen.getByRole("textbox", { name: "Days past the service day" });
const noteText = new RegExp(CLOCK_NOTE_LEAD.slice(0, 40));
const timeBox = () => screen.getByRole("textbox", { name: "GTFS time" });
const useRead = () =>
  screen.getByRole("button", { name: "Use the time read above" });
// A hold keeps hidden twins of every text it can say; only the live one is perceived.
const many = (text: string | RegExp) =>
  screen.queryAllByText(text, {
    ignore: "[aria-hidden='true'], [aria-hidden='true'] *, script, style",
  }).length;

async function paste(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") {
    await w.user.click(box);
    await w.user.paste(value);
  }
}

describe("opening", () => {
  it("opens on 25:35:00, read as one day and 5700 seconds", async () => {
    await open();
    expect(timeBox()).toHaveValue("25:35:00");
    expect(many("25:35:00")).toBeGreaterThan(0);
    expect(useRead()).toBeEnabled();
  });

  it("always shows the clock note", async () => {
    await open();
    expect(many(new RegExp(CLOCK_NOTE_LEAD.slice(0, 40)))).toBeGreaterThan(0);
  });

  it("has no accessibility violations", async () => {
    const w = await open();
    await expectNoAxeViolations(w.root);
  });
});

describe("reading", () => {
  it("shows a refusal as the signal-lost state", async () => {
    const w = await open();
    await paste(w, timeBox(), "25:60:00");
    expect(many(/NO SIGNAL/)).toBeGreaterThan(0);
    expect(useRead()).toBeDisabled();
    await expectNoAxeViolations(w.root);
  });

  it("shows an empty box as nothing typed, not as NO SIGNAL", async () => {
    const w = await open();
    await paste(w, timeBox(), "");
    expect(many(NOTHING_TYPED)).toBeGreaterThan(0);
    expect(many(/NO SIGNAL/)).toBe(0);
  });

  it("reads a one-digit hour", async () => {
    const w = await open();
    await paste(w, timeBox(), "8:05:00");
    expect(many("08:05:00")).toBeGreaterThan(0);
    expect(many(/NO SIGNAL/)).toBe(0);
  });
});

describe("the clock note", () => {
  it("is shown when the box is empty", async () => {
    const w = await open();
    await paste(w, timeBox(), "");
    expect(many(noteText)).toBeGreaterThan(0);
  });

  it("is shown when the read is refused", async () => {
    const w = await open();
    await paste(w, timeBox(), "25:60:00");
    expect(many(noteText)).toBeGreaterThan(0);
  });
});

describe("writing", () => {
  it("copies the read record into the write section and writes it back", async () => {
    const w = await open();
    await paste(w, timeBox(), "110:29:00");
    await w.user.click(useRead());
    expect(secondsBox()).toHaveValue("52140");
    expect(daysBox()).toHaveValue("4");
    expect(many("110:29:00")).toBeGreaterThan(0);
    expect(many(WRITE_REASONS.written)).toBeGreaterThan(0);
  });

  it("writes a valid record", async () => {
    const w = await open();
    await paste(w, secondsBox(), "5700");
    await paste(w, daysBox(), "1");
    expect(many("25:35:00")).toBeGreaterThan(0);
    expect(many(WRITE_REASONS.written)).toBeGreaterThan(0);
    await expectNoAxeViolations(w.root);
  });

  it("shows the reason for a refused record", async () => {
    const w = await open();
    await paste(w, secondsBox(), "57600");
    await paste(w, daysBox(), "41");
    expect(many(WRITE_REASONS.hours)).toBeGreaterThan(0);
    expect(many(/NO SIGNAL/)).toBeGreaterThan(0);
  });

  it("enables Use on a read and disables it on a refusal", async () => {
    const w = await open();
    expect(useRead()).toBeEnabled();
    await paste(w, timeBox(), "1000:00:00");
    expect(useRead()).toBeDisabled();
    await paste(w, timeBox(), "8:05:00");
    expect(useRead()).toBeEnabled();
  });
});
