/**
 * The three loaders the zone pages share with their WebMCP tools, when an import fails. The
 * mount and the tool both call them, so each wraps its own failure in a `WidgetLoadError`.
 */
import { GMT_MODULES } from "./gmt-modules";
import { WidgetLoadError } from "./widget-mount";
import { loadConverterLib, loadDstLib, loadIntervalLib } from "./zones-lib";

const originals = { ...GMT_MODULES };

afterEach(() => {
  Object.assign(GMT_MODULES, originals);
});

const LOADERS = [
  ["loadConverterLib", loadConverterLib, "zoned/format"],
  ["loadDstLib", loadDstLib, "zoned/get"],
  ["loadIntervalLib", loadIntervalLib, "zoned/interval"],
] as const;

describe.each(LOADERS)("%s", (_name, load, module) => {
  it("answers when every module loads", async () => {
    const lib = await load();
    expect(Object.keys(lib).length).toBeGreaterThan(0);
  });

  it("rejects with a WidgetLoadError when an import fails", async () => {
    GMT_MODULES[module] = () => Promise.reject(new Error("offline"));
    await expect(load()).rejects.toBeInstanceOf(WidgetLoadError);
  });
});

it("loadIntervalLib answers one function per operation", async () => {
  const lib = await loadIntervalLib();
  expect(Object.values(lib.fns).every((f) => typeof f === "function")).toBe(
    true,
  );
  expect(Object.keys(lib.fns).sort()).toEqual([
    "difference",
    "intersection",
    "union",
    "xor",
  ]);
});
