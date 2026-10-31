import { clearFormatterCache } from "../internal/formatterCache";
import { clearValidatedZones } from "../internal/validatedZones";
import { Temporal } from "../internal/temporal";
import { captureSharedState, describeLeaks } from "./sharedState";
import { installTitleGuard } from "./titleGuard";

installTitleGuard();

// Files in the shared project run in one worker, so a file must leave the globals as it found them.
// A `finally` restores a direct assignment such as `Intl.DateTimeFormat = ...`; this check fails the
// file that forgets. Files that replace a module or a global run alone and are not checked.
const sharedBefore =
  typeof process !== "undefined" && process.env.GMT_SHARED_MODULES === "1"
    ? captureSharedState()
    : undefined;

afterAll(() => {
  if (!sharedBefore) return;
  const leaks = describeLeaks(sharedBefore);
  if (leaks.length > 0) {
    throw new Error(
      `This file changed state that later files in the worker share: ${leaks.join("; ")}. Undo it in a finally block, or use vi.spyOn or vi.stubGlobal.`,
    );
  }
});

// The formatter cache and the validated-zone set outlive a call: a test that mocks `Intl` or
// `Temporal` must not meet an entry an earlier test left behind.
beforeEach(() => {
  clearFormatterCache();
  clearValidatedZones();
});

afterEach(() => {
  vi.restoreAllMocks();
  try {
    vi.useRealTimers();
  } catch {}
  // The clock adds the previous reading's sub-millisecond tail to the next one. After a fake clock
  // set before 1970 that tail is negative and would shift the next file's first reading by a
  // millisecond, so one real reading re-seeds it.
  Temporal.Now.instant();
});
