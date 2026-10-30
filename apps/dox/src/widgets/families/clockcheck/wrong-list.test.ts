// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { describe, expect, it } from "vitest";
import { expectNoAxeViolations } from "~/test/render-widget";
import { setHtml, html } from "../../builders/html";
import { widget } from "../../builders/layout";
import { findWidget } from "../../root";
import { renderHtml } from "../../test-fixture";
import { wrongList, wrongPresentPart, type WrongRow } from "./wrong-list";

const ROWS: WrongRow[] = [
  {
    zone: "Africa/Casablanca",
    at: "2026-10-25T01:00:00Z",
    when: "02:00 local",
    shift: "+01:00 → +00:00",
    by: "tzdb 2026b",
  },
  {
    zone: "Africa/El_Aaiun",
    at: "2027-02-20T02:00:00Z",
    when: "03:00 local",
    shift: "+00:00 → +01:00",
    by: "tzdb 2026c",
  },
];

function draw() {
  const fixture = renderHtml(
    widget({ name: "x", label: "X", scope: "x" }, wrongList("x", ROWS)),
  );
  return { fixture, found: findWidget(fixture.host, "x") };
}

describe("wrongList", () => {
  it("lists one row for each stated change, with its zone, shift and release", () => {
    draw();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Africa/Casablanca");
    expect(items[0]).toHaveTextContent("+01:00 → +00:00");
    expect(items[1]).toHaveTextContent("tzdb 2026c");
  });

  it("says NO SIGNAL in the last cell until the answer arrives, then what it is given", () => {
    const { found } = draw();
    const [first] = screen.getAllByRole("listitem");
    expect(within(first!).getByText("NO SIGNAL")).toBeVisible();
    setHtml(
      found.part(wrongPresentPart(ROWS[0]!.zone, ROWS[0]!.at)),
      html`still wrong`,
    );
    expect(within(first!).getByText("still wrong")).toBeVisible();
    expect(within(first!).queryByText("NO SIGNAL")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { fixture } = draw();
    await expectNoAxeViolations(fixture.host);
  });
});
