/**
 * Replaces `ResizeObserver` with one that records which observers are still
 * watching, so a test can assert that a widget's `destroy` released every one.
 * Call `restore()` in `afterEach`.
 */
import { vi } from "vitest";

export interface ResizeObserverSpy {
  /** Observers that have called `observe` and not yet `disconnect`. */
  live: Set<object>;
  /** Every observer ever constructed, and how many have disconnected. */
  created: () => number;
  /** Fire the callback of every live observer, as a width change would. */
  fire: () => void;
  restore: () => void;
}

export function spyOnResizeObservers(): ResizeObserverSpy {
  const live = new Set<ResizeObserverLike>();
  let created = 0;
  class ResizeObserverLike {
    constructor(private readonly cb: ResizeObserverCallback) {
      created++;
    }
    observe(): void {
      live.add(this);
    }
    unobserve(): void {}
    disconnect(): void {
      live.delete(this);
    }
    fire(): void {
      this.cb([], this as unknown as ResizeObserver);
    }
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverLike);
  return {
    live,
    created: () => created,
    fire: () => {
      for (const o of live) o.fire();
    },
    restore: () => vi.unstubAllGlobals(),
  };
}
