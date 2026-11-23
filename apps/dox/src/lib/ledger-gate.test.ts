// @vitest-environment jsdom
import { placeGate } from "./ledger-gate";

describe("placeGate", () => {
  it("shows the gate and writes its chip", () => {
    const gate = document.createElement("div");
    gate.hidden = true;
    const chip = document.createElement("span");
    const track = document.createElement("div");
    document.body.append(gate, chip, track);
    placeGate(gate, chip, track, 25, "Fri 17:30");
    expect(gate).toBeVisible();
    expect(chip).toHaveTextContent("Fri 17:30");
    gate.remove();
    chip.remove();
    track.remove();
  });
});
