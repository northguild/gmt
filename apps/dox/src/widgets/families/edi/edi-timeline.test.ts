// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import { ediTimeline, timelineContent } from "./edi-timeline";

describe("timelineContent", () => {
  it("says in words why there is nothing to place", async () => {
    const { host } = renderHtml(
      timelineContent({ kind: "empty", text: "nothing to place" }),
    );
    expect(host).toHaveTextContent("nothing to place");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    await expectNoAxeViolations(host);
  });

  it("names the one instant a value states", async () => {
    const { host } = renderHtml(
      timelineContent({ kind: "stated", instant: "2024-06-15T12:30:00Z" }),
    );
    expect(host).toHaveTextContent("Stated by the value: 2024-06-15T12:30:00Z");
    expect(screen.getByRole("img")).toHaveAccessibleName(
      /2024-06-15T12:30:00Z/,
    );
    await expectNoAxeViolations(host);
  });

  it("names every zone marked and the gap between them", async () => {
    const { host } = renderHtml(
      timelineContent({
        kind: "marks",
        rows: [
          { n: 1, zone: "Europe/Paris", instant: "2024-06-15T12:30:00Z" },
          { n: 2, zone: "Asia/Tokyo", instant: "2024-06-15T05:30:00Z" },
        ],
        gap: null,
      }),
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(/Europe\/Paris/);
    expect(screen.getByRole("img")).toHaveAccessibleName(/Asia\/Tokyo/);
    await expectNoAxeViolations(host);
  });

  it("says a zone that gave no instant gives nothing to draw", () => {
    const { host } = renderHtml(
      timelineContent({
        kind: "marks",
        rows: [{ n: 1, zone: "Europe/Paris", instant: "" }],
        gap: null,
      }),
    );
    expect(host).toHaveTextContent("No chosen zone gives an instant.");
  });
});

describe("ediTimeline", () => {
  it("renders the content of its spec", () => {
    const { host } = renderHtml(
      ediTimeline({ id: "t-1", spec: { kind: "empty", text: "empty words" } }),
    );
    expect(host).toHaveTextContent("empty words");
  });
});
