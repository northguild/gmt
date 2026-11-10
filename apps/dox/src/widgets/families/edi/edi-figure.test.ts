// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
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

  it("draws no empty row when a value has no parts", () => {
    renderHtml(
      figureContent({
        kind: "value",
        aria: "Date: year 2024, month 06, day 15.",
        parts: [],
        halves: [{ label: "", fields: date }],
        separator: "",
        closing: "",
      }),
    );
    const image = screen.getByRole("img");
    // oxlint-disable-next-line testing-library/no-node-access -- an empty parts row has no text, role or name; only its place as the first child shows whether it was drawn
    expect(image.firstElementChild).toHaveTextContent("2024");
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

describe("a field with no run", () => {
  it("draws the brackets and text the figure drew before the run key", () => {
    const { host } = renderHtml(
      figureContent({
        kind: "value",
        aria: "A",
        parts: [
          { text: "20240615", caption: "value", after: "", kind: "value" },
        ],
        halves: [
          {
            label: "start",
            fields: [
              lit("2024", "CCYY", "date"),
              lit("06", "MM", "date"),
              lit("14", "HH", "time"),
              lit(":", ":", "time"),
              lit("+02", "ZZZ", "offset"),
              lit("x", "", "neutral"),
              lit("", "", "none"),
            ],
          },
          {
            label: "end",
            fields: [
              { ...lit("15", "DD", "date"), bracket: "day" },
              lit("30", "mm", "time"),
            ],
          },
        ],
        separator: "/",
        closing: "no offset",
      }),
    );
    // Adjacent fields of one group share a bracket, so each label is drawn once per run of its
    // group, not once per field. Splitting runs on a `run` key no field has would draw "date"
    // twice. (`html-diff` against a baseline holds the built EDI pages byte-identical.)
    const drawn: Record<string, number> = { date: 1, time: 2, zone: 1, day: 1 };
    for (const [label, count] of Object.entries(drawn)) {
      expect(within(host).getAllByText(label)).toHaveLength(count);
    }
    expect(within(host).getByText("2024")).toBeInTheDocument();
    expect(within(host).getByText("no offset")).toBeInTheDocument();
  });
});

describe("the run key", () => {
  it("brackets each run of one group on its own", () => {
    const fraction = (text: string, run: string) => ({
      ...lit(text, "", "time"),
      run,
      bracket: run,
    });
    renderHtml(
      figureContent({
        kind: "value",
        aria: "Fractions.",
        halves: [
          { label: "", fields: [fraction("100", "ms"), fraction("000", "µs")] },
        ],
        separator: "",
        closing: "",
      }),
    );
    expect(screen.getByText("ms")).toBeInTheDocument();
    expect(screen.getByText("µs")).toBeInTheDocument();
  });
});
