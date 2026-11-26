import type { FrameState } from "../renderer";
import type { GlobeTheme } from "../types";
import { createPainter } from "./painter";
import { createWorkerHost, type FromWorker } from "./protocol";

vi.mock("./painter", () => ({ createPainter: vi.fn() }));

const theme = { name: "t" } as unknown as GlobeTheme;
const frame = { zoom: 1 } as unknown as FrameState;

function setup(context: unknown = {}) {
  const calls: string[] = [];
  const painter = {
    resize: (...args: unknown[]) => calls.push(`resize ${args.join(",")}`),
    setTheme: () => calls.push("theme"),
    setRegions: () => calls.push("regions"),
    setMarkers: () => calls.push("markers"),
    setArcs: () => calls.push("arcs"),
    render: () => calls.push("render"),
    destroy: () => calls.push("destroy"),
  };
  vi.mocked(createPainter).mockReturnValue(painter);
  const posted: FromWorker[] = [];
  const host = createWorkerHost(
    (message) => posted.push(message),
    () => {
      throw new Error("no buffer in this test");
    },
  );
  const canvas = { getContext: () => context } as unknown as OffscreenCanvas;
  return { host, posted, calls, canvas };
}

afterEach(() => vi.clearAllMocks());

describe("the worker side of the canvas 2D protocol", () => {
  it("reports ready once it has a 2D context", () => {
    const { host, posted, canvas } = setup();
    host.handle({ type: "init", canvas, theme, labelFont: "12px x" });
    expect(posted).toEqual([{ type: "ready" }]);
  });

  it("reports failure instead of ready when there is no 2D context", () => {
    const { host, posted, canvas } = setup(null);
    host.handle({ type: "init", canvas, theme, labelFont: "12px x" });
    expect(posted).toEqual([
      { type: "failed", reason: "canvas 2D is unavailable" },
    ]);
  });

  it("applies only the state a frame carries, then draws and replies with its number", () => {
    const { host, posted, calls, canvas } = setup();
    host.handle({ type: "init", canvas, theme, labelFont: "12px x" });
    posted.length = 0;

    host.handle({
      type: "frame",
      seq: 7,
      frame,
      size: { width: 400, height: 300, dpr: 2 },
      markers: [],
    });
    expect(calls).toEqual(["resize 400,300,2", "markers", "render"]);
    expect(posted).toEqual([{ type: "drawn", seq: 7 }]);

    calls.length = 0;
    host.handle({ type: "frame", seq: 8, frame });
    expect(calls).toEqual(["render"]);
  });

  it("sets the theme before drawing, so a frame never mixes palettes", () => {
    const { host, calls, canvas } = setup();
    host.handle({ type: "init", canvas, theme, labelFont: "12px x" });
    calls.length = 0;
    host.handle({ type: "frame", seq: 1, frame, theme, regions: [], arcs: [] });
    expect(calls).toEqual(["theme", "regions", "arcs", "render"]);
  });

  it("ignores a frame that arrives before init", () => {
    const { host, posted } = setup();
    host.handle({ type: "frame", seq: 1, frame });
    expect(posted).toEqual([]);
  });

  it("reports a drawing error as a failure and stays alive", () => {
    const { host, posted, canvas } = setup();
    host.handle({ type: "init", canvas, theme, labelFont: "12px x" });
    vi.mocked(createPainter).mock.results[0]!.value.render = () => {
      throw new Error("boom");
    };
    posted.length = 0;
    host.handle({ type: "frame", seq: 2, frame });
    expect(posted).toEqual([{ type: "failed", reason: "boom" }]);
  });

  it("destroys the painter on destroy and ignores later frames", () => {
    const { host, posted, calls, canvas } = setup();
    host.handle({ type: "init", canvas, theme, labelFont: "12px x" });
    calls.length = 0;
    posted.length = 0;
    host.handle({ type: "destroy" });
    host.handle({ type: "frame", seq: 3, frame });
    expect(calls).toEqual(["destroy"]);
    expect(posted).toEqual([]);
  });
});
