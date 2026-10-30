// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "~/test/render-widget";
import { html } from "../../builders/html";
import { widget } from "../../builders/layout";
import { findWidget } from "../../root";
import { setHtml } from "../../builders/html";
import { renderHtml } from "../../test-fixture";
import {
  changeEntries,
  changeGroups,
  changeListPart,
  listSection,
} from "./change-list";

const ZONES = ["America/Vancouver", "America/Winnipeg"];

function draw() {
  const fixture = renderHtml(
    widget(
      { name: "x", label: "X", scope: "x" },
      listSection(
        {
          id: "x-changes",
          heading: "Clock changes",
          gate: "changes",
          note: html`Times are local.`,
        },
        changeGroups("x", ZONES, [2026, 2027]),
      ),
    ),
  );
  return { fixture, found: findWidget(fixture.host, "x") };
}

describe("changeGroups", () => {
  it("is a section with its note, and one titled card for each zone", () => {
    draw();
    const section = screen.getByRole("region", { name: "Clock changes" });
    expect(within(section).getByText("Times are local.")).toBeVisible();
    expect(
      within(section)
        .getAllByRole("heading", { level: 5 })
        .map((h) => h.textContent),
    ).toEqual(ZONES);
  });

  it("says NO SIGNAL for every year until the answer arrives", () => {
    draw();
    expect(screen.getAllByText("NO SIGNAL")).toHaveLength(ZONES.length * 2);
  });

  it("fills a zone with its changes and says so for a year with none", () => {
    const { found } = draw();
    setHtml(
      found.part(changeListPart("America/Vancouver")),
      changeEntries([
        {
          year: 2026,
          lines: [
            {
              when: "2026-11-01 01:59",
              shift: "-07:00 → -08:00",
              utc: "2026-11-01T08:59:59Z",
            },
          ],
        },
        { year: 2027, lines: [] },
      ]),
    );
    const list = found.part(changeListPart("America/Vancouver"));
    expect(within(list).getByText("2026-11-01 01:59")).toBeVisible();
    expect(within(list).getByText("-07:00 → -08:00")).toBeVisible();
    expect(within(list).getByText("No clock change in 2027")).toBeVisible();
    expect(within(list).queryByText("NO SIGNAL")).not.toBeInTheDocument();
  });

  it("says NO SIGNAL for a change whose wall time could not be written", () => {
    const { found } = draw();
    setHtml(
      found.part(changeListPart("America/Winnipeg")),
      changeEntries([
        {
          year: 2026,
          lines: [
            { when: "", shift: "-05:00 → -06:00", utc: "2026-11-01T07:00:00Z" },
          ],
        },
      ]),
    );
    expect(
      within(found.part(changeListPart("America/Winnipeg"))).getByText(
        "NO SIGNAL",
      ),
    ).toBeVisible();
  });

  it("has no accessibility violations once filled", async () => {
    const { fixture, found } = draw();
    setHtml(
      found.part(changeListPart("America/Vancouver")),
      changeEntries([
        { year: 2026, lines: [] },
        { year: 2027, lines: [] },
      ]),
    );
    await expectNoAxeViolations(fixture.host);
  });
});
