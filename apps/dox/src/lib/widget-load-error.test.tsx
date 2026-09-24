/**
 * @vitest-environment jsdom
 *
 * A widget whose library cannot load must say so. Every mount used to catch
 * that failure and return an inert handle, leaving controls that looked live
 * and did nothing; nothing tested the path, so nothing noticed. Here each
 * library-backed mount meets a `GMT_MODULES` whose every import rejects.
 */
/// <reference types="vitest/globals" />
import { installJsdomShims } from "~/test/jsdom-shims";
import { GMT_MODULES } from "./gmt-modules";
import {
  mountConverterBench,
  renderConverterTemplate,
} from "./converter-bench-mount";
import { mountDstInspector, renderDstTemplate } from "./dst-inspector-mount";
import {
  mountDwellLedger,
  renderDwellLedgerTemplate,
} from "./dwell-ledger-mount";
import {
  mountFreeTimeLedger,
  renderFreeTimeLedgerTemplate,
} from "./free-time-ledger-mount";
import {
  mountIntervalVisualizer,
  renderIntervalTemplate,
} from "./interval-visualizer-mount";
import {
  showUnavailable,
  UNAVAILABLE_CLASS,
  WidgetLoadError,
  type MountFn,
} from "./widget-mount";

installJsdomShims();

const MOUNTS: [string, () => string, MountFn<never>][] = [
  [
    "dwell ledger",
    () => renderDwellLedgerTemplate(),
    mountDwellLedger as MountFn<never>,
  ],
  [
    "free time ledger",
    () => renderFreeTimeLedgerTemplate(),
    mountFreeTimeLedger as MountFn<never>,
  ],
  [
    "DST inspector",
    () => renderDstTemplate(),
    mountDstInspector as MountFn<never>,
  ],
  [
    "interval visualizer",
    () => renderIntervalTemplate(),
    mountIntervalVisualizer as MountFn<never>,
  ],
  [
    "converter bench",
    () => renderConverterTemplate(),
    mountConverterBench as MountFn<never>,
  ],
];

describe("a widget whose library fails to load", () => {
  const originals = { ...GMT_MODULES };
  const offline = new Error("Failed to fetch dynamically imported module");

  beforeEach(() => {
    for (const key of Object.keys(GMT_MODULES)) {
      GMT_MODULES[key] = () => Promise.reject(offline);
    }
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    Object.assign(GMT_MODULES, originals);
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it.each(MOUNTS)(
    "%s throws WidgetLoadError carrying the cause",
    async (_name, template, mount) => {
      const root = document.createElement("div");
      root.innerHTML = template();
      document.body.append(root);

      const failure = await mount(
        root,
        {} as never,
        new AbortController().signal,
      ).then(
        () => null,
        (error: unknown) => error,
      );
      expect(failure).toBeInstanceOf(WidgetLoadError);
      expect((failure as Error).cause).toBe(offline);
    },
  );
});

describe("showUnavailable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("marks the root, adds one notice with a reload link, and logs the cause", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const root = document.createElement("div");
    root.innerHTML = "<div class='gmt-widget-card'>controls</div>";
    document.body.append(root);

    const cause = new Error("offline");
    showUnavailable(root, cause);
    showUnavailable(root, cause);

    expect(root.dataset.state).toBe("unavailable");
    const notices = root.querySelectorAll(`.${UNAVAILABLE_CLASS}`);
    expect(notices).toHaveLength(1);
    expect(notices[0].getAttribute("role")).toBe("status");
    expect(notices[0].textContent).toContain("couldn’t load");
    expect(notices[0].querySelector("a")?.getAttribute("href")).toBe("");
    // The server-rendered content is kept, not replaced.
    expect(root.querySelector(".gmt-widget-card")).not.toBeNull();
    expect(logged).toHaveBeenCalledWith("widget failed to load", cause);
  });
});
