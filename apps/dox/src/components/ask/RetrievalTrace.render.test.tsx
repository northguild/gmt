/**
 * @vitest-environment jsdom
 */
import type React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BRAINS } from "~/lib/chat-constants";
import {
  describeAttempts,
  describeTimings,
  formatMs,
  RetrievalTrace,
} from "./RetrievalTrace";
import { installJsdomShims } from "~/test/jsdom-shims";
import { expectNoAxeViolations } from "~/test/render-widget";

installJsdomShims();

/** The trace is collapsed by default and Radix unmounts closed content, so
 * every row assertion opens it first, as a reader does: with its button. */
async function renderOpen(ui: React.ReactElement) {
  const result = render(ui);
  const trigger = screen.getByRole("button", { name: /^Searched \d+ chunks/ });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  await userEvent.setup().click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  return result;
}

const base = {
  totalChunks: 884,
  retrievedCount: 2,
  chunkTitles: ["dwellTime", "DST gaps"],
  chunkUrls: ["/reference/transport/calculate/dwellTime", "/guides/x#dst-gaps"],
  brainId: BRAINS[0].id,
  brainLabel: BRAINS[0].label,
};

describe("RetrievalTrace timings", () => {
  it("formats sub-second times in ms and longer ones in seconds", () => {
    expect(formatMs(0)).toBe("0 ms");
    expect(formatMs(320)).toBe("320 ms");
    expect(formatMs(1000)).toBe("1.0 s");
    expect(formatMs(2140)).toBe("2.1 s");
  });

  it("lists the stages in pipeline order, leaving out the ones not yet known", () => {
    expect(
      describeTimings({
        usage: 3,
        corpus: 12,
        search: 55,
        prompt: 4,
        brains: 1800,
      }),
    ).toBe(
      "ledger 3 ms · corpus 12 ms · search 55 ms · prompt 4 ms · brains 1.8 s",
    );
    expect(
      describeTimings({
        usage: 0,
        corpus: 0,
        search: 50,
        prompt: 0,
        brains: 1000,
        firstToken: 2400,
        total: 9100,
      }),
    ).toContain("first token 2.4 s · total 9.1 s");
  });

  it("narrates the walk across brains with labels, not ids", () => {
    expect(
      describeAttempts([
        { brainId: BRAINS[0].id, ms: 2100, outcome: "spent" },
        { brainId: BRAINS[1].id, ms: 1800, outcome: "answered" },
      ]),
    ).toBe(
      `${BRAINS[0].label} spent 2.1 s → ${BRAINS[1].label} answered 1.8 s`,
    );
  });

  it("renders nothing extra when the Worker sent no timings", async () => {
    const { container } = await renderOpen(<RetrievalTrace data={base} />);
    expect(screen.getByText("dwellTime")).toBeInTheDocument();
    expect(screen.queryByText(/ledger \d|total \d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/answered|spent/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Widget:|No widget called/),
    ).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("renders the timing, attempt and tool rows once they arrive", async () => {
    const { container } = await renderOpen(
      <RetrievalTrace
        data={{
          ...base,
          timings: {
            usage: 1,
            corpus: 2,
            search: 50,
            prompt: 3,
            brains: 900,
            firstToken: 1200,
            total: 4000,
          },
          attempts: [{ brainId: BRAINS[0].id, ms: 900, outcome: "answered" }],
          toolCalled: "showGlobe",
        }}
      />,
    );
    expect(screen.getByText(/ledger 1 ms/)).toHaveTextContent("total 4.0 s");
    expect(
      screen.getByText(`${BRAINS[0].label} answered 900 ms`),
    ).toBeInTheDocument();
    expect(screen.getByText("Widget: showGlobe")).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("says plainly when the answer finished without a widget", async () => {
    const { container } = await renderOpen(
      <RetrievalTrace data={{ ...base, toolCalled: null }} />,
    );
    expect(screen.getByText("No widget called.")).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});
