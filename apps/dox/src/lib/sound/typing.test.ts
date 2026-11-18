/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { raw, setHtml } from "~/widgets/builders";

const cue = vi.fn();
vi.mock("./cue", () => ({ cue: (name: string) => cue(name) }));

import { watchTyping } from "./typing";

let stop: () => void;

beforeEach(() => {
  cue.mockClear();
  setHtml(
    document.body,
    raw(
      `<label>Notes <textarea></textarea></label>
       <label>Name <input /></label>
       <label>Find <input type="search" /></label>
       <label>Count <input type="number" /></label>
       <label>Secret <input type="password" /></label>
       <label>Fixed <textarea readonly></textarea></label>
       <label>Agree <input type="checkbox" /></label>
       <div role="textbox" aria-label="Editor" contenteditable="true" tabindex="0"></div>
       <button type="button">Go</button>`,
    ),
  );
  stop = watchTyping();
});

afterEach(() => {
  stop();
  document.body.replaceChildren();
});

describe("the Data blip for typing", () => {
  it("plays a blip per printable key, Backspace and Enter in a textarea", async () => {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Notes"), "ab{Backspace}{Enter}");
    expect(cue.mock.calls).toEqual([["key"], ["key"], ["key"], ["key"]]);
  });

  it.each(["Name", "Find", "Count"])(
    "plays a blip in a one-line field (%s) with no opt-in",
    async (label) => {
      const user = userEvent.setup();
      await user.type(screen.getByLabelText(label), "12");
      expect(cue.mock.calls).toEqual([["key"], ["key"]]);
    },
  );

  it("is silent for Enter in a one-line field, where it submits or picks", async () => {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Find"), "{Enter}");
    expect(cue).not.toHaveBeenCalled();
  });

  it("plays a blip in a contenteditable element", async () => {
    const editor = screen.getByRole("textbox", { name: "Editor" });
    // jsdom does not compute isContentEditable; a browser reads it off the attribute.
    Object.defineProperty(editor, "isContentEditable", { value: true });
    const user = userEvent.setup();
    await user.click(editor);
    await user.keyboard("x{Enter}");
    expect(cue.mock.calls).toEqual([["key"], ["key"]]);
  });

  it("is silent in a password field", async () => {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Secret"), "hunter2");
    expect(cue).not.toHaveBeenCalled();
  });

  it("is silent in a read-only field", async () => {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Fixed"), "abc");
    expect(cue).not.toHaveBeenCalled();
  });

  it("is silent for keys on controls that take no text", async () => {
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Agree"));
    await user.keyboard(" a");
    await user.click(screen.getByRole("button", { name: "Go" }));
    await user.keyboard("{Enter}b");
    expect(cue).not.toHaveBeenCalled();
  });

  it("is silent for keys that are not typing", async () => {
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Notes"));
    await user.keyboard("{Shift}{ArrowLeft}{Tab}");
    expect(cue).not.toHaveBeenCalled();
  });

  it("is silent for Ctrl and Meta chords", async () => {
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Notes"));
    await user.keyboard("{Control>}a{/Control}{Meta>}c{/Meta}");
    expect(cue).not.toHaveBeenCalled();
  });

  it("is silent for a held key after the first press", async () => {
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Notes"));
    await user.keyboard("{a>4}{/a}");
    expect(cue).toHaveBeenCalledTimes(1);
  });

  it("is silent while an input method is composing", () => {
    const field = screen.getByLabelText("Notes");
    field.focus();
    // oxlint-disable-next-line dox-test/no-dispatch-event -- user-event cannot compose; an IME's keydown has isComposing set, and that flag is the input
    const event = new KeyboardEvent("keydown", {
      key: "a",
      isComposing: true,
      bubbles: true,
    });
    // oxlint-disable-next-line dox-test/no-dispatch-event -- same input, sent
    field.dispatchEvent(event);
    expect(cue).not.toHaveBeenCalled();
  });

  it("stops listening when stopped", async () => {
    const user = userEvent.setup();
    stop();
    await user.type(screen.getByLabelText("Notes"), "a");
    expect(cue).not.toHaveBeenCalled();
  });
});
