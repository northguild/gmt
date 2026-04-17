import { afterEach, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  try {
    vi.useRealTimers();
  } catch {}
});
