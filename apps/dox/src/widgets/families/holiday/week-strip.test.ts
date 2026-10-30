// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { weekStrip, type WeekStripOptions } from "./week-strip";

const options: WeekStripOptions = {
  from: "2021-12-24",
  to: "2021-12-28",
  weekend: [6, 7],
  marks: {
    "2021-12-26": { movedFrom: true, movedTo: 2 },
    "2021-12-27": { closed: true, rules: [1] },
  },
};

describe("weekStrip", () => {
  it("labels the image with the whole weeks it draws and the weekend", () => {
    renderHtml(weekStrip(options));
    expect(
      screen.getByRole("img", {
        name: "Weeks from 2021-12-20 to 2022-01-02. Weekend: Saturday, Sunday. The marked dates follow in the list.",
      }),
    ).toBeInTheDocument();
  });

  it("names the month on each day", () => {
    renderHtml(weekStrip(options));
    expect(screen.getByText("24 Dec")).toBeInTheDocument();
    expect(screen.getByText("27 Dec")).toBeInTheDocument();
  });

  it("lists every marked date as a sentence", () => {
    renderHtml(weekStrip(options));
    const list = screen.getByRole("list", { name: "Marked dates" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(list).toHaveTextContent("Monday 27 December 2021: closed");
  });

  it("has no axe violations", async () => {
    const { host } = renderHtml(weekStrip(options));
    await expectNoAxeViolations(host);
  });
});
