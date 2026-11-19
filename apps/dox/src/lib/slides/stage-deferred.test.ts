/**
 * @vitest-environment jsdom
 *
 * The deferred stage: it hands the deck a stage at once and gives the real one the deck's own data
 * when that arrives. The real stage is a fake here; what is under test is what it is given, when,
 * and in what order the early calls reach it.
 */
/* oxlint-disable dox-test/no-implementation-assert */
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadDeckRuntime } from "~/slides/deck-runtime";
import { FIXTURE_STAGE } from "~/test/deck-stage-fixture";
import { NO_STAGE_DATA } from "./stage-data";
import { mountDeckStage } from "./stage-deferred";
import { mountSpaceStage, type SpaceStage } from "./stage";

const fake = (): SpaceStage => ({
  goTo: vi.fn(),
  overview: vi.fn(),
  steer: vi.fn(),
  returnHome: vi.fn(),
  lapse: vi.fn(),
  pinFilings: vi.fn(),
  destroy: vi.fn(),
});

vi.mock("./stage", () => ({ mountSpaceStage: vi.fn() }));

// The registry knows one made-up deck, so no real deck is named here.
const TEST_DECK = "test-deck";
vi.mock("~/slides/deck-runtime", () => ({
  loadDeckRuntime: vi.fn(async (slug: string) =>
    slug === TEST_DECK ? { stage: FIXTURE_STAGE } : null,
  ),
}));

let abort: AbortController | undefined;
afterEach(() => {
  abort?.abort();
  abort = undefined;
  vi.mocked(mountSpaceStage).mockReset();
});

function rootFor(slug: string): HTMLElement {
  const root = document.createElement("article");
  root.dataset["deckSlug"] = slug;
  return root;
}

describe("mountDeckStage", () => {
  it("mounts the stage with the deck's data and replays what was asked before it, in order", async () => {
    const real = fake();
    vi.mocked(mountSpaceStage).mockReturnValue(real);
    abort = new AbortController();
    const stage = mountDeckStage(rootFor(TEST_DECK), {
      signal: abort.signal,
    });
    stage.goTo("Asia/Tokyo", { hop: true });
    stage.lapse("plain");
    expect(real.goTo).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(real.lapse).toHaveBeenCalledWith("plain"));
    expect(real.goTo).toHaveBeenCalledWith("Asia/Tokyo", { hop: true });
    const data = vi.mocked(mountSpaceStage).mock.calls[0]![1].data;
    expect(Object.keys(data.lapses)).toContain("plain");
    stage.overview(true);
    expect(real.overview).toHaveBeenCalledWith(true);
  });

  it("gives a deck with no runtime an empty stage data", async () => {
    vi.mocked(mountSpaceStage).mockReturnValue(fake());
    abort = new AbortController();
    mountDeckStage(rootFor("no-such-deck"), { signal: abort.signal });
    await vi.waitFor(() => expect(mountSpaceStage).toHaveBeenCalled());
    expect(vi.mocked(mountSpaceStage).mock.calls[0]![1].data).toBe(
      NO_STAGE_DATA,
    );
  });

  it("never mounts the stage when the deck is gone before its data arrives", async () => {
    abort = new AbortController();
    const stage = mountDeckStage(rootFor(TEST_DECK), {
      signal: abort.signal,
    });
    abort.abort();
    stage.destroy();
    // The same load the stage waits on, then the turn its answer takes to arrive.
    await loadDeckRuntime(TEST_DECK);
    await Promise.resolve();
    expect(mountSpaceStage).not.toHaveBeenCalled();
  });
});
