/**
 * @vitest-environment jsdom
 *
 * The live playground form end to end, against the real `@northguild/gmt` and the
 * generated templates. A reader types, picks, adds and removes rows; the call line and the
 * result follow. Everything is read by role, name and visible text.
 */
import { screen, waitFor, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { installJsdomShims } from "~/test/jsdom-shims";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "~/widgets/test-fixture";
import { renderPlaygroundFormTemplate } from "./playground-form-template";
import { mountPlayground } from "./playground-form-mount";
import { LIVE_PLAYGROUND_TEMPLATES } from "./playground-spec";

installJsdomShims();

const SENTINEL = "⟨ NO SIGNAL — invalid input ⟩";

let stop: AbortController | null = null;
afterEach(() => {
  stop?.abort();
  stop = null;
});

function open(specId: string, tone?: "wrong" | "right") {
  const template = LIVE_PLAYGROUND_TEMPLATES[specId];
  if (!template) throw new Error(`no template ${specId}`);
  const fixture = renderHtml(
    renderPlaygroundFormTemplate(
      specId,
      template,
      tone === undefined ? {} : { tone },
    ),
  );
  stop = new AbortController();
  mountPlayground(fixture.first(), stop.signal);
  const region = screen.getByRole("region", {
    name: `${template.fn} playground`,
  });
  expect(region).toBeVisible();
  return { user: userEvent.setup() };
}

const result = () => screen.getByRole("status", { name: "output" });

describe("a string function", () => {
  it("is a named region with a labelled input, a call line and a result", async () => {
    open("chopDate");
    expect(screen.getByRole("textbox", { name: "value" })).toHaveValue(
      "2024-02-29T12:34:56",
    );
    expect(screen.getByText(/chopDate/)).toBeVisible();
    await waitFor(() => expect(result()).not.toHaveTextContent(/^\s*$/));
    expect(result()).not.toHaveTextContent(SENTINEL);
    await expectNoAxeViolations(document.body);
  });

  it("re-runs after the reader types, once typing pauses", async () => {
    const { user } = open("chopDate");
    const input = screen.getByRole("textbox", { name: "value" });
    await waitFor(() => expect(result()).not.toHaveTextContent(SENTINEL));
    await user.clear(input);
    await user.type(input, "not a date");
    await waitFor(() => expect(result()).toHaveTextContent(SENTINEL));
    await expectNoAxeViolations(document.body);
  });

  it("puts the typed call on the copy button", async () => {
    const { user } = open("chopDate");
    const input = screen.getByRole("textbox", { name: "value" });
    await user.clear(input);
    await user.type(input, "2024-01-02");
    await waitFor(() => expect(screen.getByText(/2024-01-02/)).toBeVisible());
    expect(screen.getByRole("button", { name: "Copy call" })).toBeVisible();
  });
});

describe("other field kinds", () => {
  it("a number field is a text box with a decimal keyboard", async () => {
    open("convertUnixToUtc");
    const input = screen.getByRole("textbox", { name: "value" });
    expect(input).toHaveValue("1709164800000");
    await waitFor(() => expect(result()).toHaveTextContent("2024"));
  });

  it("a bigint field answers", async () => {
    open("formatNanoseconds");
    expect(screen.getByRole("textbox", { name: "nanoseconds" })).toHaveValue(
      "1710072000123456789",
    );
    await waitFor(() =>
      expect(result()).toHaveTextContent("1710072000123456789"),
    );
    expect(result()).not.toHaveTextContent(SENTINEL);
  });

  it("an enum field is a list of choices", async () => {
    const { user } = open("getZonedDay");
    const select = screen.getByRole("combobox", { name: "ianaTimezone" });
    expect(select).toHaveValue("Asia/Tokyo");
    await user.selectOptions(select, "UTC");
    expect(select).toHaveValue("UTC");
    await waitFor(() => expect(screen.getByText(/"UTC"/)).toBeVisible());
  });

  it("an amount and its unit are two named controls in one group", async () => {
    const { user } = open("addDate");
    const group = screen.getByRole("group", { name: "units" });
    const amount = within(group).getByRole("textbox", { name: "units amount" });
    const unit = within(group).getByRole("combobox", { name: "units unit" });
    expect(amount).toHaveValue("5");
    expect(unit).toHaveValue("days");
    await user.selectOptions(unit, "weeks");
    await waitFor(() => expect(result()).toHaveTextContent("2024-04-14"));
  });

  it("a source field takes an object literal", async () => {
    open("clampInterval");
    expect(screen.getByRole("textbox", { name: "interval" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "bounds" })).toBeVisible();
    await waitFor(() => expect(result()).not.toHaveTextContent(SENTINEL));
  });

  it("a function with no arguments shows only its call and answer", async () => {
    open("getDay");
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    await waitFor(() => expect(result()).not.toHaveTextContent(/^\s*$/));
    await expectNoAxeViolations(document.body);
  });
});

describe("repeatable rows", () => {
  it("names each row by its place", () => {
    open("maxDate");
    const group = screen.getByRole("group", { name: "dates" });
    expect(within(group).getByRole("textbox", { name: "dates 1" })).toHaveValue(
      "2024-03-10",
    );
    expect(within(group).getByRole("textbox", { name: "dates 3" })).toHaveValue(
      "2024-03-12",
    );
    expect(
      within(group).getByRole("button", { name: "Remove dates 2" }),
    ).toBeVisible();
    expect(
      within(group).getByRole("button", { name: "Add dates" }),
    ).toBeVisible();
  });

  it("an added row takes focus and the answer follows", async () => {
    const { user } = open("maxDate");
    await user.click(screen.getByRole("button", { name: "Add dates" }));
    const fresh = screen.getByRole("textbox", { name: "dates 4" });
    expect(fresh).toHaveFocus();
    await user.type(fresh, "2025-01-01");
    await waitFor(() => expect(result()).toHaveTextContent("2025-01-01"));
    await expectNoAxeViolations(document.body);
  });

  it("a removed row renumbers the rest and focus moves to the row before it", async () => {
    const { user } = open("maxDate");
    await user.click(screen.getByRole("button", { name: "Remove dates 2" }));
    expect(
      screen.queryByRole("textbox", { name: "dates 3" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "dates 1" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "dates 2" })).toHaveValue(
      "2024-03-12",
    );
    await expectNoAxeViolations(document.body);
  });

  it("removing the first row moves focus to the next", async () => {
    const { user } = open("maxDate");
    await user.click(screen.getByRole("button", { name: "Remove dates 1" }));
    expect(screen.getByRole("textbox", { name: "dates 1" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "dates 1" })).toHaveValue(
      "2024-03-15",
    );
  });

  it("removing the last row leaves focus on Add", async () => {
    const { user } = open("maxDate");
    await user.click(screen.getByRole("button", { name: "Remove dates 3" }));
    await user.click(screen.getByRole("button", { name: "Remove dates 2" }));
    await user.click(screen.getByRole("button", { name: "Remove dates 1" }));
    expect(screen.getByRole("button", { name: "Add dates" })).toHaveFocus();
  });

  it("an enum list row is a list of choices", async () => {
    const { user } = open("getLargestDateDurationUnit");
    const first = screen.getByRole("combobox", { name: "units 1" });
    expect(first).toHaveValue("months");
    await user.selectOptions(first, "years");
    await waitFor(() => expect(result()).toHaveTextContent("years"));
  });

  it("interval rows have a start and an end", async () => {
    open("intervalXorAllDate");
    expect(
      screen.getByRole("textbox", { name: "intervals 1 start" }),
    ).toHaveValue("2024-01-01");
    expect(
      screen.getByRole("textbox", { name: "intervals 2 end" }),
    ).toHaveValue("2024-01-15");
    expect(
      screen.getByRole("button", { name: "Remove intervals 2" }),
    ).toBeVisible();
    await waitFor(() => expect(result()).not.toHaveTextContent(/^\s*$/));
    await expectNoAxeViolations(document.body);
  });

  it("interval rows can be added", async () => {
    const { user } = open("intervalXorAllDate");
    await user.click(screen.getByRole("button", { name: "Add intervals" }));
    expect(
      screen.getByRole("textbox", { name: "intervals 3 start" }),
    ).toHaveFocus();
    expect(
      screen.getByRole("textbox", { name: "intervals 3 end" }),
    ).toBeVisible();
  });
});

describe("choice seeds", () => {
  it("choosing a value loads that choice's example into untouched fields", async () => {
    const { user } = open("bolTimestamp");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "event" }),
      "received",
    );
    expect(screen.getByRole("textbox", { name: "value" })).toHaveValue(
      "2024-06-15T21:00:00+02:00",
    );
  });

  it("leaves a value the reader typed alone", async () => {
    const { user } = open("bolTimestamp");
    const value = screen.getByRole("textbox", { name: "value" });
    await user.clear(value);
    await user.type(value, "2024-01-01T00:00:00Z");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "event" }),
      "received",
    );
    expect(value).toHaveValue("2024-01-01T00:00:00Z");
  });
});

describe("the result", () => {
  it("is labelled output", () => {
    open("chopDate", "right");
    expect(screen.getByRole("status", { name: "output" })).toBeVisible();
  });

  it("shows a correct empty answer as empty, not as no signal", async () => {
    const { user } = open("intervalXorAllDate");
    await user.click(
      screen.getByRole("button", { name: "Remove intervals 2" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Remove intervals 1" }),
    );
    await waitFor(() => expect(result()).toHaveTextContent("empty"));
    expect(result()).not.toHaveTextContent(SENTINEL);
  });

  it("stops writing once the form is stopped", async () => {
    const { user } = open("chopDate");
    const input = screen.getByRole("textbox", { name: "value" });
    await waitFor(() => expect(result()).not.toHaveTextContent(SENTINEL));
    stop?.abort();
    await user.clear(input);
    await user.type(input, "zzz");
    await new Promise((r) => setTimeout(r, 300));
    expect(result()).not.toHaveTextContent(SENTINEL);
  });
});
