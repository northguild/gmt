// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { expectNoAxeViolations } from "~/test/render-widget";
import { renderHtml } from "../../test-fixture";
import {
  asideContent,
  asideHold,
  refusalParagraphs,
  stripSummary,
  verdictContent,
  verdictHold,
  type StripRow,
} from "./edi-view";

const row = (o: Partial<StripRow>): StripRow => ({
  zone: "Europe/Paris",
  instant: "2024-06-15T12:30:00Z",
  offset: "+02:00",
  third: "",
  reason: "",
  ...o,
});

describe("asideContent", () => {
  it("is empty when there is nothing to explain", () => {
    const { host } = renderHtml(asideContent([]));
    expect(host).toBeEmptyDOMElement();
  });

  it("is one aside holding a paragraph for each reason", async () => {
    const { host } = renderHtml(
      asideContent(["First reason.", "Second reason."]),
    );
    expect(screen.getByRole("complementary")).toHaveTextContent(
      "First reason.",
    );
    expect(screen.getByRole("complementary")).toHaveTextContent(
      "Second reason.",
    );
    await expectNoAxeViolations(host);
  });
});

describe("asideHold", () => {
  it("shows the live aside and keeps its reserved reasons out of the page", async () => {
    const { host } = renderHtml(
      asideHold({
        id: "a-1",
        paragraphs: ["Live reason."],
        reasons: ["A far longer reason the aside may hold."],
      }),
    );
    expect(screen.getByRole("complementary")).toHaveTextContent("Live reason.");
    expect(
      screen.queryByText(/far longer reason/, {
        ignore: '[aria-hidden="true"], [aria-hidden="true"] *',
      }),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(host);
  });
});

describe("verdictHold", () => {
  it("names the verdict and shows the title and detail", async () => {
    const { host } = renderHtml(
      verdictHold({
        id: "v-1",
        titles: ["Offset: stated (+00:00)"],
        details: ["The value states its offset."],
      }),
    );
    expect(screen.getByRole("status", { name: "Verdict" })).toBeInTheDocument();
    await expectNoAxeViolations(host);
  });

  it("shows what verdictContent writes", () => {
    const { host } = renderHtml(
      verdictContent("Offset: not stated", "No offset."),
    );
    expect(host).toHaveTextContent("Offset: not stated");
    expect(host).toHaveTextContent("No offset.");
  });
});

describe("stripSummary", () => {
  it("speaks each zone, the third word and the gap", () => {
    expect(
      stripSummary(
        [row({ third: "X" }), row({ zone: "" })],
        "Widest gap: 1 h",
        "end",
      ),
    ).toBe(
      "Zone 1, Europe/Paris: 2024-06-15T12:30:00Z, offset +02:00, end X. Zone 2: no zone chosen. Widest gap: 1 h.",
    );
  });

  it("leaves the third word out when there is none", () => {
    expect(stripSummary([row({ third: "X" })], "", "")).toBe(
      "Zone 1, Europe/Paris: 2024-06-15T12:30:00Z, offset +02:00.",
    );
  });

  it("gives a refused row's reason", () => {
    expect(
      stripSummary([row({ instant: "", reason: "It happens twice." })], "", ""),
    ).toBe("Zone 1, Europe/Paris: no signal. It happens twice.");
  });
});

describe("refusalParagraphs", () => {
  it("lists only the refused rows, each with its zone", () => {
    expect(
      refusalParagraphs([
        row({}),
        row({ zone: "Asia/Tokyo", reason: "Skipped." }),
      ]),
    ).toEqual(["Asia/Tokyo: Skipped."]);
  });
});
