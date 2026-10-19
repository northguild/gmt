import { clearFormatterCache } from "./formatterCache";
import { countIntlConstructions } from "../test/countIntlConstructions";
import { formatDuration } from "../duration/format/formatDuration";
import { formatCalendar } from "../plain/format/formatCalendar";
import { formatDateRange } from "../plain/format/formatDateRange";
import { formatDateTime } from "../plain/format/formatDateTime";
import { formatDateTimeRange } from "../plain/format/formatDateTimeRange";
import { formatDateTimeToParts } from "../plain/format/formatDateTimeToParts";
import { formatDateToParts } from "../plain/format/formatDateToParts";
import { formatRelativeDate } from "../plain/format/formatRelativeDate";
import { formatTime } from "../plain/format/formatTime";
import { getLocaleEraNames } from "../plain/locale/getLocaleEraNames";
import { getLocaleMeridiems } from "../plain/locale/getLocaleMeridiems";
import { getLocaleMonthNames } from "../plain/locale/getLocaleMonthNames";
import { getLocaleWeekdayNames } from "../plain/locale/getLocaleWeekdayNames";
import { formatTimeZoneName } from "../zoned/format/formatTimeZoneName";
import { formatZonedDateTime } from "../zoned/format/formatZonedDateTime";
import { formatZonedRange } from "../zoned/format/formatZonedRange";
import { formatZonedToParts } from "../zoned/format/formatZonedToParts";

const zoned = "2024-07-04T15:05:00+02:00[Europe/Amsterdam]";
const zonedLater = "2024-07-09T15:05:00+02:00[Europe/Amsterdam]";

// Each site is called twice with the same plain arguments; the second call must construct no
// `Intl` formatter. Locale and options are fixed, and the zone is a string wherever the site
// takes one, so every site is cacheable.
describe("every format site reuses its formatter", () => {
  beforeEach(() => {
    clearFormatterCache();
  });

  it.each`
    site                       | call
    ${"formatTime"}            | ${() => formatTime("15:05:00", "en-GB", { timeStyle: "short" })}
    ${"formatDateTime"}        | ${() => formatDateTime("2024-07-04T15:05:00", "en-GB", { dateStyle: "long" })}
    ${"formatDateRange"}       | ${() => formatDateRange("2024-07-04", "2024-07-09", "en-GB", { dateStyle: "long" })}
    ${"formatDateTimeRange"}   | ${() => formatDateTimeRange("2024-07-04T15:05:00", "2024-07-09T16:00:00", "en-GB", { dateStyle: "long" })}
    ${"formatDateToParts"}     | ${() => formatDateToParts("2024-07-04", "en-GB", { dateStyle: "long" })}
    ${"formatDateTimeToParts"} | ${() => formatDateTimeToParts("2024-07-04T15:05:00", "en-GB", { dateStyle: "long" })}
    ${"formatCalendar"}        | ${() => formatCalendar("2024-07-04T15:05:00", "en-GB", { reference: "2024-07-03T10:00:00" })}
    ${"formatRelativeDate"}    | ${() => formatRelativeDate("2024-07-04", "en-GB", { reference: "2024-07-01" })}
    ${"formatZonedDateTime"}   | ${() => formatZonedDateTime(zoned, "en-GB", { dateStyle: "long" })}
    ${"formatZonedRange"}      | ${() => formatZonedRange(zoned, zonedLater, "en-GB", { dateStyle: "long" })}
    ${"formatZonedToParts"}    | ${() => formatZonedToParts(zoned, "en-GB", { dateStyle: "long" })}
    ${"formatTimeZoneName"}    | ${() => formatTimeZoneName("Europe/Amsterdam", "en-GB")}
    ${"formatDuration"}        | ${() => formatDuration("P1DT2H", "en-GB", { style: "long" })}
    ${"getLocaleMonthNames"}   | ${() => getLocaleMonthNames("en-GB")}
    ${"getLocaleWeekdayNames"} | ${() => getLocaleWeekdayNames("en-GB")}
    ${"getLocaleEraNames"}     | ${() => getLocaleEraNames("en-GB")}
    ${"getLocaleMeridiems"}    | ${() => getLocaleMeridiems("en-GB")}
  `("$site builds no formatter on the second call", ({ call }) => {
    let first: unknown;
    let second: unknown;
    const built = countIntlConstructions(
      ["DateTimeFormat", "NumberFormat", "ListFormat", "RelativeTimeFormat"],
      () => {
        second = call();
      },
      () => {
        first = call();
      },
    );
    expect(first).not.toBe("");
    expect({ second, built }).toEqual({ second: first, built: 0 });
  });
});
