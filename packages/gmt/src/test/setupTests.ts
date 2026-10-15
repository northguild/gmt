afterEach(() => {
  vi.restoreAllMocks();
  try {
    vi.useRealTimers();
  } catch {}
});
