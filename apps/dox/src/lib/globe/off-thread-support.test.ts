import { canDrawOffThread } from "./off-thread-support";

class FakeCanvas {
  transferControlToOffscreen() {}
}
class BareCanvas {}

const full = {
  Worker: class {},
  OffscreenCanvas: class {},
  HTMLCanvasElement: FakeCanvas,
};

describe("canDrawOffThread", () => {
  it("is true when workers, OffscreenCanvas and transfer all exist", () => {
    expect(canDrawOffThread(full)).toBe(true);
  });

  it.each([
    ["no Worker", { ...full, Worker: undefined }],
    ["no OffscreenCanvas", { ...full, OffscreenCanvas: undefined }],
    ["no HTMLCanvasElement", { ...full, HTMLCanvasElement: undefined }],
    [
      "no transferControlToOffscreen",
      { ...full, HTMLCanvasElement: BareCanvas },
    ],
  ])("is false with %s", (_name, env) => {
    expect(canDrawOffThread(env)).toBe(false);
  });
});
