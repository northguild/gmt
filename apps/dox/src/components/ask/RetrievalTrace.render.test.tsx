/**
 * @vitest-environment jsdom
 */
/// <reference types="vitest/globals" />
import type React from "react";
import { fireEvent, render } from "@testing-library/react";
import { BRAINS } from "~/lib/chat-constants";
import {
  describeAttempts,
  describeTimings,
  formatMs,
  RetrievalTrace,
} from "./RetrievalTrace";
import { installJsdomShims } from "~/test/jsdom-shims";

installJsdomShims();

/** The trace is collapsed by default and Radix unmounts closed content, so
 * every row assertion opens it first. */
function renderOpen(ui: React.ReactElement) {
  const result = render(ui);
  // `TaskTrigger` renders `asChild`, so the trigger is the div carrying the
  // Radix state attribute, not a <button>.
  const trigger = result.container.querySelector("[data-slot='collapsible-trigger']");
  if (trigger) fireEvent.click(trigger);
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
      describeTimings({ usage: 3, corpus: 12, search: 55, prompt: 4, brains: 1800 }),
    ).toBe("ledger 3 ms · corpus 12 ms · search 55 ms · prompt 4 ms · brains 1.8 s");
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
    ).toBe(`${BRAINS[0].label} spent 2.1 s → ${BRAINS[1].label} answered 1.8 s`);
  });

  it("renders nothing extra when the Worker sent no timings", () => {
    const { container } = renderOpen(<RetrievalTrace data={base} />);
    expect(container.querySelector("[data-role='timings']")).toBeNull();
    expect(container.querySelector("[data-role='attempts']")).toBeNull();
    expect(container.querySelector("[data-role='tool']")).toBeNull();
  });

  it("renders the timing, attempt and tool rows once they arrive", () => {
    const { container } = renderOpen(
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
    expect(container.querySelector("[data-role='timings']")?.textContent).toContain(
      "total 4.0 s",
    );
    expect(container.querySelector("[data-role='attempts']")?.textContent).toBe(
      `${BRAINS[0].label} answered 900 ms`,
    );
    expect(container.querySelector("[data-role='tool']")?.textContent).toBe(
      "Widget: showGlobe",
    );
  });

  it("says plainly when the answer finished without a widget", () => {
    const { container } = renderOpen(
      <RetrievalTrace data={{ ...base, toolCalled: null }} />,
    );
    expect(container.querySelector("[data-role='tool']")?.textContent).toBe(
      "No widget called.",
    );
  });
});
