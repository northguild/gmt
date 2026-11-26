/**
 * @vitest-environment jsdom
 */
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { raw, setHtml } from "~/widgets/builders";

const cue = vi.fn();
vi.mock("./cue", () => ({ cue: (name: string) => cue(name) }));

import { watchCodeCopy } from "./code-copy";

let stop: () => void;

beforeEach(() => {
  cue.mockClear();
  setHtml(
    document.body,
    raw(
      `<div class="expressive-code"><div class="copy"><button type="button">Copy code</button></div></div><button type="button">Other</button>`,
    ),
  );
  stop = watchCodeCopy();
});

afterEach(() => {
  stop();
  document.body.replaceChildren();
});

describe("the press ping for a code block's copy", () => {
  it("plays copy, and only copy, when the button is pressed", async () => {
    await userEvent.click(screen.getByRole("button", { name: "Copy code" }));
    expect(cue.mock.calls).toEqual([["copy"]]);
  });

  it("is silent for any other button", async () => {
    await userEvent.click(screen.getByRole("button", { name: "Other" }));
    expect(cue).not.toHaveBeenCalled();
  });

  it("stops listening when stopped", async () => {
    stop();
    await userEvent.click(screen.getByRole("button", { name: "Copy code" }));
    expect(cue).not.toHaveBeenCalled();
  });
});
