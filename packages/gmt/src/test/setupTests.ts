import { clearFormatterCache } from "../internal/formatterCache";
import { clearValidatedZones } from "../internal/validatedZones";
import { installTitleGuard } from "./titleGuard";

installTitleGuard();

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
});
