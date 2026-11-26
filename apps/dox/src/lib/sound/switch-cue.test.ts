/**
 * @vitest-environment jsdom
 */
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { switchField } from "~/widgets/builders";
import { renderHtml } from "~/widgets/test-fixture";

const cue = vi.fn();
vi.mock("./cue", () => ({ cue: (name: string) => cue(name) }));

import { watchSwitchCue } from "./switch-cue";

let stop: () => void;

beforeEach(() => {
  cue.mockClear();
  stop = watchSwitchCue();
});

afterEach(() => stop());

describe("the Ice snap on a kit switch", () => {
  it("plays when a reader flips it, with the mouse or the keyboard", async () => {
    renderHtml(switchField({ label: "Aura" }));
    const user = userEvent.setup();
    const sw = screen.getByRole("switch", { name: "Aura" });
    await user.click(sw);
    await user.keyboard(" ");
    expect(cue.mock.calls).toEqual([["toggle"], ["toggle"]]);
  });

  it("is silent when code sets the switch", () => {
    renderHtml(switchField({ label: "Aura" }));
    screen.getByRole<HTMLInputElement>("switch", {
      name: "Aura",
    }).checked = true;
    expect(cue).not.toHaveBeenCalled();
  });

  it("listens once however often it is started", async () => {
    watchSwitchCue();
    renderHtml(switchField({ label: "Aura" }));
    await userEvent.click(screen.getByRole("switch", { name: "Aura" }));
    expect(cue).toHaveBeenCalledOnce();
  });
});
