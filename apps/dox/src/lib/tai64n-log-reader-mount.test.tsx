/**
 * @vitest-environment jsdom
 *
 * The TAI64N Log Reader end to end: template, mount, interact, assert, against the real
 * `@northguild/gmt`, through roles and accessible names the way a person meets the page.
 * The figures are literal values read from a run of the built library.
 */
import { screen } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  cellsInColumn,
  expectNoAxeViolations,
  heldSamples,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import { SITE_BASE } from "./site";
import { DROPPED_HINT, NO_SIGNAL, TAI64N_PRESETS } from "./tai64n-log-reader";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const ACROSS = TAI64N_PRESETS.find((p) => p.id === "across-2016")!;

const entry = WIDGET_REGISTRY["showTai64nLogReader"] as AnyWidgetEntry;

let live: RenderedWidget | null = null;

const open = async (
  args: Record<string, unknown> = {},
): Promise<RenderedWidget> => {
  live?.destroy();
  live = await renderWidget(entry, { args });
  return live;
};

afterEach(() => {
  live?.destroy();
  live = null;
});

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const box = () => screen.getByRole("textbox", { name: "Log lines" });
const writer = () =>
  screen.getByRole("textbox", { name: "Write a label from an instant" });
const table = () => screen.queryByRole("table", { name: /Each log line/ });
const radio = (n: number) =>
  screen.getByRole("radio", { name: `Read line ${n}` });
const selectedLine = (): number | null => {
  const i = screen
    .queryAllByRole("radio")
    .findIndex((r) => (r as HTMLInputElement).checked);
  return i < 0 ? null : i + 1;
};

async function paste(w: RenderedWidget, value: string) {
  await w.user.clear(box());
  if (value !== "") {
    await w.user.click(box());
    await w.user.paste(value);
  }
}

const column = (header: string) =>
  cellsInColumn(table()!, header).map((c) => c.textContent?.trim());

describe("opening", () => {
  it("opens on the first preset, with its lines read", async () => {
    await open();
    expect(preset()).toHaveValue("today");
    expect(box()).toHaveValue(TAI64N_PRESETS[0]!.lines.join("\n"));
    expect(column("UTC instant")[0]).toContain("2024-01-01T00:00:00Z");
    expect(selectedLine()).toBe(1);
  });

  it("opens on seeded lines and the line a permalink names", async () => {
    await open({ values: ACROSS.lines.join("\n"), line: "3" });
    expect(preset()).toHaveValue("across-2016");
    expect(selectedLine()).toBe(3);
  });

  it("has no accessibility violations", async () => {
    const w = await open();
    await expectNoAxeViolations(w.root);
  });
});

describe("typing", () => {
  it("switches the preset to Your values", async () => {
    const w = await open();
    await paste(w, "@40000000659200a500000000 x");
    expect(preset()).toHaveValue("custom");
    expect(column("UTC instant")).toEqual(["2024-01-01T00:00:00Z"]);
  });

  it("shows the empty state when the box is empty", async () => {
    const w = await open();
    await paste(w, "");
    expect(table()).toBeNull();
    expect(
      screen.getByText(/Paste log lines that start with a TAI64N label/),
    ).toBeInTheDocument();
  });

  it("shows NO SIGNAL when no line has a label", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "refused");
    expect(screen.getAllByText(NO_SIGNAL).length).toBeGreaterThan(0);
    expect(screen.getAllByText("no label")).toHaveLength(3);
    expect(screen.getByText(/No line starts with a label/)).toBeInTheDocument();
  });

  it("says the first twelve lines are read only past twelve lines", async () => {
    const w = await open();
    const hint = () => screen.queryByText(DROPPED_HINT);
    expect(hint()).toBeNull();
    await paste(
      w,
      Array.from({ length: 13 }, () => "@40000000659200a500000000 x").join(
        "\n",
      ),
    );
    expect(hint()).toBeInTheDocument();
    expect(box()).toHaveAccessibleDescription(DROPPED_HINT);
    await paste(w, "@40000000659200a500000000 x");
    expect(hint()).toBeNull();
    expect(box()).toHaveAccessibleDescription("");
    // The hint stays wired to the box while it says nothing: its paragraph is laid out, not
    // removed, so the table below never moves.
    expect(box()).toHaveAttribute("aria-describedby");
  });
});

describe("a preset", () => {
  it("opens across-2016 on its first labelled line, with the inserted second marked below", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "across-2016");
    expect(selectedLine()).toBe(1);
    expect(column("TAI − UTC")).toEqual(["36 s", "36 s", "37 s"]);
    expect(screen.getAllByText("inside an inserted second")).toHaveLength(1);
  });
});

describe("the paste box", () => {
  it("is as high as its lines, up to twelve", async () => {
    const w = await open();
    expect(box()).toHaveAttribute("rows", "3");
    await paste(
      w,
      Array.from({ length: 20 }, () => "@40000000659200a500000000 x").join(
        "\n",
      ),
    );
    expect(box()).toHaveAttribute("rows", "12");
    await paste(w, "@40000000659200a500000000 x");
    expect(box()).toHaveAttribute("rows", "2");
  });

  it("keeps the picked line while the list still has it", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "across-2016");
    await w.user.click(radio(3));
    await w.user.click(box());
    await w.user.keyboard("{Control>}{End}{/Control}!");
    expect(selectedLine()).toBe(3);
  });

  it("falls back to the first line when the picked line is gone", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "across-2016");
    await w.user.click(radio(3));
    await paste(w, "@40000000659200a500000000 only line");
    expect(selectedLine()).toBe(1);
  });
});

describe("hostile text", () => {
  it("is drawn as text in the table and the printed calls, and makes no element", async () => {
    const token = "</code><img/src=x/onerror=alert(1)>";
    const message = "</td><img src=x onerror=alert(2)>";
    const w = await open();
    await paste(w, `${token} ${message}`);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(token)).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Calls made" })).toHaveTextContent(
      token,
    );
    await expectNoAxeViolations(w.root);
  });
});

describe("selecting a line", () => {
  it("says a line can be picked, above the table", async () => {
    await open();
    expect(screen.getByText("Pick a line to see its details.")).toBeVisible();
  });

  it("picks a line from a click anywhere on its row", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "across-2016");
    await w.user.click(screen.getByText("first second of 2017"));
    expect(selectedLine()).toBe(3);
  });

  it("picks a line from the keyboard, with the focus kept on the radio", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "across-2016");
    radio(2).focus();
    await w.user.keyboard(" ");
    expect(selectedLine()).toBe(2);
    expect(radio(2)).toHaveFocus();
  });

  it("changes section 3 and keeps the hero plates' held sizers", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "across-2016");
    const before = heldSamples(w.root);
    const rowsBefore = column("UTC instant");
    await w.user.click(radio(3));
    expect(selectedLine()).toBe(3);
    expect(heldSamples(w.root)).toEqual(before);
    // The table keeps its rows; only the chosen line moved.
    expect(column("UTC instant")).toEqual(rowsBefore);
    expect(screen.getByRole("group", { name: "Calls made" })).toHaveTextContent(
      "40000000586846a500000000",
    );
    expect(screen.getByLabelText("What the calls returned")).toHaveTextContent(
      "2017-01-01T00:00:00Z",
    );
  });

  it("keeps focus on the radio", async () => {
    const w = await open();
    await w.user.click(radio(2));
    expect(radio(2)).toHaveFocus();
  });
});

describe("the writer", () => {
  it("writes a label from an instant and reads it back", async () => {
    const w = await open({
      values: "@40000000659200a500000000 x",
      instant: "2016-12-31T23:59:60Z",
    });
    expect(writer()).toHaveValue("2016-12-31T23:59:60Z");
    expect(
      screen.getAllByText("@40000000586846a400000000").length,
    ).toBeGreaterThan(0);
    await w.user.clear(writer());
    await w.user.type(writer(), "bad");
    expect(screen.getAllByText(NO_SIGNAL).length).toBeGreaterThan(0);
  });

  it("answers an empty box with NO SIGNAL on both plates, never a neutral blank", async () => {
    const w = await open({
      values: "@40000000659200a500000000 x",
      instant: "2016-12-31T23:59:60Z",
    });
    const before = screen.getAllByText(NO_SIGNAL).length;
    await w.user.clear(writer());
    expect(screen.getAllByText(NO_SIGNAL)).toHaveLength(before + 2);
    expect(screen.queryByText("no result")).not.toBeInTheDocument();
  });
});

describe("the permalink", () => {
  it("round-trips the lines, the line and the instant", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "across-2016");
    await w.user.click(radio(1));
    const url = w.permalink();
    expect(url).toMatch(
      new RegExp(`^${SITE_BASE}/tools/tai64n-log-reader/\\?w=tai64n&wa=`),
    );
    const state = {
      values: ACROSS.lines.join("\n"),
      line: "1",
      instant: "2024-01-01T00:00:00Z",
    };
    expect(url).toBe(encodeWidgetPermalink("tai64n", state));
    expect(seedFromLocation("tai64n", url.slice(url.indexOf("?")))).toEqual(
      state,
    );
  });
});
