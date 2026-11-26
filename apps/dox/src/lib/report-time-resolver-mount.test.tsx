/**
 * @vitest-environment jsdom
 *
 * The Report Time Resolver (the METAR section, then the NOTAM section) end to end, through roles and accessible names the
 * way a reader meets the page. The loader hands the widget the real library wrapped in a
 * recorder, so the printed calls can be checked against the calls that ran. A hold draws every
 * text it may show, hidden, so a text a reader sees is looked up with the hidden twins ignored.
 */
import { screen, within } from "@testing-library/dom";
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import type { LoadedWidget } from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  expectNoAxeViolations,
  renderWidget,
  setRange,
  type RenderedWidget,
} from "~/test/render-widget";
import { aviationLib } from "~/test/aviation-lib";
import { setHtml } from "~/widgets/builders";
import type { AviationLib } from "./aviation-lib";

const recorded: { name: string; args: unknown[] }[] = [];

vi.mock("./aviation-lib", () => ({
  loadAviationLib: async () => {
    const { aviationLib: real } = await import("~/test/aviation-lib");
    const wrapped = {} as Record<string, unknown>;
    for (const [name, fn] of Object.entries(real)) {
      wrapped[name] = (...args: unknown[]) => {
        recorded.push({ name, args });
        return (fn as (...a: unknown[]) => unknown)(...args);
      };
    }
    return wrapped as unknown as AviationLib;
  },
}));

const {
  ANSWER_REASONS,
  METAR_PRESETS,
  NOTAM_PRESETS,
  NOTAM_REASONS,
  PERMANENT_TEXT,
} = await import("./report-time-resolver");
const {
  BEYOND_TEXT,
  mountReportTimeResolver,
  renderReportTimeResolverTemplate,
} = await import("./report-time-resolver-mount");

installJsdomShims();

const entry = {
  renderTemplate: renderReportTimeResolverTemplate,
  mount: mountReportTimeResolver,
} as unknown as LoadedWidget<never>;

let live: RenderedWidget | null = null;

const open = async (args: unknown = {}): Promise<RenderedWidget> => {
  live?.destroy();
  recorded.length = 0;
  live = await renderWidget(entry, { args });
  return live;
};

afterEach(() => {
  live?.destroy();
  live = null;
});

const SIGNAL = "⟨ NO SIGNAL ⟩";

/**
 * The elements that show `text` to a reader. A hold keeps a hidden twin of every text it may
 * show, inside an `aria-hidden` wrapper, so those are left out.
 */
const shown = (text: string, container: HTMLElement = document.body) =>
  within(container)
    .queryAllByText(text)
    // oxlint-disable-next-line testing-library/no-node-access -- a hold keeps hidden twins beside the live text, and no query drops a hidden subtree from a text match
    .filter((el) => el.closest("[aria-hidden='true']") === null);

const preset = () => screen.getByRole("combobox", { name: "METAR preset" });
const groupBox = () => screen.getByRole("textbox", { name: "Group" });
const referenceBox = () => screen.getByRole("textbox", { name: "Reference" });
const slider = () => screen.getByRole("slider", { name: "Move the reference" });
const calls = (which: string) =>
  screen.getByRole("group", { name: `Calls made for ${which}`, hidden: true });

/** The row of a plate: its caption's group, whose shown text is the value a reader sees. */
const plate = (caption: string) => {
  const [term] = shown(caption);
  if (term === undefined) throw new Error(`no plate captioned ${caption}`);
  // oxlint-disable-next-line testing-library/no-node-access -- a plate has no role; its caption's row is the only handle on the value beside it
  return term.closest("div")!;
};
const reads = (caption: string, text: string) =>
  expect(shown(text, plate(caption))).toHaveLength(1);

const reason = () =>
  screen.getByRole("note", { name: "Reason for the report time" });

async function paste(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") {
    await w.user.click(box);
    await w.user.paste(value);
  }
}

const preset0 = METAR_PRESETS.find((p) => p.id === "month-end")!;
const answerOf = (group: string, reference: string) =>
  aviationLib.parseMetarTime(group, reference);

describe("the template", () => {
  it("is the same markup the mount keeps, with no placeholder on the reference", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    try {
      setHtml(host, renderReportTimeResolverTemplate("pre", {}));
      expect(within(host).getByRole("textbox", { name: "Group" })).toHaveValue(
        preset0.group,
      );
      const before = within(host).getByRole("textbox", { name: "Reference" });
      expect(before).toHaveValue(preset0.reference);
      expect(before).not.toHaveAttribute("placeholder");
      expect(
        within(host).getByRole("slider", { name: "Move the reference" }),
      ).toBeDisabled();
    } finally {
      host.remove();
    }
    const w = await open();
    expect(referenceBox()).not.toHaveAttribute("placeholder");
    expect(groupBox()).toHaveValue(preset0.group);
    await expectNoAxeViolations(w.root);
  });
});

describe("opening", () => {
  it("opens on the month-end preset, read by the library", async () => {
    const w = await open();
    expect(preset()).toHaveValue("month-end");
    expect(referenceBox()).toHaveValue(preset0.reference);
    reads("Report time", answerOf(preset0.group, preset0.reference));
    reads("Reference in UTC", preset0.reference);
    expect(reason()).toHaveTextContent(ANSWER_REASONS.read);
    expect(slider()).toBeEnabled();
    await expectNoAxeViolations(w.root);
  });

  it("opens on what a chat call carries, with the reference blank when none was given", async () => {
    const w = await open({ group: "251200Z" });
    expect(groupBox()).toHaveValue("251200Z");
    expect(referenceBox()).toHaveValue("");
    reads("Report time", SIGNAL);
    expect(reason()).toHaveTextContent(ANSWER_REASONS.noReference);
    expect(slider()).toBeDisabled();
    expect(recorded.some((c) => c.name === "parseMetarTime")).toBe(true);
    await expectNoAxeViolations(w.root);
  });
});

describe("every region, in every state", () => {
  const regions = () => {
    expect(screen.getByRole("group", { name: "Reference" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Candidates" })).toBeVisible();
    expect(
      screen.getByRole("table", { name: /seven candidate months/ }),
    ).toBeVisible();
    expect(slider()).toBeVisible();
    expect(
      screen.getByRole("note", { name: "About moving the reference" }),
    ).toBeVisible();
    expect(calls("the report time")).toBeInTheDocument();
    expect(calls("the strip")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Strip calls" }),
    ).toBeInTheDocument();
  };

  it("keeps all of them with nothing typed", async () => {
    const w = await open({ group: "", ref: "" });
    regions();
    reads("Report time", "nothing typed");
    reads("Reference in UTC", "nothing typed");
    expect(reason()).toHaveTextContent(ANSWER_REASONS.empty);
    expect(recorded.filter((c) => c.name === "parseMetarTime")).toEqual([]);
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    await expectNoAxeViolations(w.root);
  });

  it("keeps all of them when the library refuses", async () => {
    const w = await open({ metarPreset: "no-reference" });
    regions();
    reads("Report time", SIGNAL);
    reads("Reference in UTC", "nothing typed");
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    await expectNoAxeViolations(w.root);
  });

  it("keeps all of them with an answer, and draws the marks", async () => {
    const w = await open();
    regions();
    const chosen = screen.getAllByRole("img", { name: /, chosen$/ });
    expect(chosen).toHaveLength(1);
    // The reference and the six or seven candidates are named images too.
    expect(
      screen.getByRole("img", { name: /, the reference$/ }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });
});

describe("every preset", () => {
  it.each(METAR_PRESETS.map((p) => [p.id, p] as const))(
    "%s reads as the library says, and is accessible",
    async (id, p) => {
      const w = await open();
      await w.user.selectOptions(preset(), id);
      expect(preset()).toHaveValue(id);
      expect(groupBox()).toHaveValue(p.group);
      expect(referenceBox()).toHaveValue(p.reference);
      const direct = answerOf(p.group, p.reference);
      reads("Report time", direct === "" ? SIGNAL : direct);
      await expectNoAxeViolations(w.root);
    },
  );
});

describe("typing", () => {
  it("tells a lower case group from a bad shape", async () => {
    const w = await open();
    await paste(w, groupBox(), "302350z");
    reads("Report time", SIGNAL);
    expect(reason()).toHaveTextContent(ANSWER_REASONS.lowerCase);
    expect(preset()).toHaveValue("custom");
    await paste(w, groupBox(), "30235");
    expect(reason()).toHaveTextContent(ANSWER_REASONS.shape);
    await expectNoAxeViolations(w.root);
  });

  it("sends the group exactly as typed", async () => {
    const w = await open({ metarPreset: "lower-case" });
    expect(calls("the report time")).toHaveTextContent(
      'parseMetarTime("251200z", "2024-06-25T12:20:00Z")',
    );
    await paste(w, groupBox(), " 251200Z");
    expect(calls("the report time")).toHaveTextContent(
      'parseMetarTime(" 251200Z"',
    );
  });

  it("prints the calls that ran", async () => {
    await open();
    const parse = recorded.find((c) => c.name === "parseMetarTime");
    expect(parse?.args).toEqual([preset0.group, preset0.reference]);
    expect(calls("the report time")).toHaveTextContent(
      `parseMetarTime("${preset0.group}", "${preset0.reference}")`,
    );
    expect(calls("the report time")).toHaveTextContent("isValidMetarTime(");
  });
});

describe("the slider", () => {
  it("moves the reference one minute per step, the step an arrow key takes", async () => {
    const w = await open();
    // jsdom does not turn an arrow key into a native range step, so the step is read and taken.
    expect(slider()).toHaveAttribute("step", "1");
    const start = Number((slider() as HTMLInputElement).value);
    setRange(slider(), start + 1);
    expect(Number((slider() as HTMLInputElement).value)).toBe(start + 1);
    const moved = aviationLib.addUtc(preset0.reference, { minutes: 1 });
    reads("Reference in UTC", moved);
    expect(preset()).toHaveValue("custom");
    await expectNoAxeViolations(w.root);
  });

  it("slides across a month end and keeps the strip where it was", async () => {
    const w = await open();
    const input = slider() as HTMLInputElement;
    const marks = () =>
      screen
        .getAllByRole("img")
        .map((m) => m.getAttribute("aria-label"))
        .filter((l) => l !== null && !l.endsWith(", the reference"));
    const before = marks().map((l) => l!.replace(/, chosen$/, ""));
    setRange(input, Number(input.min));
    const after = marks().map((l) => l!.replace(/, chosen$/, ""));
    expect(after).toEqual(before);
    expect(screen.getAllByRole("img", { name: /, chosen$/ })).toHaveLength(1);
    const lo = aviationLib.addUtc(
      aviationLib.toOffsetInstant(preset0.reference)!.instant,
      { months: -1 },
    );
    reads("Reference in UTC", lo);
    expect(calls("the report time")).toHaveTextContent("fromOffsetInstant(");
    await expectNoAxeViolations(w.root);
  });

  it("keeps the offset of the typed reference while sliding", async () => {
    await open({ metarPreset: "offset-reference" });
    setRange(slider(), 60);
    expect(calls("the report time")).toHaveTextContent("+02:00");
  });

  it("goes back to the typed reference when the group changes", async () => {
    const w = await open();
    setRange(slider(), 90);
    expect(Number((slider() as HTMLInputElement).value)).toBe(90);
    await paste(w, groupBox(), "151200Z");
    expect(Number((slider() as HTMLInputElement).value)).toBe(0);
  });

  it("is disabled, and says why, for a reference it cannot split", async () => {
    await open({ metarPreset: "local-reference" });
    expect(slider()).toBeDisabled();
    expect(
      screen.getByRole("note", { name: "About moving the reference" }),
    ).toHaveTextContent("toOffsetInstant does not split it");
  });
});

describe("the strip", () => {
  it("names the month that lacks the day", async () => {
    await open({ metarPreset: "february-31" });
    expect(shown("no 31 in Feb")).toHaveLength(1);
  });

  it("marks one row chosen with the word", async () => {
    await open();
    expect(shown("chosen")).toHaveLength(1);
  });

  it("holds the beyond-the-strip note hidden while the answer is on the strip", async () => {
    await open();
    expect(shown(BEYOND_TEXT)).toHaveLength(0);
  });

  it("opens the strip calls on request", async () => {
    const w = await open();
    const button = screen.getByRole("button", { name: "Strip calls" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await w.user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(calls("the strip")).toBeVisible();
    expect(calls("the strip")).toHaveTextContent("startOfUtc(");
    await expectNoAxeViolations(w.root);
  });
});

// ---------------------------------------------------------------------------
// Section 2: NOTAM validity
// ---------------------------------------------------------------------------

const npreset = () => screen.getByRole("combobox", { name: "NOTAM preset" });
const itemB = () => screen.getByRole("textbox", { name: "Item B)" });
const itemC = () => screen.getByRole("textbox", { name: "Item C)" });
const firstYear = () => screen.getByRole("textbox", { name: "First year" });
const rollingChip = () => screen.getByRole("radio", { name: "Rolling" });
const fixedChip = () => screen.getByRole("radio", { name: "Fixed from" });
const reasonOf = (which: "B" | "C") =>
  screen.getByRole("note", { name: `Reason for item ${which})` });
const nCalls = () => calls("the NOTAM validity");

const parsed = (item: string, window: number | "rolling" | undefined) =>
  aviationLib.parseNotamValidity(
    item,
    window === undefined ? {} : { yearWindow: window },
  );

const instantOf = (item: string, window: number | "rolling") => {
  const v = parsed(item, window);
  if (v === null || v.kind !== "instant") throw new Error("not an instant");
  return v.instant;
};

describe("the NOTAM section: opening", () => {
  it("opens on the OPADD estimate, read by the library, with the window an input", async () => {
    const w = await open();
    expect(npreset()).toHaveValue("opadd-estimate");
    expect(itemB()).toHaveValue("1407011200");
    expect(itemC()).toHaveValue("1407031230EST");
    expect(firstYear()).toHaveValue("2000");
    expect(firstYear()).not.toHaveAttribute("placeholder");
    reads("In force from (B)", instantOf("1407011200", 2000));
    reads("Ends (C)", instantOf("1407031230EST", 2000));
    expect(reasonOf("B")).toHaveTextContent(NOTAM_REASONS.read);
    expect(reasonOf("C")).toHaveTextContent(NOTAM_REASONS.estimated);
    expect(shown("estimate")).toHaveLength(1);
    await expectNoAxeViolations(w.root);
  });

  it("opens each section on its own default when only the other was seeded", async () => {
    await open({ metarPreset: "lower-case" });
    expect(npreset()).toHaveValue("opadd-estimate");
    expect(preset()).toHaveValue("lower-case");
    await open({ notamPreset: "permanent" });
    expect(npreset()).toHaveValue("permanent");
    expect(preset()).toHaveValue("month-end");
  });

  it("opens a chat call that gave no window with the window blank", async () => {
    const w = await open({ b: "2506151200", c: "PERM" });
    expect(firstYear()).toHaveValue("");
    reads("In force from (B)", SIGNAL);
    expect(reasonOf("B")).toHaveTextContent(NOTAM_REASONS.noWindow);
    expect(nCalls()).not.toHaveTextContent("yearWindow");
    await expectNoAxeViolations(w.root);
  });
});

describe("the NOTAM section: every region, in every state", () => {
  const regions = () => {
    expect(npreset()).toBeVisible();
    expect(itemB()).toBeVisible();
    expect(itemC()).toBeVisible();
    expect(reasonOf("B")).toBeInTheDocument();
    expect(reasonOf("C")).toBeInTheDocument();
    expect(nCalls()).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Fixed from" }),
    ).toBeInTheDocument();
  };

  it("keeps all of them with nothing typed", async () => {
    const w = await open({ b: "", c: "", window: "2000" });
    regions();
    reads("In force from (B)", "nothing typed");
    reads("Ends (C)", "nothing typed");
    expect(reasonOf("B")).toHaveTextContent(NOTAM_REASONS.emptyB);
    expect(reasonOf("C")).toHaveTextContent(NOTAM_REASONS.emptyC);
    expect(shown("estimate")).toHaveLength(0);
    expect(recorded.filter((c) => c.name === "parseNotamValidity")).toEqual([]);
    await expectNoAxeViolations(w.root);
  });

  it("keeps all of them when the library refuses", async () => {
    const w = await open({ notamPreset: "no-window" });
    regions();
    reads("In force from (B)", SIGNAL);
    reads("Ends (C)", SIGNAL);
    await expectNoAxeViolations(w.root);
  });

  it("keeps all of them with an answer", async () => {
    const w = await open();
    regions();
    await expectNoAxeViolations(w.root);
  });
});

describe("every NOTAM preset", () => {
  it.each(NOTAM_PRESETS.map((p) => [p.id, p] as const))(
    "%s reads as the library says, and is accessible",
    async (id, p) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(convertUtcToUnix("2026-11-10T12:00:00Z")!);
      try {
        const w = await open();
        await w.user.selectOptions(npreset(), id);
        expect(npreset()).toHaveValue(id);
        expect(itemB()).toHaveValue(p.itemB);
        expect(itemC()).toHaveValue(p.itemC);
        const window =
          p.window === ""
            ? undefined
            : p.window === "rolling"
              ? "rolling"
              : Number(p.window);
        for (const [caption, item] of [
          ["In force from (B)", p.itemB],
          ["Ends (C)", p.itemC],
        ] as const) {
          const v = parsed(item, window);
          reads(
            caption,
            v === null
              ? SIGNAL
              : v.kind === "permanent"
                ? PERMANENT_TEXT
                : v.instant,
          );
        }
        await expectNoAxeViolations(w.root);
      } finally {
        vi.useRealTimers();
      }
    },
  );
});

describe("the NOTAM section: typing", () => {
  it("shows PERM as permanent, no date, and no estimate badge", async () => {
    await open({ notamPreset: "permanent" });
    reads("Ends (C)", PERMANENT_TEXT);
    expect(reasonOf("C")).toHaveTextContent(NOTAM_REASONS.permanent);
    expect(shown("estimate")).toHaveLength(0);
  });

  it("shows the badge for an estimate and not once the EST is removed", async () => {
    const w = await open();
    expect(shown("estimate")).toHaveLength(1);
    await paste(w, itemC(), "1407031230");
    expect(shown("estimate")).toHaveLength(0);
    reads("Ends (C)", instantOf("1407031230", 2000));
    expect(npreset()).toHaveValue("custom");
    await paste(w, itemC(), "1407022030");
    expect(npreset()).toHaveValue("opadd-pair");
  });

  it("tells a lower case perm from a bad shape, and sends it as typed", async () => {
    const w = await open();
    await paste(w, itemC(), "perm");
    reads("Ends (C)", SIGNAL);
    expect(reasonOf("C")).toHaveTextContent(NOTAM_REASONS.lowerCase);
    expect(nCalls()).toHaveTextContent(
      'parseNotamValidity("perm", { yearWindow: 2000 })',
    );
    expect(npreset()).toHaveValue("custom");
    await paste(w, itemC(), "15");
    expect(reasonOf("C")).toHaveTextContent(NOTAM_REASONS.shape);
    await expectNoAxeViolations(w.root);
  });

  it("shows EST in item B) as the library read it, with the item C) only note and no NO SIGNAL", async () => {
    const w = await open({ notamPreset: "est-in-b" });
    reads("In force from (B)", instantOf("1407031230EST", 2000));
    expect(reasonOf("B")).toHaveTextContent(NOTAM_REASONS.markedInB);
    expect(shown(SIGNAL)).toEqual([]);
    await expectNoAxeViolations(w.root);
  });

  it("tells a blank item from a refused one", async () => {
    await open({ b: "1407011200", c: "", window: "2000" });
    reads("In force from (B)", instantOf("1407011200", 2000));
    reads("Ends (C)", "nothing typed");
  });

  it("changes the reading with the first year", async () => {
    const w = await open({ notamPreset: "archive" });
    reads("In force from (B)", instantOf("9912312359", 1950));
    await paste(w, firstYear(), "2000");
    reads("In force from (B)", instantOf("9912312359", 2000));
    expect(nCalls()).toHaveTextContent("{ yearWindow: 2000 }");
  });
});

describe("the NOTAM window chips", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the rolling window against the clock and hides the first year", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(convertUtcToUnix("2026-11-10T12:00:00Z")!);
    const w = await open({ notamPreset: "rolling" });
    expect(rollingChip()).toBeChecked();
    expect(
      screen.queryByRole("textbox", { name: "First year" }),
    ).not.toBeInTheDocument();
    reads("In force from (B)", instantOf("7506151200", "rolling"));
    expect(nCalls()).toHaveTextContent('{ yearWindow: "rolling" }');
    await w.user.click(fixedChip());
    expect(firstYear()).toBeVisible();
    reads("In force from (B)", SIGNAL);
    expect(reasonOf("B")).toHaveTextContent(NOTAM_REASONS.noWindow);
    await expectNoAxeViolations(w.root);
  });
});

describe("the two sections", () => {
  it("redraws section 2 alone and leaves section 1's elements as they were", async () => {
    const w = await open();
    const table = screen.getByRole("table", { name: /seven candidate months/ });
    const metarReason = reason();
    const slide = slider();
    const metarCalls = calls("the report time");
    await paste(w, itemB(), "1407011300");
    reads("In force from (B)", instantOf("1407011300", 2000));
    expect(screen.getByRole("table", { name: /seven candidate months/ })).toBe(
      table,
    );
    expect(reason()).toBe(metarReason);
    expect(slider()).toBe(slide);
    expect(calls("the report time")).toBe(metarCalls);
  });

  it("redraws section 1 alone when the group changes", async () => {
    const w = await open();
    const bReason = reasonOf("B");
    const nc = nCalls();
    await paste(w, groupBox(), "302350Z");
    expect(reasonOf("B")).toBe(bReason);
    expect(nCalls()).toBe(nc);
  });

  it("hands one permalink the keys of both sections", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const ctl = new AbortController();
    try {
      setHtml(host, renderReportTimeResolverTemplate("pl", {}));
      const handle = await mountReportTimeResolver(host, {}, ctl.signal);
      const link = handle.getPermalinkState?.();
      expect(link).toMatchObject({
        metarPreset: "month-end",
        notamPreset: "opadd-estimate",
      });
      handle.destroy();
    } finally {
      ctl.abort();
      host.remove();
    }
  });
});
