/**
 * @vitest-environment jsdom
 *
 * The Converter Bench end to end: template, mount, interact, assert, against the real
 * `@northguild/gmt`, through roles and accessible names the way a reader meets the page.
 */
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import { expectNoAxeViolations, renderWidget } from "~/test/render-widget";
import { mountConverterBench } from "./converter-bench-mount";
import { WidgetLoadError } from "./widget-mount";

installJsdomShims();

const entry = WIDGET_REGISTRY["showConverterBench"] as AnyWidgetEntry;

const open = (args: Record<string, unknown> = {}, idPrefix = "test") =>
  renderWidget(entry, { args, idPrefix });

const zones = () =>
  within(screen.getByRole("region", { name: "Zone conversion" }));
const bench = () =>
  within(screen.getByRole("region", { name: "Format bench" }));
const tester = () =>
  within(screen.getByRole("region", { name: "Regex tester" }));

const from = () => zones().getByRole("combobox", { name: "From" });
const to = () => zones().getByRole("combobox", { name: "To" });
const locale = () => bench().getByRole("combobox", { name: "Locale" });
const converted = () => screen.getByLabelText("Converted value");
const regexList = () => tester().getByRole("list", { name: "Regex results" });
const matches = () =>
  within(regexList())
    .getAllByRole("listitem")
    .filter((li) => /· match/.test(li.textContent ?? ""));

describe("the template", () => {
  it("is a named region with three sections and every control named", async () => {
    await open();
    expect(
      screen.getByRole("region", { name: "Converter Bench" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent),
    ).toEqual(["Zone conversion", "Format bench", "Regex tester"]);
    expect(zones().getByRole("textbox", { name: "Input" })).toBeInTheDocument();
    expect(bench().getByRole("textbox", { name: "Input" })).toBeInTheDocument();
    expect(
      tester().getByRole("textbox", { name: "Input" }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it("opens on the London to Sydney pair in regionless English", async () => {
    await open();
    expect(from()).toHaveValue("Europe/London");
    expect(to()).toHaveValue("Australia/Sydney");
    expect(locale()).toHaveValue("en");
    expect(zones().getByRole("textbox", { name: "Input" })).toHaveValue(
      "2024-03-15T14:30:00.000+00:00[Europe/London]",
    );
  });

  it("paints seeded arguments rather than defaults", async () => {
    await open({ from: "Asia/Tokyo", to: "Europe/Paris", locale: "fr-FR" });
    expect(from()).toHaveValue("Asia/Tokyo");
    expect(to()).toHaveValue("Europe/Paris");
    expect(locale()).toHaveValue("fr-FR");
  });

  it("appends a seeded zone the curated list does not contain", async () => {
    await open({ to: "Pacific/Chatham" });
    expect(to()).toHaveValue("Pacific/Chatham");
    expect(
      within(to()).getByRole("option", { name: "Pacific/Chatham" }),
    ).toBeInTheDocument();
  });

  it("gives two copies on one page their own ids", async () => {
    await open({}, "one");
    await open({}, "two");
    expect(screen.getAllByRole("combobox", { name: "From" })).toHaveLength(2);
    expect(
      screen.getAllByRole("region", { name: "Converter Bench" }),
    ).toHaveLength(2);
  });
});

describe("the mount", () => {
  it("converts on mount, into the real library", async () => {
    await open();
    // 14:30 in London (GMT in March); Sydney is on daylight time, eleven hours ahead.
    expect(converted()).toHaveTextContent("2024-03-16T01:30:00+11:00");
    expect(converted()).toHaveTextContent("Australia/Sydney");
    await expectNoAxeViolations(document.body);
  });

  it("reconverts when the target zone changes", async () => {
    const w = await open();
    await w.user.selectOptions(to(), "Asia/Tokyo");
    expect(converted()).toHaveTextContent("Asia/Tokyo");
    await expectNoAxeViolations(document.body);
  });

  it("shows NO SIGNAL for an input the library refuses, and not a blank box", async () => {
    const w = await open();
    const input = zones().getByRole("textbox", { name: "Input" });
    await w.user.clear(input);
    await w.user.paste("not a date");
    expect(converted()).toHaveTextContent("NO SIGNAL");
    await expectNoAxeViolations(document.body);
  });

  it("writes the call each format output answers, and what it returned", async () => {
    await open();
    const parts = screen.getByRole("group", {
      name: "formatZonedToParts call",
    });
    expect(parts).toHaveTextContent(/formatZonedToParts\("2024-03-15/);
    expect(
      screen.getByRole("group", { name: "formatRelativeZoned call" }),
    ).toHaveTextContent("formatRelativeZoned");
    expect(screen.getByLabelText("Format parts")).toHaveTextContent('"type"');
    expect(screen.getByLabelText("Relative format")).not.toBeEmptyDOMElement();
  });

  it("reformats in the locale the reader picks", async () => {
    const w = await open();
    await w.user.selectOptions(locale(), "fr-FR");
    expect(
      screen.getByRole("group", { name: "formatZonedToParts call" }),
    ).toHaveTextContent('"fr-FR"');
    await expectNoAxeViolations(document.body);
  });

  it("renders a regex chip per exported pattern, marking matches in words", async () => {
    await open();
    expect(within(regexList()).getAllByRole("listitem").length).toBeGreaterThan(
      10,
    );
    expect(matches().length).toBeGreaterThan(0);
  });

  it("re-tests the regexes as the input changes", async () => {
    const w = await open();
    const before = matches().length;
    const input = tester().getByRole("textbox", { name: "Input" });
    await w.user.clear(input);
    await w.user.paste("not a date at all");
    expect(matches().length).toBeLessThan(before);
    await expectNoAxeViolations(document.body);
  });

  it("reports its live state for a permalink, not the seeded state", async () => {
    const w = await open();
    await w.user.selectOptions(to(), "Asia/Tokyo");
    expect(new URL(w.permalink(), "https://x.test").search).toContain("Tokyo");
  });

  it("shows the zones a link or a call names, not the first of the list", async () => {
    await open({ from: "America/Nuuk", to: "Australia/Lord_Howe" });
    expect(from()).toHaveValue("America/Nuuk");
    expect(to()).toHaveValue("Australia/Lord_Howe");
  });

  it("offers a locale a link names", async () => {
    await open({ locale: "xx-XX" });
    expect(locale()).toHaveValue("xx-XX");
  });
});

describe("the lifecycle", () => {
  it("returns an inert handle when the mount is already aborted", async () => {
    const w = await renderWidget(entry, { args: {}, aborted: true });
    expect(() => w.destroy()).not.toThrow();
  });

  it("survives destroy being called twice", async () => {
    const w = await open();
    w.destroy();
    expect(() => w.destroy()).not.toThrow();
  });

  it("throws a WidgetLoadError when the template is broken", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    await expect(
      mountConverterBench(root, {}, new AbortController().signal),
    ).rejects.toBeInstanceOf(WidgetLoadError);
    root.remove();
  });
});

describe("escaping", () => {
  it("neutralises a quote that would otherwise close an attribute", async () => {
    await open({ value: `" autofocus onfocus="alert(1)` });
    const input = zones().getByRole("textbox", { name: "Input" });
    // The mount normalises the text; the payload survives as text in the value.
    expect((input as HTMLInputElement).value).toContain(
      `" autofocus onfocus="alert(1)`,
    );
    expect(input).not.toHaveAttribute("onfocus");
    expect(input).not.toHaveAttribute("autofocus");
  });

  it("neutralises a tag injected through a zone name", async () => {
    await open({ to: "<script>alert(1)</script>" });
    expect(
      within(to()).getByRole("option", { name: "<script>alert(1)</script>" }),
    ).toBeInTheDocument();
  });
});
