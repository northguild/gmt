/**
 * Playground spec types and the startOfZoned spec.
 *
 * Each spec describes one live playground: which gmt module + function it
 * calls, the positional and option-object parameters to render as inputs,
 * and the return type (for sentinel detection).
 */

export type ParamType = "string" | "enum";

export interface ParamSpec {
  name: string;
  label?: string;
  type: ParamType;
  value: string;
  options?: string[];
}

export interface PlaygroundSpec {
  module: string;
  fn: string;
  params: ParamSpec[];
  options?: ParamSpec[];
  returnType: "string" | "number" | "boolean" | "array";
  sentinelLabel?: string;
}

export const PLAYGROUND_SPECS: Record<string, PlaygroundSpec> = {
  startOfZoned: {
    module: "zoned/calculate",
    fn: "startOfZoned",
    params: [
      {
        name: "value",
        type: "string",
        value: "2024-11-03T01:45:00-05:00[America/New_York]",
      },
      {
        name: "unit",
        type: "enum",
        value: "hour",
        options: [
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond",
        ],
      },
    ],
    options: [
      {
        name: "disambiguation",
        type: "enum",
        value: "compatible",
        options: ["compatible", "earlier", "later", "reject"],
      },
      {
        name: "offset",
        type: "enum",
        value: "ignore",
        options: ["prefer", "use", "ignore", "reject"],
      },
    ],
    returnType: "string",
  },

  addZoned: {
    module: "zoned/calculate",
    fn: "addZoned",
    params: [
      {
        name: "value",
        type: "string",
        value: "2024-03-10T12:00:00-05:00[America/New_York]",
      },
      {
        name: "duration",
        type: "string",
        value: "{\"days\":7}",
      },
    ],
    options: [
      {
        name: "disambiguation",
        type: "enum",
        value: "compatible",
        options: ["compatible", "earlier", "later", "reject"],
      },
    ],
    returnType: "string",
  },

  addMonths: {
    module: "plain/calculate",
    fn: "addMonths",
    params: [
      {
        name: "value",
        type: "string",
        value: "2024-01-31",
      },
      {
        name: "months",
        type: "string",
        value: "1",
      },
    ],
    returnType: "string",
  },

  addDays: {
    module: "plain/calculate",
    fn: "addDays",
    params: [
      {
        name: "value",
        type: "string",
        value: "2024-03-15",
      },
      {
        name: "days",
        type: "string",
        value: "5",
      },
    ],
    returnType: "string",
  },

  getNow: {
    module: "plain/get",
    fn: "getNow",
    params: [],
    returnType: "string",
  },

  getToday: {
    module: "plain/get",
    fn: "getToday",
    params: [],
    returnType: "string",
  },

  isValidDate: {
    module: "plain/validate",
    fn: "isValidDate",
    params: [
      {
        name: "value",
        type: "string",
        value: "2024-03-15",
      },
    ],
    returnType: "boolean",
  },

  isValidTime: {
    module: "plain/validate",
    fn: "isValidTime",
    params: [
      {
        name: "value",
        type: "string",
        value: "14:30:45",
      },
    ],
    returnType: "boolean",
  },

  isValidDateTime: {
    module: "plain/validate",
    fn: "isValidDateTime",
    params: [
      {
        name: "value",
        type: "string",
        value: "2024-03-15T14:30:45",
      },
    ],
    returnType: "boolean",
  },

  isAfterDate: {
    module: "plain/compare",
    fn: "isAfterDate",
    params: [
      {
        name: "value",
        type: "string",
        value: "2024-03-20",
      },
      {
        name: "other",
        type: "string",
        value: "2024-03-15",
      },
    ],
    returnType: "boolean",
  },

  areDatesEqual: {
    module: "plain/compare",
    fn: "areDatesEqual",
    params: [
      {
        name: "value",
        type: "string",
        value: "2024-03-15",
      },
      {
        name: "other",
        type: "string",
        value: "2024-03-15",
      },
    ],
    returnType: "boolean",
  },

  formatDate: {
    module: "plain/format",
    fn: "formatDate",
    params: [
      {
        name: "value",
        type: "string",
        value: "2024-03-15",
      },
      {
        name: "locale",
        type: "string",
        value: "en-US",
      },
    ],
    returnType: "string",
  },

  formatTime: {
    module: "plain/format",
    fn: "formatTime",
    params: [
      {
        name: "value",
        type: "string",
        value: "14:30:45",
      },
      {
        name: "locale",
        type: "string",
        value: "en-US",
      },
    ],
    returnType: "string",
  },

  formatDateTime: {
    module: "plain/format",
    fn: "formatDateTime",
    params: [
      {
        name: "value",
        type: "string",
        value: "2024-03-15T14:30:45",
      },
      {
        name: "locale",
        type: "string",
        value: "en-US",
      },
    ],
    returnType: "string",
  },

  formatRelativeDate: {
    module: "plain/format",
    fn: "formatRelativeDate",
    params: [
      {
        name: "value",
        type: "string",
        value: "2024-03-12",
      },
      {
        name: "locale",
        type: "string",
        value: "en-US",
      },
    ],
    options: [
      {
        name: "reference",
        type: "string",
        value: "2024-03-15",
      },
    ],
    returnType: "string",
  },

  formatRelativeTime: {
    module: "plain/format",
    fn: "formatRelativeTime",
    params: [
      {
        name: "value",
        type: "string",
        value: "11:30:00",
      },
      {
        name: "locale",
        type: "string",
        value: "en-US",
      },
    ],
    options: [
      {
        name: "reference",
        type: "string",
        value: "12:00:00",
      },
    ],
    returnType: "string",
  },

  formatRelativeDateTime: {
    module: "plain/format",
    fn: "formatRelativeDateTime",
    params: [
      {
        name: "value",
        type: "string",
        value: "2024-03-15T10:00:00",
      },
      {
        name: "locale",
        type: "string",
        value: "en-US",
      },
    ],
    options: [
      {
        name: "reference",
        type: "string",
        value: "2024-03-15T12:00:00",
      },
    ],
    returnType: "string",
  },

  diffDate: {
    module: "plain/calculate",
    fn: "diffDate",
    params: [
      {
        name: "value",
        type: "string",
        value: "2024-03-10",
      },
      {
        name: "other",
        type: "string",
        value: "2024-04-05",
      },
      {
        name: "unit",
        type: "enum",
        value: "day",
        options: ["year", "month", "week", "day"],
      },
    ],
    returnType: "number",
  },

  parseYearFromDate: {
    module: "plain/parse",
    fn: "parseYearFromDate",
    params: [
      {
        name: "value",
        type: "string",
        value: "2024-03-15",
      },
    ],
    returnType: "number",
  },

  parseMonthFromDate: {
    module: "plain/parse",
    fn: "parseMonthFromDate",
    params: [
      {
        name: "value",
        type: "string",
        value: "2024-03-15",
      },
    ],
    returnType: "number",
  },

  parseDayFromDate: {
    module: "plain/parse",
    fn: "parseDayFromDate",
    params: [
      {
        name: "value",
        type: "string",
        value: "2024-03-15",
      },
    ],
    returnType: "number",
  },

  isValidDuration: {
    module: "duration",
    fn: "isValidDuration",
    params: [
      {
        name: "value",
        type: "string",
        value: "P1DT2H30M",
      },
    ],
    returnType: "boolean",
  },

  parseDuration: {
    module: "duration",
    fn: "parseDuration",
    params: [
      {
        name: "value",
        type: "string",
        value: "P1DT2H30M",
      },
    ],
    returnType: "string",
  },

  durationAs: {
    module: "duration",
    fn: "durationAs",
    params: [
      {
        name: "value",
        type: "string",
        value: "P1DT2H30M",
      },
      {
        name: "unit",
        type: "enum",
        value: "hours",
        options: ["years", "months", "weeks", "days", "hours", "minutes", "seconds", "milliseconds", "microseconds", "nanoseconds"],
      },
    ],
    options: [
      {
        name: "relativeTo",
        type: "string",
        value: "",
      },
    ],
    returnType: "number",
  },

  getDurationUnit: {
    module: "duration",
    fn: "getDurationUnit",
    params: [
      {
        name: "value",
        type: "string",
        value: "P1DT2H30M",
      },
      {
        name: "unit",
        type: "enum",
        value: "hours",
        options: ["years", "months", "weeks", "days", "hours", "minutes", "seconds", "milliseconds", "microseconds", "nanoseconds"],
      },
    ],
    returnType: "number",
  },

  compareDurations: {
    module: "duration",
    fn: "compareDurations",
    params: [
      {
        name: "value",
        type: "string",
        value: "PT1H",
      },
      {
        name: "other",
        type: "string",
        value: "PT30M",
      },
    ],
    options: [
      {
        name: "relativeTo",
        type: "string",
        value: "",
      },
    ],
    returnType: "number",
  },

  formatDuration: {
    module: "duration",
    fn: "formatDuration",
    params: [
      {
        name: "value",
        type: "string",
        value: "P1DT2H30M",
      },
      {
        name: "locale",
        type: "string",
        value: "en-US",
      },
    ],
    returnType: "string",
  },

  isValidTimeZone: {
    module: "zoned/validate",
    fn: "isValidTimeZone",
    params: [
      {
        name: "value",
        type: "string",
        value: "America/New_York",
      },
    ],
    returnType: "boolean",
  },

  convertPlainDateTimeToZoned: {
    module: "zoned/convert",
    fn: "convertPlainDateTimeToZoned",
    params: [
      {
        name: "value",
        type: "string",
        value: "2024-03-15T14:30:45",
      },
      {
        name: "timeZone",
        type: "string",
        value: "America/New_York",
      },
    ],
    options: [
      {
        name: "disambiguation",
        type: "enum",
        value: "compatible",
        options: ["compatible", "earlier", "later", "reject"],
      },
    ],
    returnType: "string",
  },

  intervalContainsDate: {
    module: "plain/interval",
    fn: "intervalContainsDate",
    params: [
      {
        name: "start",
        type: "string",
        value: "2024-01-01",
      },
      {
        name: "end",
        type: "string",
        value: "2024-12-31",
      },
      {
        name: "value",
        type: "string",
        value: "2024-06-15",
      },
    ],
    returnType: "boolean",
  },

  intervalsOverlapDate: {
    module: "plain/interval",
    fn: "intervalsOverlapDate",
    params: [
      {
        name: "aStart",
        type: "string",
        value: "2024-01-01",
      },
      {
        name: "aEnd",
        type: "string",
        value: "2024-06-30",
      },
      {
        name: "bStart",
        type: "string",
        value: "2024-04-01",
      },
      {
        name: "bEnd",
        type: "string",
        value: "2024-12-31",
      },
    ],
    returnType: "boolean",
  },

  intervalUnionDate: {
    module: "plain/interval",
    fn: "intervalUnionDate",
    params: [
      {
        name: "aStart",
        type: "string",
        value: "2024-01-01",
      },
      {
        name: "aEnd",
        type: "string",
        value: "2024-06-30",
      },
      {
        name: "bStart",
        type: "string",
        value: "2024-04-01",
      },
      {
        name: "bEnd",
        type: "string",
        value: "2024-12-31",
      },
    ],
    returnType: "string",
  },

  intervalCountDate: {
    module: "plain/interval",
    fn: "intervalCountDate",
    params: [
      {
        name: "start",
        type: "string",
        value: "2024-01-01",
      },
      {
        name: "end",
        type: "string",
        value: "2024-01-02",
      },
      {
        name: "unit",
        type: "enum",
        value: "day",
        options: ["year", "month", "week", "day"],
      },
    ],
    returnType: "number",
  },

  intervalLengthDate: {
    module: "plain/interval",
    fn: "intervalLengthDate",
    params: [
      {
        name: "start",
        type: "string",
        value: "2024-01-01",
      },
      {
        name: "end",
        type: "string",
        value: "2024-01-02",
      },
      {
        name: "unit",
        type: "enum",
        value: "day",
        options: ["year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond"],
      },
    ],
    returnType: "number",
  },
};
