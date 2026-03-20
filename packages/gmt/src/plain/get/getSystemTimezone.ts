export function getSystemTimezone(): string {
  try {
    const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return systemTimeZone || "";
  } catch {
    return "";
  }
}
