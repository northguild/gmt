// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { section, widget } from "../../builders/layout";
import { renderHtml } from "../../test-fixture";
import {
  PIN_PLACEHOLDER,
  labelLayer,
  labelMarkup,
  legendCount,
  mapDrawing,
  zoneLegend,
  zoneMap,
} from "./zone-map";

const ZONES = ["America/Vancouver", "America/Winnipeg", "America/Toronto"];

function draw() {
  return renderHtml(
    widget(
      { name: "canada", label: "Canada", scope: "canada" },
      zoneMap({
        idPrefix: "canada",
        zones: ZONES,
        listLabel: "Canada time zones, scrollable list",
        mapHeight: 400,
        legend: zoneLegend("canada", [
          { kind: "stopped", text: html`${legendCount("stopped")} stopped` },
          { kind: "none", text: html`${legendCount("none")} never change` },
        ]),
        clocks: section(
          { id: "clocks", heading: "Clocks", level: 4 },
          html`<p>Live clocks.</p>`,
        ),
      }),
    ),
  );
}

describe("zoneMap", () => {
  it("names the map, the pick card and the list", () => {
    draw();
    expect(
      screen.getByRole("group", { name: "Zones on the map" }),
    ).toBeVisible();
    expect(screen.getByRole("region", { name: "Pick a zone" })).toBeVisible();
    expect(
      screen.getByRole("region", {
        name: "Canada time zones, scrollable list",
      }),
    ).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("list", { name: "Zones" })).toBeVisible();
  });

  it("lists one unpressed button per zone, each naming its zone, and says no answer yet", () => {
    draw();
    const buttons = within(
      screen.getByRole("list", { name: "Zones" }),
    ).getAllByRole("button");
    expect(buttons).toHaveLength(ZONES.length);
    ZONES.forEach((zone, i) => {
      expect(buttons[i]).toHaveAccessibleName(expect.stringContaining(zone));
      expect(buttons[i]).not.toBePressed();
      expect(buttons[i]).toHaveTextContent("no answer yet");
    });
    // A zone with no row says so with the sentinel, never a blank.
    expect(screen.getAllByText("NO SIGNAL")).toHaveLength(ZONES.length);
  });

  it("starts the pin panel on its placeholder, with a polite status for the announcement", () => {
    draw();
    expect(screen.getByText(PIN_PLACEHOLDER)).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("");
    for (const term of [
      "Local time",
      "UTC offset",
      "Last change",
      "Next change",
      "Recorded in",
    ])
      expect(screen.getByText(term)).toBeVisible();
  });

  it("states the legend as a named list with a count slot for each class", () => {
    draw();
    const legend = screen.getByRole("list", { name: "Map classes" });
    expect(within(legend).getAllByRole("listitem")).toHaveLength(2);
    expect(within(legend).getByText(/stopped/)).toBeVisible();
    expect(within(legend).getByText(/never change/)).toBeVisible();
  });

  it("puts the scroll region in the tab order, so a keyboard reader can scroll the list", async () => {
    draw();
    const user = userEvent.setup();
    await user.tab();
    expect(
      screen.getByRole("region", {
        name: "Canada time zones, scrollable list",
      }),
    ).toHaveFocus();
  });

  it("has no accessibility violations", async () => {
    const fixture = draw();
    await expectNoAxeViolations(fixture.host);
  });
});

describe("mapDrawing", () => {
  const drawing = () =>
    renderHtml(
      html`<div>
        ${mapDrawing({
          id: "map-svg",
          width: 800,
          height: 400,
          label: "Canada, time zones",
          land: ["M0,0L10,0L10,10Z"],
          shapes: [
            {
              id: "America/Vancouver",
              d: "M1,1L5,1L5,5Z",
              kind: "stopped",
              label: "America/Vancouver, stopped",
            },
          ],
          markers: [
            {
              id: "America/Winnipeg",
              cx: 20,
              cy: 20,
              r: 6,
              kind: "none",
              label: "America/Winnipeg, never changes",
            },
          ],
        })}
        ${labelLayer("labels")}
      </div>`,
    );

  it("names the drawing, and each shape and ring as a pressable button", () => {
    drawing();
    const svg = screen.getByRole("group", { name: "Canada, time zones" });
    const shape = within(svg).getByRole("button", {
      name: "America/Vancouver, stopped",
    });
    expect(shape).not.toBePressed();
    expect(shape).toHaveAttribute("tabindex", "-1");
    expect(
      within(svg).getByRole("button", {
        name: "America/Winnipeg, never changes",
      }),
    ).toHaveAttribute("tabindex", "-1");
  });

  it("writes a label as the city over its offset, or NO SIGNAL for a zone with no offset", () => {
    const label = (offset: string | null) =>
      renderHtml(
        labelMarkup({
          zone: "America/Vancouver",
          city: "Vancouver",
          offset,
          ax: "10%",
          ay: "20%",
          width: 80,
          height: 30,
        }),
      );
    label("-07:00");
    expect(screen.getByText("Vancouver")).toBeInTheDocument();
    expect(screen.getByText("-07:00")).toBeInTheDocument();
    label(null);
    expect(screen.getByText("NO SIGNAL")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const fixture = drawing();
    await expectNoAxeViolations(fixture.host);
  });
});
