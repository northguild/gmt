/**
 * @vitest-environment jsdom
 *
 * The SSIM Date Reader end to end, through roles and accessible names the way a reader meets
 * the page. The loader hands the widget the real library wrapped in a recorder, so the printed
 * calls can be checked against the calls that ran. A hold draws every text it may show, hidden,
 * so a text a reader sees is looked up with the hidden twins ignored.
 */
import { screen, within } from "@testing-library/dom";
import { convertUtcToUnix } from "@northguild/gmt/utc/convert";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import {
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";
import { aviationLib } from "~/test/aviation-lib";
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

const { READ_REASONS, SSIM_PRESETS, WRITE_REASONS, monthTable } =
  await import("./ssim-date-reader");
const { DIFFERS_TEXT, NOT_WRITTEN } = await import("./ssim-date-reader-mount");

installJsdomShims();

const entry = WIDGET_REGISTRY["showSsimDateReader"] as AnyWidgetEntry;

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
  vi.useRealTimers();
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

const preset = () => screen.getByRole("combobox", { name: "Preset" });
const valueBox = () => screen.getByRole("textbox", { name: "SSIM date" });
const firstBox = () => screen.getByRole("textbox", { name: "First year" });
const localeSelect = () => screen.getByRole("combobox", { name: "Locale" });
const dateBox = () => screen.getByRole("textbox", { name: "ISO date" });
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

const reason = (label: string) => screen.getByRole("note", { name: label });

async function paste(w: RenderedWidget, box: HTMLElement, value: string) {
  await w.user.clear(box);
  if (value !== "") {
    await w.user.click(box);
    await w.user.paste(value);
  }
}

describe("opening", () => {
  it("opens on the french-locale preset with the comparison already differing", async () => {
    const w = await open();
    expect(preset()).toHaveValue("french-locale");
    expect(valueBox()).toHaveValue("01JAN26");
    expect(firstBox()).toHaveValue("2000");
    expect(localeSelect()).toHaveValue("fr-FR");
    reads("SSIM reads", "2026-01-01");
    reads("Valid", "valid");
    reads("Pattern reads (ddMMMyy, fr-FR)", "no date");
    expect(shown(DIFFERS_TEXT)).toHaveLength(1);
    expect(reason("Reason for the read")).toHaveTextContent(READ_REASONS.read);
    await expectNoAxeViolations(w.root);
  });

  it("opens on what a chat call carries, with no window when none was given", async () => {
    const w = await open({ value: "01JAN26", window: "", locale: "en" });
    expect(valueBox()).toHaveValue("01JAN26");
    expect(firstBox()).toHaveValue("");
    reads("SSIM reads", SIGNAL);
    reads("Valid", "not valid");
    expect(reason("Reason for the read")).toHaveTextContent(
      READ_REASONS.noWindow,
    );
    await expectNoAxeViolations(w.root);
  });
});

describe("every preset", () => {
  const EXPECT: Record<
    string,
    { ssim: string; valid: string; pattern: string; differs: boolean }
  > = {
    "french-locale": {
      ssim: "2026-01-01",
      valid: "valid",
      pattern: "no date",
      differs: true,
    },
    "english-locale": {
      ssim: "2026-01-01",
      valid: "valid",
      pattern: "2026-01-01",
      differs: false,
    },
    "turkish-locale": {
      ssim: "2026-10-25",
      valid: "valid",
      pattern: "no date",
      differs: true,
    },
    "lower-case": {
      ssim: SIGNAL,
      valid: "not valid",
      pattern: "2026-01-01",
      differs: true,
    },
    "spanish-locale": {
      ssim: SIGNAL,
      valid: "not valid",
      pattern: "2026-01-01",
      differs: true,
    },
    archive: {
      ssim: "2009-12-16",
      valid: "valid",
      pattern: "2009-12-16",
      differs: false,
    },
    "leap-2000": {
      ssim: "2000-02-29",
      valid: "valid",
      pattern: "2000-02-29",
      differs: false,
    },
    "leap-1900": {
      ssim: SIGNAL,
      valid: "not valid",
      pattern: "no date",
      differs: false,
    },
    "no-window": {
      ssim: SIGNAL,
      valid: "not valid",
      pattern: "no date",
      differs: false,
    },
    "write-outside": {
      ssim: "2026-01-01",
      valid: "valid",
      pattern: "2026-01-01",
      differs: false,
    },
  };

  it("has an expectation for each preset but the rolling one", () => {
    expect(
      SSIM_PRESETS.map((p) => p.id)
        .filter((id) => id !== "rolling")
        .sort(),
    ).toEqual(Object.keys(EXPECT).sort());
  });

  it.each(Object.entries(EXPECT))(
    "%s reads as the library says, and is accessible",
    async (id, want) => {
      const w = await open();
      await w.user.selectOptions(preset(), id);
      expect(preset()).toHaveValue(id);
      const locale = (localeSelect() as HTMLSelectElement).value;
      reads("SSIM reads", want.ssim);
      reads("Valid", want.valid);
      reads(`Pattern reads (ddMMMyy, ${locale})`, want.pattern);
      if (want.differs) {
        expect(shown(DIFFERS_TEXT)).toHaveLength(1);
      } else {
        expect(shown(DIFFERS_TEXT)).toHaveLength(0);
      }
      await expectNoAxeViolations(w.root);
    },
  );

  it("the rolling preset reads with a rolling window and keeps the first year out of the way", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(convertUtcToUnix("2026-11-10T12:00:00Z")!);
    const w = await open();
    await w.user.selectOptions(preset(), "rolling");
    expect(screen.getByRole("radio", { name: "Rolling" })).toBeChecked();
    expect(
      screen.queryByRole("textbox", { name: "First year" }),
    ).not.toBeInTheDocument();
    reads(
      "SSIM reads",
      aviationLib.parseSsimDate("25OCT26", { yearWindow: "rolling" }),
    );
    expect(calls("the SSIM read")).toHaveTextContent(
      '{ yearWindow: "rolling" }',
    );
    await expectNoAxeViolations(w.root);
  });

  it("a rolling window moves with the clock", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(convertUtcToUnix("2026-11-10T12:00:00Z")!);
    const w = await open({ value: "25OCT26", window: "rolling" });
    const now = aviationLib.parseSsimDate("25OCT26", { yearWindow: "rolling" });
    reads("SSIM reads", now);
    vi.setSystemTime(convertUtcToUnix("2090-01-01T12:00:00Z")!);
    await w.user.clear(valueBox());
    await w.user.click(valueBox());
    await w.user.paste("25OCT26");
    const later = aviationLib.parseSsimDate("25OCT26", {
      yearWindow: "rolling",
    });
    expect(later).not.toBe(now);
    reads("SSIM reads", later);
  });
});

describe("typing", () => {
  it("lower case is refused with its own reason, and the call shows the text as typed", async () => {
    const w = await open();
    await paste(w, valueBox(), "01jan26");
    reads("SSIM reads", SIGNAL);
    expect(reason("Reason for the read")).toHaveTextContent(
      READ_REASONS.lowerCase,
    );
    expect(calls("the SSIM read")).toHaveTextContent('parseSsimDate("01jan26"');
    expect(preset()).toHaveValue("custom");
    await expectNoAxeViolations(w.root);
  });

  it("a cleared window is the no-date reason, never a default", async () => {
    const w = await open();
    await w.user.clear(firstBox());
    reads("SSIM reads", SIGNAL);
    expect(reason("Reason for the read")).toHaveTextContent(
      READ_REASONS.noWindow,
    );
    expect(calls("the SSIM read")).toHaveTextContent(
      'parseSsimDate("01JAN26", {})',
    );
  });

  it("the window chips switch the window and show or hide the first year", async () => {
    const w = await open();
    await w.user.click(screen.getByRole("radio", { name: "Rolling" }));
    expect(
      screen.queryByRole("textbox", { name: "First year" }),
    ).not.toBeInTheDocument();
    await w.user.click(screen.getByRole("radio", { name: "Fixed from" }));
    expect(firstBox()).toBeVisible();
    reads("SSIM reads", "2026-01-01");
  });

  it("an empty field says nothing typed and makes no call", async () => {
    const w = await open();
    recorded.length = 0;
    await w.user.clear(valueBox());
    recorded.length = 0;
    await w.user.clear(valueBox());
    reads("SSIM reads", "nothing typed");
    reads("Valid", "nothing typed");
    reads("Pattern reads (ddMMMyy, fr-FR)", "nothing typed");
    expect(reason("Reason for the read")).toHaveTextContent(READ_REASONS.empty);
    expect(recorded.map((c) => c.name)).not.toContain("parseSsimDate");
    expect(recorded.map((c) => c.name)).not.toContain("isValidSsimDate");
    expect(recorded.map((c) => c.name)).not.toContain("parseDateWithPattern");
    await expectNoAxeViolations(w.root);
  });

  it("a section left blank makes no call of its own", async () => {
    await open({ value: "", date: "", window: "2000", locale: "en" });
    const names = recorded.map((c) => c.name);
    expect(names).not.toContain("parseSsimDate");
    expect(names).not.toContain("isValidSsimDate");
    expect(names).not.toContain("parseDateWithPattern");
    expect(names).not.toContain("isValidDate");
    // The month table's twelve probes are the only writes.
    expect(names.filter((n) => n === "formatSsimDate")).toHaveLength(12);
    reads("SSIM writes", "nothing typed");
    reads("Reads back as", "nothing typed");
  });
});

describe("the locale", () => {
  it("feeds the comparison alone: a switch redraws section 2 and never calls the SSIM reader", async () => {
    const w = await open({ value: "01ENE26", window: "2000", locale: "en" });
    reads("SSIM reads", SIGNAL);
    recorded.length = 0;
    await w.user.selectOptions(localeSelect(), "es-ES");
    const names = recorded.map((c) => c.name);
    expect(names).not.toContain("parseSsimDate");
    expect(names).not.toContain("isValidSsimDate");
    expect(names).not.toContain("isValidDate");
    expect(names).toContain("parseDateWithPattern");
    expect(names).toContain("getLocaleMonthNames");
    reads("SSIM reads", SIGNAL);
    reads("Pattern reads (ddMMMyy, es-ES)", "2026-01-01");
    expect(shown(DIFFERS_TEXT)).toHaveLength(1);
    // The header and caption name no locale, so the stacked layout wraps them the same for
    // `en` and `fr-FR` and the table holds one height.
    expect(
      screen.getByRole("columnheader", { name: "Short name" }),
    ).toBeVisible();
    expect(screen.queryByText(/es-ES short name/)).not.toBeInTheDocument();
    await expectNoAxeViolations(w.root);
  });

  it("redraws the month table only when the locale changed", async () => {
    const w = await open({ value: "01JAN26", window: "2000", locale: "en" });
    recorded.length = 0;
    await paste(w, valueBox(), "02JAN26");
    expect(recorded.map((c) => c.name)).not.toContain("getLocaleMonthNames");
  });

  it("the call to the SSIM reader carries no locale", async () => {
    await open();
    const text = calls("the SSIM read").textContent ?? "";
    expect(text).not.toContain("fr-FR");
    expect(calls("the pattern and the table")).toHaveTextContent('"fr-FR"');
  });
});

describe("the month table", () => {
  it("shows the letters the library writes, month by month", async () => {
    await open({ value: "01JAN26", window: "2000", locale: "en" });
    const table = screen.getByRole("region", { name: /The twelve months/ });
    const rows = within(table).getAllByRole("row").slice(1);
    const want = monthTable(aviationLib, "en").rows;
    expect(rows).toHaveLength(12);
    rows.forEach((row, i) => {
      expect(shown(want[i]!.letters!, row)).toHaveLength(1);
      expect(shown(want[i]!.name!, row)).toHaveLength(1);
    });
  });

  it("shows the locale's own names beside the same letters", async () => {
    await open({ value: "01JAN26", window: "2000", locale: "es-ES" });
    const table = screen.getByRole("region", { name: /The twelve months/ });
    const first = within(table).getAllByRole("row")[1]!;
    expect(shown("JAN", first)).toHaveLength(1);
    expect(
      shown(monthTable(aviationLib, "es-ES").rows[0]!.name!, first),
    ).toHaveLength(1);
  });
});

describe("the write", () => {
  it("writes upper case and reads it back with the same window", async () => {
    const w = await open();
    reads("SSIM writes", "01JAN26");
    reads("Reads back as", "2026-01-01");
    expect(reason("Reason for the write")).toHaveTextContent(
      WRITE_REASONS.written,
    );
    expect(calls("the write")).toHaveTextContent('formatSsimDate("2026-01-01"');
    await expectNoAxeViolations(w.root);
  });

  it("refuses a year outside the window and says nothing was written", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "write-outside");
    reads("SSIM writes", SIGNAL);
    reads("Reads back as", NOT_WRITTEN);
    expect(reason("Reason for the write")).toHaveTextContent(
      WRITE_REASONS.outside,
    );
    await expectNoAxeViolations(w.root);
  });

  it("with no window the writer is refused, not outside", async () => {
    const w = await open();
    await w.user.selectOptions(preset(), "no-window");
    await paste(w, dateBox(), "2026-01-01");
    reads("SSIM writes", SIGNAL);
    expect(reason("Reason for the write")).toHaveTextContent(
      WRITE_REASONS.refused,
    );
  });

  it("a date typed in section 3 does not redraw the read", async () => {
    const w = await open();
    recorded.length = 0;
    await paste(w, dateBox(), "2026-12-31");
    const names = recorded.map((c) => c.name);
    expect(names).not.toContain("parseDateWithPattern");
    expect(names).not.toContain("isValidSsimDate");
    reads("SSIM writes", "31DEC26");
  });
});

describe("holds", () => {
  it("each reason hold draws every text it can show", async () => {
    const w = await open();
    for (const text of [
      ...Object.values(READ_REASONS),
      ...Object.values(WRITE_REASONS),
    ]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    await expectNoAxeViolations(w.root);
  });

  it("the plates hold a ghost of every value they can show", async () => {
    await open();
    for (const text of ["nothing typed", SIGNAL, "valid", "not valid"]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText(NOT_WRITTEN).length).toBeGreaterThan(0);
  });
});

describe("the permalink", () => {
  it("a preset links as that preset, and a typed value as its four strings", async () => {
    const w = await open();
    expect(decodeURIComponent(w.permalink())).toContain(
      '"preset":"french-locale"',
    );
    await paste(w, valueBox(), "05MAR41");
    const link = decodeURIComponent(w.permalink());
    expect(link).toContain('"value":"05MAR41"');
    expect(link).toContain('"window":"2000"');
    expect(link).toContain('"locale":"fr-FR"');
  });
});
