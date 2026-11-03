/**
 * @vitest-environment jsdom
 *
 * The Database Timestamp Reader end to end against the real `@northguild/gmt`, through roles and
 * accessible names the way a person (or a screen reader) meets the page.
 */
import { screen, within } from "@testing-library/dom";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import { loadDatabaseLib } from "./database-lib";
import { DB_PRESETS, formOf } from "./database-timestamp-forms";
import { readDb } from "./database-timestamp-reader";
import {
  CUSTOM_PRESET_ID,
  matchPreset,
  mountDatabaseTimestampReader,
  permalinkOf,
  presetState,
  readArgs,
  RESERVED_LINES,
  renderDatabaseTimestampReaderTemplate,
} from "./database-timestamp-reader-mount";

installJsdomShims();

const entry = {
  renderTemplate: renderDatabaseTimestampReaderTemplate,
  mount: mountDatabaseTimestampReader,
} as never;

const open = (args: Record<string, unknown> = {}) =>
  renderWidget(entry, { args });

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const database = () => screen.getByRole("combobox", { name: "Database" });
const form = () => screen.getByRole("combobox", { name: "Form" });
const plate = () => screen.getByRole("status", { name: "Reading" });
const output = () => screen.getByLabelText("What the calls returned");
const calls = () => screen.getByRole("group", { name: "Calls made" });

/** Replaces what a text box holds, in one input event. */
async function enter(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") await w.user.paste(value);
}

const NO_SIGNAL = /NO SIGNAL/;

describe("the Database Timestamp Reader", () => {
  it("opens on the first preset and prints the call it made", async () => {
    await open();
    expect(plate()).toHaveTextContent("2024-03-15");
    expect(calls()).toHaveTextContent("parseSqlOffsetDateTime(v)");
    expect(output()).toHaveTextContent("2024-03-15");
    expect(plate()).not.toHaveTextContent(NO_SIGNAL);
  });

  it("lists the forms of the chosen database and reads the first preset of one", async () => {
    const w = await open();
    await w.user.selectOptions(database(), "MongoDB");
    expect(
      within(form())
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toHaveLength(3);
    expect(calls()).toHaveTextContent("convertUnixToUtc(v)");
    expect(plate()).toHaveTextContent("2024-03-15T14:30:00.123Z");
  });

  it("reads what is typed", async () => {
    const w = await open();
    await w.user.selectOptions(database(), "DynamoDB");
    await enter(w, screen.getByRole("textbox", { name: "Seconds" }), "86400");
    expect(plate()).toHaveTextContent("1970-01-02");
    expect(preset()).toHaveValue(CUSTOM_PRESET_ID);
  });

  it("shows NO SIGNAL only when the call returned its sentinel", async () => {
    const w = await open();
    await enter(
      w,
      screen.getByRole("textbox", { name: "Column text" }),
      "nope",
    );
    expect(plate()).toHaveTextContent(NO_SIGNAL);
    expect(output()).toHaveTextContent("NO SIGNAL");
  });

  it("names a field that is not a number instead of calling", async () => {
    const w = await open();
    await w.user.selectOptions(database(), "MongoDB");
    await enter(
      w,
      screen.getByRole("textbox", { name: "Milliseconds" }),
      "abc",
    );
    expect(screen.getByText("Not a number")).toBeInTheDocument();
    expect(plate()).not.toHaveTextContent(NO_SIGNAL);
  });

  it("answers a validator's false in words, not as a lost signal", async () => {
    const w = await open();
    await w.user.selectOptions(database(), "MongoDB");
    await w.user.selectOptions(form(), formOf("mongodb-extended-json")!.id);
    await enter(
      w,
      screen.getByRole("textbox", { name: /text/i }),
      "not a date",
    );
    expect(plate()).toHaveTextContent("false");
    expect(plate()).not.toHaveTextContent(NO_SIGNAL);
  });

  it("asks for the session zone of a MySQL TIMESTAMP and names an unknown one", async () => {
    const w = await open();
    await w.user.selectOptions(database(), "MySQL");
    await w.user.selectOptions(form(), "mysql-timestamp");
    const zone = screen.getByRole("textbox", { name: "Session time zone" });
    await enter(w, zone, "Mars/Olympus_Mons");
    expect(screen.getByText(/is not a time zone/)).toBeInTheDocument();
    await enter(w, zone, "Europe/Stockholm");
    expect(calls()).toHaveTextContent("Europe/Stockholm");
  });

  it("shows the two ISO readers, each with what it returned, on a new form", async () => {
    await open({ preset: "postgresql-timestamptz-half-hour" });
    const iso = screen.getByRole("group", { name: "ISO reader calls" });
    expect(iso).toHaveTextContent("toOffsetInstant");
    expect(iso).toHaveTextContent("parseRfc3339");
    const returned = screen.getByLabelText("What the ISO readers returned");
    expect(returned).toHaveTextContent("2024-03-15T14:30:00+05:30[+05:30]");
    expect(returned).toHaveTextContent("null");
    expect(returned).not.toHaveTextContent(NO_SIGNAL);
    expect(calls()).not.toHaveTextContent("parseRfc3339");
  });

  it("hides the ISO readers on a form that is not new", async () => {
    await open({ preset: "sqlite-unixepoch" });
    expect(
      screen.queryByRole("group", { name: "ISO reader calls" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "What the ISO readers returned" }),
    ).not.toBeInTheDocument();
  });

  it("names the kind of the form in words", async () => {
    const w = await open();
    expect(screen.getByText("new in this release")).toBeInTheDocument();
    await w.user.selectOptions(database(), "MongoDB");
    expect(screen.getByText("export")).toBeInTheDocument();
    expect(screen.queryByText("new in this release")).not.toBeInTheDocument();
  });

  it("shows the offset plate only for a reading that split an offset", async () => {
    const w = await open();
    const terms = () => screen.queryAllByRole("term").map((t) => t.textContent);
    expect(terms()).toContain("Offset");
    await w.user.selectOptions(database(), "MongoDB");
    expect(terms()).not.toContain("Offset");
  });

  it("shows the zone field on MySQL TIMESTAMP alone", async () => {
    const w = await open();
    const zoneBox = () =>
      screen.queryByRole("textbox", { name: "Session time zone" });
    await w.user.selectOptions(database(), "MySQL");
    await w.user.selectOptions(form(), "mysql-timestamp");
    expect(zoneBox()).toBeInTheDocument();
    await w.user.selectOptions(form(), "mysql-datetime");
    expect(zoneBox()).not.toBeInTheDocument();
  });

  it("links the forms that live elsewhere and the tools beside this one", async () => {
    await open();
    const elsewhere = screen.getAllByRole("link", { name: /^[A-Za-z ,]+: / });
    expect(elsewhere.length).toBeGreaterThan(0);
    for (const link of elsewhere) expect(link).toHaveAttribute("href");
    const tools = within(screen.getByRole("group", { name: "Other tools" }));
    for (const name of [
      "Databases guide",
      "ID Timestamp Decoder",
      "Foreign Epoch Bridges",
    ]) {
      expect(tools.getByRole("link", { name })).toHaveAttribute("href");
    }
  });

  it("prints exactly the calls the reader made, for every preset", async () => {
    const lib = await loadDatabaseLib();
    const flat = (text: string) => text.replace(/\s+/g, " ");
    for (const p of DB_PRESETS) {
      const reading = readDb(lib, p.form, p.values, p.zone ?? "");
      const w = await open({ preset: p.id });
      expect(plate()).toBeInTheDocument();
      expect(calls()).toHaveTextContent(
        flat(reading.calls.map((c) => c.code).join(" ")),
      );
      if (reading.ok) {
        expect(output()).toHaveTextContent(
          flat(reading.calls.map((c) => c.returned).join(" ")),
        );
      }
      w.destroy();
    }
  });

  it("reserves the room of the longest reading for every preset", async () => {
    const lib = await loadDatabaseLib();
    const lines = (list: readonly { code: string }[]) =>
      list
        .map((c) => c.code)
        .join("\n")
        .split("\n").length;
    for (const p of DB_PRESETS) {
      const reading = readDb(lib, p.form, p.values, p.zone ?? "");
      expect(lines(reading.calls)).toBeLessThanOrEqual(RESERVED_LINES.calls);
      expect(reading.calls.length).toBeLessThanOrEqual(RESERVED_LINES.output);
      expect(lines(reading.iso ?? [])).toBeLessThanOrEqual(RESERVED_LINES.iso);
      expect((reading.iso ?? []).length).toBeLessThanOrEqual(
        RESERVED_LINES.isoOutput,
      );
    }
  });

  it("keeps every part in the page for every form, and only hides the ones it does not use", async () => {
    const w = await open();
    const parts = () => ({
      boxes: screen.getAllByRole("textbox", { hidden: true }).length,
      main: screen.queryAllByRole("group", { name: "Calls made", hidden: true })
        .length,
      iso: screen.queryAllByRole("group", {
        name: "ISO reader calls",
        hidden: true,
      }).length,
      offset: screen.queryAllByText("Offset").length,
    });
    const first = parts();
    expect(first).toEqual({ boxes: 4, main: 1, iso: 1, offset: 1 });
    for (const [db, id] of [
      ["MySQL", "mysql-timestamp"],
      ["MongoDB", "mongodb-extended-json"],
      ["Oracle", "oracle-timestamptz"],
    ] as const) {
      await w.user.selectOptions(database(), db);
      await w.user.selectOptions(form(), id);
      expect(parts()).toEqual(first);
    }
  });

  it("has no accessibility violations", async () => {
    const w = await open();
    await expectNoAxeViolations(w.root);
  });

  it("is seeded by a preset or by a form with its fields", async () => {
    await open({ form: "sqlite-unixepoch", value: "0" });
    expect(plate()).toHaveTextContent("1970-01-01");
  });
});

describe("the permalink", () => {
  it("is the preset alone when the state is exactly a preset", () => {
    const p = DB_PRESETS[3]!;
    expect(permalinkOf(presetState(p))).toEqual({ preset: p.id });
  });

  it("carries the form, every field and the zone when the values are the reader's own", () => {
    const state = {
      formId: "mysql-timestamp",
      values: ["2024-03-15 14:30:00"],
      zone: "Asia/Tokyo",
    };
    expect(matchPreset(state)).toBe(CUSTOM_PRESET_ID);
    const link = permalinkOf(state);
    expect(link).toEqual({
      form: "mysql-timestamp",
      value: "2024-03-15 14:30:00",
      zone: "Asia/Tokyo",
    });
    expect(readArgs(link)).toEqual({ ...state, values: state.values });
  });

  it("brings a cleared field back cleared", () => {
    const link = permalinkOf({
      formId: "sqlite-unixepoch",
      values: [""],
      zone: "",
    });
    expect(readArgs(link).values).toEqual([""]);
  });

  it("never lends a preset's session zone to a value the seed names without one", () => {
    const first = DB_PRESETS.find((p) => p.form === "mysql-timestamp")!;
    expect(readArgs({ form: "mysql-timestamp" }).zone).toBe(first.zone);
    const state = readArgs({
      form: "mysql-timestamp",
      value: "2024-06-01 08:00:00",
    });
    expect(state).toEqual({
      formId: "mysql-timestamp",
      values: ["2024-06-01 08:00:00"],
      zone: "",
    });
    expect(readArgs(permalinkOf(state))).toEqual(state);
  });

  it("falls back to the first preset for a form it does not know", () => {
    expect(readArgs({ form: "no-such-form" })).toEqual(
      presetState(DB_PRESETS[0]!),
    );
  });
});
