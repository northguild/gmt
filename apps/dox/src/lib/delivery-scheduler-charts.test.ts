/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import { decorative } from "./delivery-scheduler-charts";

/** A stand-in mark whose scene has one label with a point and a hit-test link,
 *  as a built-in `text` mark's does. */
function fakeTextMark() {
  const point = { key: "p", x: 10, y: 20 };
  return {
    initialize: () => ({
      id: "label",
      channels: {},
      render: () => ({
        nodes: [{ kind: "label", key: "n", interaction: { point } }],
        points: [point],
      }),
    }),
  } as never;
}

describe("decorative", () => {
  it("keeps the painted nodes but drops the interaction points and hit links", () => {
    const init = (decorative(fakeTextMark()) as any).initialize({});
    const scene = init.render({});
    expect(scene.points).toEqual([]);
    expect(scene.nodes).toHaveLength(1);
    expect(scene.nodes[0].kind).toBe("label");
    expect(scene.nodes[0].interaction).toBeUndefined();
  });

  it("leaves a mark without a render function as it was", () => {
    const layoutOnly = {
      initialize: () => ({ id: "x", channels: {}, resolveLayout: () => ({}) }),
    } as never;
    const init = (decorative(layoutOnly) as any).initialize({});
    expect(init.render).toBeUndefined();
    expect(typeof init.resolveLayout).toBe("function");
  });
});
