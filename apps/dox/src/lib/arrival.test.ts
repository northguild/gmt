/**
 * @vitest-environment jsdom
 *
 * The inline head script runs before first paint: it marks a landing load as waiting for the
 * entrance, frees the page after a failsafe, and notes an arrival through a view transition. It
 * runs here against a stand-in window so no listener outlives a test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ARRIVAL_FAILSAFE_MS,
  VIEW_TRANSITION_OPT_IN,
  arrivalInlineSource,
} from "./arrival";

type Listener = (event: { viewTransition: unknown }) => void;

/** What the script can read of the page it was reached from. */
interface Origin {
  /** `navigation.activation.from.url`; absent where the Navigation API is. */
  activation?: string;
  referrer?: string;
}

/** A view transition stand-in that records the types added to it. */
function transition(): { types: Set<string> } {
  return { types: new Set() };
}

interface Stand {
  /** Delivers `pagereveal` to what the script registered. */
  reveal: (viewTransition: unknown) => void;
  root: HTMLElement;
}

const ORIGIN = "https://northguild.dev";

/** Runs the script for `path` on a stand-in window and a fresh root element. */
function run(base: string, path: string, from: Origin = {}): Stand {
  const listeners: Listener[] = [];
  const win = {
    navigation:
      from.activation === undefined
        ? undefined
        : { activation: { from: { url: from.activation } } },
    addEventListener: (name: string, listener: Listener) => {
      if (name === "pagereveal") listeners.push(listener);
    },
  };
  const root = document.createElement("html");
  new Function("window", "document", "location", arrivalInlineSource(base))(
    win,
    { documentElement: root, referrer: from.referrer ?? "" },
    { pathname: path, origin: ORIGIN },
  );
  return {
    reveal: (viewTransition) => {
      for (const listener of listeners) listener({ viewTransition });
    },
    root,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("arrivalInlineSource", () => {
  it("marks the landing as waiting", () => {
    expect(run("/", "/").root.dataset["entrance"]).toBe("wait");
  });

  it("marks the landing under a base path, with or without the trailing slash", () => {
    expect(run("/gmt/", "/gmt/").root.dataset["entrance"]).toBe("wait");
    expect(run("/gmt/", "/gmt").root.dataset["entrance"]).toBe("wait");
    expect(run("/gmt/", "/gmt/index.html").root.dataset["entrance"]).toBe(
      "wait",
    );
  });

  it("leaves every other page alone", () => {
    expect(run("/", "/install/").root.dataset["entrance"]).toBeUndefined();
    expect(run("/gmt/", "/").root.dataset["entrance"]).toBeUndefined();
  });

  it("frees a page still waiting after the failsafe", () => {
    const { root } = run("/", "/");
    vi.advanceTimersByTime(ARRIVAL_FAILSAFE_MS - 1);
    expect(root.dataset["entrance"]).toBe("wait");
    vi.advanceTimersByTime(1);
    expect(root.dataset["entrance"]).toBe("static");
  });

  it("does not touch a page the sequencer already started", () => {
    const { root } = run("/", "/");
    root.dataset["entrance"] = "run";
    vi.advanceTimersByTime(ARRIVAL_FAILSAFE_MS * 2);
    expect(root.dataset["entrance"]).toBe("run");
  });

  it("notes an arrival through a view transition", () => {
    const { reveal, root } = run("/", "/");
    reveal({ finished: Promise.resolve() });
    expect(root.dataset["arrival"]).toBe("transition");
  });

  it("notes a direct load as a load, and nothing before the reveal", () => {
    const { reveal, root } = run("/", "/");
    expect(root.dataset["arrival"]).toBeUndefined();
    reveal(null);
    expect(root.dataset["arrival"]).toBe("load");
  });

  it("keeps a value set before the reveal", () => {
    const { reveal, root } = run("/", "/");
    root.dataset["arrival"] = "transition";
    reveal(null);
    expect(root.dataset["arrival"]).toBe("transition");
  });

  it("notes the transition on pages that are not the landing", () => {
    const { reveal, root } = run("/", "/install/");
    reveal({});
    expect(root.dataset["arrival"]).toBe("transition");
  });
});

describe("arrival from the site above", () => {
  /** Reveals `/gmt/` through a transition that came from `from`. */
  function arrive(from: Origin, base = "/gmt/"): Set<string> {
    const { reveal } = run(base, "/gmt/", from);
    const vt = transition();
    reveal(vt);
    return vt.types;
  }

  it("adds the type for an arrival from the root of the same origin", () => {
    expect([...arrive({ activation: `${ORIGIN}/` })]).toEqual(["from-landing"]);
  });

  it("adds the type for any page of the same origin outside this site", () => {
    expect(
      arrive({ activation: `${ORIGIN}/blog/post/` }).has("from-landing"),
    ).toBe(true);
  });

  it("does not add it for a page of this site", () => {
    expect(arrive({ activation: `${ORIGIN}/gmt/guides/x/` }).size).toBe(0);
    expect(arrive({ activation: `${ORIGIN}/gmt/` }).size).toBe(0);
    expect(arrive({ activation: `${ORIGIN}/gmt` }).size).toBe(0);
  });

  it("does not mistake a sibling path that starts with the base for this site", () => {
    expect(arrive({ activation: `${ORIGIN}/gmtx/` }).has("from-landing")).toBe(
      true,
    );
  });

  it("does not add it for another origin", () => {
    expect(arrive({ activation: "https://example.com/" }).size).toBe(0);
  });

  it("does nothing without a view transition", () => {
    const { reveal, root } = run("/gmt/", "/gmt/", {
      activation: `${ORIGIN}/`,
    });
    expect(() => reveal(null)).not.toThrow();
    expect(root.dataset["arrival"]).toBe("load");
  });

  it("does nothing when the transition has no types", () => {
    const { reveal } = run("/gmt/", "/gmt/", { activation: `${ORIGIN}/` });
    expect(() => reveal({})).not.toThrow();
  });

  it("falls back to the referrer where the Navigation API is missing", () => {
    expect(arrive({ referrer: `${ORIGIN}/` }).has("from-landing")).toBe(true);
    expect(arrive({ referrer: `${ORIGIN}/gmt/guides/x/` }).size).toBe(0);
    expect(arrive({ referrer: "https://example.com/" }).size).toBe(0);
  });

  it("adds nothing when no previous page is known", () => {
    expect(arrive({}).size).toBe(0);
  });

  it("ignores an address it cannot read", () => {
    expect(arrive({ activation: "not a url" }).size).toBe(0);
  });

  it("never adds it when the site is the origin's root", () => {
    expect(arrive({ activation: `${ORIGIN}/blog/` }, "/").size).toBe(0);
  });
});

describe("the view-transition opt-in", () => {
  it("opts in, and out under reduced motion", () => {
    expect(VIEW_TRANSITION_OPT_IN).toContain(
      "@view-transition{navigation:auto}",
    );
    expect(VIEW_TRANSITION_OPT_IN).toMatch(
      /@media\(prefers-reduced-motion:reduce\)\{@view-transition\{navigation:none\}\}/,
    );
  });
});

describe("the carousel mark", () => {
  it("marks the landing as waiting for the carousel, on any screen", () => {
    expect(run("/", "/").root.dataset["homeCarousel"]).toBe("wait");
  });

  it("leaves a page that is not the landing alone", () => {
    expect(run("/", "/install/").root.dataset["homeCarousel"]).toBe(undefined);
  });

  it("works under a base path", () => {
    expect(run("/gmt/", "/gmt/").root.dataset["homeCarousel"]).toBe("wait");
  });

  it("removes a mark nothing has replaced when the failsafe fires", () => {
    const { root } = run("/", "/");
    vi.advanceTimersByTime(ARRIVAL_FAILSAFE_MS);
    expect(root.dataset["homeCarousel"]).toBe(undefined);
  });

  it("keeps the mark once the carousel has taken it over", () => {
    const { root } = run("/", "/");
    root.dataset["homeCarousel"] = "on";
    vi.advanceTimersByTime(ARRIVAL_FAILSAFE_MS);
    expect(root.dataset["homeCarousel"]).toBe("on");
  });
});
