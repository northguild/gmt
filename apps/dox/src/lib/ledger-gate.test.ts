// @vitest-environment jsdom
import { layoutGates, placeGate } from "./ledger-gate";

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

describe("layoutGates", () => {
  it("keeps every visible gate's chip on the page when several share a track", () => {
    const track = document.createElement("div");
    document.body.append(track);
    const parts = ["next open", "next close"].map((text) => {
      const gate = document.createElement("div");
      gate.dataset["edge"] = "start";
      const chip = document.createElement("span");
      gate.append(chip);
      track.append(gate);
      return { gate, chip, text };
    });
    for (const p of parts) placeGate(p.gate, p.chip, track, 12, p.text);
    layoutGates(track);
    for (const p of parts) {
      expect(p.gate).toBeVisible();
      expect(p.chip).toHaveTextContent(p.text);
    }
    track.remove();
  });
});
