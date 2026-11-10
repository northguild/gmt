/**
 * @vitest-environment jsdom
 *
 * The HL7 Timestamp Reader end to end: template -> mount -> interact -> assert, against the real
 * `@northguild/gmt`, through roles and accessible names the way a person (or a screen reader)
 * meets the page.
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
  type RenderedWidget,
} from "~/test/render-widget";
import { HL7_PRESETS, hl7Texts, presetState } from "./hl7-timestamp-reader";
import { encodeWidgetPermalink, seedFromLocation } from "./widget-permalink";

installJsdomShims();

const entry = WIDGET_REGISTRY["showHl7TimestampReader"] as AnyWidgetEntry;

/** preset id → [verdict, what the call returned (the head of it)]. */
const EXPECTED: Record<string, [string, string]> = {
  "no-offset": ["No offset: the sender's local time", '"local"'],
  offset: ["Offset stated", '"instant"'],
  "minus-zero": ["Offset stated", '"+00:00"'],
  fraction: ["Offset stated", '"2024-06-15T10:30:45.1234Z"'],
  "fall-back": ["No offset: the sender's local time", '"local"'],
  "spring-forward": ["No offset: the sender's local time", '"local"'],
  midnight: ["No offset: the sender's local time", '"local"'],
  "ts-month": ["A span, not a moment", '"partial"'],
  "ts-day": ["A span, not a moment", '"partial"'],
  "ts-finer": ["", "NO SIGNAL"],
  "birth-year": ["A span, not a moment", '"partial"'],
  "null-value": ["The HL7 null value", '"null"'],
  "five-digits": ["", "NO SIGNAL"],
};

const open = (args = {}, idPrefix = "test") =>
  renderWidget(entry, { args, idPrefix });

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const input = () =>
  screen.getByRole("textbox", { name: "HL7 value (DTM or TS)" });
const zone = (n: number) => screen.getByRole("combobox", { name: `Zone ${n}` });
const section = (name: RegExp) => screen.getByRole("region", { name });
const states = () => section(/^2\. /);
const lands = () => section(/^3\. /);
const back = () => section(/^4\. /);
const verdict = () => screen.getByRole("status", { name: "Verdict" });
const parseOutput = () =>
  within(states()).getByRole("status", { name: "What the call returned" });
const parseCall = () =>
  within(states()).queryByRole("group", { name: "Call made" });
const reason = () => within(states()).queryByRole("complementary");
const stripNote = () =>
  screen.getByRole("note", { name: "Where a value with no offset lands" });
const gap = () => screen.getByRole("status", { name: "Widest gap" });
const strip = () => screen.getByRole("table", { name: /four zones/ });
const column = (name: string | RegExp) =>
  cellsInColumn(strip(), name).map((c) => c.textContent!.trim());
const ladder = () =>
  within(back()).getByRole("table", {
    name: "The value written at each precision",
  });
const ladderNote = () =>
  screen.getByRole("note", { name: "About the written values" });

async function choose(w: RenderedWidget, id: string) {
  await w.user.selectOptions(preset(), id);
}
async function retype(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") await w.user.type(box, value);
}

describe("renderHl7TimestampReaderTemplate", () => {
  it("is a named region with four numbered sections and named controls", async () => {
    await open();
    expect(
      screen.getByRole("region", { name: "HL7 Timestamp Reader" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent),
    ).toEqual([
      "1. Type an HL7 date-time",
      "2. What the value states",
      "3. Where a value with no offset lands",
      "4. Written back by formatHL7",
    ]);
    for (const c of [preset(), input(), zone(1), zone(4)]) {
      expect(c).toBeInTheDocument();
    }
  });

  it("does not run a hostile seed", async () => {
    await open({
      value: '"><img src=x onerror=alert(1)>',
      zone1: '"><script>x</script>',
    });
    expect(input()).toHaveValue('"><img src=x onerror=alert(1)>');
    expect(parseOutput()).toHaveTextContent("NO SIGNAL");
  });
});

describe("every preset, against the real library", () => {
  it("has an expectation for every preset", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(
      HL7_PRESETS.map((p) => p.id).sort(),
    );
  });

  it.each(HL7_PRESETS.map((p) => [p.id]))("%s", async (id) => {
    const w = await open();
    await choose(w, id!);
    const [verdictWords, returned] = EXPECTED[id!]!;
    expect(input()).toHaveValue(
      presetState(HL7_PRESETS.find((p) => p.id === id)!).value,
    );
    expect(verdict()).toHaveTextContent(
      verdictWords === "" ? /^$/ : verdictWords,
    );
    expect(parseOutput()).toHaveTextContent(returned);
    expect(parseCall()).toHaveTextContent("parseHL7(");
    if (returned === "NO SIGNAL") expect(reason()).toBeInTheDocument();
    else expect(reason()).not.toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("explains a refused value without blaming a blank", async () => {
    const w = await open();
    await choose(w, "five-digits");
    expect(parseOutput()).toHaveTextContent("NO SIGNAL");
    expect(reason()).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });
});

describe("the strip", () => {
  it("opens on the starter: Kolkata is 5 h 30 min before the same digits read as UTC", async () => {
    const w = await open({ value: "20240615103000", zone1: "Asia/Kolkata" });
    expect(column("Instant")[0]).toBe("2024-06-15T05:00:00Z");
    expect(column("Read as UTC")[0]).toBe("5 h 30 min later");
    await expectNoAxeViolations(w.root);
  });

  it("reads the first preset in its example zones and names the widest gap", async () => {
    const w = await open();
    expect(column("Instant")[0]).toBe("2024-06-15T05:00:00Z");
    expect(gap()).toHaveTextContent("Widest gap:");
    await expectNoAxeViolations(w.root);
  });

  it("changes a row when its zone changes, and leaves the preset for Custom", async () => {
    const w = await open();
    await w.user.selectOptions(zone(3), "Asia/Tokyo");
    expect(column("Instant")[2]).toBe("2024-06-15T01:30:00Z");
    expect(preset()).toHaveValue("custom");
    await expectNoAxeViolations(w.root);
  });

  it("says no zone chosen for a blank slot", async () => {
    await open();
    expect(column("Instant")[3]).toBe("no zone chosen");
  });

  it("disables the zone selects when the value states its offset", async () => {
    const w = await open();
    await choose(w, "offset");
    for (const n of [1, 2, 3, 4]) expect(zone(n)).toBeDisabled();
    expect(stripNote()).toHaveTextContent(
      "The value states its offset, so there is nothing to choose.",
    );
    await expectNoAxeViolations(w.root);
  });

  it("applies no zone to a span", async () => {
    const w = await open();
    await choose(w, "ts-month");
    for (const n of [1, 2, 3, 4]) expect(zone(n)).toBeDisabled();
    expect(stripNote()).toHaveTextContent("A span has no instant");
    await expectNoAxeViolations(w.root);
  });

  it("never fills a zone from the value typed", async () => {
    const w = await open();
    for (const n of [1, 2, 3, 4]) await w.user.selectOptions(zone(n), "");
    await retype(w, input(), "20240615103000");
    for (const n of [1, 2, 3, 4]) expect(zone(n)).toHaveValue("");
    await expectNoAxeViolations(w.root);
  });

  it("refuses a time the clock shows twice, with its reason, in the zone that shows it", async () => {
    const w = await open();
    await choose(w, "fall-back");
    expect(zone(1)).toHaveValue("Europe/London");
    expect(column("Instant")[0]).toBe("NO SIGNAL");
    expect(column("Instant")[1]).toBe("2024-10-26T16:30:00Z");
    expect(
      within(lands()).getAllByRole("complementary").length,
    ).toBeGreaterThan(0);
    await expectNoAxeViolations(w.root);
  });
});

describe("the writer ladder", () => {
  it("writes seven precisions, and a finer one than the value carries is no result", async () => {
    const w = await open();
    expect(
      cellsInColumn(ladder(), "Precision").map((c) => c.textContent),
    ).toEqual(["year", "month", "day", "hour", "minute", "second", "fraction"]);
    const sent = cellsInColumn(ladder(), "As sent").map((c) =>
      c.textContent!.trim(),
    );
    expect(sent[0]).toBe("2024");
    expect(sent[5]).toBe("20240615103000");
    expect(sent[6]).toBe("no result");
    expect(ladderNote()).toHaveTextContent("formatHL7");
    await expectNoAxeViolations(w.root);
  });

  it("says nothing to write for a blank field", async () => {
    const w = await open();
    await retype(w, input(), "");
    expect(ladderNote()).toHaveTextContent(
      "Nothing to write: there is no value.",
    );
    await expectNoAxeViolations(w.root);
  });
});

describe("the blank form", () => {
  it("makes no call and says nothing to read, never amber", async () => {
    const w = await open();
    await retype(w, input(), "");
    expect(parseOutput()).toHaveTextContent("nothing to read");
    expect(parseOutput()).not.toHaveTextContent("NO SIGNAL");
    expect(parseCall()).not.toBeInTheDocument();
    expect(reason()).not.toBeInTheDocument();
    expect(verdict()).toHaveTextContent(/^$/);
    expect(stripNote()).toHaveTextContent("No value to place.");
    await expectNoAxeViolations(w.root);
  });

  it("goes from blank to a refused value to a result and back", async () => {
    const w = await open();
    await retype(w, input(), "");
    await retype(w, input(), "2024061510300");
    expect(parseOutput()).toHaveTextContent("NO SIGNAL");
    await retype(w, input(), "20240615103000+0200");
    expect(verdict()).toHaveTextContent("Offset stated");
    await retype(w, input(), "");
    expect(parseOutput()).toHaveTextContent("nothing to read");
    await expectNoAxeViolations(w.root);
  });
});

describe("seeding and permalinks", () => {
  it("seeds a named preset", async () => {
    await open({ preset: "ts-month" });
    expect(preset()).toHaveValue("ts-month");
    expect(verdict()).toHaveTextContent("A span, not a moment");
  });

  it("seeds an unlisted zone without dropping it", async () => {
    await open({ value: "20240615103000", zone1: "Pacific/Auckland" });
    expect(zone(1)).toHaveValue("Pacific/Auckland");
    expect(column("Instant")[0]).toBe("2024-06-14T22:30:00Z");
  });

  it.each(HL7_PRESETS.map((p) => [p.id]))(
    "round-trips %s as a permalink of strings",
    async (id) => {
      const first = await open();
      await choose(first, id!);
      const url = first.permalink();
      expect(url).toMatch(/\?w=hl7&wa=[^)"'\s]+$/);
      const state = seedFromLocation(
        "hl7",
        url.slice(url.indexOf("?")),
      ) as Record<string, unknown>;
      expect(
        Object.values(state).every(
          (v) => typeof v === "string" && v.length > 0 && v.length <= 64,
        ),
      ).toBe(true);
      expect(encodeWidgetPermalink("hl7", state)).toBe(url);
      first.destroy();

      await open(state, "second");
      expect(preset()).toHaveValue(id);
      expect(parseOutput()).toHaveTextContent(EXPECTED[id!]![1]);
    },
  );

  it("carries a custom value untrimmed", async () => {
    const w = await open();
    await retype(w, input(), "20240615103001");
    const url = w.permalink();
    expect(seedFromLocation("hl7", url.slice(url.indexOf("?")))).toMatchObject({
      value: "20240615103001",
    });
  });
});

describe("naming", () => {
  it("names no regulator or statute, and never calls the library GMT", async () => {
    const forbidden = /\b(HIPAA|CFR|statut|regulat|FDA|agency|GMT)\b/;
    const w = await open();
    expect(w.root).not.toHaveTextContent(forbidden);
    for (const p of HL7_PRESETS) {
      expect(`${p.label} ${p.description}`).not.toMatch(forbidden);
      await choose(w, p.id);
      expect(w.root).not.toHaveTextContent(forbidden);
    }
  });
});

describe("lifecycle", () => {
  it("an aborted mount is inert, and destroying twice is safe", async () => {
    const w = await renderWidget(entry, { args: {}, aborted: true });
    // The host's static shell is there; the mount wrote nothing into it.
    expect(verdict()).toBeEmptyDOMElement();
    expect(parseOutput()).toHaveTextContent("nothing to read");
    expect(ladderNote()).toBeEmptyDOMElement();
    expect(() => {
      w.destroy();
      w.destroy();
    }).not.toThrow();
  });
});

describe("holds still", () => {
  const norm = (t: string | null) => (t ?? "").replace(/\s+/g, " ").trim();
  // A hold draws every text its region can show as a hidden ghost beside the live one.
  const ghosts = (region: HTMLElement, sample: string) =>
    within(region).queryAllByText(
      (_, el) =>
        el?.getAttribute("aria-hidden") === "true" &&
        norm(el.textContent).includes(norm(sample)),
    );
  const longest = (list: readonly string[]) =>
    list.reduce((a, b) => (b.length > a.length ? b : a));
  // Each sample with the numbered section whose hold draws it. The verdict holds every title
  // and every detail (`verdictHold`); the reason aside holds only its longest (`asideHold`).
  const everyText = (): [() => HTMLElement, string][] => {
    const t = hl7Texts();
    return [
      ...t.stripNotes.map((s): [() => HTMLElement, string] => [lands, s]),
      ...t.gaps.map((s): [() => HTMLElement, string] => [lands, s]),
      ...t.ladderNotes.map((s): [() => HTMLElement, string] => [back, s]),
      ...t.verdicts.map((s): [() => HTMLElement, string] => [states, s]),
      ...t.details.map((s): [() => HTMLElement, string] => [states, s]),
      [states, longest(t.reasons)],
      [states, t.parseCall],
      [states, t.parseOutput],
      [lands, t.stripCall],
      [lands, t.stripOutput],
    ];
  };

  it("has every region present in every preset", async () => {
    const w = await open();
    for (const p of HL7_PRESETS) {
      await choose(w, p.id);
      for (const name of [/^1\. /, /^2\. /, /^3\. /, /^4\. /]) {
        expect(section(name), p.id).toBeInTheDocument();
      }
      expect(preset(), p.id).toBeInTheDocument();
      expect(input(), p.id).toBeInTheDocument();
      expect(verdict(), p.id).toBeInTheDocument();
      expect(parseOutput(), p.id).toBeInTheDocument();
      expect(stripNote(), p.id).toBeInTheDocument();
      expect(gap(), p.id).toBeInTheDocument();
      expect(strip(), p.id).toBeInTheDocument();
      expect(ladder(), p.id).toBeInTheDocument();
      expect(ladderNote(), p.id).toBeInTheDocument();
    }
  });

  it("holds every text a region can show, in every preset", async () => {
    const w = await open();
    for (const p of HL7_PRESETS) {
      await choose(w, p.id);
      for (const [region, sample] of everyText()) {
        expect(
          ghosts(region(), sample).length,
          `${p.id}: ${sample.slice(0, 40)}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the hold of a text region while its live text changes", async () => {
    const w = await open();
    await choose(w, HL7_PRESETS[0]!.id);
    const before = everyText().map(([r, s]) => ghosts(r(), s).length);
    for (const p of HL7_PRESETS) {
      await choose(w, p.id);
      expect(
        everyText().map(([r, s]) => ghosts(r(), s).length),
        p.id,
      ).toEqual(before);
    }
  });
});
