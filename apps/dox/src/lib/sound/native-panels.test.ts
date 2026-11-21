/**
 * @vitest-environment jsdom
 */
import { screen } from "@testing-library/dom";
import { raw, setHtml } from "~/widgets/builders";

const cue = vi.fn();
vi.mock("./cue", () => ({ cue: (name: string) => cue(name) }));

import { watchNativePanels } from "./native-panels";

let stop: () => void;

beforeEach(() => {
  cue.mockClear();
  setHtml(
    document.body,
    raw(
      `<div popover aria-label="Auto panel">Auto</div><div popover="manual" aria-label="Tooltip">Tip</div><p>Plain</p>`,
    ),
  );
  stop = watchNativePanels();
});

afterEach(() => {
  stop();
  document.body.replaceChildren();
});

/** jsdom has no popover; the browser fires `toggle` on the element after it changes state. */
function toggle(name: string, newState: "open" | "closed") {
  // oxlint-disable-next-line dox-test/no-dispatch-event -- jsdom has no popover, so no press can make the browser fire `toggle`; the event is the input
  const event = new Event("toggle");
  Object.assign(event, { newState });
  // oxlint-disable-next-line dox-test/no-dispatch-event -- same input, sent
  screen.getByLabelText(name, { selector: "[popover]" }).dispatchEvent(event);
}

describe("the open and close Felt slide for native panels", () => {
  it("plays open and close as a popover toggles", () => {
    toggle("Auto panel", "open");
    toggle("Auto panel", "closed");
    expect(cue.mock.calls).toEqual([["open"], ["close"]]);
  });

  it("is silent for a manual popover, which is not a panel", () => {
    toggle("Tooltip", "open");
    expect(cue).not.toHaveBeenCalled();
  });

  it("stops listening when stopped", () => {
    stop();
    toggle("Auto panel", "open");
    expect(cue).not.toHaveBeenCalled();
  });
});
