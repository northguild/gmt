// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { lit } from "~/lib/edi-picture";
import { renderHtml } from "../../test-fixture";
import { ediFigure, figureContent } from "./edi-figure";

const date = [
  lit("2024", "CCYY", "date"),
  lit("06", "MM", "date"),
  lit("15", "DD", "date"),
];

describe("figureContent", () => {
  it("says in words when there is nothing to take apart", async () => {
    const { host } = renderHtml(
      figureContent({ kind: "empty", text: "Type a value." }),
    );
    expect(host).toHaveTextContent("Type a value.");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    await expectNoAxeViolations(host);
  });

  it("describes a value as one named image and shows its parts", async () => {
    const { host } = renderHtml(
      figureContent({
        kind: "value",
        aria: "Date: year 2024, month 06, day 15.",
        parts: [
          { text: "20240615", caption: "value", after: "", kind: "value" },
        ],
        halves: [{ label: "", fields: date }],
        separator: "",
        closing: "no offset",
      }),
    );
    expect(
      screen.getByRole("img", { name: "Date: year 2024, month 06, day 15." }),
    ).toBeInTheDocument();
    expect(host).toHaveTextContent("20240615");
    expect(host).toHaveTextContent("no offset");
    await expectNoAxeViolations(host);
  });
});

describe("ediFigure", () => {
  it("shows the live figure and keeps its reserved ones out of the page", async () => {
    const { host } = renderHtml(
      ediFigure({
        id: "f-1",
        spec: { kind: "empty", text: "Type a value." },
        reserve: [
          { halves: [{ label: "", fields: date }], separator: "", closing: "" },
        ],
      }),
    );
    expect(host).toHaveTextContent("Type a value.");
    expect(
      screen.queryByText("CCYY", {
        ignore: '[aria-hidden="true"], [aria-hidden="true"] *',
      }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(host);
  });
});
