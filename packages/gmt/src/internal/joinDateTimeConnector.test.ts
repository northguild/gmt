import { expectDateTimeEqual } from "../test";
import { joinDateTimeConnector } from "./joinDateTimeConnector";
import { normalizeDateTime } from "./normalizeDateTime";

const EPOCH_MS = Date.UTC(2024, 2, 15, 14, 30); // 2024-03-15T14:30:00Z

// Callers (formatCalendar*) always pipe this helper's output through
// normalizeDateTime, which collapses Intl's narrow no-break space before
// AM/PM to an ordinary space. Match that here so expectations read as
// plain ASCII instead of embedding  .
function join(
  epochMs: number,
  timeZone: string,
  locale: string,
  dayLabel: string,
  timeStyle: "short" | "medium" | "full",
): string {
  return normalizeDateTime(
    joinDateTimeConnector(epochMs, timeZone, locale, dayLabel, timeStyle),
  );
}

describe("joinDateTimeConnector", () => {
  it.each`
    locale     | expected
    ${"en-US"} | ${"Tomorrow at 2:30 PM"}
    ${"en-GB"} | ${"Tomorrow at 14:30"}
    ${"de-DE"} | ${"Tomorrow um 14:30"}
    ${"fr-FR"} | ${"Tomorrow à 14:30"}
    ${"tr-TR"} | ${"Tomorrow 14:30"}
  `(
    "joins 'Tomorrow' with the $locale time using its own connector",
    ({ locale, expected }) => {
      expect(join(EPOCH_MS, "UTC", locale, "Tomorrow", "short")).toBe(expected);
    },
  );

  it("strips ru-RU's date-side ' г.' suffix out of the connector instead of leaking it", () => {
    expect(join(EPOCH_MS, "UTC", "ru-RU", "Завтра", "short")).toBe(
      "Завтра в 14:30",
    );
  });

  it("preserves day-period-before-hour ordering (ko-KR, zh-TW)", () => {
    // ko-KR's day period ("오후") is one of the CJK words that some ICU
    // builds render as ASCII "PM" instead — see icuVariants.ts. This is a
    // test-comparison concern only; the ordering (day period before hour)
    // is what this case actually verifies.
    expectDateTimeEqual(
      join(EPOCH_MS, "UTC", "ko-KR", "내일", "short"),
      "내일 오후 2:30",
    );
    expectDateTimeEqual(
      join(EPOCH_MS, "UTC", "zh-TW", "明天", "short"),
      "明天 下午2:30",
    );
  });

  it.each`
    timeStyle   | expected
    ${"short"}  | ${"Tomorrow at 2:30 PM"}
    ${"medium"} | ${"Tomorrow at 2:30:00 PM"}
    ${"full"}   | ${"Tomorrow at 2:30:00 PM Coordinated Universal Time"}
  `("timeStyle:$timeStyle produces $expected", ({ timeStyle, expected }) => {
    expect(join(EPOCH_MS, "UTC", "en-US", "Tomorrow", timeStyle)).toBe(
      expected,
    );
  });

  it("honors the given timeZone for both the connector lookup and the time rendered", () => {
    expect(
      join(EPOCH_MS, "America/New_York", "en-US", "Tomorrow", "short"),
    ).toBe("Tomorrow at 10:30 AM");
  });
});
