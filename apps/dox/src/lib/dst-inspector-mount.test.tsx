/**
 * @vitest-environment jsdom
 *
 * The DST transition inspector, driven end to end through roles and accessible names,
 * against the real `@northguild/gmt`. It answers the story's motivating question: what
 * happens to 1:30am on November 3rd in New York.
 *
 * One thing is specific to this widget: the scrub state (the transition window and the
 * handle's minute) lives in the mount's closure, so a re-render caused by something else
 * must not reset it.
 */
import { screen, within } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import { spyOnResizeObservers } from "~/test/resize-observer-spy";
import {
  cellsInColumn,
  expectNoAxeViolations,
  renderWidget,
  type RenderedWidget,
} from "~/test/render-widget";

installJsdomShims();

const entry = WIDGET_REGISTRY["showDstInspector"] as AnyWidgetEntry;

const open = (args: Record<string, unknown> = {}): Promise<RenderedWidget> =>
  renderWidget(entry, { args });

const zone = () => screen.getByRole("combobox", { name: "Zone" });
const year = () => screen.getByRole("textbox", { name: "Year" });
const preset = () => screen.getByRole("combobox", { name: "Value preset" });
const disambiguation = () =>
  screen.getByRole("combobox", { name: "Disambiguation" });
const probeHandle = () =>
  screen.getByRole("slider", { name: "Local probe time" });
const transitions = () =>
  screen.getByRole("table", { name: "DST transitions" });
const result = () => screen.getByLabelText("What the probe returned");
const aside = () =>
  screen.getByRole("complementary", { name: "About this probe" });
const status = () =>
  screen.getByText(/ — (inside the|normal local time)/, { selector: "p" });

describe("renderDstTemplate", () => {
  it("is a named region that opens on Europe/London with its transitions and a result", async () => {
    const w = await open();
    expect(
      screen.getByRole("region", { name: "DST Inspector" }),
    ).toBeInTheDocument();
    expect(zone()).toHaveValue("Europe/London");
    expect(result()).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Copy call" })).toHaveLength(
      2,
    );
    await expectNoAxeViolations(w.root);
  });

  it("paints seeded arguments", async () => {
    await open({
      zone: "Europe/London",
      year: 2026,
      preset: "overlap",
      disambiguation: "earlier",
      offset: "reject",
    });
    expect(zone()).toHaveValue("Europe/London");
    expect(year()).toHaveValue("2026");
    expect(preset()).toHaveValue("overlap");
    expect(disambiguation()).toHaveValue("earlier");
  });

  it("keeps a seeded zone the curated list lacks", async () => {
    await open({ zone: "Pacific/Chatham", year: 2024 });
    expect(zone()).toHaveValue("Pacific/Chatham");
    expect(transitions()).toBeInTheDocument();
  });

  it("gives the probe handle a slider role and a name", async () => {
    await open();
    expect(probeHandle()).toHaveAttribute("tabindex", "0");
  });

  it("server-renders a preset description, so the mount does not grow a slot", async () => {
    await open({ preset: "overlap" });
    expect(
      screen.getAllByText(/twice/, { selector: "p" })[0],
    ).toBeInTheDocument();
  });
});

describe("the Exact transition instant preset in a southern zone", () => {
  it.each(["Australia/Sydney", "Australia/Adelaide", "Pacific/Auckland"])(
    "%s: the fall-back's own wall time is in the overlap, whatever the disambiguation",
    async (name) => {
      for (const choice of ["compatible", "reject"]) {
        const w = await open({
          zone: name,
          year: 2024,
          preset: "transition",
          disambiguation: choice,
        });
        expect(aside(), `${name} ${choice}`).toHaveTextContent("overlap");
        expect(aside()).not.toHaveTextContent("normal wall-clock time");
        if (choice === "reject") {
          expect(aside()).toHaveTextContent("rejected this wall time");
          expect(aside()).not.toHaveTextContent("returned an empty result");
        }
        w.destroy();
        document.body.replaceChildren();
      }
    },
  );
});

describe("a zone with no transitions", () => {
  it("says plainly there is nothing to probe, instead of calling with an empty string", async () => {
    await open({ zone: "Asia/Tokyo", year: 2024, preset: "gap" });
    const frames = screen.getAllByRole("button", { name: "Copy call" });
    expect(frames).toHaveLength(2);
    expect(screen.getAllByText(/no DST transitions/i).length).toBeGreaterThan(
      0,
    );
    expect(
      screen.queryByText(/convertPlainDateTimeToZoned\(/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("A local hour that was skipped"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("slider", { name: "Local probe time" }),
    ).not.toBeInTheDocument();
  });

  it("shows UTC as an empty table, never a fabricated row", async () => {
    await open({ zone: "UTC", year: 2024 });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.getByText("No DST transitions in this zone/year."),
    ).toBeInTheDocument();
  });
});

describe("mountDstInspector", () => {
  it("lists the year's real transitions", async () => {
    await open();
    // London has two transitions in 2024.
    expect(within(transitions()).getAllByRole("row")).toHaveLength(3);
  });

  it("answers the story's motivating question", async () => {
    await open({ zone: "America/New_York", year: 2024, preset: "overlap" });
    expect(
      cellsInColumn(transitions(), "Local Date").map((c) => c.textContent),
    ).toContain("2024-11-03");
    expect(result()).not.toBeEmptyDOMElement();
    expect(probeHandle()).toBeVisible();
  });

  it("recomputes when the zone changes", async () => {
    const w = await open();
    const before = cellsInColumn(transitions(), "Local Date").map(
      (c) => c.textContent,
    );
    await w.user.selectOptions(zone(), "Australia/Sydney");
    expect(
      cellsInColumn(transitions(), "Local Date").map((c) => c.textContent),
    ).not.toEqual(before);
  });

  it("changes the answer when disambiguation changes", async () => {
    const w = await open({ preset: "overlap" });
    const before = result().textContent ?? "";
    await w.user.selectOptions(disambiguation(), "later");
    expect(result()).not.toHaveTextContent(before, {
      normalizeWhitespace: false,
    });
  });

  it("scrubs the probe with the keyboard", async () => {
    const w = await open({ preset: "gap" });
    const before = status().textContent ?? "";
    probeHandle().focus();
    await w.user.keyboard("{ArrowRight}");
    expect(status()).not.toHaveTextContent(before);
    await expectNoAxeViolations(w.root);
  });

  it("scrubs into the New York gap, where the local time never happens", async () => {
    const w = await open({
      zone: "America/New_York",
      year: 2024,
      preset: "gap",
    });
    probeHandle().focus();
    await w.user.keyboard("{Home}");
    await w.user.keyboard("{PageUp}".repeat(2));
    for (
      let i = 0;
      i < 24 && !/never happens/.test(status().textContent ?? "");
      i++
    ) {
      await w.user.keyboard("{ArrowRight}");
    }
    expect(status()).toHaveTextContent("never happens");
  });

  it("keeps scrub state across an unrelated re-render", async () => {
    const w = await open({ preset: "gap" });
    probeHandle().focus();
    await w.user.keyboard("{ArrowRight}{ArrowRight}");
    const scrubbed = (probeHandle() as HTMLInputElement).value;
    await w.user.selectOptions(disambiguation(), "later");
    expect(probeHandle()).toHaveValue(scrubbed);
    const mid = status().textContent ?? "";
    probeHandle().focus();
    await w.user.keyboard("{ArrowRight}");
    expect(status()).not.toHaveTextContent(mid);
  });

  it("reports live state for a permalink", async () => {
    const w = await open();
    await w.user.selectOptions(zone(), "Europe/Berlin");
    const link = w.permalink();
    expect(link).toContain("Europe%2FBerlin");
    expect(link).toContain("2024");
  });

  it("survives destroy twice and an aborted mount", async () => {
    const w = await open();
    expect(() => {
      w.destroy();
      w.destroy();
    }).not.toThrow();
    const inert = await renderWidget(entry, { args: {}, aborted: true });
    expect(() => inert.destroy()).not.toThrow();
  });
});

describe("escaping", () => {
  it("neutralises a quote injected through a zone name", async () => {
    await open({ zone: `" autofocus onfocus="alert(1)` });
    expect(
      screen.getByRole("option", { name: `" autofocus onfocus="alert(1)` }),
    ).toHaveValue(`" autofocus onfocus="alert(1)`);
  });

  it("neutralises a tag injected through the year", async () => {
    await open({
      year: `2024"><script>alert(1)</script>` as unknown as number,
    });
    expect(document.body).not.toHaveTextContent("alert(1)</script>");
    expect(year()).toBeInTheDocument();
  });
});

describe("releasing observers", () => {
  it("destroy disconnects every ResizeObserver the mount created", async () => {
    const spy = spyOnResizeObservers();
    try {
      const w = await open();
      w.destroy();
      expect(spy.live.size).toBe(0);
    } finally {
      spy.restore();
    }
  });
});
