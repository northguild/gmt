/**
 * The three loaders the ledger pages share with their WebMCP tools, when an import fails. The
 * mount and the tool both call them, so each wraps its own failure in a `WidgetLoadError`.
 */
import { GMT_MODULES } from "./gmt-modules";
import { loadBillingLib, loadDwellLib, loadFreeTimeLib } from "./ledger-lib";
import { WidgetLoadError } from "./widget-mount";

const originals = { ...GMT_MODULES };

afterEach(() => {
  Object.assign(GMT_MODULES, originals);
});

const LOADERS = [
  ["loadBillingLib", loadBillingLib, "intermodal/calculate"],
  ["loadDwellLib", loadDwellLib, "transport/calculate"],
  ["loadFreeTimeLib", loadFreeTimeLib, "calendar/validate"],
] as const;

describe.each(LOADERS)("%s", (_name, load, module) => {
  it("answers when every module loads", async () => {
    const lib = await load();
    expect(Object.values(lib).every((f) => typeof f === "function")).toBe(true);
  });

  it("rejects with a WidgetLoadError when an import fails", async () => {
    GMT_MODULES[module] = () => Promise.reject(new Error("offline"));
    await expect(load()).rejects.toBeInstanceOf(WidgetLoadError);
  });
});
