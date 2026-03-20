import { Temporal } from "@js-temporal/polyfill";

export function mapDaysInMonth(month: string): string[] {
  try {
    const yearMonth = Temporal.PlainYearMonth.from(month);

    if (yearMonth.toString() !== month) {
      return [];
    }

    const daysInMonth = yearMonth.daysInMonth;

    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = (index + 1).toString().padStart(2, "0");
      return `${yearMonth.toString()}-${day}`;
    });
  } catch {
    return [];
  }
}
