/**
 * @vitest-environment jsdom
 *
 * The FHIR Date Checker end to end: template -> mount -> interact -> assert, against the real
 * `@northguild/gmt`, through roles and accessible names the way a person (or a screen reader)
 * meets the page. `renderWidget` owns each mount's `AbortController` and tears it down after the
 * test, so nothing here waits on a timer.
 */
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  cellsInColumn,
  expectNoAxeViolations,
  renderWidget,
} from "~/test/render-widget";
import { FHIR_PRESETS, fhirTexts } from "./fhir-date-checker";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showFhirDateChecker"] as AnyWidgetEntry;

/** preset id -> [verdict title, valid as date, dateTime, instant]. */
const EXPECTED: Record<string, [string, boolean, boolean, boolean]> = {
  month: ["A month", true, true, false],
  "second-offset": ["A moment to the second", false, true, true],
  "fraction-z": ["A moment to a fraction of a second", false, true, true],
  "feb-30": ["Not a FHIR value", false, false, false],
  "leap-2016": ["A moment to the second", false, true, true],
  "leap-2017": ["Not a FHIR value", false, false, false],
  "no-zone": ["Not a FHIR value", false, false, false],
  minute: ["Not a FHIR value", false, false, false],
  "wall-date": ["A moment to the second", false, true, true],
  "bracket-zone": ["Not a FHIR value", false, false, false],
};

const open = (args = {}, idPrefix = "test") =>
  renderWidget(entry, { args, idPrefix });

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const input = () =>
  screen.getByRole("textbox", {
    name: "FHIR value (date, dateTime or instant)",
  });
const section = (name: RegExp) => screen.getByRole("region", { name });
const types = () => section(/^2\. /);
const names = () => section(/^3\. /);
const back = () => section(/^4\. /);
const verdict = () => screen.getByRole("status", { name: "Verdict" });
const calls = () =>
  within(types()).queryByRole("group", { name: "Calls made" });
const output = () =>
  within(types()).getByRole("status", { name: "What the calls returned" });
const typeTable = () =>
  within(types()).getByRole("table", { name: "Each FHIR type, checked" });
const writer = () =>
  within(back()).getByRole("table", {
    name: "The value written back, at each precision",
  });
const why = (type: string) => screen.getByRole("note", { name: `Why ${type}` });
const stripNote = () =>
  screen.getByRole("note", { name: "What the value names" });
const writerNote = () =>
  screen.getByRole("note", { name: "About the written values" });

const text = (cells: HTMLElement[]) => cells.map((c) => c.textContent!.trim());
const validColumn = () =>
  text(cellsInColumn(typeTable(), "Valid")).map((t) => t === "Valid");
const shapeOnly = (type: number) =>
  within(cellsInColumn(typeTable(), "FHIR pattern")[type]!).queryAllByText(
    "shape only",
    { ignore: '[aria-hidden="true"], [aria-hidden="true"] *' },
  ).length > 0;

async function choose(w: Awaited<ReturnType<typeof open>>, id: string) {
  await w.user.selectOptions(preset(), id);
}
async function retype(
  w: Awaited<ReturnType<typeof open>>,
  box: HTMLElement,
  value: string,
) {
  await w.user.clear(box);
  if (value !== "") await w.user.type(box, value);
}

describe("renderFhirDateCheckerTemplate", () => {
  it("is a named region with four numbered sections and named controls", async () => {
    await open();
    expect(
      screen.getByRole("region", { name: "FHIR Date Checker" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent),
    ).toEqual([
      "1. Type a FHIR value",
      "2. What each type says",
      "3. What the value names",
      "4. Written back by formatFHIR",
    ]);
    expect(preset()).toBeInTheDocument();
    expect(input()).toBeInTheDocument();
  });

  it("opens on the first preset", async () => {
    const w = await open();
    expect(input()).toHaveValue("2024-06");
    expect(verdict()).toHaveTextContent("A month");
    await expectNoAxeViolations(w.root);
  });

  it("does not run a hostile seed", async () => {
    await open({ value: '"><img src=x onerror=alert(1)>' });
    expect(input()).toHaveValue('"><img src=x onerror=alert(1)>');
    expect(output()).toHaveTextContent("NO SIGNAL");
  });
});

describe("every preset, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      FHIR_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(FHIR_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const w = await open();
    await choose(w, id!);
    const [title, ...valids] = EXPECTED[id!]!;
    expect(verdict()).toHaveTextContent(title);
    expect(validColumn()).toEqual(valids);
    expect(calls()).toHaveTextContent("parseFHIR(");
    await expectNoAxeViolations(w.root);
  });
});

describe("the type table", () => {
  it("marks a shape-only match for a day that does not exist, on date and dateTime", async () => {
    const w = await open();
    await choose(w, "feb-30");
    expect([shapeOnly(0), shapeOnly(1), shapeOnly(2)]).toEqual([
      true,
      true,
      false,
    ]);
    expect(why("date")).toHaveTextContent("that day does not exist");
    expect(why("instant")).toHaveTextContent("does not match");
    expect(output()).toHaveTextContent("NO SIGNAL");
    await expectNoAxeViolations(w.root);
  });

  it("says a month is not an instant, and why", async () => {
    await open();
    expect(why("instant")).toHaveTextContent(
      "A month value. instant takes a second or a fraction.",
    );
    expect(why("date")).toHaveTextContent("Valid.");
  });

  it("explains a leap second that was not inserted", async () => {
    const w = await open();
    await choose(w, "leap-2017");
    expect(why("dateTime")).toHaveTextContent("no leap second was inserted");
    await expectNoAxeViolations(w.root);
  });
});

describe("what the value names", () => {
  it("draws a month as a span with nothing padded", async () => {
    const w = await open();
    expect(stripNote()).toHaveTextContent(
      "FHIR keeps the precision. Nothing is padded.",
    );
    expect(names()).toHaveTextContent("2024-06-01 to 2024-06-30");
    await expectNoAxeViolations(w.root);
  });

  it("draws a moment as one instant", async () => {
    const w = await open();
    await choose(w, "second-offset");
    expect(stripNote()).toHaveTextContent("names one instant");
    await expectNoAxeViolations(w.root);
  });

  it("says an inserted leap second has no instant of its own", async () => {
    const w = await open();
    await choose(w, "leap-2016");
    expect(names()).toHaveTextContent("no instant of its own");
  });
});

describe("the writer grid", () => {
  it("writes six rows by three types, and a precision a type refuses is no result", async () => {
    const w = await open();
    expect(text(cellsInColumn(writer(), "Precision"))).toEqual([
      "Default (no precision)",
      "year",
      "month",
      "day",
      "second",
      "fraction",
    ]);
    const date = text(cellsInColumn(writer(), "date")).map((t) => t);
    expect(date.slice(0, 4)).toEqual([
      "2024-06",
      "2024",
      "2024-06",
      "no result",
    ]);
    expect(text(cellsInColumn(writer(), "instant"))[0]).toBe("no result");
    expect(writerNote()).toHaveTextContent("formatFHIR(");
    await expectNoAxeViolations(w.root);
  });

  it("fills only year to day for a time to the minute, and nothing for a leap second", async () => {
    const w = await open();
    await choose(w, "minute");
    for (const type of ["date", "dateTime"]) {
      const col = text(cellsInColumn(writer(), type));
      expect(col.slice(1, 4)).toEqual(["2024", "2024-06", "2024-06-15"]);
      expect(col.slice(4)).toEqual(["no result", "no result"]);
    }
    await choose(w, "leap-2016");
    for (const type of ["date", "dateTime", "instant"]) {
      expect(new Set(text(cellsInColumn(writer(), type)))).toEqual(
        new Set(["no result"]),
      );
    }
    await expectNoAxeViolations(w.root);
  });

  it("keeps -00:00", async () => {
    const w = await open();
    await retype(w, input(), "2024-06-15T10:30:00-00:00");
    expect(text(cellsInColumn(writer(), "dateTime"))[0]).toContain("-00:00");
    await expectNoAxeViolations(w.root);
  });
});

describe("the blank form", () => {
  it("makes no call and says nothing to read, never amber", async () => {
    const w = await open();
    await retype(w, input(), "");
    expect(output()).toHaveTextContent("nothing to read");
    expect(output()).not.toHaveTextContent("NO SIGNAL");
    expect(calls()).not.toBeInTheDocument();
    expect(verdict()).toHaveTextContent("Nothing to read");
    expect(writerNote()).toHaveTextContent("Type a value to write it back.");
    expect(validColumn()).toEqual([false, false, false]);
    await expectNoAxeViolations(w.root);
  });

  it("goes from blank to a refused value to a result and back", async () => {
    const w = await open();
    await retype(w, input(), "");
    await retype(w, input(), "2024-02-30");
    expect(output()).toHaveTextContent("NO SIGNAL");
    await retype(w, input(), "2024-02-29");
    expect(verdict()).toHaveTextContent("A day");
    await retype(w, input(), "");
    expect(output()).toHaveTextContent("nothing to read");
    await expectNoAxeViolations(w.root);
  });
});

describe("seeding and permalinks", () => {
  it("seeds a named preset", async () => {
    await open({ preset: "feb-30" });
    expect(preset()).toHaveValue("feb-30");
    expect(verdict()).toHaveTextContent("Not a FHIR value");
  });

  it.each(FHIR_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of strings",
    async (id) => {
      const first = await open();
      await choose(first, id!);
      const url = first.permalink();
      expect(url).toMatch(/\?w=fhir&wa=[^)"'\s]+$/);
      const state = seedFromLocation(
        "fhir",
        url.slice(url.indexOf("?")),
      ) as Record<string, unknown>;
      expect(encodeWidgetPermalink("fhir", state)).toBe(url);
      first.destroy();

      await open(state, "second");
      expect(preset()).toHaveValue(id);
    },
  );

  it("carries a custom value untrimmed", async () => {
    const w = await open();
    await retype(w, input(), "2024-06-15 ");
    const url = w.permalink();
    expect(seedFromLocation("fhir", url.slice(url.indexOf("?")))).toMatchObject(
      {
        value: "2024-06-15 ",
      },
    );
  });
});

describe("naming", () => {
  it("never calls the library GMT or shows null", async () => {
    const w = await open();
    for (const p of FHIR_PRESETS) {
      await choose(w, p.id);
      expect(w.root).not.toHaveTextContent(/GMT|\bnull\b/);
    }
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert, and destroying twice is safe", async () => {
    const w = await renderWidget(entry, { args: {}, aborted: true });
    expect(verdict()).toBeEmptyDOMElement();
    expect(() => {
      w.destroy();
      w.destroy();
    }).not.toThrow();
  });
});

describe("holds still", () => {
  const norm = (t: string | null) => (t ?? "").replace(/\s+/g, " ").trim();
  const ghosts = (region: HTMLElement, sample: string) =>
    within(region).queryAllByText(
      (_, el) =>
        el?.getAttribute("aria-hidden") === "true" &&
        norm(el.textContent).includes(norm(sample)),
    );

  it("holds every text a region can show, in every preset", async () => {
    const t = fhirTexts();
    const w = await open();
    const all: [() => HTMLElement, string][] = [
      ...t.reasons.map((s): [() => HTMLElement, string] => [types, s]),
      ...t.verdicts.map((s): [() => HTMLElement, string] => [types, s]),
      ...t.stripNotes.map((s): [() => HTMLElement, string] => [names, s]),
      [types, t.parseCall],
      [types, t.parseOutput],
    ];
    const count = () => all.map(([r, s]) => ghosts(r(), s).length);
    const before = count();
    for (const p of FHIR_PRESETS) {
      await choose(w, p.id);
      expect(count(), p.id).toEqual(before);
    }
    for (const n of before) expect(n).toBeGreaterThan(0);
  });
});
