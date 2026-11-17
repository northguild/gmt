/**
 * @vitest-environment jsdom
 *
 * The Connection Checker when only the single-leg arrival lookup hits the edge of the supported
 * time range: the strip and its summary line both say so, as they did before the mount took its
 * facts from `connectionFacts`. A stub library throws a RangeError from `scheduleDelivery([leg])`
 * while the whole call succeeds.
 */
import { screen } from "@testing-library/dom";
import {
  WIDGET_REGISTRY,
  type AnyWidgetEntry,
} from "~/components/ask/widget-registry";
import { installJsdomShims } from "~/test/jsdom-shims";
import { renderWidget } from "~/test/render-widget";
import { transportLib } from "~/test/transport-lib";
import { RANGE_EDGE_TEXT } from "./widget-ui";

installJsdomShims();

vi.mock("./transport-lib", () => ({
  loadTransportLib: async () => ({
    ...transportLib,
    scheduleDelivery: (legs: unknown, options?: unknown) => {
      if (Array.isArray(legs) && legs.length === 1) {
        throw new RangeError("Invalid time value");
      }
      return transportLib.scheduleDelivery(legs, options);
    },
  }),
}));

const entry = WIDGET_REGISTRY["showConnectionChecker"] as AnyWidgetEntry;

describe("a single-leg arrival past the supported range", () => {
  it("draws the range-edge strip and words the summary the same way", async () => {
    const w = await renderWidget(entry, { args: {} });
    try {
      const strip = screen.getByLabelText("Handoff strip", {
        selector: "output",
      });
      expect(strip).toHaveTextContent("NO SIGNAL");
      // The summary line beneath the strip carries the same notice.
      const summary = screen.getByText(RANGE_EDGE_TEXT);
      expect(strip).not.toContainElement(summary);
      // The whole schedule still answers, so the output and verdict are the normal ones.
      expect(
        screen.getByLabelText("What scheduleDelivery returned"),
      ).not.toHaveTextContent("NO SIGNAL");
    } finally {
      w.destroy();
    }
  });
});
