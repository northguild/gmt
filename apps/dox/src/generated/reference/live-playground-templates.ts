// GENERATED FILE — do not edit by hand.
// Produced by apps/dox/scripts/build-reference.ts (`pnpm dox:generate`).
import type { LivePlaygroundTemplate } from "../../lib/playground-spec";

export const LIVE_PLAYGROUND_TEMPLATES: Record<string, LivePlaygroundTemplate> = {
  "businessDaysBetween": {
    "module": "calendar/business",
    "fn": "businessDaysBetween",
    "template": "businessDaysBetween(\"2024-07-01\", \"2024-07-05\", { weekend: [6, 7], holidays: [\"2024-07-04\"], timeZone: \"Africa/Kigali\" })",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-07-01"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-07-05"
      },
      {
        "name": "calendar",
        "kind": "expr",
        "seed": "{ weekend: [6, 7], holidays: [\"2024-07-04\"], timeZone: \"Africa/Kigali\" }"
      }
    ]
  },
  "mergeCalendars": {
    "module": "calendar/business",
    "fn": "mergeCalendars",
    "template": "mergeCalendars([{ weekend: [6, 7], holidays: [\"2024-07-04\"], timeZone: \"Africa/Kigali\" }, { weekend: [6, 7], holidays: [\"2024-05-06\"], timeZone: \"Europe/London\" }])",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "calendars",
        "kind": "list",
        "seed": "",
        "element": "expr",
        "items": [
          "{ weekend: [6, 7], holidays: [\"2024-07-04\"], timeZone: \"Africa/Kigali\" }",
          "{ weekend: [6, 7], holidays: [\"2024-05-06\"], timeZone: \"Europe/London\" }"
        ]
      }
    ]
  },
  "nextBusinessDay": {
    "module": "calendar/business",
    "fn": "nextBusinessDay",
    "template": "nextBusinessDay(\"2024-07-03\", { weekend: [6, 7], holidays: [\"2024-07-04\"], timeZone: \"Africa/Kigali\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-07-03"
      },
      {
        "name": "calendar",
        "kind": "expr",
        "seed": "{ weekend: [6, 7], holidays: [\"2024-07-04\"], timeZone: \"Africa/Kigali\" }"
      }
    ]
  },
  "previousBusinessDay": {
    "module": "calendar/business",
    "fn": "previousBusinessDay",
    "template": "previousBusinessDay(\"2024-07-05\", { weekend: [6, 7], holidays: [\"2024-07-04\"], timeZone: \"Africa/Kigali\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-07-05"
      },
      {
        "name": "calendar",
        "kind": "expr",
        "seed": "{ weekend: [6, 7], holidays: [\"2024-07-04\"], timeZone: \"Africa/Kigali\" }"
      }
    ]
  },
  "rollDate": {
    "module": "calendar/business",
    "fn": "rollDate",
    "template": "rollDate(\"2024-05-31\", \"following\", { weekend: [6, 7], holidays: [\"2024-05-31\"], timeZone: \"Europe/London\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-05-31"
      },
      {
        "name": "convention",
        "kind": "enum",
        "seed": "following",
        "choices": [
          "following",
          "modifiedFollowing",
          "preceding",
          "modifiedPreceding",
          "endOfMonth",
          "none"
        ]
      },
      {
        "name": "calendar",
        "kind": "expr",
        "seed": "{ weekend: [6, 7], holidays: [\"2024-05-31\"], timeZone: \"Europe/London\" }"
      }
    ],
    "choiceSeeds": {
      "convention": {
        "following": {
          "value": {
            "seed": "2024-05-31"
          },
          "calendar": {
            "seed": "{ weekend: [6, 7], holidays: [\"2024-05-31\"], timeZone: \"Europe/London\" }"
          }
        },
        "modifiedFollowing": {
          "value": {
            "seed": "2024-05-31"
          },
          "calendar": {
            "seed": "{ weekend: [6, 7], holidays: [\"2024-05-31\"], timeZone: \"Europe/London\" }"
          }
        },
        "modifiedPreceding": {
          "value": {
            "seed": "2024-06-01"
          },
          "calendar": {
            "seed": "{ weekend: [6, 7], holidays: [\"2024-05-31\"], timeZone: \"Europe/London\" }"
          }
        },
        "endOfMonth": {
          "value": {
            "seed": "2024-03-15"
          },
          "calendar": {
            "seed": "{ weekend: [6, 7], holidays: [], timeZone: \"UTC\" }"
          }
        },
        "none": {
          "value": {
            "seed": "2024-06-01"
          },
          "calendar": {
            "seed": "{ weekend: [6, 7], holidays: [], timeZone: \"UTC\" }"
          }
        }
      }
    }
  },
  "bucketRange": {
    "module": "calendar/calculate",
    "fn": "bucketRange",
    "template": "bucketRange(\"2024-06-15T03:00:00Z\", \"2024-06-17T03:00:00Z\", \"day\", \"Asia/Kolkata\")",
    "returnType": "array",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-06-15T03:00:00Z"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-06-17T03:00:00Z"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "day",
        "choices": [
          "months",
          "weeks",
          "days",
          "hours",
          "month",
          "week",
          "day",
          "hour"
        ]
      },
      {
        "name": "timeZone",
        "kind": "enum",
        "seed": "Asia/Kolkata",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "day": {
          "start": {
            "seed": "2024-06-15T03:00:00Z"
          },
          "end": {
            "seed": "2024-06-17T03:00:00Z"
          },
          "timeZone": {
            "seed": "Asia/Kolkata"
          }
        },
        "hour": {
          "start": {
            "seed": "2024-04-06T14:00:00Z"
          },
          "end": {
            "seed": "2024-04-06T18:00:00Z"
          },
          "timeZone": {
            "seed": "Australia/Sydney"
          }
        },
        "days": {
          "start": {
            "seed": "2024-06-15T03:00:00Z"
          },
          "end": {
            "seed": "2024-06-17T03:00:00Z"
          },
          "timeZone": {
            "seed": "Asia/Tokyo"
          }
        }
      },
      "timeZone": {
        "Asia/Kolkata": {
          "start": {
            "seed": "2024-06-15T03:00:00Z"
          },
          "end": {
            "seed": "2024-06-17T03:00:00Z"
          },
          "unit": {
            "seed": "day"
          }
        },
        "Europe/London": {
          "start": {
            "seed": "2024-03-30T00:00:00Z"
          },
          "end": {
            "seed": "2024-04-01T23:00:00Z"
          },
          "unit": {
            "seed": "day"
          }
        },
        "Australia/Sydney": {
          "start": {
            "seed": "2024-04-05T13:00:00Z"
          },
          "end": {
            "seed": "2024-04-08T14:00:00Z"
          },
          "unit": {
            "seed": "day"
          }
        },
        "Asia/Tokyo": {
          "start": {
            "seed": "2024-06-15T03:00:00Z"
          },
          "end": {
            "seed": "2024-06-17T03:00:00Z"
          },
          "unit": {
            "seed": "days"
          }
        }
      }
    }
  },
  "floorToZone": {
    "module": "calendar/calculate",
    "fn": "floorToZone",
    "template": "floorToZone(\"2024-06-15T03:00:00Z\", \"day\", \"America/New_York\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15T03:00:00Z"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "day",
        "choices": [
          "months",
          "weeks",
          "days",
          "hours",
          "month",
          "week",
          "day",
          "hour"
        ]
      },
      {
        "name": "timeZone",
        "kind": "enum",
        "seed": "America/New_York",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "day": {
          "value": {
            "seed": "2024-06-15T03:00:00Z"
          },
          "timeZone": {
            "seed": "America/New_York"
          }
        },
        "hour": {
          "value": {
            "seed": "2024-06-15T03:00:00Z"
          },
          "timeZone": {
            "seed": "Pacific/Honolulu"
          }
        },
        "week": {
          "value": {
            "seed": "2024-06-15T03:00:00Z"
          },
          "timeZone": {
            "seed": "Asia/Tokyo"
          }
        },
        "days": {
          "value": {
            "seed": "2024-05-15T10:20:30.123Z"
          },
          "timeZone": {
            "seed": "Europe/Berlin"
          }
        }
      },
      "timeZone": {
        "America/New_York": {
          "value": {
            "seed": "2024-06-15T03:00:00Z"
          },
          "unit": {
            "seed": "day"
          }
        },
        "UTC": {
          "value": {
            "seed": "2024-06-15T03:00:00Z"
          },
          "unit": {
            "seed": "day"
          }
        },
        "Asia/Tokyo": {
          "value": {
            "seed": "2024-06-15T03:00:00Z"
          },
          "unit": {
            "seed": "week"
          }
        },
        "Europe/Berlin": {
          "value": {
            "seed": "2024-05-15T10:20:30.123Z"
          },
          "unit": {
            "seed": "days"
          }
        }
      }
    }
  },
  "getFiscalPeriod": {
    "module": "calendar/calculate",
    "fn": "getFiscalPeriod",
    "template": "getFiscalPeriod(\"2024-06-15\", { pattern: \"4-5-4\", yearEndsOn: \"2026-01-31\", extraWeek: \"lastPeriod\", yearLabel: \"startYear\" })",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15"
      },
      {
        "name": "calendar",
        "kind": "expr",
        "seed": "{ pattern: \"4-5-4\", yearEndsOn: \"2026-01-31\", extraWeek: \"lastPeriod\", yearLabel: \"startYear\" }"
      }
    ]
  },
  "getIsoWeekDate": {
    "module": "calendar/calculate",
    "fn": "getIsoWeekDate",
    "template": "getIsoWeekDate(\"2024-06-15\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15"
      }
    ]
  },
  "getOrdinalDate": {
    "module": "calendar/calculate",
    "fn": "getOrdinalDate",
    "template": "getOrdinalDate(\"2024-01-01\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-01-01"
      }
    ]
  },
  "getQuarter": {
    "module": "calendar/calculate",
    "fn": "getQuarter",
    "template": "getQuarter(\"2024-06-15\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15"
      }
    ]
  },
  "addOperatingTime": {
    "module": "calendar/hours",
    "fn": "addOperatingTime",
    "template": "addOperatingTime(\"2024-06-14T15:00:00Z\", \"PT2H\", { timeZone: \"Europe/London\", weekly: { 1: [{ from: \"09:00\", to: \"17:00\" }], 5: [{ from: \"09:00\", to: \"17:00\" }] } })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-06-14T15:00:00Z"
      },
      {
        "name": "duration",
        "kind": "string",
        "seed": "PT2H"
      },
      {
        "name": "schedule",
        "kind": "expr",
        "seed": "{ timeZone: \"Europe/London\", weekly: { 1: [{ from: \"09:00\", to: \"17:00\" }], 5: [{ from: \"09:00\", to: \"17:00\" }] } }"
      }
    ]
  },
  "isOpenAt": {
    "module": "calendar/hours",
    "fn": "isOpenAt",
    "template": "isOpenAt(\"2024-06-17T01:00:00Z\", { timeZone: \"Asia/Tokyo\", weekly: { 1: [{ from: \"09:00\", to: \"17:00\" }] } })",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoString",
        "kind": "string",
        "seed": "2024-06-17T01:00:00Z"
      },
      {
        "name": "schedule",
        "kind": "expr",
        "seed": "{ timeZone: \"Asia/Tokyo\", weekly: { 1: [{ from: \"09:00\", to: \"17:00\" }] } }"
      }
    ]
  },
  "nextCloseAt": {
    "module": "calendar/hours",
    "fn": "nextCloseAt",
    "template": "nextCloseAt(\"2024-06-17T08:00:00Z\", { timeZone: \"Africa/Johannesburg\", weekly: { 1: [{ from: \"09:00\", to: \"17:00\" }] } })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoString",
        "kind": "string",
        "seed": "2024-06-17T08:00:00Z"
      },
      {
        "name": "schedule",
        "kind": "expr",
        "seed": "{ timeZone: \"Africa/Johannesburg\", weekly: { 1: [{ from: \"09:00\", to: \"17:00\" }] } }"
      }
    ]
  },
  "nextOpenAt": {
    "module": "calendar/hours",
    "fn": "nextOpenAt",
    "template": "nextOpenAt(\"2024-06-15T15:00:00Z\", { timeZone: \"America/Sao_Paulo\", weekly: { 1: [{ from: \"09:00\", to: \"17:00\" }], 5: [{ from: \"09:00\", to: \"17:00\" }] } })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoString",
        "kind": "string",
        "seed": "2024-06-15T15:00:00Z"
      },
      {
        "name": "schedule",
        "kind": "expr",
        "seed": "{ timeZone: \"America/Sao_Paulo\", weekly: { 1: [{ from: \"09:00\", to: \"17:00\" }], 5: [{ from: \"09:00\", to: \"17:00\" }] } }"
      }
    ]
  },
  "operatingIntervals": {
    "module": "calendar/hours",
    "fn": "operatingIntervals",
    "template": "operatingIntervals({ timeZone: \"Africa/Kigali\", weekly: { 4: [{ from: \"09:00\", to: \"17:00\" }], 5: [{ from: \"09:00\", to: \"17:00\" }] }, holidays: [\"2024-07-04\"] }, { start: \"2024-07-04T00:00:00Z\", end: \"2024-07-06T00:00:00Z\" })",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "schedule",
        "kind": "expr",
        "seed": "{ timeZone: \"Africa/Kigali\", weekly: { 4: [{ from: \"09:00\", to: \"17:00\" }], 5: [{ from: \"09:00\", to: \"17:00\" }] }, holidays: [\"2024-07-04\"] }"
      },
      {
        "name": "range",
        "kind": "expr",
        "seed": "{ start: \"2024-07-04T00:00:00Z\", end: \"2024-07-06T00:00:00Z\" }"
      }
    ]
  },
  "operatingTimeBetween": {
    "module": "calendar/hours",
    "fn": "operatingTimeBetween",
    "template": "operatingTimeBetween(\"2024-06-14T10:30:00Z\", \"2024-06-17T04:30:00Z\", { timeZone: \"Asia/Kolkata\", weekly: { 1: [{ from: \"09:00\", to: \"17:00\" }], 5: [{ from: \"09:00\", to: \"17:00\" }] } })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-06-14T10:30:00Z"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-06-17T04:30:00Z"
      },
      {
        "name": "schedule",
        "kind": "expr",
        "seed": "{ timeZone: \"Asia/Kolkata\", weekly: { 1: [{ from: \"09:00\", to: \"17:00\" }], 5: [{ from: \"09:00\", to: \"17:00\" }] } }"
      }
    ]
  },
  "recurringWindows": {
    "module": "calendar/hours",
    "fn": "recurringWindows",
    "template": "recurringWindows({ 1: [{ from: \"09:00\", to: \"17:00\" }] }, { start: \"2024-06-10T00:00:00Z\", end: \"2024-06-11T00:00:00Z\" }, \"Africa/Johannesburg\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "weekly",
        "kind": "expr",
        "seed": "{ 1: [{ from: \"09:00\", to: \"17:00\" }] }"
      },
      {
        "name": "range",
        "kind": "expr",
        "seed": "{ start: \"2024-06-10T00:00:00Z\", end: \"2024-06-11T00:00:00Z\" }"
      },
      {
        "name": "timeZone",
        "kind": "enum",
        "seed": "Africa/Johannesburg",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ],
    "choiceSeeds": {
      "timeZone": {
        "Africa/Johannesburg": {
          "weekly": {
            "seed": "{ 1: [{ from: \"09:00\", to: \"17:00\" }] }"
          },
          "range": {
            "seed": "{ start: \"2024-06-10T00:00:00Z\", end: \"2024-06-11T00:00:00Z\" }"
          }
        },
        "UTC": {
          "weekly": {
            "seed": "{ 5: [{ from: \"23:00\", to: \"06:00\" }] }"
          },
          "range": {
            "seed": "{ start: \"2024-06-14T00:00:00Z\", end: \"2024-06-16T00:00:00Z\" }"
          }
        },
        "Europe/London": {
          "weekly": {
            "seed": "{ 6: [{ from: \"23:00\", to: \"06:00\" }] }"
          },
          "range": {
            "seed": "{ start: \"2024-10-26T00:00:00Z\", end: \"2024-10-28T00:00:00Z\" }"
          }
        },
        "Australia/Sydney": {
          "weekly": {
            "seed": "{ 7: [{ from: \"02:30\", to: \"04:00\" }] }"
          },
          "range": {
            "seed": "{ start: \"2024-10-05T12:00:00Z\", end: \"2024-10-06T12:00:00Z\" }"
          }
        }
      }
    }
  },
  "buildBusinessCalendar": {
    "module": "calendar/rules",
    "fn": "buildBusinessCalendar",
    "template": "buildBusinessCalendar({ timeZone: \"Europe/Berlin\", weekend: [6, 7], years: { from: 2026, to: 2026 }, rules: [{ name: \"New year\", kind: \"fixed\", month: 1, day: 1 }, { name: \"Two days before Easter\", kind: \"easterRelative\", offsetDays: -2 }, { name: \"Day after Easter\", kind: \"easterRelative\", offsetDays: 1 }, { name: \"Spring day\", kind: \"fixed\", month: 5, day: 1 }, { name: \"Winter day\", kind: \"fixed\", month: 12, day: 25 }, { name: \"Day after winter day\", kind: \"fixed\", month: 12, day: 26 }] })",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "timeZone",
        "kind": "string",
        "seed": "Europe/Berlin"
      },
      {
        "name": "weekend",
        "kind": "expr",
        "seed": "[6, 7]"
      },
      {
        "name": "years",
        "kind": "expr",
        "seed": "{ from: 2026, to: 2026 }"
      },
      {
        "name": "rules",
        "kind": "expr",
        "seed": "[{ name: \"New year\", kind: \"fixed\", month: 1, day: 1 }, { name: \"Two days before Easter\", kind: \"easterRelative\", offsetDays: -2 }, { name: \"Day after Easter\", kind: \"easterRelative\", offsetDays: 1 }, { name: \"Spring day\", kind: \"fixed\", month: 5, day: 1 }, { name: \"Winter day\", kind: \"fixed\", month: 12, day: 25 }, { name: \"Day after winter day\", kind: \"fixed\", month: 12, day: 26 }]"
      }
    ],
    "objectArg": true
  },
  "easterSunday": {
    "module": "calendar/rules",
    "fn": "easterSunday",
    "template": "easterSunday(2024)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "year",
        "kind": "number",
        "seed": "2024"
      }
    ]
  },
  "holidayDates": {
    "module": "calendar/rules",
    "fn": "holidayDates",
    "template": "holidayDates({ name: \"Closing day\", kind: \"easterRelative\", offsetDays: -2 }, 2024)",
    "returnType": "array",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "rule",
        "kind": "expr",
        "seed": "{ name: \"Closing day\", kind: \"easterRelative\", offsetDays: -2 }"
      },
      {
        "name": "year",
        "kind": "number",
        "seed": "2024"
      }
    ]
  },
  "nthWeekdayOfMonth": {
    "module": "calendar/rules",
    "fn": "nthWeekdayOfMonth",
    "template": "nthWeekdayOfMonth(2026, 3, 7, \"last\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "year",
        "kind": "number",
        "seed": "2026"
      },
      {
        "name": "month",
        "kind": "number",
        "seed": "3"
      },
      {
        "name": "weekday",
        "kind": "number",
        "seed": "7"
      },
      {
        "name": "n",
        "kind": "enum",
        "seed": "last",
        "choices": [
          "1",
          "2",
          "3",
          "4",
          "5",
          "-1",
          "-2",
          "-3",
          "-4",
          "-5",
          "last"
        ]
      }
    ]
  },
  "observedDate": {
    "module": "calendar/rules",
    "fn": "observedDate",
    "template": "observedDate(\"2027-12-25\", { 6: { previous: 5 }, 7: { next: 1 } })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoDate",
        "kind": "string",
        "seed": "2027-12-25"
      },
      {
        "name": "policy",
        "kind": "expr",
        "seed": "{ 6: { previous: 5 }, 7: { next: 1 } }"
      },
      {
        "name": "calendar",
        "kind": "string",
        "seed": "",
        "optional": true
      }
    ]
  },
  "isValidBusinessCalendar": {
    "module": "calendar/validate",
    "fn": "isValidBusinessCalendar",
    "template": "isValidBusinessCalendar({ weekend: [6, 7], holidays: [], timeZone: \"UTC\" })",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "weekend",
        "kind": "expr",
        "seed": "[6, 7]"
      },
      {
        "name": "holidays",
        "kind": "expr",
        "seed": "[]"
      },
      {
        "name": "timeZone",
        "kind": "string",
        "seed": "UTC"
      }
    ],
    "objectArg": true
  },
  "isValidFiscalCalendar": {
    "module": "calendar/validate",
    "fn": "isValidFiscalCalendar",
    "template": "isValidFiscalCalendar({ pattern: \"4-5-4\", yearEndsOn: \"2026-01-31\", extraWeek: \"lastPeriod\", yearLabel: \"startYear\" })",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "pattern",
        "kind": "string",
        "seed": "4-5-4"
      },
      {
        "name": "yearEndsOn",
        "kind": "string",
        "seed": "2026-01-31"
      },
      {
        "name": "extraWeek",
        "kind": "string",
        "seed": "lastPeriod"
      },
      {
        "name": "yearLabel",
        "kind": "string",
        "seed": "startYear"
      }
    ],
    "objectArg": true
  },
  "isValidFiscalExtraWeek": {
    "module": "calendar/validate",
    "fn": "isValidFiscalExtraWeek",
    "template": "isValidFiscalExtraWeek(\"firstPeriod\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "firstPeriod"
      }
    ]
  },
  "isValidFiscalPattern": {
    "module": "calendar/validate",
    "fn": "isValidFiscalPattern",
    "template": "isValidFiscalPattern(\"4-5-4\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "pattern",
        "kind": "string",
        "seed": "4-5-4"
      }
    ]
  },
  "isValidFiscalYearLabel": {
    "module": "calendar/validate",
    "fn": "isValidFiscalYearLabel",
    "template": "isValidFiscalYearLabel(\"startYear\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "startYear"
      }
    ]
  },
  "isValidHolidayRule": {
    "module": "calendar/validate",
    "fn": "isValidHolidayRule",
    "template": "isValidHolidayRule({ name: \"Closing day\", kind: \"fixed\", month: 12, day: 25 })",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "name",
        "kind": "string",
        "seed": "Closing day"
      },
      {
        "name": "kind",
        "kind": "string",
        "seed": "fixed"
      },
      {
        "name": "month",
        "kind": "number",
        "seed": "12"
      },
      {
        "name": "day",
        "kind": "number",
        "seed": "25"
      }
    ],
    "objectArg": true
  },
  "isValidRollConvention": {
    "module": "calendar/validate",
    "fn": "isValidRollConvention",
    "template": "isValidRollConvention(\"modifiedFollowing\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "convention",
        "kind": "string",
        "seed": "modifiedFollowing"
      }
    ]
  },
  "isValidZoneBucketUnit": {
    "module": "calendar/validate",
    "fn": "isValidZoneBucketUnit",
    "template": "isValidZoneBucketUnit(\"hour\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "unit",
        "kind": "string",
        "seed": "hour"
      }
    ]
  },
  "absDuration": {
    "module": "duration/calculate",
    "fn": "absDuration",
    "template": "absDuration(\"-P1DT2H\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "-P1DT2H"
      }
    ]
  },
  "addDuration": {
    "module": "duration/calculate",
    "fn": "addDuration",
    "template": "addDuration(\"P1D\", \"PT2H\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "a",
        "kind": "string",
        "seed": "P1D"
      },
      {
        "name": "b",
        "kind": "string",
        "seed": "PT2H"
      }
    ]
  },
  "durationFromUnits": {
    "module": "duration/calculate",
    "fn": "durationFromUnits",
    "template": "durationFromUnits({ minutes: 15 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "units",
        "kind": "units",
        "seed": "15",
        "unitKeys": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds"
        ],
        "unitSeed": "minutes"
      }
    ]
  },
  "getDurationSign": {
    "module": "duration/calculate",
    "fn": "getDurationSign",
    "template": "getDurationSign(\"P1DT2H\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "P1DT2H"
      }
    ]
  },
  "getDurationUnit": {
    "module": "duration/calculate",
    "fn": "getDurationUnit",
    "template": "getDurationUnit(\"P1DT2H30M\", \"hours\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "P1DT2H30M"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "hours",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "hours": {
          "value": {
            "seed": "P1DT2H30M"
          }
        },
        "minutes": {
          "value": {
            "seed": "P1DT2H30M"
          }
        },
        "months": {
          "value": {
            "seed": "P1M"
          }
        },
        "days": {
          "value": {
            "seed": "PT0S"
          }
        },
        "hour": {
          "value": {
            "seed": "P1DT2H30M"
          }
        }
      }
    }
  },
  "negateDuration": {
    "module": "duration/calculate",
    "fn": "negateDuration",
    "template": "negateDuration(\"P1DT2H\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "P1DT2H"
      }
    ]
  },
  "subtractDuration": {
    "module": "duration/calculate",
    "fn": "subtractDuration",
    "template": "subtractDuration(\"P1D\", \"PT2H\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "a",
        "kind": "string",
        "seed": "P1D"
      },
      {
        "name": "b",
        "kind": "string",
        "seed": "PT2H"
      }
    ]
  },
  "totalDuration": {
    "module": "duration/calculate",
    "fn": "totalDuration",
    "template": "totalDuration(\"P1DT2H30M\", \"hours\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "P1DT2H30M"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "hours",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "hours": {
          "value": {
            "seed": "P1DT2H30M"
          }
        },
        "minutes": {
          "value": {
            "seed": "P1DT2H30M"
          }
        },
        "days": {
          "value": {
            "seed": "PT36H"
          }
        },
        "minute": {
          "value": {
            "seed": "P1DT2H30M"
          }
        }
      }
    }
  },
  "totalUnits": {
    "module": "duration/calculate",
    "fn": "totalUnits",
    "template": "totalUnits({ minutes: 15 }, \"seconds\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "units",
        "kind": "units",
        "seed": "15",
        "unitKeys": [
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds"
        ],
        "unitSeed": "minutes"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "seconds",
        "choices": [
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "seconds": {
          "units": {
            "seed": "15",
            "unitSeed": "minutes"
          }
        },
        "days": {
          "units": {
            "seed": "36",
            "unitSeed": "hours"
          }
        },
        "hours": {
          "units": {
            "seed": "-90",
            "unitSeed": "minutes"
          }
        },
        "millisecond": {
          "units": {
            "seed": "10",
            "unitSeed": "seconds"
          }
        }
      }
    }
  },
  "compareDurations": {
    "module": "duration/compare",
    "fn": "compareDurations",
    "template": "compareDurations(\"PT1H\", \"PT30M\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "a",
        "kind": "string",
        "seed": "PT1H"
      },
      {
        "name": "b",
        "kind": "string",
        "seed": "PT30M"
      }
    ]
  },
  "formatDuration": {
    "module": "duration/format",
    "fn": "formatDuration",
    "template": "formatDuration(\"P1DT2H30M\", \"en-GB\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "P1DT2H30M"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "en-GB",
        "optional": true
      }
    ]
  },
  "formatHumanDuration": {
    "module": "duration/format",
    "fn": "formatHumanDuration",
    "template": "formatHumanDuration(\"PT2H30M\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "duration",
        "kind": "string",
        "seed": "PT2H30M"
      }
    ]
  },
  "normalizeDuration": {
    "module": "duration/normalize",
    "fn": "normalizeDuration",
    "template": "normalizeDuration(\"PT90M\", { largestUnit: \"hour\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "PT90M"
      }
    ],
    "optionsSuffix": "{ largestUnit: \"hour\" }"
  },
  "parseDuration": {
    "module": "duration/parse",
    "fn": "parseDuration",
    "template": "parseDuration(\"P1DT2H30M\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "P1DT2H30M"
      }
    ]
  },
  "parseHumanDuration": {
    "module": "duration/parse",
    "fn": "parseHumanDuration",
    "template": "parseHumanDuration(\"2h 30m\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "text",
        "kind": "string",
        "seed": "2h 30m"
      }
    ]
  },
  "isValidDuration": {
    "module": "duration/validate",
    "fn": "isValidDuration",
    "template": "isValidDuration(\"P1DT2H30M\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "P1DT2H30M"
      }
    ]
  },
  "gnssToUtc": {
    "module": "gnss/convert",
    "fn": "gnssToUtc",
    "template": "gnssToUtc(\"GPS\", \"2017-01-01T00:00:17 GPS\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "system",
        "kind": "enum",
        "seed": "GPS",
        "choices": [
          "GPS",
          "GAL",
          "BDT",
          "QZS",
          "GLO",
          "IRN"
        ]
      },
      {
        "name": "value",
        "kind": "string",
        "seed": "2017-01-01T00:00:17 GPS"
      }
    ],
    "choiceSeeds": {
      "system": {
        "GPS": {
          "value": {
            "seed": "2017-01-01T00:00:17 GPS"
          }
        },
        "BDT": {
          "value": {
            "seed": "2024-01-01T00:00:04 BDT"
          }
        },
        "GAL": {
          "value": {
            "seed": "1999-08-22T00:00:00 GAL"
          }
        },
        "GLO": {
          "value": {
            "seed": "2016-12-31T23:59:60 GLO"
          }
        }
      }
    }
  },
  "gnssWeekToUtc": {
    "module": "gnss/convert",
    "fn": "gnssWeekToUtc",
    "template": "gnssWeekToUtc(\"GPS-LNAV\", 100, 0, 0)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "counter",
        "kind": "enum",
        "seed": "GPS-LNAV",
        "choices": [
          "GAL",
          "BDT",
          "GPS-LNAV",
          "GPS-CNAV",
          "QZS-LNAV",
          "QZS-CNAV",
          "IRN-LNAV",
          "IRN-L1NV"
        ]
      },
      {
        "name": "week",
        "kind": "number",
        "seed": "100"
      },
      {
        "name": "timeOfWeekSeconds",
        "kind": "number",
        "seed": "0"
      },
      {
        "name": "rolloverEra",
        "kind": "expr",
        "seed": "0"
      }
    ],
    "choiceSeeds": {
      "counter": {
        "GPS-LNAV": {
          "week": {
            "seed": "100"
          },
          "timeOfWeekSeconds": {
            "seed": "0"
          },
          "rolloverEra": {
            "seed": "0"
          }
        },
        "GPS-CNAV": {
          "week": {
            "seed": "2295"
          },
          "timeOfWeekSeconds": {
            "seed": "86418"
          },
          "rolloverEra": {
            "seed": "0"
          }
        },
        "BDT": {
          "week": {
            "seed": "939"
          },
          "timeOfWeekSeconds": {
            "seed": "86404"
          },
          "rolloverEra": {
            "seed": "0"
          }
        },
        "GAL": {
          "week": {
            "seed": "100"
          },
          "timeOfWeekSeconds": {
            "seed": "0"
          },
          "rolloverEra": {
            "seed": "{ notBefore: \"1999-01-01T00:00:00Z\" }"
          }
        },
        "IRN-LNAV": {
          "week": {
            "seed": "248"
          },
          "timeOfWeekSeconds": {
            "seed": "0"
          },
          "rolloverEra": {
            "seed": "1"
          }
        }
      }
    }
  },
  "rinexWeekToUtc": {
    "module": "gnss/convert",
    "fn": "rinexWeekToUtc",
    "template": "rinexWeekToUtc(\"IRN\", 2295, 86418)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "system",
        "kind": "enum",
        "seed": "IRN",
        "choices": [
          "GPS",
          "GAL",
          "BDT",
          "QZS",
          "IRN"
        ]
      },
      {
        "name": "week",
        "kind": "number",
        "seed": "2295"
      },
      {
        "name": "timeOfWeekSeconds",
        "kind": "number",
        "seed": "86418"
      }
    ],
    "choiceSeeds": {
      "system": {
        "IRN": {
          "week": {
            "seed": "2295"
          },
          "timeOfWeekSeconds": {
            "seed": "86418"
          }
        },
        "GPS": {
          "week": {
            "seed": "1930"
          },
          "timeOfWeekSeconds": {
            "seed": "17"
          }
        },
        "BDT": {
          "week": {
            "seed": "809"
          },
          "timeOfWeekSeconds": {
            "seed": "165600"
          }
        }
      }
    }
  },
  "utcToGnss": {
    "module": "gnss/convert",
    "fn": "utcToGnss",
    "template": "utcToGnss(\"GPS\", \"1980-01-06T00:00:00Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "system",
        "kind": "enum",
        "seed": "GPS",
        "choices": [
          "GPS",
          "GAL",
          "BDT",
          "QZS",
          "GLO",
          "IRN"
        ]
      },
      {
        "name": "utcString",
        "kind": "string",
        "seed": "1980-01-06T00:00:00Z"
      }
    ],
    "choiceSeeds": {
      "system": {
        "GPS": {
          "utcString": {
            "seed": "1980-01-06T00:00:00Z"
          }
        },
        "GAL": {
          "utcString": {
            "seed": "1999-08-22T00:00:00Z"
          }
        },
        "BDT": {
          "utcString": {
            "seed": "2006-01-01T00:00:00Z"
          }
        },
        "QZS": {
          "utcString": {
            "seed": "2024-01-01T00:00:00Z"
          }
        },
        "GLO": {
          "utcString": {
            "seed": "2024-01-01T00:00:00Z"
          }
        },
        "IRN": {
          "utcString": {
            "seed": "2024-01-01T00:00:00Z"
          }
        }
      }
    }
  },
  "utcToGnssWeek": {
    "module": "gnss/convert",
    "fn": "utcToGnssWeek",
    "template": "utcToGnssWeek(\"GPS-LNAV\", \"2019-04-07T00:00:00Z\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "counter",
        "kind": "enum",
        "seed": "GPS-LNAV",
        "choices": [
          "GAL",
          "BDT",
          "GPS-LNAV",
          "GPS-CNAV",
          "QZS-LNAV",
          "QZS-CNAV",
          "IRN-LNAV",
          "IRN-L1NV"
        ]
      },
      {
        "name": "utcString",
        "kind": "string",
        "seed": "2019-04-07T00:00:00Z"
      }
    ],
    "choiceSeeds": {
      "counter": {
        "GPS-LNAV": {
          "utcString": {
            "seed": "2019-04-07T00:00:00Z"
          }
        },
        "GPS-CNAV": {
          "utcString": {
            "seed": "2019-04-07T00:00:00Z"
          }
        },
        "GAL": {
          "utcString": {
            "seed": "2019-04-07T00:00:00Z"
          }
        },
        "BDT": {
          "utcString": {
            "seed": "2024-01-01T00:00:00Z"
          }
        }
      }
    }
  },
  "utcToRinexWeek": {
    "module": "gnss/convert",
    "fn": "utcToRinexWeek",
    "template": "utcToRinexWeek(\"IRN\", \"2024-01-01T00:00:00Z\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "system",
        "kind": "enum",
        "seed": "IRN",
        "choices": [
          "GPS",
          "GAL",
          "BDT",
          "QZS",
          "IRN"
        ]
      },
      {
        "name": "utcString",
        "kind": "string",
        "seed": "2024-01-01T00:00:00Z"
      }
    ],
    "choiceSeeds": {
      "system": {
        "IRN": {
          "utcString": {
            "seed": "2024-01-01T00:00:00Z"
          }
        },
        "BDT": {
          "utcString": {
            "seed": "2021-07-05T21:59:56Z"
          }
        }
      }
    }
  },
  "classifyLocal": {
    "module": "instant/convert",
    "fn": "classifyLocal",
    "template": "classifyLocal(\"2024-07-15T12:00:00\", \"Asia/Tokyo\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "localDateTime",
        "kind": "string",
        "seed": "2024-07-15T12:00:00"
      },
      {
        "name": "timeZone",
        "kind": "enum",
        "seed": "Asia/Tokyo",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ],
    "choiceSeeds": {
      "timeZone": {
        "Asia/Tokyo": {
          "localDateTime": {
            "seed": "2024-07-15T12:00:00"
          }
        },
        "Europe/London": {
          "localDateTime": {
            "seed": "2024-10-27T01:30:00"
          }
        },
        "Australia/Sydney": {
          "localDateTime": {
            "seed": "2024-10-06T02:30:00"
          }
        },
        "UTC": {
          "localDateTime": {
            "seed": "2024-11-03T01:30:00"
          }
        }
      }
    }
  },
  "fromOffsetInstant": {
    "module": "instant/convert",
    "fn": "fromOffsetInstant",
    "template": "fromOffsetInstant({ instant: \"2024-07-15T16:00:00Z\", offset: \"-04:00\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "instant",
        "kind": "string",
        "seed": "2024-07-15T16:00:00Z"
      },
      {
        "name": "offset",
        "kind": "string",
        "seed": "-04:00"
      }
    ],
    "objectArg": true
  },
  "resolveLocal": {
    "module": "instant/convert",
    "fn": "resolveLocal",
    "template": "resolveLocal(\"2024-07-15T12:00:00\", \"Asia/Tokyo\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "localDateTime",
        "kind": "string",
        "seed": "2024-07-15T12:00:00"
      },
      {
        "name": "timeZone",
        "kind": "enum",
        "seed": "Asia/Tokyo",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ],
    "choiceSeeds": {
      "timeZone": {
        "Asia/Tokyo": {
          "localDateTime": {
            "seed": "2024-07-15T12:00:00"
          }
        },
        "Europe/London": {
          "localDateTime": {
            "seed": "2024-10-27T01:30:00"
          }
        },
        "Australia/Sydney": {
          "localDateTime": {
            "seed": "2024-10-06T02:30:00"
          }
        },
        "Africa/Johannesburg": {
          "localDateTime": {
            "seed": "2024-07-15T12:00:00[foo=bar]"
          }
        }
      }
    }
  },
  "toOffsetInstant": {
    "module": "instant/convert",
    "fn": "toOffsetInstant",
    "template": "toOffsetInstant(\"2024-07-15T12:00:00+09:00[Asia/Tokyo]\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-07-15T12:00:00+09:00[Asia/Tokyo]"
      },
      {
        "name": "timeZone",
        "kind": "enum",
        "seed": "",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ],
        "optional": true
      }
    ]
  },
  "isValidUtcOffset": {
    "module": "instant/validate",
    "fn": "isValidUtcOffset",
    "template": "isValidUtcOffset(\"-04:00\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "-04:00"
      }
    ]
  },
  "billingTimeline": {
    "module": "intermodal/calculate",
    "fn": "billingTimeline",
    "template": "billingTimeline({ anchorOn: \"2026-03-01\" }, { issueDays: 30, disputeDays: 30, resolutionDays: 30 })",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "dates",
        "kind": "expr",
        "seed": "{ anchorOn: \"2026-03-01\" }"
      },
      {
        "name": "windows",
        "kind": "expr",
        "seed": "{ issueDays: 30, disputeDays: 30, resolutionDays: 30 }"
      }
    ]
  },
  "chargeableDays": {
    "module": "intermodal/calculate",
    "fn": "chargeableDays",
    "template": "chargeableDays(\"2024-06-14T19:00:00Z\", \"2024-06-17T04:00:00Z\", 3, { basis: \"calendar\", chargeBasis: \"calendar\", timeZone: \"America/Port_of_Spain\", firstDay: \"eventDay\" })",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "clockStart",
        "kind": "string",
        "seed": "2024-06-14T19:00:00Z"
      },
      {
        "name": "clockEnd",
        "kind": "string",
        "seed": "2024-06-17T04:00:00Z"
      },
      {
        "name": "freeDays",
        "kind": "number",
        "seed": "3"
      }
    ],
    "optionsSuffix": "{ basis: \"calendar\", chargeBasis: \"calendar\", timeZone: \"America/Port_of_Spain\", firstDay: \"eventDay\" }"
  },
  "demurrageClock": {
    "module": "intermodal/calculate",
    "fn": "demurrageClock",
    "template": "demurrageClock([{ type: \"discharged\", at: \"2024-06-14T19:00:00Z\" }, { type: \"available\", at: \"2024-06-15T12:00:00Z\" }, { type: \"gatedOut\", at: \"2024-06-20T14:30:00Z\" }, { type: \"emptyReturned\", at: \"2024-06-27T09:00:00Z\" }], \"demurrage\", { direction: \"import\" })",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "events",
        "kind": "list",
        "seed": "",
        "element": "expr",
        "items": [
          "{ type: \"discharged\", at: \"2024-06-14T19:00:00Z\" }",
          "{ type: \"available\", at: \"2024-06-15T12:00:00Z\" }",
          "{ type: \"gatedOut\", at: \"2024-06-20T14:30:00Z\" }",
          "{ type: \"emptyReturned\", at: \"2024-06-27T09:00:00Z\" }"
        ]
      },
      {
        "name": "scope",
        "kind": "enum",
        "seed": "demurrage",
        "choices": [
          "demurrage",
          "detention",
          "storage",
          "combined"
        ]
      }
    ],
    "optionsSuffix": "{ direction: \"import\" }",
    "choiceSeeds": {
      "scope": {
        "demurrage": {
          "events": {
            "seed": "",
            "items": [
              "{ type: \"discharged\", at: \"2024-06-14T19:00:00Z\" }",
              "{ type: \"available\", at: \"2024-06-15T12:00:00Z\" }",
              "{ type: \"gatedOut\", at: \"2024-06-20T14:30:00Z\" }",
              "{ type: \"emptyReturned\", at: \"2024-06-27T09:00:00Z\" }"
            ]
          }
        },
        "detention": {
          "events": {
            "seed": "",
            "items": [
              "{ type: \"discharged\", at: \"2024-06-14T19:00:00Z\" }",
              "{ type: \"available\", at: \"2024-06-15T12:00:00Z\" }",
              "{ type: \"gatedOut\", at: \"2024-06-20T14:30:00Z\" }",
              "{ type: \"emptyReturned\", at: \"2024-06-27T09:00:00Z\" }"
            ]
          }
        },
        "combined": {
          "events": {
            "seed": "",
            "items": [
              "{ type: \"discharged\", at: \"2024-06-14T19:00:00Z\" }",
              "{ type: \"available\", at: \"2024-06-15T12:00:00Z\" }",
              "{ type: \"gatedOut\", at: \"2024-06-20T14:30:00Z\" }",
              "{ type: \"emptyReturned\", at: \"2024-06-27T09:00:00Z\" }"
            ]
          }
        },
        "storage": {
          "events": {
            "seed": "",
            "items": [
              "{ type: \"discharged\", at: \"2024-06-14T19:00:00Z\" }",
              "{ type: \"gatedOut\", at: \"2024-06-20T14:30:00Z\" }"
            ]
          }
        }
      }
    }
  },
  "freeTimeExpiry": {
    "module": "intermodal/calculate",
    "fn": "freeTimeExpiry",
    "template": "freeTimeExpiry(\"2024-06-14T19:00:00Z\", 3, { basis: \"calendar\", timeZone: \"America/Port_of_Spain\", firstDay: \"eventDay\" })",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "clockStart",
        "kind": "string",
        "seed": "2024-06-14T19:00:00Z"
      },
      {
        "name": "freeDays",
        "kind": "number",
        "seed": "3"
      }
    ],
    "optionsSuffix": "{ basis: \"calendar\", timeZone: \"America/Port_of_Spain\", firstDay: \"eventDay\" }"
  },
  "multimodalETA": {
    "module": "intermodal/calculate",
    "fn": "multimodalETA",
    "template": "multimodalETA([{ departure: \"2024-06-10T08:00:00+08:00[Asia/Shanghai]\", duration: \"PT6H\", timeZone: \"Asia/Shanghai\", dwellAfter: \"P2D\" }, { duration: \"P14DT6H\", timeZone: \"America/Los_Angeles\", dwellAfter: \"PT36H\" }, { duration: \"PT52H\", timeZone: \"America/Chicago\" }])",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "legs",
        "kind": "list",
        "seed": "",
        "element": "expr",
        "items": [
          "{ departure: \"2024-06-10T08:00:00+08:00[Asia/Shanghai]\", duration: \"PT6H\", timeZone: \"Asia/Shanghai\", dwellAfter: \"P2D\" }",
          "{ duration: \"P14DT6H\", timeZone: \"America/Los_Angeles\", dwellAfter: \"PT36H\" }",
          "{ duration: \"PT52H\", timeZone: \"America/Chicago\" }"
        ]
      }
    ]
  },
  "bolTimestamp": {
    "module": "intermodal/format",
    "fn": "bolTimestamp",
    "template": "bolTimestamp(\"2024-06-16T01:00:00Z\", \"shippedOnBoard\", { timeZone: \"America/Sao_Paulo\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-16T01:00:00Z"
      },
      {
        "name": "event",
        "kind": "enum",
        "seed": "shippedOnBoard",
        "choices": [
          "issue",
          "received",
          "shippedOnBoard"
        ]
      }
    ],
    "optionsSuffix": "{ timeZone: \"America/Sao_Paulo\" }",
    "choiceSeeds": {
      "event": {
        "shippedOnBoard": {
          "value": {
            "seed": "2024-06-16T01:00:00Z"
          }
        },
        "received": {
          "value": {
            "seed": "2024-06-15T21:00:00+02:00"
          }
        },
        "issue": {
          "value": {
            "seed": "2024-06-16T09:00:00+08:00[Asia/Shanghai]"
          }
        }
      }
    }
  },
  "formatEdifactDate": {
    "module": "intermodal/format",
    "fn": "formatEdifactDate",
    "template": "formatEdifactDate(\"2024-06-15\", \"102\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "102",
        "choices": [
          "102"
        ]
      }
    ]
  },
  "formatEdifactDatePeriod": {
    "module": "intermodal/format",
    "fn": "formatEdifactDatePeriod",
    "template": "formatEdifactDatePeriod(\"2024-06-15\", \"2024-06-20\", \"718\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-06-15"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-06-20"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "718",
        "choices": [
          "718"
        ]
      }
    ]
  },
  "formatEdifactDateTime": {
    "module": "intermodal/format",
    "fn": "formatEdifactDateTime",
    "template": "formatEdifactDateTime(\"2024-06-15T14:30:00\", \"203\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15T14:30:00"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "203",
        "choices": [
          "203",
          "204"
        ]
      }
    ],
    "choiceSeeds": {
      "format": {
        "203": {
          "value": {
            "seed": "2024-06-15T14:30:00"
          }
        },
        "204": {
          "value": {
            "seed": "2024-06-15T14:30:45"
          }
        }
      }
    }
  },
  "formatEdifactDateTimePeriod": {
    "module": "intermodal/format",
    "fn": "formatEdifactDateTimePeriod",
    "template": "formatEdifactDateTimePeriod(\"2024-06-15T14:30:00\", \"2024-06-20T16:00:00\", \"719\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-06-15T14:30:00"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-06-20T16:00:00"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "719",
        "choices": [
          "719"
        ]
      }
    ]
  },
  "formatEdifactOffsetDateTime": {
    "module": "intermodal/format",
    "fn": "formatEdifactOffsetDateTime",
    "template": "formatEdifactOffsetDateTime(\"2024-06-15T14:30:00+02:00\", \"205\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15T14:30:00+02:00"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "205",
        "choices": [
          "205",
          "208",
          "303",
          "304"
        ]
      }
    ],
    "choiceSeeds": {
      "format": {
        "205": {
          "value": {
            "seed": "2024-06-15T14:30:00+02:00"
          }
        },
        "208": {
          "value": {
            "seed": "2024-06-15T14:30:45+05:30"
          }
        },
        "303": {
          "value": {
            "seed": "2024-06-15T14:30:00+02:00"
          }
        },
        "304": {
          "value": {
            "seed": "2024-06-15T14:30:45-05:00"
          }
        }
      }
    }
  },
  "formatEdifactTime": {
    "module": "intermodal/format",
    "fn": "formatEdifactTime",
    "template": "formatEdifactTime(\"14:30:00\", \"401\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "14:30:00"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "401",
        "choices": [
          "401",
          "402"
        ]
      }
    ],
    "choiceSeeds": {
      "format": {
        "401": {
          "value": {
            "seed": "14:30:00"
          }
        },
        "402": {
          "value": {
            "seed": "14:30:45"
          }
        }
      }
    }
  },
  "formatEpcisEvent": {
    "module": "intermodal/format",
    "fn": "formatEpcisEvent",
    "template": "formatEpcisEvent({ instant: \"2024-06-15T14:30:00Z\", offset: \"-05:00\" })",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "instant",
        "kind": "string",
        "seed": "2024-06-15T14:30:00Z"
      },
      {
        "name": "offset",
        "kind": "string",
        "seed": "-05:00"
      }
    ],
    "objectArg": true
  },
  "formatX12Date": {
    "module": "intermodal/format",
    "fn": "formatX12Date",
    "template": "formatX12Date(\"2024-06-15\", \"D8\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "D8",
        "choices": [
          "D8",
          "DB"
        ]
      }
    ]
  },
  "formatX12DateRange": {
    "module": "intermodal/format",
    "fn": "formatX12DateRange",
    "template": "formatX12DateRange(\"2024-06-15\", \"2024-06-20\", \"RD8\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-06-15"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-06-20"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "RD8",
        "choices": [
          "RD8",
          "RD"
        ]
      }
    ]
  },
  "formatX12DateTime": {
    "module": "intermodal/format",
    "fn": "formatX12DateTime",
    "template": "formatX12DateTime(\"2024-06-15T14:30:00\", \"DT\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15T14:30:00"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "DT",
        "choices": [
          "DT",
          "RTS"
        ]
      }
    ],
    "choiceSeeds": {
      "format": {
        "DT": {
          "value": {
            "seed": "2024-06-15T14:30:00"
          }
        },
        "RTS": {
          "value": {
            "seed": "2024-06-15T14:30:45"
          }
        }
      }
    }
  },
  "formatX12DateTimeRange": {
    "module": "intermodal/format",
    "fn": "formatX12DateTimeRange",
    "template": "formatX12DateTimeRange(\"2024-06-15T14:30:00\", \"2024-06-20T16:00:00\", \"RDT\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-06-15T14:30:00"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-06-20T16:00:00"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "RDT",
        "choices": [
          "RDT",
          "DTS"
        ]
      }
    ],
    "choiceSeeds": {
      "format": {
        "RDT": {
          "start": {
            "seed": "2024-06-15T14:30:00"
          },
          "end": {
            "seed": "2024-06-20T16:00:00"
          }
        },
        "DTS": {
          "start": {
            "seed": "2024-06-15T14:30:45"
          },
          "end": {
            "seed": "2024-06-20T16:00:30"
          }
        }
      }
    }
  },
  "formatX12Time": {
    "module": "intermodal/format",
    "fn": "formatX12Time",
    "template": "formatX12Time(\"14:30:00\", \"TM\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "14:30:00"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "TM",
        "choices": [
          "TM",
          "TS"
        ]
      }
    ],
    "choiceSeeds": {
      "format": {
        "TM": {
          "value": {
            "seed": "14:30:00"
          }
        },
        "TS": {
          "value": {
            "seed": "14:30:45"
          }
        }
      }
    }
  },
  "formatX12TimeElement": {
    "module": "intermodal/format",
    "fn": "formatX12TimeElement",
    "template": "formatX12TimeElement(\"14:30:00.12\", \"HHMMSSDD\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "14:30:00.12"
      },
      {
        "name": "form",
        "kind": "enum",
        "seed": "HHMMSSDD",
        "choices": [
          "HHMM",
          "HHMMSS",
          "HHMMSSD",
          "HHMMSSDD"
        ]
      }
    ],
    "choiceSeeds": {
      "form": {
        "HHMMSSDD": {
          "value": {
            "seed": "14:30:00.12"
          }
        },
        "HHMMSSD": {
          "value": {
            "seed": "14:30:00.12"
          }
        },
        "HHMM": {
          "value": {
            "seed": "14:30"
          }
        },
        "HHMMSS": {
          "value": {
            "seed": "14:30:45.999"
          }
        }
      }
    }
  },
  "classifyEdifactDtmFormat": {
    "module": "intermodal/parse",
    "fn": "classifyEdifactDtmFormat",
    "template": "classifyEdifactDtmFormat(\"102\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "format",
        "kind": "string",
        "seed": "102"
      }
    ]
  },
  "classifyX12DateTimePeriodFormat": {
    "module": "intermodal/parse",
    "fn": "classifyX12DateTimePeriodFormat",
    "template": "classifyX12DateTimePeriodFormat(\"D8\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "format",
        "kind": "string",
        "seed": "D8"
      }
    ]
  },
  "classifyX12TimeCode": {
    "module": "intermodal/parse",
    "fn": "classifyX12TimeCode",
    "template": "classifyX12TimeCode(\"20\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "timeCode",
        "kind": "string",
        "seed": "20"
      }
    ]
  },
  "parseEdifactDate": {
    "module": "intermodal/parse",
    "fn": "parseEdifactDate",
    "template": "parseEdifactDate(\"20240615\", \"102\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "20240615"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "102",
        "choices": [
          "102"
        ]
      }
    ]
  },
  "parseEdifactDatePeriod": {
    "module": "intermodal/parse",
    "fn": "parseEdifactDatePeriod",
    "template": "parseEdifactDatePeriod(\"2024061520240620\", \"718\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024061520240620"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "718",
        "choices": [
          "718"
        ]
      }
    ]
  },
  "parseEdifactDateTime": {
    "module": "intermodal/parse",
    "fn": "parseEdifactDateTime",
    "template": "parseEdifactDateTime(\"202406151430\", \"203\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "202406151430"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "203",
        "choices": [
          "203",
          "204"
        ]
      }
    ],
    "choiceSeeds": {
      "format": {
        "203": {
          "value": {
            "seed": "202406151430"
          }
        },
        "204": {
          "value": {
            "seed": "20240615143045"
          }
        }
      }
    }
  },
  "parseEdifactDateTimePeriod": {
    "module": "intermodal/parse",
    "fn": "parseEdifactDateTimePeriod",
    "template": "parseEdifactDateTimePeriod(\"202406151430202406201600\", \"719\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "202406151430202406201600"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "719",
        "choices": [
          "719"
        ]
      }
    ]
  },
  "parseEdifactOffsetDateTime": {
    "module": "intermodal/parse",
    "fn": "parseEdifactOffsetDateTime",
    "template": "parseEdifactOffsetDateTime(\"202406151430+0200\", \"205\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "202406151430+0200"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "205",
        "choices": [
          "205",
          "208",
          "303",
          "304"
        ]
      }
    ],
    "choiceSeeds": {
      "format": {
        "205": {
          "value": {
            "seed": "202406151430+0200"
          }
        },
        "208": {
          "value": {
            "seed": "20240615143045+0530"
          }
        },
        "303": {
          "value": {
            "seed": "202406151430+02"
          }
        },
        "304": {
          "value": {
            "seed": "20240615143045-05"
          }
        }
      }
    }
  },
  "parseEdifactTime": {
    "module": "intermodal/parse",
    "fn": "parseEdifactTime",
    "template": "parseEdifactTime(\"1430\", \"401\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "1430"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "401",
        "choices": [
          "401",
          "402"
        ]
      }
    ],
    "choiceSeeds": {
      "format": {
        "401": {
          "value": {
            "seed": "1430"
          }
        },
        "402": {
          "value": {
            "seed": "143045"
          }
        }
      }
    }
  },
  "parseEpcisEvent": {
    "module": "intermodal/parse",
    "fn": "parseEpcisEvent",
    "template": "parseEpcisEvent({ eventTime: \"2024-06-15T14:30:00Z\", eventTimeZoneOffset: \"-05:00\" })",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "eventTime",
        "kind": "string",
        "seed": "2024-06-15T14:30:00Z"
      },
      {
        "name": "eventTimeZoneOffset",
        "kind": "string",
        "seed": "-05:00"
      }
    ],
    "objectArg": true
  },
  "parseX12Date": {
    "module": "intermodal/parse",
    "fn": "parseX12Date",
    "template": "parseX12Date(\"20240615\", \"D8\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "20240615"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "D8",
        "choices": [
          "D8",
          "DB"
        ]
      }
    ],
    "choiceSeeds": {
      "format": {
        "D8": {
          "value": {
            "seed": "20240615"
          }
        },
        "DB": {
          "value": {
            "seed": "06152024"
          }
        }
      }
    }
  },
  "parseX12DateAndTime": {
    "module": "intermodal/parse",
    "fn": "parseX12DateAndTime",
    "template": "parseX12DateAndTime(\"20240615\", \"1430\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "date",
        "kind": "string",
        "seed": "20240615"
      },
      {
        "name": "time",
        "kind": "string",
        "seed": "1430"
      }
    ]
  },
  "parseX12DateRange": {
    "module": "intermodal/parse",
    "fn": "parseX12DateRange",
    "template": "parseX12DateRange(\"20240615-20240620\", \"RD8\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "20240615-20240620"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "RD8",
        "choices": [
          "RD8",
          "RD"
        ]
      }
    ],
    "choiceSeeds": {
      "format": {
        "RD8": {
          "value": {
            "seed": "20240615-20240620"
          }
        },
        "RD": {
          "value": {
            "seed": "06152024-06202024"
          }
        }
      }
    }
  },
  "parseX12DateTime": {
    "module": "intermodal/parse",
    "fn": "parseX12DateTime",
    "template": "parseX12DateTime(\"202406151430\", \"DT\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "202406151430"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "DT",
        "choices": [
          "DT",
          "RTS"
        ]
      }
    ],
    "choiceSeeds": {
      "format": {
        "DT": {
          "value": {
            "seed": "202406151430"
          }
        },
        "RTS": {
          "value": {
            "seed": "20240615143045"
          }
        }
      }
    }
  },
  "parseX12DateTimeRange": {
    "module": "intermodal/parse",
    "fn": "parseX12DateTimeRange",
    "template": "parseX12DateTimeRange(\"202406151430-202406201600\", \"RDT\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "202406151430-202406201600"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "RDT",
        "choices": [
          "RDT",
          "DTS"
        ]
      }
    ],
    "choiceSeeds": {
      "format": {
        "RDT": {
          "value": {
            "seed": "202406151430-202406201600"
          }
        },
        "DTS": {
          "value": {
            "seed": "20240615143045-20240620160030"
          }
        }
      }
    }
  },
  "parseX12Time": {
    "module": "intermodal/parse",
    "fn": "parseX12Time",
    "template": "parseX12Time(\"1430\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "1430"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "",
        "choices": [
          "TM",
          "TS"
        ],
        "optional": true
      }
    ],
    "choiceSeeds": {
      "format": {
        "TM": {
          "value": {
            "seed": "1430"
          }
        },
        "TS": {
          "value": {
            "seed": "143045"
          }
        }
      }
    }
  },
  "x12TimeCodeOffset": {
    "module": "intermodal/parse",
    "fn": "x12TimeCodeOffset",
    "template": "x12TimeCodeOffset(\"20\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "timeCode",
        "kind": "enum",
        "seed": "20",
        "choices": [
          "01",
          "02",
          "03",
          "04",
          "05",
          "06",
          "07",
          "08",
          "09",
          "10",
          "11",
          "12",
          "13",
          "14",
          "15",
          "16",
          "17",
          "18",
          "19",
          "20",
          "21",
          "22",
          "23",
          "24",
          "25",
          "26",
          "27",
          "28",
          "29",
          "GM",
          "UT"
        ]
      }
    ]
  },
  "x12TimeCodeZone": {
    "module": "intermodal/parse",
    "fn": "x12TimeCodeZone",
    "template": "x12TimeCodeZone(\"ES\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "timeCode",
        "kind": "enum",
        "seed": "ES",
        "choices": [
          "TS",
          "AD",
          "AS",
          "AT",
          "CD",
          "CS",
          "CT",
          "ED",
          "ES",
          "ET",
          "HD",
          "HS",
          "HT",
          "LT",
          "MD",
          "MS",
          "MT",
          "ND",
          "NS",
          "NT",
          "PD",
          "PS",
          "PT",
          "TD",
          "TT"
        ]
      }
    ]
  },
  "isValidEdifactDate": {
    "module": "intermodal/validate",
    "fn": "isValidEdifactDate",
    "template": "isValidEdifactDate(\"20240615\", \"102\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "20240615"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "102",
        "choices": [
          "102"
        ]
      }
    ]
  },
  "isValidEdifactDatePeriod": {
    "module": "intermodal/validate",
    "fn": "isValidEdifactDatePeriod",
    "template": "isValidEdifactDatePeriod(\"2024061520240620\", \"718\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024061520240620"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "718",
        "choices": [
          "718"
        ]
      }
    ]
  },
  "isValidEdifactDateTime": {
    "module": "intermodal/validate",
    "fn": "isValidEdifactDateTime",
    "template": "isValidEdifactDateTime(\"202406151430\", \"203\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "202406151430"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "203",
        "choices": [
          "203",
          "204"
        ]
      }
    ],
    "choiceSeeds": {
      "format": {
        "203": {
          "value": {
            "seed": "202406151430"
          }
        },
        "204": {
          "value": {
            "seed": "20240615143045"
          }
        }
      }
    }
  },
  "isValidEdifactDateTimePeriod": {
    "module": "intermodal/validate",
    "fn": "isValidEdifactDateTimePeriod",
    "template": "isValidEdifactDateTimePeriod(\"202406151430202406201600\", \"719\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "202406151430202406201600"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "719",
        "choices": [
          "719"
        ]
      }
    ]
  },
  "isValidEdifactDtmFormat": {
    "module": "intermodal/validate",
    "fn": "isValidEdifactDtmFormat",
    "template": "isValidEdifactDtmFormat(\"203\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "format",
        "kind": "string",
        "seed": "203"
      }
    ]
  },
  "isValidEdifactOffsetDateTime": {
    "module": "intermodal/validate",
    "fn": "isValidEdifactOffsetDateTime",
    "template": "isValidEdifactOffsetDateTime(\"202406151430+0200\", \"205\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "202406151430+0200"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "205",
        "choices": [
          "205",
          "208",
          "303",
          "304"
        ]
      }
    ],
    "choiceSeeds": {
      "format": {
        "205": {
          "value": {
            "seed": "202406151430+0200"
          }
        },
        "208": {
          "value": {
            "seed": "20240615143045+0530"
          }
        },
        "303": {
          "value": {
            "seed": "202406151430UTC"
          }
        },
        "304": {
          "value": {
            "seed": "20240615143045-05"
          }
        }
      }
    }
  },
  "isValidEdifactTime": {
    "module": "intermodal/validate",
    "fn": "isValidEdifactTime",
    "template": "isValidEdifactTime(\"1430\", \"401\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "1430"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "401",
        "choices": [
          "401",
          "402"
        ]
      }
    ],
    "choiceSeeds": {
      "format": {
        "401": {
          "value": {
            "seed": "1430"
          }
        },
        "402": {
          "value": {
            "seed": "143045"
          }
        }
      }
    }
  },
  "isValidEpcisEvent": {
    "module": "intermodal/validate",
    "fn": "isValidEpcisEvent",
    "template": "isValidEpcisEvent({ eventTime: \"2024-06-15T14:30:00Z\", eventTimeZoneOffset: \"-05:00\" })",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "eventTime",
        "kind": "string",
        "seed": "2024-06-15T14:30:00Z"
      },
      {
        "name": "eventTimeZoneOffset",
        "kind": "string",
        "seed": "-05:00"
      }
    ],
    "objectArg": true
  },
  "isValidEpcisEventTime": {
    "module": "intermodal/validate",
    "fn": "isValidEpcisEventTime",
    "template": "isValidEpcisEventTime(\"2024-06-15T14:30:00Z\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15T14:30:00Z"
      }
    ]
  },
  "isValidEpcisTimeZoneOffset": {
    "module": "intermodal/validate",
    "fn": "isValidEpcisTimeZoneOffset",
    "template": "isValidEpcisTimeZoneOffset(\"-05:00\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "-05:00"
      }
    ]
  },
  "isValidX12Date": {
    "module": "intermodal/validate",
    "fn": "isValidX12Date",
    "template": "isValidX12Date(\"20240615\", \"D8\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "20240615"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "D8",
        "choices": [
          "D8",
          "DB"
        ]
      }
    ],
    "choiceSeeds": {
      "format": {
        "D8": {
          "value": {
            "seed": "20240615"
          }
        },
        "DB": {
          "value": {
            "seed": "06152024"
          }
        }
      }
    }
  },
  "isValidX12DateAndTime": {
    "module": "intermodal/validate",
    "fn": "isValidX12DateAndTime",
    "template": "isValidX12DateAndTime(\"20240615\", \"1430\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "date",
        "kind": "string",
        "seed": "20240615"
      },
      {
        "name": "time",
        "kind": "string",
        "seed": "1430"
      }
    ]
  },
  "isValidX12DateRange": {
    "module": "intermodal/validate",
    "fn": "isValidX12DateRange",
    "template": "isValidX12DateRange(\"20240615-20240620\", \"RD8\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "20240615-20240620"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "RD8",
        "choices": [
          "RD8",
          "RD"
        ]
      }
    ],
    "choiceSeeds": {
      "format": {
        "RD8": {
          "value": {
            "seed": "20240615-20240620"
          }
        },
        "RD": {
          "value": {
            "seed": "06152024-06202024"
          }
        }
      }
    }
  },
  "isValidX12DateTime": {
    "module": "intermodal/validate",
    "fn": "isValidX12DateTime",
    "template": "isValidX12DateTime(\"202406151430\", \"DT\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "202406151430"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "DT",
        "choices": [
          "DT",
          "RTS"
        ]
      }
    ],
    "choiceSeeds": {
      "format": {
        "DT": {
          "value": {
            "seed": "202406151430"
          }
        },
        "RTS": {
          "value": {
            "seed": "20240615143045"
          }
        }
      }
    }
  },
  "isValidX12DateTimePeriodFormat": {
    "module": "intermodal/validate",
    "fn": "isValidX12DateTimePeriodFormat",
    "template": "isValidX12DateTimePeriodFormat(\"D8\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "format",
        "kind": "string",
        "seed": "D8"
      }
    ]
  },
  "isValidX12DateTimeRange": {
    "module": "intermodal/validate",
    "fn": "isValidX12DateTimeRange",
    "template": "isValidX12DateTimeRange(\"202406151430-202406201600\", \"RDT\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "202406151430-202406201600"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "RDT",
        "choices": [
          "RDT",
          "DTS"
        ]
      }
    ],
    "choiceSeeds": {
      "format": {
        "RDT": {
          "value": {
            "seed": "202406151430-202406201600"
          }
        },
        "DTS": {
          "value": {
            "seed": "20240615143045-20240620160030"
          }
        }
      }
    }
  },
  "isValidX12Time": {
    "module": "intermodal/validate",
    "fn": "isValidX12Time",
    "template": "isValidX12Time(\"1430\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "1430"
      },
      {
        "name": "format",
        "kind": "enum",
        "seed": "",
        "choices": [
          "TM",
          "TS"
        ],
        "optional": true
      }
    ],
    "choiceSeeds": {
      "format": {
        "TM": {
          "value": {
            "seed": "1430"
          }
        },
        "TS": {
          "value": {
            "seed": "143045"
          }
        }
      }
    }
  },
  "isValidX12TimeCode": {
    "module": "intermodal/validate",
    "fn": "isValidX12TimeCode",
    "template": "isValidX12TimeCode(\"ES\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "timeCode",
        "kind": "string",
        "seed": "ES"
      }
    ]
  },
  "clampInterval": {
    "module": "interval/calculate",
    "fn": "clampInterval",
    "template": "clampInterval({ start: \"2024-01-01T08:00:00Z\", end: \"2024-01-01T12:00:00Z\" }, { start: \"2024-01-01T09:00:00Z\", end: \"2024-01-01T17:00:00Z\" })",
    "returnType": "object",
    "allowEmptyArray": false,
    "nullIsEmpty": true,
    "fields": [
      {
        "name": "interval",
        "kind": "expr",
        "seed": "{ start: \"2024-01-01T08:00:00Z\", end: \"2024-01-01T12:00:00Z\" }"
      },
      {
        "name": "bounds",
        "kind": "expr",
        "seed": "{ start: \"2024-01-01T09:00:00Z\", end: \"2024-01-01T17:00:00Z\" }"
      }
    ]
  },
  "intersectIntervals": {
    "module": "interval/calculate",
    "fn": "intersectIntervals",
    "template": "intersectIntervals({ start: \"2024-01-01T09:00:00Z\", end: \"2024-01-01T17:00:00Z\" }, { start: \"2024-01-01T12:00:00Z\", end: \"2024-01-01T18:00:00Z\" })",
    "returnType": "object",
    "allowEmptyArray": false,
    "nullIsEmpty": true,
    "fields": [
      {
        "name": "a",
        "kind": "expr",
        "seed": "{ start: \"2024-01-01T09:00:00Z\", end: \"2024-01-01T17:00:00Z\" }"
      },
      {
        "name": "b",
        "kind": "expr",
        "seed": "{ start: \"2024-01-01T12:00:00Z\", end: \"2024-01-01T18:00:00Z\" }"
      }
    ]
  },
  "mergeIntervals": {
    "module": "interval/calculate",
    "fn": "mergeIntervals",
    "template": "mergeIntervals([{ start: \"2024-01-01T13:00:00Z\", end: \"2024-01-01T17:00:00Z\" }, { start: \"2024-01-01T09:00:00Z\", end: \"2024-01-01T12:00:00Z\" }])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "intervals",
        "kind": "intervals",
        "seed": "",
        "pairs": [
          [
            "2024-01-01T13:00:00Z",
            "2024-01-01T17:00:00Z"
          ],
          [
            "2024-01-01T09:00:00Z",
            "2024-01-01T12:00:00Z"
          ]
        ]
      }
    ]
  },
  "splitIntervalAt": {
    "module": "interval/calculate",
    "fn": "splitIntervalAt",
    "template": "splitIntervalAt({ start: \"2024-01-01T09:00:00Z\", end: \"2024-01-01T17:00:00Z\" }, [\"2024-01-01T12:00:00Z\"])",
    "returnType": "array",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "interval",
        "kind": "expr",
        "seed": "{ start: \"2024-01-01T09:00:00Z\", end: \"2024-01-01T17:00:00Z\" }"
      },
      {
        "name": "boundaries",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "2024-01-01T12:00:00Z"
        ]
      }
    ]
  },
  "subtractIntervals": {
    "module": "interval/calculate",
    "fn": "subtractIntervals",
    "template": "subtractIntervals({ start: \"2024-01-01T09:00:00Z\", end: \"2024-01-01T17:00:00Z\" }, [{ start: \"2024-01-01T12:00:00Z\", end: \"2024-01-01T13:00:00Z\" }])",
    "returnType": "array",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "from",
        "kind": "expr",
        "seed": "{ start: \"2024-01-01T09:00:00Z\", end: \"2024-01-01T17:00:00Z\" }"
      },
      {
        "name": "remove",
        "kind": "intervals",
        "seed": "",
        "pairs": [
          [
            "2024-01-01T12:00:00Z",
            "2024-01-01T13:00:00Z"
          ]
        ]
      }
    ]
  },
  "sumIntervals": {
    "module": "interval/calculate",
    "fn": "sumIntervals",
    "template": "sumIntervals([{ start: \"2024-01-01T00:00:00Z\", end: \"2024-01-03T01:30:00Z\" }])",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "intervals",
        "kind": "intervals",
        "seed": "",
        "pairs": [
          [
            "2024-01-01T00:00:00Z",
            "2024-01-03T01:30:00Z"
          ]
        ]
      }
    ]
  },
  "intervalContains": {
    "module": "interval/compare",
    "fn": "intervalContains",
    "template": "intervalContains({ start: \"2024-01-01T09:00:00Z\", end: \"2024-01-01T17:00:00Z\" }, \"2024-01-01T09:00:00Z\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "interval",
        "kind": "expr",
        "seed": "{ start: \"2024-01-01T09:00:00Z\", end: \"2024-01-01T17:00:00Z\" }"
      },
      {
        "name": "isoString",
        "kind": "string",
        "seed": "2024-01-01T09:00:00Z"
      }
    ]
  },
  "intervalsOverlap": {
    "module": "interval/compare",
    "fn": "intervalsOverlap",
    "template": "intervalsOverlap({ start: \"2024-01-01T09:00:00Z\", end: \"2024-01-01T17:00:00Z\" }, { start: \"2024-01-01T12:00:00Z\", end: \"2024-01-01T18:00:00Z\" })",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "a",
        "kind": "expr",
        "seed": "{ start: \"2024-01-01T09:00:00Z\", end: \"2024-01-01T17:00:00Z\" }"
      },
      {
        "name": "b",
        "kind": "expr",
        "seed": "{ start: \"2024-01-01T12:00:00Z\", end: \"2024-01-01T18:00:00Z\" }"
      }
    ]
  },
  "isValidInterval": {
    "module": "interval/validate",
    "fn": "isValidInterval",
    "template": "isValidInterval({ start: \"2024-01-01T09:00:00Z\", end: \"2024-01-01T17:00:00Z\" })",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01T09:00:00Z"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-01-01T17:00:00Z"
      }
    ],
    "objectArg": true
  },
  "addBusinessDays": {
    "module": "plain/calculate",
    "fn": "addBusinessDays",
    "template": "addBusinessDays(\"2024-03-15\", 1)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15"
      },
      {
        "name": "amount",
        "kind": "number",
        "seed": "1"
      },
      {
        "name": "calendar",
        "kind": "string",
        "seed": "",
        "optional": true
      }
    ]
  },
  "addDate": {
    "module": "plain/calculate",
    "fn": "addDate",
    "template": "addDate(\"2024-03-10\", { days: 5 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-10"
      },
      {
        "name": "units",
        "kind": "units",
        "seed": "5",
        "unitKeys": [
          "years",
          "months",
          "weeks",
          "days"
        ],
        "unitSeed": "days"
      }
    ]
  },
  "addDateTime": {
    "module": "plain/calculate",
    "fn": "addDateTime",
    "template": "addDateTime(\"2024-03-10T12:00:00\", { days: 5 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-10T12:00:00"
      },
      {
        "name": "units",
        "kind": "units",
        "seed": "5",
        "unitKeys": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds"
        ],
        "unitSeed": "days"
      }
    ]
  },
  "addTime": {
    "module": "plain/calculate",
    "fn": "addTime",
    "template": "addTime(\"12:00:00\", { hours: 1 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "12:00:00"
      },
      {
        "name": "units",
        "kind": "units",
        "seed": "1",
        "unitKeys": [
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds"
        ],
        "unitSeed": "hours"
      }
    ]
  },
  "addYearMonth": {
    "module": "plain/calculate",
    "fn": "addYearMonth",
    "template": "addYearMonth(\"2026-10\", { months: 1 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2026-10"
      },
      {
        "name": "units",
        "kind": "expr",
        "seed": "{ months: 1 }"
      }
    ]
  },
  "clampDate": {
    "module": "plain/calculate",
    "fn": "clampDate",
    "template": "clampDate(\"2024-03-15\", \"2024-03-01\", \"2024-03-31\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15"
      },
      {
        "name": "min",
        "kind": "string",
        "seed": "2024-03-01"
      },
      {
        "name": "max",
        "kind": "string",
        "seed": "2024-03-31"
      }
    ]
  },
  "closestDateTo": {
    "module": "plain/calculate",
    "fn": "closestDateTo",
    "template": "closestDateTo(\"2024-03-15\", [\"2024-03-01\", \"2024-03-20\", \"2024-03-18\"])",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "target",
        "kind": "string",
        "seed": "2024-03-15"
      },
      {
        "name": "candidates",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "2024-03-01",
          "2024-03-20",
          "2024-03-18"
        ]
      }
    ]
  },
  "cycleDate": {
    "module": "plain/calculate",
    "fn": "cycleDate",
    "template": "cycleDate(\"2024-06-15\", \"month\", 1)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15"
      },
      {
        "name": "field",
        "kind": "enum",
        "seed": "month",
        "choices": [
          "year",
          "month",
          "day"
        ]
      },
      {
        "name": "amount",
        "kind": "number",
        "seed": "1"
      }
    ],
    "choiceSeeds": {
      "field": {
        "month": {
          "value": {
            "seed": "2024-06-15"
          },
          "amount": {
            "seed": "1"
          }
        },
        "day": {
          "value": {
            "seed": "2024-12-31"
          },
          "amount": {
            "seed": "1"
          }
        },
        "year": {
          "value": {
            "seed": "2022-02-03"
          },
          "amount": {
            "seed": "5"
          }
        }
      }
    }
  },
  "cycleDateTime": {
    "module": "plain/calculate",
    "fn": "cycleDateTime",
    "template": "cycleDateTime(\"2024-06-15T09:30:00\", \"hour\", 1)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15T09:30:00"
      },
      {
        "name": "field",
        "kind": "enum",
        "seed": "hour",
        "choices": [
          "year",
          "month",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      },
      {
        "name": "amount",
        "kind": "number",
        "seed": "1"
      }
    ],
    "choiceSeeds": {
      "field": {
        "hour": {
          "value": {
            "seed": "2024-06-15T09:30:00"
          },
          "amount": {
            "seed": "1"
          }
        },
        "month": {
          "value": {
            "seed": "2024-12-15T23:30:00"
          },
          "amount": {
            "seed": "1"
          }
        },
        "minute": {
          "value": {
            "seed": "2024-06-15T09:22:00"
          },
          "amount": {
            "seed": "15"
          }
        }
      }
    }
  },
  "cycleTime": {
    "module": "plain/calculate",
    "fn": "cycleTime",
    "template": "cycleTime(\"09:30:00\", \"hour\", 1)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "09:30:00"
      },
      {
        "name": "field",
        "kind": "enum",
        "seed": "hour",
        "choices": [
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      },
      {
        "name": "amount",
        "kind": "number",
        "seed": "1"
      }
    ],
    "choiceSeeds": {
      "field": {
        "hour": {
          "value": {
            "seed": "09:30:00"
          },
          "amount": {
            "seed": "1"
          }
        },
        "minute": {
          "value": {
            "seed": "09:22:00"
          },
          "amount": {
            "seed": "15"
          }
        }
      }
    }
  },
  "diffDate": {
    "module": "plain/calculate",
    "fn": "diffDate",
    "template": "diffDate(\"2024-03-10\", \"2024-03-15\", \"days\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "date1",
        "kind": "string",
        "seed": "2024-03-10"
      },
      {
        "name": "date2",
        "kind": "string",
        "seed": "2024-03-15"
      },
      {
        "name": "unitArg",
        "kind": "enum",
        "seed": "days",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "year",
          "month",
          "week",
          "day"
        ]
      }
    ],
    "choiceSeeds": {
      "unitArg": {
        "days": {
          "date1": {
            "seed": "2024-03-10"
          },
          "date2": {
            "seed": "2024-03-15"
          }
        },
        "weeks": {
          "date1": {
            "seed": "2024-01-01"
          },
          "date2": {
            "seed": "2024-01-16"
          }
        },
        "months": {
          "date1": {
            "seed": "2024-02-24[u-ca=hebrew]"
          },
          "date2": {
            "seed": "2024-03-25[u-ca=hebrew]"
          }
        }
      }
    }
  },
  "diffDateAsDuration": {
    "module": "plain/calculate",
    "fn": "diffDateAsDuration",
    "template": "diffDateAsDuration(\"2024-03-10\", \"2024-04-05\", \"days\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "date1",
        "kind": "string",
        "seed": "2024-03-10"
      },
      {
        "name": "date2",
        "kind": "string",
        "seed": "2024-04-05"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "days",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "year",
          "month",
          "week",
          "day"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "days": {
          "date1": {
            "seed": "2024-03-10"
          },
          "date2": {
            "seed": "2024-04-05"
          }
        },
        "weeks": {
          "date1": {
            "seed": "2024-01-01"
          },
          "date2": {
            "seed": "2024-01-16"
          }
        },
        "months": {
          "date1": {
            "seed": "2024-02-24[u-ca=hebrew]"
          },
          "date2": {
            "seed": "2024-03-25[u-ca=hebrew]"
          }
        }
      }
    }
  },
  "diffDateTime": {
    "module": "plain/calculate",
    "fn": "diffDateTime",
    "template": "diffDateTime(\"2024-03-10T12:00:00\", \"2024-03-15T12:00:00\", \"days\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "dateTime1",
        "kind": "string",
        "seed": "2024-03-10T12:00:00"
      },
      {
        "name": "dateTime2",
        "kind": "string",
        "seed": "2024-03-15T12:00:00"
      },
      {
        "name": "units",
        "kind": "enum",
        "seed": "days",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ]
  },
  "diffDateTimeAsDuration": {
    "module": "plain/calculate",
    "fn": "diffDateTimeAsDuration",
    "template": "diffDateTimeAsDuration(\"2024-03-10T00:00:00\", \"2024-03-11T02:00:00\", \"days\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "dateTime1",
        "kind": "string",
        "seed": "2024-03-10T00:00:00"
      },
      {
        "name": "dateTime2",
        "kind": "string",
        "seed": "2024-03-11T02:00:00"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "days",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "days": {
          "dateTime1": {
            "seed": "2024-03-10T00:00:00"
          },
          "dateTime2": {
            "seed": "2024-03-11T02:00:00"
          }
        },
        "hours": {
          "dateTime1": {
            "seed": "2024-02-29T00:00:00"
          },
          "dateTime2": {
            "seed": "2024-02-29T01:30:00"
          }
        }
      }
    }
  },
  "diffTime": {
    "module": "plain/calculate",
    "fn": "diffTime",
    "template": "diffTime(\"12:00:00\", \"14:30:00\", \"hours\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "time1",
        "kind": "string",
        "seed": "12:00:00"
      },
      {
        "name": "time2",
        "kind": "string",
        "seed": "14:30:00"
      },
      {
        "name": "units",
        "kind": "enum",
        "seed": "hours",
        "choices": [
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ]
  },
  "diffYearMonth": {
    "module": "plain/calculate",
    "fn": "diffYearMonth",
    "template": "diffYearMonth(\"2025-11\", \"2026-10\", \"months\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "a",
        "kind": "string",
        "seed": "2025-11"
      },
      {
        "name": "b",
        "kind": "string",
        "seed": "2026-10"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "months",
        "choices": [
          "years",
          "months",
          "year",
          "month"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "months": {
          "a": {
            "seed": "2025-11"
          },
          "b": {
            "seed": "2026-10"
          }
        },
        "years": {
          "a": {
            "seed": "2025-11"
          },
          "b": {
            "seed": "2027-10"
          }
        }
      }
    }
  },
  "endOfDate": {
    "module": "plain/calculate",
    "fn": "endOfDate",
    "template": "endOfDate(\"2024-02-29\", \"month\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "month",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "year",
          "month",
          "week",
          "day"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "month": {
          "value": {
            "seed": "2024-02-29"
          }
        },
        "week": {
          "value": {
            "seed": "2024-03-03"
          }
        },
        "years": {
          "value": {
            "seed": "2024-02-29"
          }
        }
      }
    }
  },
  "endOfDateTime": {
    "module": "plain/calculate",
    "fn": "endOfDateTime",
    "template": "endOfDateTime(\"2024-02-29T12:34:56\", \"month\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:34:56"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "month",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "month": {
          "value": {
            "seed": "2024-02-29T12:34:56"
          }
        },
        "second": {
          "value": {
            "seed": "2024-02-29T12:34:56.123456789"
          }
        },
        "week": {
          "value": {
            "seed": "2024-03-03T12:00:00"
          }
        },
        "hours": {
          "value": {
            "seed": "2024-02-29T12:34:56"
          }
        }
      }
    }
  },
  "endOfQuarterForDate": {
    "module": "plain/calculate",
    "fn": "endOfQuarterForDate",
    "template": "endOfQuarterForDate(\"2024-03-15\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15"
      }
    ]
  },
  "endOfQuarterForDateTime": {
    "module": "plain/calculate",
    "fn": "endOfQuarterForDateTime",
    "template": "endOfQuarterForDateTime(\"2024-03-15T12:00:00\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T12:00:00"
      }
    ]
  },
  "endOfTime": {
    "module": "plain/calculate",
    "fn": "endOfTime",
    "template": "endOfTime(\"12:34:56\", \"hour\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "12:34:56"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "hour",
        "choices": [
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "hour": {
          "value": {
            "seed": "12:34:56"
          }
        },
        "milliseconds": {
          "value": {
            "seed": "12:34:56.123"
          }
        }
      }
    }
  },
  "endOfYearMonth": {
    "module": "plain/calculate",
    "fn": "endOfYearMonth",
    "template": "endOfYearMonth(\"2026-10\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2026-10"
      }
    ]
  },
  "getDayOfYear": {
    "module": "plain/calculate",
    "fn": "getDayOfYear",
    "template": "getDayOfYear(\"2024-01-01\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-01-01"
      }
    ]
  },
  "getDaysInMonth": {
    "module": "plain/calculate",
    "fn": "getDaysInMonth",
    "template": "getDaysInMonth(\"2024-02-15\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-15"
      }
    ]
  },
  "getDaysInYear": {
    "module": "plain/calculate",
    "fn": "getDaysInYear",
    "template": "getDaysInYear(\"2024-06-15\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15"
      }
    ]
  },
  "getDaysInYearMonth": {
    "module": "plain/calculate",
    "fn": "getDaysInYearMonth",
    "template": "getDaysInYearMonth(\"2024-02\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02"
      }
    ]
  },
  "getLargestDateDurationUnit": {
    "module": "plain/calculate",
    "fn": "getLargestDateDurationUnit",
    "template": "getLargestDateDurationUnit([\"months\", \"days\"])",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "units",
        "kind": "list",
        "seed": "",
        "element": "enum",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "year",
          "month",
          "week",
          "day"
        ],
        "items": [
          "months",
          "days"
        ]
      }
    ]
  },
  "getLargestDateTimeDurationUnit": {
    "module": "plain/calculate",
    "fn": "getLargestDateTimeDurationUnit",
    "template": "getLargestDateTimeDurationUnit([\"hours\", \"minutes\", \"seconds\"])",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "units",
        "kind": "list",
        "seed": "",
        "element": "enum",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ],
        "items": [
          "hours",
          "minutes",
          "seconds"
        ]
      }
    ]
  },
  "getLargestTimeDurationUnit": {
    "module": "plain/calculate",
    "fn": "getLargestTimeDurationUnit",
    "template": "getLargestTimeDurationUnit([\"minutes\", \"seconds\"])",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "units",
        "kind": "list",
        "seed": "",
        "element": "enum",
        "choices": [
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ],
        "items": [
          "minutes",
          "seconds"
        ]
      }
    ]
  },
  "getLocaleDayOfWeek": {
    "module": "plain/calculate",
    "fn": "getLocaleDayOfWeek",
    "template": "getLocaleDayOfWeek(\"2024-02-25\", \"ja-JP\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-25"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "ja-JP"
      }
    ]
  },
  "getLocaleEndOfWeek": {
    "module": "plain/calculate",
    "fn": "getLocaleEndOfWeek",
    "template": "getLocaleEndOfWeek(\"2024-02-29\", \"ja-JP\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "ja-JP"
      }
    ]
  },
  "getLocaleStartOfWeek": {
    "module": "plain/calculate",
    "fn": "getLocaleStartOfWeek",
    "template": "getLocaleStartOfWeek(\"2024-02-29\", \"ja-JP\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "ja-JP"
      }
    ]
  },
  "getLocaleWeekYear": {
    "module": "plain/calculate",
    "fn": "getLocaleWeekYear",
    "template": "getLocaleWeekYear(\"2024-06-15\", \"pt-BR\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "pt-BR"
      }
    ]
  },
  "getQuarterForDate": {
    "module": "plain/calculate",
    "fn": "getQuarterForDate",
    "template": "getQuarterForDate(\"2024-01-15\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-01-15"
      }
    ]
  },
  "getQuarterForDateTime": {
    "module": "plain/calculate",
    "fn": "getQuarterForDateTime",
    "template": "getQuarterForDateTime(\"2024-01-15T12:00:00\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-01-15T12:00:00"
      }
    ]
  },
  "getWeekNumber": {
    "module": "plain/calculate",
    "fn": "getWeekNumber",
    "template": "getWeekNumber(\"2024-01-01\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "dateStr",
        "kind": "string",
        "seed": "2024-01-01"
      },
      {
        "name": "weekStartsOn",
        "kind": "enum",
        "seed": "",
        "choices": [
          "monday",
          "sunday"
        ],
        "optional": true
      }
    ]
  },
  "getWeekOfMonth": {
    "module": "plain/calculate",
    "fn": "getWeekOfMonth",
    "template": "getWeekOfMonth(\"2024-02-01\", \"ja-JP\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-01"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "ja-JP"
      }
    ]
  },
  "getWeekYear": {
    "module": "plain/calculate",
    "fn": "getWeekYear",
    "template": "getWeekYear(\"2024-06-15\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15"
      }
    ]
  },
  "getWeeksInLocaleWeekYear": {
    "module": "plain/calculate",
    "fn": "getWeeksInLocaleWeekYear",
    "template": "getWeeksInLocaleWeekYear(\"2024-06-15\", \"pt-BR\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "pt-BR"
      }
    ]
  },
  "getWeeksInMonth": {
    "module": "plain/calculate",
    "fn": "getWeeksInMonth",
    "template": "getWeeksInMonth(\"2024-02-15\", \"pt-BR\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-15"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "pt-BR"
      }
    ]
  },
  "getWeeksInYear": {
    "module": "plain/calculate",
    "fn": "getWeeksInYear",
    "template": "getWeeksInYear(\"2024-06-15\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15"
      }
    ]
  },
  "maxDate": {
    "module": "plain/calculate",
    "fn": "maxDate",
    "template": "maxDate([\"2024-03-10\", \"2024-03-15\", \"2024-03-12\"])",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "dates",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "2024-03-10",
          "2024-03-15",
          "2024-03-12"
        ]
      }
    ]
  },
  "maxDateTime": {
    "module": "plain/calculate",
    "fn": "maxDateTime",
    "template": "maxDateTime([\"2024-03-10T12:00:00\", \"2024-03-15T12:00:00\", \"2024-03-12T12:00:00\"])",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "dateTimes",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "2024-03-10T12:00:00",
          "2024-03-15T12:00:00",
          "2024-03-12T12:00:00"
        ]
      }
    ]
  },
  "maxTime": {
    "module": "plain/calculate",
    "fn": "maxTime",
    "template": "maxTime([\"14:30:00\", \"09:00:00\", \"20:45:00\"])",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "times",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "14:30:00",
          "09:00:00",
          "20:45:00"
        ]
      }
    ]
  },
  "minDate": {
    "module": "plain/calculate",
    "fn": "minDate",
    "template": "minDate([\"2024-03-10\", \"2024-03-15\", \"2024-03-12\"])",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "dates",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "2024-03-10",
          "2024-03-15",
          "2024-03-12"
        ]
      }
    ]
  },
  "minDateTime": {
    "module": "plain/calculate",
    "fn": "minDateTime",
    "template": "minDateTime([\"2024-03-10T12:00:00\", \"2024-03-15T12:00:00\", \"2024-03-12T12:00:00\"])",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "dateTimes",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "2024-03-10T12:00:00",
          "2024-03-15T12:00:00",
          "2024-03-12T12:00:00"
        ]
      }
    ]
  },
  "minTime": {
    "module": "plain/calculate",
    "fn": "minTime",
    "template": "minTime([\"14:30:00\", \"09:00:00\", \"20:45:00\"])",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "times",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "14:30:00",
          "09:00:00",
          "20:45:00"
        ]
      }
    ]
  },
  "nextWeekday": {
    "module": "plain/calculate",
    "fn": "nextWeekday",
    "template": "nextWeekday(\"2024-03-15\", 5)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15"
      },
      {
        "name": "dayOfWeek",
        "kind": "number",
        "seed": "5"
      }
    ]
  },
  "previousWeekday": {
    "module": "plain/calculate",
    "fn": "previousWeekday",
    "template": "previousWeekday(\"2024-03-15\", 5)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15"
      },
      {
        "name": "dayOfWeek",
        "kind": "number",
        "seed": "5"
      }
    ]
  },
  "roundDate": {
    "module": "plain/calculate",
    "fn": "roundDate",
    "template": "roundDate(\"2024-06-15\", { smallestUnit: \"year\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15"
      }
    ],
    "optionsSuffix": "{ smallestUnit: \"year\" }"
  },
  "roundDateTime": {
    "module": "plain/calculate",
    "fn": "roundDateTime",
    "template": "roundDateTime(\"2024-06-15T12:34:56\", { smallestUnit: \"year\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15T12:34:56"
      }
    ],
    "optionsSuffix": "{ smallestUnit: \"year\" }"
  },
  "roundTime": {
    "module": "plain/calculate",
    "fn": "roundTime",
    "template": "roundTime(\"12:34:56\", { smallestUnit: \"hour\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "12:34:56"
      }
    ],
    "optionsSuffix": "{ smallestUnit: \"hour\" }"
  },
  "setDate": {
    "module": "plain/calculate",
    "fn": "setDate",
    "template": "setDate(\"2024-03-10\", { year: 2025 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-10"
      },
      {
        "name": "fields",
        "kind": "units",
        "seed": "2025",
        "unitKeys": [
          "year",
          "month",
          "day"
        ],
        "unitSeed": "year"
      }
    ]
  },
  "setDateTime": {
    "module": "plain/calculate",
    "fn": "setDateTime",
    "template": "setDateTime(\"2024-03-10T12:00:00\", { hour: 9 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-10T12:00:00"
      },
      {
        "name": "fields",
        "kind": "units",
        "seed": "9",
        "unitKeys": [
          "year",
          "month",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ],
        "unitSeed": "hour"
      }
    ]
  },
  "setTime": {
    "module": "plain/calculate",
    "fn": "setTime",
    "template": "setTime(\"12:00:00\", { hour: 9 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "12:00:00"
      },
      {
        "name": "fields",
        "kind": "units",
        "seed": "9",
        "unitKeys": [
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ],
        "unitSeed": "hour"
      }
    ]
  },
  "sortDateTimes": {
    "module": "plain/calculate",
    "fn": "sortDateTimes",
    "template": "sortDateTimes([\"2024-03-10T12:00:00\", \"2024-01-01T08:00:00\", \"2024-02-15T15:30:00\"])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "dateTimes",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "2024-03-10T12:00:00",
          "2024-01-01T08:00:00",
          "2024-02-15T15:30:00"
        ]
      },
      {
        "name": "order",
        "kind": "enum",
        "seed": "",
        "choices": [
          "asc",
          "desc"
        ],
        "optional": true
      }
    ]
  },
  "sortDates": {
    "module": "plain/calculate",
    "fn": "sortDates",
    "template": "sortDates([\"2024-03-10\", \"2024-01-01\", \"2024-02-15\"])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "dates",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "2024-03-10",
          "2024-01-01",
          "2024-02-15"
        ]
      },
      {
        "name": "order",
        "kind": "enum",
        "seed": "",
        "choices": [
          "asc",
          "desc"
        ],
        "optional": true
      }
    ]
  },
  "sortTimes": {
    "module": "plain/calculate",
    "fn": "sortTimes",
    "template": "sortTimes([\"14:30:00\", \"09:00:00\", \"20:45:00\"])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "times",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "14:30:00",
          "09:00:00",
          "20:45:00"
        ]
      },
      {
        "name": "order",
        "kind": "enum",
        "seed": "",
        "choices": [
          "asc",
          "desc"
        ],
        "optional": true
      }
    ]
  },
  "startOfDate": {
    "module": "plain/calculate",
    "fn": "startOfDate",
    "template": "startOfDate(\"2024-02-29\", \"month\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "month",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "year",
          "month",
          "week",
          "day"
        ]
      }
    ]
  },
  "startOfDateTime": {
    "module": "plain/calculate",
    "fn": "startOfDateTime",
    "template": "startOfDateTime(\"2024-02-29T12:34:56\", \"month\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:34:56"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "month",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "month": {
          "value": {
            "seed": "2024-02-29T12:34:56"
          }
        },
        "milliseconds": {
          "value": {
            "seed": "2024-02-29T12:34:56.789"
          }
        }
      }
    }
  },
  "startOfQuarterForDate": {
    "module": "plain/calculate",
    "fn": "startOfQuarterForDate",
    "template": "startOfQuarterForDate(\"2024-03-15\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15"
      }
    ]
  },
  "startOfQuarterForDateTime": {
    "module": "plain/calculate",
    "fn": "startOfQuarterForDateTime",
    "template": "startOfQuarterForDateTime(\"2024-03-15T12:00:00\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T12:00:00"
      }
    ]
  },
  "startOfTime": {
    "module": "plain/calculate",
    "fn": "startOfTime",
    "template": "startOfTime(\"12:34:56\", \"hour\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "12:34:56"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "hour",
        "choices": [
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "hour": {
          "value": {
            "seed": "12:34:56"
          }
        },
        "millisecond": {
          "value": {
            "seed": "12:34:56.999"
          }
        },
        "minutes": {
          "value": {
            "seed": "12:34:56.123456789"
          }
        }
      }
    }
  },
  "startOfYearMonth": {
    "module": "plain/calculate",
    "fn": "startOfYearMonth",
    "template": "startOfYearMonth(\"2026-10\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2026-10"
      }
    ]
  },
  "subtractBusinessDays": {
    "module": "plain/calculate",
    "fn": "subtractBusinessDays",
    "template": "subtractBusinessDays(\"2024-03-18\", 1)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-18"
      },
      {
        "name": "amount",
        "kind": "number",
        "seed": "1"
      },
      {
        "name": "calendar",
        "kind": "string",
        "seed": "",
        "optional": true
      }
    ]
  },
  "subtractDate": {
    "module": "plain/calculate",
    "fn": "subtractDate",
    "template": "subtractDate(\"2024-03-15\", { days: 5 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15"
      },
      {
        "name": "units",
        "kind": "units",
        "seed": "5",
        "unitKeys": [
          "years",
          "months",
          "weeks",
          "days"
        ],
        "unitSeed": "days"
      }
    ]
  },
  "subtractDateTime": {
    "module": "plain/calculate",
    "fn": "subtractDateTime",
    "template": "subtractDateTime(\"2024-03-15T12:00:00\", { days: 5 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T12:00:00"
      },
      {
        "name": "units",
        "kind": "units",
        "seed": "5",
        "unitKeys": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds"
        ],
        "unitSeed": "days"
      }
    ]
  },
  "subtractTime": {
    "module": "plain/calculate",
    "fn": "subtractTime",
    "template": "subtractTime(\"14:30:00\", { hours: 1 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "14:30:00"
      },
      {
        "name": "units",
        "kind": "units",
        "seed": "1",
        "unitKeys": [
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds"
        ],
        "unitSeed": "hours"
      }
    ]
  },
  "subtractYearMonth": {
    "module": "plain/calculate",
    "fn": "subtractYearMonth",
    "template": "subtractYearMonth(\"2026-10\", { months: 10 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2026-10"
      },
      {
        "name": "units",
        "kind": "expr",
        "seed": "{ months: 10 }"
      }
    ]
  },
  "weekOfYearForDate": {
    "module": "plain/calculate",
    "fn": "weekOfYearForDate",
    "template": "weekOfYearForDate(\"2024-01-01\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-01-01"
      }
    ]
  },
  "weekOfYearForDateTime": {
    "module": "plain/calculate",
    "fn": "weekOfYearForDateTime",
    "template": "weekOfYearForDateTime(\"2024-01-01T12:00:00\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-01-01T12:00:00"
      }
    ]
  },
  "chopDate": {
    "module": "plain/chop",
    "fn": "chopDate",
    "template": "chopDate(\"2024-02-29T12:34:56\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:34:56"
      }
    ]
  },
  "chopMilliseconds": {
    "module": "plain/chop",
    "fn": "chopMilliseconds",
    "template": "chopMilliseconds(\"2024-02-29T12:34:56.789\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:34:56.789"
      }
    ]
  },
  "chopSeconds": {
    "module": "plain/chop",
    "fn": "chopSeconds",
    "template": "chopSeconds(\"2024-02-29T12:34:56\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:34:56"
      }
    ]
  },
  "chopTime": {
    "module": "plain/chop",
    "fn": "chopTime",
    "template": "chopTime(\"2024-02-29T12:34:56\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:34:56"
      }
    ]
  },
  "areDateTimesEqual": {
    "module": "plain/compare",
    "fn": "areDateTimesEqual",
    "template": "areDateTimesEqual(\"2024-02-29T12:34:56\", \"2024-02-29T12:34:56\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-02-29T12:34:56"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-02-29T12:34:56"
      }
    ]
  },
  "areDateTimesEqualBy": {
    "module": "plain/compare",
    "fn": "areDateTimesEqualBy",
    "template": "areDateTimesEqualBy(\"2024-03-15T10:00:00\", \"2024-03-15T18:00:00\", \"day\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-03-15T10:00:00"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-03-15T18:00:00"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "day",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "day": {
          "value1": {
            "seed": "2024-03-15T10:00:00"
          },
          "value2": {
            "seed": "2024-03-15T18:00:00"
          }
        },
        "hour": {
          "value1": {
            "seed": "2024-03-15T10:30:00"
          },
          "value2": {
            "seed": "2024-03-15T10:45:00"
          }
        },
        "second": {
          "value1": {
            "seed": "2024-05-15T10:20:30.123"
          },
          "value2": {
            "seed": "2024-05-15T10:20:30.999"
          }
        }
      }
    }
  },
  "areDatesEqual": {
    "module": "plain/compare",
    "fn": "areDatesEqual",
    "template": "areDatesEqual(\"2024-02-29\", \"2024-02-29T12:34:56\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-02-29"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-02-29T12:34:56"
      }
    ]
  },
  "areDatesEqualBy": {
    "module": "plain/compare",
    "fn": "areDatesEqualBy",
    "template": "areDatesEqualBy(\"2024-03-15\", \"2024-03-20\", \"month\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-03-15"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-03-20"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "month",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "year",
          "month",
          "week",
          "day"
        ]
      }
    ]
  },
  "areMonthDaysEqual": {
    "module": "plain/compare",
    "fn": "areMonthDaysEqual",
    "template": "areMonthDaysEqual(\"12-25\", \"--12-25\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "a",
        "kind": "string",
        "seed": "12-25"
      },
      {
        "name": "b",
        "kind": "string",
        "seed": "--12-25"
      }
    ]
  },
  "areTimesEqual": {
    "module": "plain/compare",
    "fn": "areTimesEqual",
    "template": "areTimesEqual(\"12:34:56\", \"12:34:56\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "12:34:56"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "12:34:56"
      }
    ]
  },
  "areYearMonthsEqual": {
    "module": "plain/compare",
    "fn": "areYearMonthsEqual",
    "template": "areYearMonthsEqual(\"+002026-10\", \"2026-10\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "a",
        "kind": "string",
        "seed": "+002026-10"
      },
      {
        "name": "b",
        "kind": "string",
        "seed": "2026-10"
      }
    ]
  },
  "compareMonthDays": {
    "module": "plain/compare",
    "fn": "compareMonthDays",
    "template": "compareMonthDays(\"--01-01\", \"--12-31\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "a",
        "kind": "string",
        "seed": "--01-01"
      },
      {
        "name": "b",
        "kind": "string",
        "seed": "--12-31"
      }
    ]
  },
  "compareYearMonths": {
    "module": "plain/compare",
    "fn": "compareYearMonths",
    "template": "compareYearMonths(\"2026-09\", \"2026-10\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "a",
        "kind": "string",
        "seed": "2026-09"
      },
      {
        "name": "b",
        "kind": "string",
        "seed": "2026-10"
      }
    ]
  },
  "isAfterDate": {
    "module": "plain/compare",
    "fn": "isAfterDate",
    "template": "isAfterDate(\"2024-03-01\", \"2024-02-29\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-03-01"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-02-29"
      }
    ]
  },
  "isAfterDateTime": {
    "module": "plain/compare",
    "fn": "isAfterDateTime",
    "template": "isAfterDateTime(\"2024-02-29T12:34:56\", \"2024-02-28T12:34:56\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-02-29T12:34:56"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-02-28T12:34:56"
      }
    ]
  },
  "isAfterTime": {
    "module": "plain/compare",
    "fn": "isAfterTime",
    "template": "isAfterTime(\"12:34:56\", \"11:34:56\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "12:34:56"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "11:34:56"
      }
    ]
  },
  "isBeforeDate": {
    "module": "plain/compare",
    "fn": "isBeforeDate",
    "template": "isBeforeDate(\"2024-02-28\", \"2024-02-29\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-02-28"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-02-29"
      }
    ]
  },
  "isBeforeDateTime": {
    "module": "plain/compare",
    "fn": "isBeforeDateTime",
    "template": "isBeforeDateTime(\"2024-02-28T12:34:56\", \"2024-02-29T12:34:56\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-02-28T12:34:56"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-02-29T12:34:56"
      }
    ]
  },
  "isBeforeTime": {
    "module": "plain/compare",
    "fn": "isBeforeTime",
    "template": "isBeforeTime(\"12:34:56\", \"13:34:56\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "12:34:56"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "13:34:56"
      }
    ]
  },
  "isBetweenDate": {
    "module": "plain/compare",
    "fn": "isBetweenDate",
    "template": "isBetweenDate(\"2024-02-29\", \"2024-02-01\", \"2024-02-28\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "date",
        "kind": "string",
        "seed": "2024-02-29"
      },
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-02-01"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-02-28"
      }
    ]
  },
  "isBetweenDateTime": {
    "module": "plain/compare",
    "fn": "isBetweenDateTime",
    "template": "isBetweenDateTime(\"2024-02-29T12:00:00\", \"2024-02-01T00:00:00\", \"2024-02-28T23:59:59\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "dateTime",
        "kind": "string",
        "seed": "2024-02-29T12:00:00"
      },
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-02-01T00:00:00"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-02-28T23:59:59"
      }
    ]
  },
  "isBetweenTime": {
    "module": "plain/compare",
    "fn": "isBetweenTime",
    "template": "isBetweenTime(\"12:34:56\", \"12:00:00\", \"13:00:00\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "time",
        "kind": "string",
        "seed": "12:34:56"
      },
      {
        "name": "start",
        "kind": "string",
        "seed": "12:00:00"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "13:00:00"
      }
    ]
  },
  "isBusinessDay": {
    "module": "plain/compare",
    "fn": "isBusinessDay",
    "template": "isBusinessDay(\"2024-02-05\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-05"
      },
      {
        "name": "calendar",
        "kind": "string",
        "seed": "",
        "optional": true
      }
    ]
  },
  "isFuture": {
    "module": "plain/compare",
    "fn": "isFuture",
    "template": "isFuture(\"2024-03-16\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-16"
      }
    ]
  },
  "isPast": {
    "module": "plain/compare",
    "fn": "isPast",
    "template": "isPast(\"2024-03-14\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-14"
      }
    ]
  },
  "isRelativeDay": {
    "module": "plain/compare",
    "fn": "isRelativeDay",
    "template": "isRelativeDay(\"2024-03-15\", 0)",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15"
      },
      {
        "name": "offsetDays",
        "kind": "number",
        "seed": "0"
      }
    ]
  },
  "isThisUnit": {
    "module": "plain/compare",
    "fn": "isThisUnit",
    "template": "isThisUnit(\"2024-03-15\", \"month\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "month",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "year",
          "month",
          "week",
          "day"
        ]
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "",
        "optional": true
      }
    ],
    "choiceSeeds": {
      "unit": {
        "month": {
          "value": {
            "seed": "2024-03-15"
          },
          "locale": {
            "seed": ""
          }
        },
        "year": {
          "value": {
            "seed": "2024-03-15"
          },
          "locale": {
            "seed": ""
          }
        },
        "week": {
          "value": {
            "seed": "2024-02-26"
          },
          "locale": {
            "seed": "fr-FR"
          }
        },
        "months": {
          "value": {
            "seed": "2024-03-15"
          },
          "locale": {
            "seed": ""
          }
        }
      }
    }
  },
  "isWeekend": {
    "module": "plain/compare",
    "fn": "isWeekend",
    "template": "isWeekend(\"2024-02-03\", \"fr-FR\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-03"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "fr-FR"
      }
    ]
  },
  "convertDateToCalendar": {
    "module": "plain/convert",
    "fn": "convertDateToCalendar",
    "template": "convertDateToCalendar(\"2024-10-03\", \"hebrew\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-10-03"
      },
      {
        "name": "calendar",
        "kind": "enum",
        "seed": "hebrew",
        "choices": [
          "iso8601",
          "gregory",
          "hebrew",
          "islamic-civil",
          "islamic-tbla",
          "islamic-umalqura",
          "japanese",
          "buddhist",
          "roc",
          "persian",
          "indian",
          "ethiopic",
          "ethioaa",
          "coptic"
        ]
      }
    ],
    "choiceSeeds": {
      "calendar": {
        "hebrew": {
          "value": {
            "seed": "2024-10-03"
          }
        },
        "japanese": {
          "value": {
            "seed": "2024-10-03"
          }
        },
        "roc": {
          "value": {
            "seed": "1000-01-01"
          }
        },
        "iso8601": {
          "value": {
            "seed": "2024-10-03[u-ca=hebrew]"
          }
        },
        "gregory": {
          "value": {
            "seed": "2024-10-03"
          }
        }
      }
    }
  },
  "monthDayToDate": {
    "module": "plain/convert",
    "fn": "monthDayToDate",
    "template": "monthDayToDate(\"--12-25\", 2024)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "monthDay",
        "kind": "string",
        "seed": "--12-25"
      },
      {
        "name": "year",
        "kind": "number",
        "seed": "2024"
      }
    ]
  },
  "formatCalendar": {
    "module": "plain/format",
    "fn": "formatCalendar",
    "template": "formatCalendar(\"2026-03-16T14:30:00\", \"en-GB\", { reference: \"2026-03-15T09:00:00\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2026-03-16T14:30:00"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "en-GB",
        "optional": true
      }
    ],
    "optionsSuffix": "{ reference: \"2026-03-15T09:00:00\" }"
  },
  "formatDate": {
    "module": "plain/format",
    "fn": "formatDate",
    "template": "formatDate(\"2024-03-15\", \"pt-BR\", { year: \"numeric\", month: \"long\", day: \"numeric\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "pt-BR",
        "optional": true
      }
    ],
    "optionsSuffix": "{ year: \"numeric\", month: \"long\", day: \"numeric\" }"
  },
  "formatDateRange": {
    "module": "plain/format",
    "fn": "formatDateRange",
    "template": "formatDateRange(\"2024-02-03\", \"2024-02-05\", \"en-GB\", { dateStyle: \"long\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-02-03"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-02-05"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "en-GB",
        "optional": true
      }
    ],
    "optionsSuffix": "{ dateStyle: \"long\" }"
  },
  "formatDateTime": {
    "module": "plain/format",
    "fn": "formatDateTime",
    "template": "formatDateTime(\"2024-03-15T14:30:00\", \"en-GB\", { dateStyle: \"medium\", timeStyle: \"short\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:00"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "en-GB",
        "optional": true
      }
    ],
    "optionsSuffix": "{ dateStyle: \"medium\", timeStyle: \"short\" }"
  },
  "formatDateTimeRange": {
    "module": "plain/format",
    "fn": "formatDateTimeRange",
    "template": "formatDateTimeRange(\"2024-02-03T09:00:00\", \"2024-02-03T17:00:00\", \"en-GB\", { dateStyle: \"long\", timeStyle: \"short\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-02-03T09:00:00"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-02-03T17:00:00"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "en-GB",
        "optional": true
      }
    ],
    "optionsSuffix": "{ dateStyle: \"long\", timeStyle: \"short\" }"
  },
  "formatDateTimeToParts": {
    "module": "plain/format",
    "fn": "formatDateTimeToParts",
    "template": "formatDateTimeToParts(\"2024-03-15T14:30:00\", \"ja-JP\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:00"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "ja-JP",
        "optional": true
      }
    ]
  },
  "formatDateToParts": {
    "module": "plain/format",
    "fn": "formatDateToParts",
    "template": "formatDateToParts(\"2024-03-15\", \"zh-CN\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "zh-CN",
        "optional": true
      }
    ]
  },
  "formatMonthDay": {
    "module": "plain/format",
    "fn": "formatMonthDay",
    "template": "formatMonthDay(\"--12-25\", \"en-US\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "--12-25"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "en-US",
        "optional": true
      }
    ]
  },
  "formatRelativeDate": {
    "module": "plain/format",
    "fn": "formatRelativeDate",
    "template": "formatRelativeDate(\"2026-01-15\", \"pt-BR\", { reference: \"2026-04-15\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2026-01-15"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "pt-BR",
        "optional": true
      }
    ],
    "optionsSuffix": "{ reference: \"2026-04-15\" }"
  },
  "formatRelativeDateTime": {
    "module": "plain/format",
    "fn": "formatRelativeDateTime",
    "template": "formatRelativeDateTime(\"2026-03-17T09:00:00\", \"en-GB\", { style: \"long\", reference: \"2026-03-17T06:00:00\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2026-03-17T09:00:00"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "en-GB",
        "optional": true
      }
    ],
    "optionsSuffix": "{ style: \"long\", reference: \"2026-03-17T06:00:00\" }"
  },
  "formatRelativeTime": {
    "module": "plain/format",
    "fn": "formatRelativeTime",
    "template": "formatRelativeTime(\"14:30:00\", \"de-DE\", { style: \"short\", reference: \"16:30:00\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "14:30:00"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "de-DE",
        "optional": true
      }
    ],
    "optionsSuffix": "{ style: \"short\", reference: \"16:30:00\" }"
  },
  "formatSqlDateTime": {
    "module": "plain/format",
    "fn": "formatSqlDateTime",
    "template": "formatSqlDateTime(\"2024-03-15T14:30:00\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:00"
      }
    ]
  },
  "formatTime": {
    "module": "plain/format",
    "fn": "formatTime",
    "template": "formatTime(\"14:30:00\", \"hi-IN\", { timeStyle: \"short\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "14:30:00"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "hi-IN",
        "optional": true
      }
    ],
    "optionsSuffix": "{ timeStyle: \"short\" }"
  },
  "formatYearMonth": {
    "module": "plain/format",
    "fn": "formatYearMonth",
    "template": "formatYearMonth(\"2026-10\", \"en-US\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2026-10"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "en-US",
        "optional": true
      }
    ]
  },
  "getDay": {
    "module": "plain/get",
    "fn": "getDay",
    "template": "getDay()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getDayOfWeek": {
    "module": "plain/get",
    "fn": "getDayOfWeek",
    "template": "getDayOfWeek()",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": []
  },
  "getHour": {
    "module": "plain/get",
    "fn": "getHour",
    "template": "getHour()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getMicrosecond": {
    "module": "plain/get",
    "fn": "getMicrosecond",
    "template": "getMicrosecond()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getMillisecond": {
    "module": "plain/get",
    "fn": "getMillisecond",
    "template": "getMillisecond()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getMinute": {
    "module": "plain/get",
    "fn": "getMinute",
    "template": "getMinute()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getMonth": {
    "module": "plain/get",
    "fn": "getMonth",
    "template": "getMonth()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getNanosecond": {
    "module": "plain/get",
    "fn": "getNanosecond",
    "template": "getNanosecond()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getNow": {
    "module": "plain/get",
    "fn": "getNow",
    "template": "getNow()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getNowUnit": {
    "module": "plain/get",
    "fn": "getNowUnit",
    "template": "getNowUnit(\"year\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "unit",
        "kind": "enum",
        "seed": "year",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
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
          "dayOfWeek"
        ]
      }
    ]
  },
  "getSecond": {
    "module": "plain/get",
    "fn": "getSecond",
    "template": "getSecond()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getToday": {
    "module": "plain/get",
    "fn": "getToday",
    "template": "getToday()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getWeekOfYear": {
    "module": "plain/get",
    "fn": "getWeekOfYear",
    "template": "getWeekOfYear()",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": []
  },
  "getYear": {
    "module": "plain/get",
    "fn": "getYear",
    "template": "getYear()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "intervalAbutsDate": {
    "module": "plain/interval",
    "fn": "intervalAbutsDate",
    "template": "intervalAbutsDate(\"2024-01-01\", \"2024-06-30\", \"2024-06-30\", \"2024-12-31\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-06-30"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-06-30"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-12-31"
      }
    ]
  },
  "intervalAbutsDateTime": {
    "module": "plain/interval",
    "fn": "intervalAbutsDateTime",
    "template": "intervalAbutsDateTime(\"2024-01-01T09:00:00\", \"2024-01-01T12:00:00\", \"2024-01-01T12:00:00\", \"2024-01-01T17:00:00\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T09:00:00"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-01-01T12:00:00"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-01-01T12:00:00"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-01-01T17:00:00"
      }
    ]
  },
  "intervalAbutsTime": {
    "module": "plain/interval",
    "fn": "intervalAbutsTime",
    "template": "intervalAbutsTime(\"09:00:00\", \"12:00:00\", \"12:00:00\", \"17:00:00\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "09:00:00"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "12:00:00"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "12:00:00"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "17:00:00"
      }
    ]
  },
  "intervalContainsDate": {
    "module": "plain/interval",
    "fn": "intervalContainsDate",
    "template": "intervalContainsDate(\"2024-01-01\", \"2024-12-31\", \"2024-06-15\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "intervalStart",
        "kind": "string",
        "seed": "2024-01-01"
      },
      {
        "name": "intervalEnd",
        "kind": "string",
        "seed": "2024-12-31"
      },
      {
        "name": "pointOrStart",
        "kind": "string",
        "seed": "2024-06-15"
      },
      {
        "name": "pointEnd",
        "kind": "string",
        "seed": "",
        "optional": true
      }
    ]
  },
  "intervalContainsDateTime": {
    "module": "plain/interval",
    "fn": "intervalContainsDateTime",
    "template": "intervalContainsDateTime(\"2024-01-01T09:00:00\", \"2024-01-01T17:00:00\", \"2024-01-01T12:00:00\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "intervalStart",
        "kind": "string",
        "seed": "2024-01-01T09:00:00"
      },
      {
        "name": "intervalEnd",
        "kind": "string",
        "seed": "2024-01-01T17:00:00"
      },
      {
        "name": "pointOrStart",
        "kind": "string",
        "seed": "2024-01-01T12:00:00"
      },
      {
        "name": "pointEnd",
        "kind": "string",
        "seed": "",
        "optional": true
      }
    ]
  },
  "intervalContainsTime": {
    "module": "plain/interval",
    "fn": "intervalContainsTime",
    "template": "intervalContainsTime(\"09:00:00\", \"17:00:00\", \"12:00:00\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "intervalStart",
        "kind": "string",
        "seed": "09:00:00"
      },
      {
        "name": "intervalEnd",
        "kind": "string",
        "seed": "17:00:00"
      },
      {
        "name": "pointOrStart",
        "kind": "string",
        "seed": "12:00:00"
      },
      {
        "name": "pointEnd",
        "kind": "string",
        "seed": "",
        "optional": true
      }
    ]
  },
  "intervalCountDate": {
    "module": "plain/interval",
    "fn": "intervalCountDate",
    "template": "intervalCountDate(\"2024-01-01\", \"2024-01-03\", \"day\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-01-03"
      },
      {
        "name": "unit",
        "kind": "string",
        "seed": "day"
      }
    ]
  },
  "intervalCountDateTime": {
    "module": "plain/interval",
    "fn": "intervalCountDateTime",
    "template": "intervalCountDateTime(\"2024-01-01T23:59:00\", \"2024-01-02T00:01:00\", \"day\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01T23:59:00"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-01-02T00:01:00"
      },
      {
        "name": "unit",
        "kind": "string",
        "seed": "day"
      }
    ]
  },
  "intervalCountTime": {
    "module": "plain/interval",
    "fn": "intervalCountTime",
    "template": "intervalCountTime(\"12:00:00\", \"14:00:00\", \"hour\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "12:00:00"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "14:00:00"
      },
      {
        "name": "unit",
        "kind": "string",
        "seed": "hour"
      }
    ]
  },
  "intervalDifferenceDate": {
    "module": "plain/interval",
    "fn": "intervalDifferenceDate",
    "template": "intervalDifferenceDate(\"2024-01-01\", \"2024-12-31\", \"2024-06-01\", \"2024-07-01\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-12-31"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-06-01"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-07-01"
      }
    ]
  },
  "intervalDifferenceDateTime": {
    "module": "plain/interval",
    "fn": "intervalDifferenceDateTime",
    "template": "intervalDifferenceDateTime(\"2024-01-01T09:00:00\", \"2024-01-01T17:00:00\", \"2024-01-01T12:00:00\", \"2024-01-01T13:00:00\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T09:00:00"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-01-01T17:00:00"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-01-01T12:00:00"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-01-01T13:00:00"
      }
    ]
  },
  "intervalDifferenceTime": {
    "module": "plain/interval",
    "fn": "intervalDifferenceTime",
    "template": "intervalDifferenceTime(\"09:00:00\", \"17:00:00\", \"12:00:00\", \"13:00:00\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "09:00:00"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "17:00:00"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "12:00:00"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "13:00:00"
      }
    ]
  },
  "intervalDivideEquallyDate": {
    "module": "plain/interval",
    "fn": "intervalDivideEquallyDate",
    "template": "intervalDivideEquallyDate(\"2024-01-01\", \"2024-01-05\", 4)",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-01-05"
      },
      {
        "name": "n",
        "kind": "number",
        "seed": "4"
      }
    ]
  },
  "intervalDivideEquallyDateTime": {
    "module": "plain/interval",
    "fn": "intervalDivideEquallyDateTime",
    "template": "intervalDivideEquallyDateTime(\"2024-01-01T00:00:00\", \"2024-01-04T00:00:00\", 3)",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01T00:00:00"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-01-04T00:00:00"
      },
      {
        "name": "n",
        "kind": "number",
        "seed": "3"
      }
    ]
  },
  "intervalDivideEquallyTime": {
    "module": "plain/interval",
    "fn": "intervalDivideEquallyTime",
    "template": "intervalDivideEquallyTime(\"09:00:00\", \"17:00:00\", 4)",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "09:00:00"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "17:00:00"
      },
      {
        "name": "n",
        "kind": "number",
        "seed": "4"
      }
    ]
  },
  "intervalEngulfsDate": {
    "module": "plain/interval",
    "fn": "intervalEngulfsDate",
    "template": "intervalEngulfsDate(\"2024-01-01\", \"2024-12-31\", \"2024-06-01\", \"2024-07-01\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-12-31"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-06-01"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-07-01"
      }
    ]
  },
  "intervalEngulfsDateTime": {
    "module": "plain/interval",
    "fn": "intervalEngulfsDateTime",
    "template": "intervalEngulfsDateTime(\"2024-01-01T09:00:00\", \"2024-01-01T17:00:00\", \"2024-01-01T12:00:00\", \"2024-01-01T13:00:00\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T09:00:00"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-01-01T17:00:00"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-01-01T12:00:00"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-01-01T13:00:00"
      }
    ]
  },
  "intervalEngulfsTime": {
    "module": "plain/interval",
    "fn": "intervalEngulfsTime",
    "template": "intervalEngulfsTime(\"09:00:00\", \"17:00:00\", \"12:00:00\", \"13:00:00\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "09:00:00"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "17:00:00"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "12:00:00"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "13:00:00"
      }
    ]
  },
  "intervalFromDurationDate": {
    "module": "plain/interval",
    "fn": "intervalFromDurationDate",
    "template": "intervalFromDurationDate(\"2024-01-01\", \"P1M\", \"start\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-01-01"
      },
      {
        "name": "duration",
        "kind": "string",
        "seed": "P1M"
      },
      {
        "name": "anchor",
        "kind": "enum",
        "seed": "start",
        "choices": [
          "start",
          "end"
        ]
      }
    ],
    "choiceSeeds": {
      "anchor": {
        "start": {
          "value": {
            "seed": "2024-01-01"
          },
          "duration": {
            "seed": "P1M"
          }
        },
        "end": {
          "value": {
            "seed": "2024-02-01"
          },
          "duration": {
            "seed": "P1M"
          }
        }
      }
    }
  },
  "intervalFromDurationDateTime": {
    "module": "plain/interval",
    "fn": "intervalFromDurationDateTime",
    "template": "intervalFromDurationDateTime(\"2024-01-01T00:00:00\", \"P1DT2H\", \"start\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-01-01T00:00:00"
      },
      {
        "name": "duration",
        "kind": "string",
        "seed": "P1DT2H"
      },
      {
        "name": "anchor",
        "kind": "enum",
        "seed": "start",
        "choices": [
          "start",
          "end"
        ]
      }
    ],
    "choiceSeeds": {
      "anchor": {
        "start": {
          "value": {
            "seed": "2024-01-01T00:00:00"
          },
          "duration": {
            "seed": "P1DT2H"
          }
        },
        "end": {
          "value": {
            "seed": "2024-01-02T02:00:00"
          },
          "duration": {
            "seed": "P1DT2H"
          }
        }
      }
    }
  },
  "intervalFromDurationTime": {
    "module": "plain/interval",
    "fn": "intervalFromDurationTime",
    "template": "intervalFromDurationTime(\"12:00:00\", \"PT1H\", \"start\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "12:00:00"
      },
      {
        "name": "duration",
        "kind": "string",
        "seed": "PT1H"
      },
      {
        "name": "anchor",
        "kind": "enum",
        "seed": "start",
        "choices": [
          "start",
          "end"
        ]
      }
    ],
    "choiceSeeds": {
      "anchor": {
        "start": {
          "value": {
            "seed": "12:00:00"
          },
          "duration": {
            "seed": "PT1H"
          }
        },
        "end": {
          "value": {
            "seed": "13:00:00"
          },
          "duration": {
            "seed": "PT1H"
          }
        }
      }
    }
  },
  "intervalIntersectionDate": {
    "module": "plain/interval",
    "fn": "intervalIntersectionDate",
    "template": "intervalIntersectionDate(\"2024-01-01\", \"2024-06-30\", \"2024-04-01\", \"2024-12-31\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "nullIsEmpty": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-06-30"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-04-01"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-12-31"
      }
    ]
  },
  "intervalIntersectionDateTime": {
    "module": "plain/interval",
    "fn": "intervalIntersectionDateTime",
    "template": "intervalIntersectionDateTime(\"2024-01-01T09:00:00\", \"2024-01-01T13:00:00\", \"2024-01-01T12:00:00\", \"2024-01-01T17:00:00\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "nullIsEmpty": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T09:00:00"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-01-01T13:00:00"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-01-01T12:00:00"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-01-01T17:00:00"
      }
    ]
  },
  "intervalIntersectionTime": {
    "module": "plain/interval",
    "fn": "intervalIntersectionTime",
    "template": "intervalIntersectionTime(\"09:00:00\", \"17:00:00\", \"12:00:00\", \"18:00:00\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "nullIsEmpty": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "09:00:00"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "17:00:00"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "12:00:00"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "18:00:00"
      }
    ]
  },
  "intervalLengthDate": {
    "module": "plain/interval",
    "fn": "intervalLengthDate",
    "template": "intervalLengthDate(\"2024-01-01\", \"2024-01-03\", \"day\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-01-03"
      },
      {
        "name": "unit",
        "kind": "string",
        "seed": "day"
      }
    ]
  },
  "intervalLengthDateTime": {
    "module": "plain/interval",
    "fn": "intervalLengthDateTime",
    "template": "intervalLengthDateTime(\"2024-01-01T23:59:00\", \"2024-01-02T00:01:00\", \"day\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01T23:59:00"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-01-02T00:01:00"
      },
      {
        "name": "unit",
        "kind": "string",
        "seed": "day"
      }
    ]
  },
  "intervalLengthTime": {
    "module": "plain/interval",
    "fn": "intervalLengthTime",
    "template": "intervalLengthTime(\"12:00:00\", \"14:30:00\", \"hour\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "12:00:00"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "14:30:00"
      },
      {
        "name": "unit",
        "kind": "string",
        "seed": "hour"
      }
    ]
  },
  "intervalOverlappingDaysDate": {
    "module": "plain/interval",
    "fn": "intervalOverlappingDaysDate",
    "template": "intervalOverlappingDaysDate(\"2024-01-01\", \"2024-06-30\", \"2024-04-01\", \"2024-12-31\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-06-30"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-04-01"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-12-31"
      }
    ]
  },
  "intervalOverlappingDaysDateTime": {
    "module": "plain/interval",
    "fn": "intervalOverlappingDaysDateTime",
    "template": "intervalOverlappingDaysDateTime(\"2024-01-01T23:59:00\", \"2024-01-02T00:01:00\", \"2024-01-01T23:59:00\", \"2024-01-02T00:01:00\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T23:59:00"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-01-02T00:01:00"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-01-01T23:59:00"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-01-02T00:01:00"
      }
    ]
  },
  "intervalSplitAtDate": {
    "module": "plain/interval",
    "fn": "intervalSplitAtDate",
    "template": "intervalSplitAtDate(\"2024-01-01\", \"2024-01-10\", [\"2024-01-05\"])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-01-10"
      },
      {
        "name": "points",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "2024-01-05"
        ]
      }
    ]
  },
  "intervalSplitAtDateTime": {
    "module": "plain/interval",
    "fn": "intervalSplitAtDateTime",
    "template": "intervalSplitAtDateTime(\"2024-01-01T00:00:00\", \"2024-01-10T00:00:00\", [\"2024-01-05T00:00:00\"])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01T00:00:00"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-01-10T00:00:00"
      },
      {
        "name": "points",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "2024-01-05T00:00:00"
        ]
      }
    ]
  },
  "intervalSplitAtTime": {
    "module": "plain/interval",
    "fn": "intervalSplitAtTime",
    "template": "intervalSplitAtTime(\"09:00:00\", \"17:00:00\", [\"12:00:00\"])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "09:00:00"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "17:00:00"
      },
      {
        "name": "points",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "12:00:00"
        ]
      }
    ]
  },
  "intervalUnionDate": {
    "module": "plain/interval",
    "fn": "intervalUnionDate",
    "template": "intervalUnionDate(\"2024-01-01\", \"2024-06-30\", \"2024-04-01\", \"2024-12-31\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "nullIsEmpty": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-06-30"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-04-01"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-12-31"
      }
    ]
  },
  "intervalUnionDateTime": {
    "module": "plain/interval",
    "fn": "intervalUnionDateTime",
    "template": "intervalUnionDateTime(\"2024-01-01T09:00:00\", \"2024-01-01T13:00:00\", \"2024-01-01T12:00:00\", \"2024-01-01T17:00:00\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "nullIsEmpty": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T09:00:00"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-01-01T13:00:00"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-01-01T12:00:00"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-01-01T17:00:00"
      }
    ]
  },
  "intervalUnionTime": {
    "module": "plain/interval",
    "fn": "intervalUnionTime",
    "template": "intervalUnionTime(\"09:00:00\", \"17:00:00\", \"12:00:00\", \"18:00:00\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "nullIsEmpty": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "09:00:00"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "17:00:00"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "12:00:00"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "18:00:00"
      }
    ]
  },
  "intervalXorAllDate": {
    "module": "plain/interval",
    "fn": "intervalXorAllDate",
    "template": "intervalXorAllDate([{ start: \"2024-01-01\", end: \"2024-01-10\" }, { start: \"2024-01-05\", end: \"2024-01-15\" }])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "intervals",
        "kind": "intervals",
        "seed": "",
        "pairs": [
          [
            "2024-01-01",
            "2024-01-10"
          ],
          [
            "2024-01-05",
            "2024-01-15"
          ]
        ]
      }
    ]
  },
  "intervalXorAllDateTime": {
    "module": "plain/interval",
    "fn": "intervalXorAllDateTime",
    "template": "intervalXorAllDateTime([{ start: \"2024-01-01T00:00:00\", end: \"2024-01-10T00:00:00\" }, { start: \"2024-01-05T00:00:00\", end: \"2024-01-15T00:00:00\" }])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "intervals",
        "kind": "intervals",
        "seed": "",
        "pairs": [
          [
            "2024-01-01T00:00:00",
            "2024-01-10T00:00:00"
          ],
          [
            "2024-01-05T00:00:00",
            "2024-01-15T00:00:00"
          ]
        ]
      }
    ]
  },
  "intervalXorAllTime": {
    "module": "plain/interval",
    "fn": "intervalXorAllTime",
    "template": "intervalXorAllTime([{ start: \"09:00:00\", end: \"12:00:00\" }, { start: \"11:00:00\", end: \"15:00:00\" }])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "intervals",
        "kind": "intervals",
        "seed": "",
        "pairs": [
          [
            "09:00:00",
            "12:00:00"
          ],
          [
            "11:00:00",
            "15:00:00"
          ]
        ]
      }
    ]
  },
  "intervalXorDate": {
    "module": "plain/interval",
    "fn": "intervalXorDate",
    "template": "intervalXorDate(\"2024-01-01\", \"2024-06-30\", \"2024-04-01\", \"2024-12-31\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-06-30"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-04-01"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-12-31"
      }
    ]
  },
  "intervalXorDateTime": {
    "module": "plain/interval",
    "fn": "intervalXorDateTime",
    "template": "intervalXorDateTime(\"2024-01-01T09:00:00\", \"2024-01-01T13:00:00\", \"2024-01-01T12:00:00\", \"2024-01-01T17:00:00\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T09:00:00"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-01-01T13:00:00"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-01-01T12:00:00"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-01-01T17:00:00"
      }
    ]
  },
  "intervalXorTime": {
    "module": "plain/interval",
    "fn": "intervalXorTime",
    "template": "intervalXorTime(\"09:00:00\", \"12:00:00\", \"11:00:00\", \"17:00:00\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "09:00:00"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "12:00:00"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "11:00:00"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "17:00:00"
      }
    ]
  },
  "intervalsOverlapDate": {
    "module": "plain/interval",
    "fn": "intervalsOverlapDate",
    "template": "intervalsOverlapDate(\"2024-01-01\", \"2024-06-30\", \"2024-04-01\", \"2024-12-31\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-06-30"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-04-01"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-12-31"
      }
    ]
  },
  "intervalsOverlapDateTime": {
    "module": "plain/interval",
    "fn": "intervalsOverlapDateTime",
    "template": "intervalsOverlapDateTime(\"2024-01-01T09:00:00\", \"2024-01-01T13:00:00\", \"2024-01-01T12:00:00\", \"2024-01-01T17:00:00\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T09:00:00"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-01-01T13:00:00"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-01-01T12:00:00"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-01-01T17:00:00"
      }
    ]
  },
  "intervalsOverlapTime": {
    "module": "plain/interval",
    "fn": "intervalsOverlapTime",
    "template": "intervalsOverlapTime(\"09:00:00\", \"17:00:00\", \"12:00:00\", \"18:00:00\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "09:00:00"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "17:00:00"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "12:00:00"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "18:00:00"
      }
    ]
  },
  "mergeIntervalsDate": {
    "module": "plain/interval",
    "fn": "mergeIntervalsDate",
    "template": "mergeIntervalsDate([{ start: \"2024-01-01\", end: \"2024-01-10\" }, { start: \"2024-01-05\", end: \"2024-01-15\" }])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "intervals",
        "kind": "intervals",
        "seed": "",
        "pairs": [
          [
            "2024-01-01",
            "2024-01-10"
          ],
          [
            "2024-01-05",
            "2024-01-15"
          ]
        ]
      }
    ]
  },
  "mergeIntervalsDateTime": {
    "module": "plain/interval",
    "fn": "mergeIntervalsDateTime",
    "template": "mergeIntervalsDateTime([{ start: \"2024-01-01T00:00:00\", end: \"2024-01-10T00:00:00\" }, { start: \"2024-01-10T00:00:00\", end: \"2024-01-15T00:00:00\" }])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "intervals",
        "kind": "intervals",
        "seed": "",
        "pairs": [
          [
            "2024-01-01T00:00:00",
            "2024-01-10T00:00:00"
          ],
          [
            "2024-01-10T00:00:00",
            "2024-01-15T00:00:00"
          ]
        ]
      }
    ]
  },
  "mergeIntervalsTime": {
    "module": "plain/interval",
    "fn": "mergeIntervalsTime",
    "template": "mergeIntervalsTime([{ start: \"09:00:00\", end: \"12:00:00\" }, { start: \"12:00:00\", end: \"15:00:00\" }])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "intervals",
        "kind": "intervals",
        "seed": "",
        "pairs": [
          [
            "09:00:00",
            "12:00:00"
          ],
          [
            "12:00:00",
            "15:00:00"
          ]
        ]
      }
    ]
  },
  "splitIntervalByUnitDate": {
    "module": "plain/interval",
    "fn": "splitIntervalByUnitDate",
    "template": "splitIntervalByUnitDate(\"2024-01-01\", \"2024-01-10\", \"day\", 2)",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-01-10"
      },
      {
        "name": "unit",
        "kind": "string",
        "seed": "day"
      },
      {
        "name": "amount",
        "kind": "number",
        "seed": "2"
      }
    ]
  },
  "splitIntervalByUnitDateTime": {
    "module": "plain/interval",
    "fn": "splitIntervalByUnitDateTime",
    "template": "splitIntervalByUnitDateTime(\"2024-01-01T12:00:00\", \"2024-01-01T14:00:00\", \"hour\", 1)",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01T12:00:00"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-01-01T14:00:00"
      },
      {
        "name": "unit",
        "kind": "string",
        "seed": "hour"
      },
      {
        "name": "amount",
        "kind": "number",
        "seed": "1"
      }
    ]
  },
  "splitIntervalByUnitTime": {
    "module": "plain/interval",
    "fn": "splitIntervalByUnitTime",
    "template": "splitIntervalByUnitTime(\"12:00:00\", \"14:00:00\", \"hour\", 1)",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "12:00:00"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "14:00:00"
      },
      {
        "name": "unit",
        "kind": "string",
        "seed": "hour"
      },
      {
        "name": "amount",
        "kind": "number",
        "seed": "1"
      }
    ]
  },
  "isValidDateInterval": {
    "module": "plain/interval",
    "fn": "isValidDateInterval",
    "template": "isValidDateInterval(\"2024-01-01\", \"2024-12-31\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-12-31"
      }
    ]
  },
  "isValidDateTimeInterval": {
    "module": "plain/interval",
    "fn": "isValidDateTimeInterval",
    "template": "isValidDateTimeInterval(\"2024-01-01T10:00:00\", \"2024-12-31T23:59:59\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01T10:00:00"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-12-31T23:59:59"
      }
    ]
  },
  "isValidTimeInterval": {
    "module": "plain/interval",
    "fn": "isValidTimeInterval",
    "template": "isValidTimeInterval(\"09:00:00\", \"17:00:00\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "09:00:00"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "17:00:00"
      }
    ]
  },
  "getLocaleEraNames": {
    "module": "plain/locale",
    "fn": "getLocaleEraNames",
    "template": "getLocaleEraNames(\"en-GB\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "locale",
        "kind": "string",
        "seed": "en-GB"
      },
      {
        "name": "style",
        "kind": "enum",
        "seed": "",
        "choices": [
          "long",
          "short",
          "narrow"
        ],
        "optional": true
      }
    ],
    "choiceSeeds": {
      "style": {
        "short": {
          "locale": {
            "seed": "de-DE"
          }
        },
        "narrow": {
          "locale": {
            "seed": "ja-JP"
          }
        }
      }
    }
  },
  "getLocaleMeridiems": {
    "module": "plain/locale",
    "fn": "getLocaleMeridiems",
    "template": "getLocaleMeridiems(\"ar-EG\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "locale",
        "kind": "string",
        "seed": "ar-EG"
      }
    ]
  },
  "getLocaleMonthNames": {
    "module": "plain/locale",
    "fn": "getLocaleMonthNames",
    "template": "getLocaleMonthNames(\"ja-JP\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "locale",
        "kind": "string",
        "seed": "ja-JP"
      },
      {
        "name": "style",
        "kind": "enum",
        "seed": "",
        "choices": [
          "long",
          "short",
          "narrow"
        ],
        "optional": true
      }
    ],
    "choiceSeeds": {
      "style": {
        "short": {
          "locale": {
            "seed": "de-DE"
          }
        },
        "narrow": {
          "locale": {
            "seed": "fr-FR"
          }
        }
      }
    }
  },
  "getLocaleWeekdayNames": {
    "module": "plain/locale",
    "fn": "getLocaleWeekdayNames",
    "template": "getLocaleWeekdayNames(\"pt-BR\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "locale",
        "kind": "string",
        "seed": "pt-BR"
      },
      {
        "name": "style",
        "kind": "enum",
        "seed": "",
        "choices": [
          "long",
          "short",
          "narrow"
        ],
        "optional": true
      }
    ]
  },
  "mapDatesInRange": {
    "module": "plain/map",
    "fn": "mapDatesInRange",
    "template": "mapDatesInRange(\"2024-03-01\", \"2024-03-05\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "startDate",
        "kind": "string",
        "seed": "2024-03-01"
      },
      {
        "name": "endDate",
        "kind": "string",
        "seed": "2024-03-05"
      },
      {
        "name": "stepDays",
        "kind": "number",
        "seed": "",
        "optional": true
      }
    ]
  },
  "mapDaysInMonth": {
    "module": "plain/map",
    "fn": "mapDaysInMonth",
    "template": "mapDaysInMonth(\"2024-02\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "month",
        "kind": "string",
        "seed": "2024-02"
      }
    ]
  },
  "parseDateTimeWithPattern": {
    "module": "plain/parse",
    "fn": "parseDateTimeWithPattern",
    "template": "parseDateTimeWithPattern(\"15/03/2024 14:30:00\", \"dd/MM/yyyy HH:mm:ss\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "15/03/2024 14:30:00"
      },
      {
        "name": "pattern",
        "kind": "string",
        "seed": "dd/MM/yyyy HH:mm:ss"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "",
        "optional": true
      }
    ]
  },
  "parseDateWithPattern": {
    "module": "plain/parse",
    "fn": "parseDateWithPattern",
    "template": "parseDateWithPattern(\"15/03/2024\", \"dd/MM/yyyy\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "15/03/2024"
      },
      {
        "name": "pattern",
        "kind": "string",
        "seed": "dd/MM/yyyy"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "",
        "optional": true
      }
    ]
  },
  "parseDayFromDate": {
    "module": "plain/parse",
    "fn": "parseDayFromDate",
    "template": "parseDayFromDate(\"2024-03-15\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15"
      }
    ]
  },
  "parseDayFromDateTime": {
    "module": "plain/parse",
    "fn": "parseDayFromDateTime",
    "template": "parseDayFromDateTime(\"2024-03-15T12:30:00\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T12:30:00"
      }
    ]
  },
  "parseDayOfWeekFromDate": {
    "module": "plain/parse",
    "fn": "parseDayOfWeekFromDate",
    "template": "parseDayOfWeekFromDate(\"2024-01-01\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-01-01"
      }
    ]
  },
  "parseDayOfWeekFromDateTime": {
    "module": "plain/parse",
    "fn": "parseDayOfWeekFromDateTime",
    "template": "parseDayOfWeekFromDateTime(\"2024-01-01T12:00:00\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-01-01T12:00:00"
      }
    ]
  },
  "parseHourFromDateTime": {
    "module": "plain/parse",
    "fn": "parseHourFromDateTime",
    "template": "parseHourFromDateTime(\"2024-03-15T14:30:00\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:00"
      }
    ]
  },
  "parseHourFromTime": {
    "module": "plain/parse",
    "fn": "parseHourFromTime",
    "template": "parseHourFromTime(\"12:30:00\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "12:30:00"
      }
    ]
  },
  "parseMicrosecondFromDateTime": {
    "module": "plain/parse",
    "fn": "parseMicrosecondFromDateTime",
    "template": "parseMicrosecondFromDateTime(\"2024-03-15T14:30:45.123\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:45.123"
      }
    ]
  },
  "parseMicrosecondFromTime": {
    "module": "plain/parse",
    "fn": "parseMicrosecondFromTime",
    "template": "parseMicrosecondFromTime(\"12:30:45.123\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "12:30:45.123"
      }
    ]
  },
  "parseMillisecondFromDateTime": {
    "module": "plain/parse",
    "fn": "parseMillisecondFromDateTime",
    "template": "parseMillisecondFromDateTime(\"2024-03-15T14:30:45.123\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:45.123"
      }
    ]
  },
  "parseMillisecondFromTime": {
    "module": "plain/parse",
    "fn": "parseMillisecondFromTime",
    "template": "parseMillisecondFromTime(\"12:30:45.123\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "12:30:45.123"
      }
    ]
  },
  "parseMinuteFromDateTime": {
    "module": "plain/parse",
    "fn": "parseMinuteFromDateTime",
    "template": "parseMinuteFromDateTime(\"2024-03-15T14:30:45\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:45"
      }
    ]
  },
  "parseMinuteFromTime": {
    "module": "plain/parse",
    "fn": "parseMinuteFromTime",
    "template": "parseMinuteFromTime(\"12:30:00\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "12:30:00"
      }
    ]
  },
  "parseMonthDay": {
    "module": "plain/parse",
    "fn": "parseMonthDay",
    "template": "parseMonthDay(\"--12-25\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "--12-25"
      }
    ]
  },
  "parseMonthDayFromDate": {
    "module": "plain/parse",
    "fn": "parseMonthDayFromDate",
    "template": "parseMonthDayFromDate(\"2024-12-25\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-12-25"
      }
    ]
  },
  "parseMonthDayFromDateTime": {
    "module": "plain/parse",
    "fn": "parseMonthDayFromDateTime",
    "template": "parseMonthDayFromDateTime(\"2024-12-25T10:00:00\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-12-25T10:00:00"
      }
    ]
  },
  "parseMonthDayWithPattern": {
    "module": "plain/parse",
    "fn": "parseMonthDayWithPattern",
    "template": "parseMonthDayWithPattern(\"12-25\", \"MM-dd\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "12-25"
      },
      {
        "name": "pattern",
        "kind": "string",
        "seed": "MM-dd"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "",
        "optional": true
      }
    ]
  },
  "parseMonthFromDate": {
    "module": "plain/parse",
    "fn": "parseMonthFromDate",
    "template": "parseMonthFromDate(\"2024-03-15\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15"
      }
    ]
  },
  "parseMonthFromDateTime": {
    "module": "plain/parse",
    "fn": "parseMonthFromDateTime",
    "template": "parseMonthFromDateTime(\"2024-03-15T12:30:00\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T12:30:00"
      }
    ]
  },
  "parseNanosecondFromDateTime": {
    "module": "plain/parse",
    "fn": "parseNanosecondFromDateTime",
    "template": "parseNanosecondFromDateTime(\"2024-03-15T14:30:45.123\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:45.123"
      }
    ]
  },
  "parseNanosecondFromTime": {
    "module": "plain/parse",
    "fn": "parseNanosecondFromTime",
    "template": "parseNanosecondFromTime(\"12:30:45.123\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "12:30:45.123"
      }
    ]
  },
  "parseSecondFromDateTime": {
    "module": "plain/parse",
    "fn": "parseSecondFromDateTime",
    "template": "parseSecondFromDateTime(\"2024-03-15T14:30:45\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:45"
      }
    ]
  },
  "parseSecondFromTime": {
    "module": "plain/parse",
    "fn": "parseSecondFromTime",
    "template": "parseSecondFromTime(\"12:30:45\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "12:30:45"
      }
    ]
  },
  "parseSqlDateTime": {
    "module": "plain/parse",
    "fn": "parseSqlDateTime",
    "template": "parseSqlDateTime(\"2024-03-15 14:30:00\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15 14:30:00"
      }
    ]
  },
  "parseTimeWithPattern": {
    "module": "plain/parse",
    "fn": "parseTimeWithPattern",
    "template": "parseTimeWithPattern(\"14:30:45\", \"HH:mm:ss\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "14:30:45"
      },
      {
        "name": "pattern",
        "kind": "string",
        "seed": "HH:mm:ss"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "",
        "optional": true
      }
    ]
  },
  "parseUnitFromDate": {
    "module": "plain/parse",
    "fn": "parseUnitFromDate",
    "template": "parseUnitFromDate(\"2024-03-15\", \"year\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "year",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "year",
          "month",
          "week",
          "day",
          "dayOfWeek"
        ]
      }
    ]
  },
  "parseUnitFromDateTime": {
    "module": "plain/parse",
    "fn": "parseUnitFromDateTime",
    "template": "parseUnitFromDateTime(\"2024-03-15T14:30:45.123\", \"year\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:45.123"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "year",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
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
          "dayOfWeek"
        ]
      }
    ]
  },
  "parseUnitFromTime": {
    "module": "plain/parse",
    "fn": "parseUnitFromTime",
    "template": "parseUnitFromTime(\"14:30:45.123\", \"hour\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "14:30:45.123"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "hour",
        "choices": [
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "hour": {
          "value": {
            "seed": "14:30:45.123"
          }
        },
        "minute": {
          "value": {
            "seed": "14:30:45.123"
          }
        },
        "second": {
          "value": {
            "seed": "14:30:45.123"
          }
        },
        "millisecond": {
          "value": {
            "seed": "14:30:45.123"
          }
        },
        "milliseconds": {
          "value": {
            "seed": "14:30:45.123"
          }
        },
        "nanosecond": {
          "value": {
            "seed": "14:30:45.123456789"
          }
        }
      }
    }
  },
  "parseWeekFromDate": {
    "module": "plain/parse",
    "fn": "parseWeekFromDate",
    "template": "parseWeekFromDate(\"2024-01-01\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-01-01"
      }
    ]
  },
  "parseWeekFromDateTime": {
    "module": "plain/parse",
    "fn": "parseWeekFromDateTime",
    "template": "parseWeekFromDateTime(\"2024-01-01T12:00:00\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-01-01T12:00:00"
      }
    ]
  },
  "parseYearFromDate": {
    "module": "plain/parse",
    "fn": "parseYearFromDate",
    "template": "parseYearFromDate(\"2024-03-15\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15"
      }
    ]
  },
  "parseYearFromDateTime": {
    "module": "plain/parse",
    "fn": "parseYearFromDateTime",
    "template": "parseYearFromDateTime(\"2024-03-15T12:30:00\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T12:30:00"
      }
    ]
  },
  "parseYearMonth": {
    "module": "plain/parse",
    "fn": "parseYearMonth",
    "template": "parseYearMonth(\"2026-10\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2026-10"
      }
    ]
  },
  "parseYearMonthFromDate": {
    "module": "plain/parse",
    "fn": "parseYearMonthFromDate",
    "template": "parseYearMonthFromDate(\"2026-10-01\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2026-10-01"
      }
    ]
  },
  "parseYearMonthFromDateTime": {
    "module": "plain/parse",
    "fn": "parseYearMonthFromDateTime",
    "template": "parseYearMonthFromDateTime(\"2026-10-01T10:00:00\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2026-10-01T10:00:00"
      }
    ]
  },
  "parseYearMonthWithPattern": {
    "module": "plain/parse",
    "fn": "parseYearMonthWithPattern",
    "template": "parseYearMonthWithPattern(\"10/2026\", \"MM/yyyy\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "10/2026"
      },
      {
        "name": "pattern",
        "kind": "string",
        "seed": "MM/yyyy"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "",
        "optional": true
      }
    ]
  },
  "hasSecond60": {
    "module": "plain/validate",
    "fn": "hasSecond60",
    "template": "hasSecond60(\"2016-12-31T23:59:60Z\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2016-12-31T23:59:60Z"
      }
    ]
  },
  "isLeapYear": {
    "module": "plain/validate",
    "fn": "isLeapYear",
    "template": "isLeapYear(\"2024-03-15\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15"
      }
    ]
  },
  "isValidCalendarDate": {
    "module": "plain/validate",
    "fn": "isValidCalendarDate",
    "template": "isValidCalendarDate(\"2024-10-03\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-10-03"
      }
    ]
  },
  "isValidDate": {
    "module": "plain/validate",
    "fn": "isValidDate",
    "template": "isValidDate(\"2024-03-10\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-10"
      }
    ]
  },
  "isValidDateCycleField": {
    "module": "plain/validate",
    "fn": "isValidDateCycleField",
    "template": "isValidDateCycleField(\"year\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "field",
        "kind": "string",
        "seed": "year"
      }
    ]
  },
  "isValidDateDurationUnit": {
    "module": "plain/validate",
    "fn": "isValidDateDurationUnit",
    "template": "isValidDateDurationUnit(\"days\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "unit",
        "kind": "string",
        "seed": "days"
      }
    ]
  },
  "isValidDateRange": {
    "module": "plain/validate",
    "fn": "isValidDateRange",
    "template": "isValidDateRange({ value1: \"2024-02-28\", value2: \"2024-02-29\" })",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-02-28"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-02-29"
      }
    ],
    "objectArg": true
  },
  "isValidDateTime": {
    "module": "plain/validate",
    "fn": "isValidDateTime",
    "template": "isValidDateTime(\"2024-02-29T12:34:56\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:34:56"
      }
    ]
  },
  "isValidDateTimeCycleField": {
    "module": "plain/validate",
    "fn": "isValidDateTimeCycleField",
    "template": "isValidDateTimeCycleField(\"year\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "field",
        "kind": "string",
        "seed": "year"
      }
    ]
  },
  "isValidDateTimeDurationUnit": {
    "module": "plain/validate",
    "fn": "isValidDateTimeDurationUnit",
    "template": "isValidDateTimeDurationUnit(\"days\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "unit",
        "kind": "string",
        "seed": "days"
      }
    ]
  },
  "isValidDateTimeRange": {
    "module": "plain/validate",
    "fn": "isValidDateTimeRange",
    "template": "isValidDateTimeRange({ value1: \"2024-01-01T10:00:00\", value2: \"2024-12-31T23:59:59\" })",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-01-01T10:00:00"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-12-31T23:59:59"
      }
    ],
    "objectArg": true
  },
  "isValidDateTimeUnit": {
    "module": "plain/validate",
    "fn": "isValidDateTimeUnit",
    "template": "isValidDateTimeUnit(\"year\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "unit",
        "kind": "string",
        "seed": "year"
      }
    ]
  },
  "isValidDateUnit": {
    "module": "plain/validate",
    "fn": "isValidDateUnit",
    "template": "isValidDateUnit(\"year\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "unit",
        "kind": "string",
        "seed": "year"
      }
    ]
  },
  "isValidIsoDateLike": {
    "module": "plain/validate",
    "fn": "isValidIsoDateLike",
    "template": "isValidIsoDateLike(\"2024-02-29\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29"
      }
    ]
  },
  "isValidMonthDay": {
    "module": "plain/validate",
    "fn": "isValidMonthDay",
    "template": "isValidMonthDay(\"--12-25\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "--12-25"
      }
    ]
  },
  "isValidSqlDateTime": {
    "module": "plain/validate",
    "fn": "isValidSqlDateTime",
    "template": "isValidSqlDateTime(\"2024-03-15 14:30:00\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15 14:30:00"
      }
    ]
  },
  "isValidTime": {
    "module": "plain/validate",
    "fn": "isValidTime",
    "template": "isValidTime(\"12:34:56\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "12:34:56"
      }
    ]
  },
  "isValidTimeCycleField": {
    "module": "plain/validate",
    "fn": "isValidTimeCycleField",
    "template": "isValidTimeCycleField(\"hour\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "field",
        "kind": "string",
        "seed": "hour"
      }
    ]
  },
  "isValidTimeDurationUnit": {
    "module": "plain/validate",
    "fn": "isValidTimeDurationUnit",
    "template": "isValidTimeDurationUnit(\"hours\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "unit",
        "kind": "string",
        "seed": "hours"
      }
    ]
  },
  "isValidTimeRange": {
    "module": "plain/validate",
    "fn": "isValidTimeRange",
    "template": "isValidTimeRange({ value1: \"09:00:00\", value2: \"17:00:00\" })",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "09:00:00"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "17:00:00"
      }
    ],
    "objectArg": true
  },
  "isValidTimeUnit": {
    "module": "plain/validate",
    "fn": "isValidTimeUnit",
    "template": "isValidTimeUnit(\"hour\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "unit",
        "kind": "string",
        "seed": "hour"
      }
    ]
  },
  "isValidYearMonth": {
    "module": "plain/validate",
    "fn": "isValidYearMonth",
    "template": "isValidYearMonth(\"2026-10\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2026-10"
      }
    ]
  },
  "truncateNanoseconds": {
    "module": "precision/calculate",
    "fn": "truncateNanoseconds",
    "template": "truncateNanoseconds(1710072000123456789n, \"us\")",
    "returnType": "bigint",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "nanoseconds",
        "kind": "bigint",
        "seed": "1710072000123456789"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "us",
        "choices": [
          "ms",
          "us"
        ]
      }
    ]
  },
  "fromArrowLocalTimestamp": {
    "module": "precision/convert",
    "fn": "fromArrowLocalTimestamp",
    "template": "fromArrowLocalTimestamp(0n, \"second\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "bigint",
        "seed": "0"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "second",
        "choices": [
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "second": {
          "value": {
            "seed": "0"
          }
        },
        "milliseconds": {
          "value": {
            "seed": "1704067200123"
          }
        },
        "nanosecond": {
          "value": {
            "seed": "-1"
          }
        }
      }
    }
  },
  "fromArrowTimestamp": {
    "module": "precision/convert",
    "fn": "fromArrowTimestamp",
    "template": "fromArrowTimestamp(0n, \"second\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "bigint",
        "seed": "0"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "second",
        "choices": [
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "second": {
          "value": {
            "seed": "0"
          }
        },
        "milliseconds": {
          "value": {
            "seed": "1704067200000"
          }
        },
        "nanosecond": {
          "value": {
            "seed": "1704067200123456789"
          }
        }
      }
    }
  },
  "fromDotNetTicks": {
    "module": "precision/convert",
    "fn": "fromDotNetTicks",
    "template": "fromDotNetTicks(0n)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "bigint",
        "seed": "0"
      }
    ]
  },
  "fromExcelSerial": {
    "module": "precision/convert",
    "fn": "fromExcelSerial",
    "template": "fromExcelSerial(1)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1"
      }
    ]
  },
  "fromFileTime": {
    "module": "precision/convert",
    "fn": "fromFileTime",
    "template": "fromFileTime(0n)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "bigint",
        "seed": "0"
      }
    ]
  },
  "fromNanoseconds": {
    "module": "precision/convert",
    "fn": "fromNanoseconds",
    "template": "fromNanoseconds(0n)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "nanoseconds",
        "kind": "bigint",
        "seed": "0"
      },
      {
        "name": "timeZone",
        "kind": "enum",
        "seed": "",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ],
        "optional": true
      }
    ]
  },
  "fromNtpTimestamp": {
    "module": "precision/convert",
    "fn": "fromNtpTimestamp",
    "template": "fromNtpTimestamp(0n)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "bigint",
        "seed": "0"
      },
      {
        "name": "eraArg",
        "kind": "number",
        "seed": "",
        "optional": true
      }
    ]
  },
  "fromParquetInt96": {
    "module": "precision/convert",
    "fn": "fromParquetInt96",
    "template": "fromParquetInt96({ julianDay: 2440588, nanosOfDay: 0n })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "julianDay",
        "kind": "number",
        "seed": "2440588"
      },
      {
        "name": "nanosOfDay",
        "kind": "bigint",
        "seed": "0"
      }
    ],
    "objectArg": true
  },
  "fromPgMicroseconds": {
    "module": "precision/convert",
    "fn": "fromPgMicroseconds",
    "template": "fromPgMicroseconds(0n)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "bigint",
        "seed": "0"
      }
    ]
  },
  "fromProtoDuration": {
    "module": "precision/convert",
    "fn": "fromProtoDuration",
    "template": "fromProtoDuration({ seconds: 5401n, nanos: 500000000 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "seconds",
        "kind": "bigint",
        "seed": "5401"
      },
      {
        "name": "nanos",
        "kind": "number",
        "seed": "500000000"
      }
    ],
    "objectArg": true
  },
  "fromProtoTimestamp": {
    "module": "precision/convert",
    "fn": "fromProtoTimestamp",
    "template": "fromProtoTimestamp({ seconds: 0n, nanos: 0 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "seconds",
        "kind": "bigint",
        "seed": "0"
      },
      {
        "name": "nanos",
        "kind": "number",
        "seed": "0"
      }
    ],
    "objectArg": true
  },
  "toArrowLocalTimestamp": {
    "module": "precision/convert",
    "fn": "toArrowLocalTimestamp",
    "template": "toArrowLocalTimestamp(\"2024-01-01T00:00:00\", \"millisecond\")",
    "returnType": "bigint",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "dateTime",
        "kind": "string",
        "seed": "2024-01-01T00:00:00"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "millisecond",
        "choices": [
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "millisecond": {
          "dateTime": {
            "seed": "2024-01-01T00:00:00"
          }
        },
        "second": {
          "dateTime": {
            "seed": "2024-01-01T00:00:00[Asia/Tokyo]"
          }
        },
        "nanosecond": {
          "dateTime": {
            "seed": "2262-04-11T23:47:16.854775807"
          }
        }
      }
    }
  },
  "toArrowTimestamp": {
    "module": "precision/convert",
    "fn": "toArrowTimestamp",
    "template": "toArrowTimestamp(\"2024-01-01T00:00:00Z\", \"millisecond\")",
    "returnType": "bigint",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoString",
        "kind": "string",
        "seed": "2024-01-01T00:00:00Z"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "millisecond",
        "choices": [
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "millisecond": {
          "isoString": {
            "seed": "2024-01-01T00:00:00Z"
          }
        },
        "second": {
          "isoString": {
            "seed": "2024-01-01T09:00:00+09:00[Asia/Tokyo]"
          }
        },
        "microsecond": {
          "isoString": {
            "seed": "2024-01-01T00:00:00.123456789Z"
          }
        },
        "nanosecond": {
          "isoString": {
            "seed": "2262-04-11T23:47:16.854775807Z"
          }
        }
      }
    }
  },
  "toDotNetTicks": {
    "module": "precision/convert",
    "fn": "toDotNetTicks",
    "template": "toDotNetTicks(\"0001-01-01T00:00:00Z\")",
    "returnType": "bigint",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoString",
        "kind": "string",
        "seed": "0001-01-01T00:00:00Z"
      }
    ]
  },
  "toExcelSerial": {
    "module": "precision/convert",
    "fn": "toExcelSerial",
    "template": "toExcelSerial(\"1900-01-01T00:00:00Z\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoString",
        "kind": "string",
        "seed": "1900-01-01T00:00:00Z"
      }
    ]
  },
  "toFileTime": {
    "module": "precision/convert",
    "fn": "toFileTime",
    "template": "toFileTime(\"1601-01-01T00:00:00Z\")",
    "returnType": "bigint",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoString",
        "kind": "string",
        "seed": "1601-01-01T00:00:00Z"
      }
    ]
  },
  "toNanoseconds": {
    "module": "precision/convert",
    "fn": "toNanoseconds",
    "template": "toNanoseconds(\"1970-01-01T00:00:00Z\")",
    "returnType": "bigint",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoString",
        "kind": "string",
        "seed": "1970-01-01T00:00:00Z"
      }
    ]
  },
  "toNtpTimestamp": {
    "module": "precision/convert",
    "fn": "toNtpTimestamp",
    "template": "toNtpTimestamp(\"1900-01-01T00:00:00Z\")",
    "returnType": "bigint",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoString",
        "kind": "string",
        "seed": "1900-01-01T00:00:00Z"
      }
    ]
  },
  "toParquetInt96": {
    "module": "precision/convert",
    "fn": "toParquetInt96",
    "template": "toParquetInt96(\"1970-01-01T00:00:00Z\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoString",
        "kind": "string",
        "seed": "1970-01-01T00:00:00Z"
      }
    ]
  },
  "toPgMicroseconds": {
    "module": "precision/convert",
    "fn": "toPgMicroseconds",
    "template": "toPgMicroseconds(\"2000-01-01T00:00:00Z\")",
    "returnType": "bigint",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoString",
        "kind": "string",
        "seed": "2000-01-01T00:00:00Z"
      }
    ]
  },
  "toProtoDuration": {
    "module": "precision/convert",
    "fn": "toProtoDuration",
    "template": "toProtoDuration(\"PT1H30M1.5S\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoDuration",
        "kind": "string",
        "seed": "PT1H30M1.5S"
      }
    ]
  },
  "toProtoTimestamp": {
    "module": "precision/convert",
    "fn": "toProtoTimestamp",
    "template": "toProtoTimestamp(\"1970-01-01T00:00:00Z\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoString",
        "kind": "string",
        "seed": "1970-01-01T00:00:00Z"
      }
    ]
  },
  "formatNanoseconds": {
    "module": "precision/format",
    "fn": "formatNanoseconds",
    "template": "formatNanoseconds(1710072000123456789n)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "nanoseconds",
        "kind": "bigint",
        "seed": "1710072000123456789"
      }
    ]
  },
  "fromKsuid": {
    "module": "precision/identifiers",
    "fn": "fromKsuid",
    "template": "fromKsuid(\"0ujtsYcgvSTl8PAuAdqWYSMnLOv\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "ksuid",
        "kind": "string",
        "seed": "0ujtsYcgvSTl8PAuAdqWYSMnLOv"
      }
    ]
  },
  "fromObjectId": {
    "module": "precision/identifiers",
    "fn": "fromObjectId",
    "template": "fromObjectId(\"65a0f4d0c3b1a2e4f5d6c7b8\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "objectId",
        "kind": "string",
        "seed": "65a0f4d0c3b1a2e4f5d6c7b8"
      }
    ]
  },
  "fromSnowflake": {
    "module": "precision/identifiers",
    "fn": "fromSnowflake",
    "template": "fromSnowflake(\"175928847299117063\", { epochMs: 1420070400000, shift: 22 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "id",
        "kind": "string",
        "seed": "175928847299117063"
      },
      {
        "name": "layout",
        "kind": "expr",
        "seed": "{ epochMs: 1420070400000, shift: 22 }"
      }
    ]
  },
  "fromUlid": {
    "module": "precision/identifiers",
    "fn": "fromUlid",
    "template": "fromUlid(\"01ARZ3NDEKTSV4RRFFQ69G5FAV\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "ulid",
        "kind": "string",
        "seed": "01ARZ3NDEKTSV4RRFFQ69G5FAV"
      }
    ]
  },
  "fromUuidTimestamp": {
    "module": "precision/identifiers",
    "fn": "fromUuidTimestamp",
    "template": "fromUuidTimestamp(\"C232AB00-9414-11EC-B3C8-9F6BDECED846\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "uuid",
        "kind": "string",
        "seed": "C232AB00-9414-11EC-B3C8-9F6BDECED846"
      }
    ]
  },
  "ulidTimestampPrefix": {
    "module": "precision/identifiers",
    "fn": "ulidTimestampPrefix",
    "template": "ulidTimestampPrefix(\"2024-01-01T00:00:00Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoString",
        "kind": "string",
        "seed": "2024-01-01T00:00:00Z"
      }
    ]
  },
  "uuidV7TimestampPrefix": {
    "module": "precision/identifiers",
    "fn": "uuidV7TimestampPrefix",
    "template": "uuidV7TimestampPrefix(\"2024-01-01T00:00:00Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoString",
        "kind": "string",
        "seed": "2024-01-01T00:00:00Z"
      }
    ]
  },
  "parseNanoseconds": {
    "module": "precision/parse",
    "fn": "parseNanoseconds",
    "template": "parseNanoseconds(\"1710072000123456789\")",
    "returnType": "bigint",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "1710072000123456789"
      }
    ]
  },
  "isValidInstant": {
    "module": "precision/validate",
    "fn": "isValidInstant",
    "template": "isValidInstant(\"2024-03-10T12:00:00Z\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-10T12:00:00Z"
      }
    ]
  },
  "isValidInt64NanosecondDateTime": {
    "module": "precision/validate",
    "fn": "isValidInt64NanosecondDateTime",
    "template": "isValidInt64NanosecondDateTime(\"2024-01-01T00:00:00\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "dateTime",
        "kind": "string",
        "seed": "2024-01-01T00:00:00"
      }
    ]
  },
  "isValidInt64NanosecondInstant": {
    "module": "precision/validate",
    "fn": "isValidInt64NanosecondInstant",
    "template": "isValidInt64NanosecondInstant(\"2024-01-01T00:00:00Z\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoString",
        "kind": "string",
        "seed": "2024-01-01T00:00:00Z"
      }
    ]
  },
  "isValidNanoPattern": {
    "module": "precision/validate",
    "fn": "isValidNanoPattern",
    "template": "isValidNanoPattern(\"1710072000123456789\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "1710072000123456789"
      }
    ]
  },
  "isValidNanoseconds": {
    "module": "precision/validate",
    "fn": "isValidNanoseconds",
    "template": "isValidNanoseconds(0n)",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "bigint",
        "seed": "0"
      }
    ]
  },
  "cronRuns": {
    "module": "recurrence/calculate",
    "fn": "cronRuns",
    "template": "cronRuns({ minute: { values: [30], star: false }, hour: { values: [2], star: false }, dayOfMonth: { values: [10], star: false }, month: { values: [3], star: false }, dayOfWeek: { values: [1, 2, 3, 4, 5, 6, 7], star: true } }, \"America/New_York\", { start: \"2024-03-10T00:00:00Z\", end: \"2024-03-11T00:00:00Z\" }, \"daemonCatchUp\")",
    "returnType": "array",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "expression",
        "kind": "expr",
        "seed": "{ minute: { values: [30], star: false }, hour: { values: [2], star: false }, dayOfMonth: { values: [10], star: false }, month: { values: [3], star: false }, dayOfWeek: { values: [1, 2, 3, 4, 5, 6, 7], star: true } }"
      },
      {
        "name": "timeZone",
        "kind": "enum",
        "seed": "America/New_York",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      },
      {
        "name": "window",
        "kind": "expr",
        "seed": "{ start: \"2024-03-10T00:00:00Z\", end: \"2024-03-11T00:00:00Z\" }"
      },
      {
        "name": "policy",
        "kind": "enum",
        "seed": "daemonCatchUp",
        "choices": [
          "crontabMatch",
          "daemonCatchUp"
        ]
      }
    ]
  },
  "expandRecurrence": {
    "module": "recurrence/calculate",
    "fn": "expandRecurrence",
    "template": "expandRecurrence({ frequency: \"daily\", interval: 1, firstDayOfWeek: 1, count: 2 }, \"2024-03-09T02:30:00\", \"America/New_York\", { start: \"2024-03-10T00:00:00Z\", end: \"2024-03-11T00:00:00Z\" })",
    "returnType": "array",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "rule",
        "kind": "expr",
        "seed": "{ frequency: \"daily\", interval: 1, firstDayOfWeek: 1, count: 2 }"
      },
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-03-09T02:30:00"
      },
      {
        "name": "timeZone",
        "kind": "enum",
        "seed": "America/New_York",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      },
      {
        "name": "window",
        "kind": "expr",
        "seed": "{ start: \"2024-03-10T00:00:00Z\", end: \"2024-03-11T00:00:00Z\" }"
      }
    ]
  },
  "parseCronExpression": {
    "module": "recurrence/parse",
    "fn": "parseCronExpression",
    "template": "parseCronExpression(\"0 9-17 * * mon-fri\")?.dayOfWeek",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "0 9-17 * * mon-fri"
      }
    ]
  },
  "parseRecurrenceRule": {
    "module": "recurrence/parse",
    "fn": "parseRecurrenceRule",
    "template": "parseRecurrenceRule(\"FREQ=MONTHLY;BYDAY=-1FR\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "FREQ=MONTHLY;BYDAY=-1FR"
      }
    ]
  },
  "spanMs": {
    "module": "span/calculate",
    "fn": "spanMs",
    "template": "spanMs(\"2024-03-10T12:00:00Z\", \"2024-03-10T12:00:01Z\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-03-10T12:00:00Z"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-03-10T12:00:01Z"
      }
    ]
  },
  "spanNs": {
    "module": "span/calculate",
    "fn": "spanNs",
    "template": "spanNs(\"2024-03-10T12:00:00Z\", \"2024-03-10T12:00:01Z\")",
    "returnType": "bigint",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-03-10T12:00:00Z"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-03-10T12:00:01Z"
      }
    ]
  },
  "spanWallClock": {
    "module": "span/calculate",
    "fn": "spanWallClock",
    "template": "spanWallClock(\"2024-03-30T12:00:00+00:00[Europe/London]\", \"2024-03-31T12:00:00+01:00[Europe/London]\", \"hours\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-03-30T12:00:00+00:00[Europe/London]"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-03-31T12:00:00+01:00[Europe/London]"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "hours",
        "choices": [
          "days",
          "hours",
          "day",
          "hour"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "hours": {
          "start": {
            "seed": "2024-03-30T12:00:00+00:00[Europe/London]"
          },
          "end": {
            "seed": "2024-03-31T12:00:00+01:00[Europe/London]"
          }
        },
        "days": {
          "start": {
            "seed": "2024-04-06T12:00:00+11:00[Australia/Sydney]"
          },
          "end": {
            "seed": "2024-04-07T12:00:00+10:00[Australia/Sydney]"
          }
        },
        "day": {
          "start": {
            "seed": "2024-03-01T12:00:00+02:00[Africa/Johannesburg]"
          },
          "end": {
            "seed": "2024-03-02T12:00:00+02:00[Africa/Johannesburg]"
          }
        }
      }
    }
  },
  "isValidSpan": {
    "module": "span/validate",
    "fn": "isValidSpan",
    "template": "isValidSpan(\"2024-03-10T12:00:00Z\", \"2024-03-10T12:00:01Z\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-03-10T12:00:00Z"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-03-10T12:00:01Z"
      }
    ]
  },
  "leapSecondsBetween": {
    "module": "timescale/calculate",
    "fn": "leapSecondsBetween",
    "template": "leapSecondsBetween(\"2020-01-01T00:00:00Z\", \"2024-01-01T00:00:00Z\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2020-01-01T00:00:00Z"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-01-01T00:00:00Z"
      }
    ]
  },
  "nextLeapSecond": {
    "module": "timescale/calculate",
    "fn": "nextLeapSecond",
    "template": "nextLeapSecond(\"2016-01-01T00:00:00Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoString",
        "kind": "string",
        "seed": "2016-01-01T00:00:00Z"
      }
    ]
  },
  "taiMinusUtc": {
    "module": "timescale/calculate",
    "fn": "taiMinusUtc",
    "template": "taiMinusUtc(\"2024-01-01T00:00:00Z\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoString",
        "kind": "string",
        "seed": "2024-01-01T00:00:00Z"
      }
    ]
  },
  "fromTAI": {
    "module": "timescale/convert",
    "fn": "fromTAI",
    "template": "fromTAI(\"2026-01-01T00:00:37 TAI\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "taiString",
        "kind": "string",
        "seed": "2026-01-01T00:00:37 TAI"
      }
    ]
  },
  "toTAI": {
    "module": "timescale/convert",
    "fn": "toTAI",
    "template": "toTAI(\"2026-01-01T00:00:00Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoString",
        "kind": "string",
        "seed": "2026-01-01T00:00:00Z"
      }
    ]
  },
  "isLeapSecond": {
    "module": "timescale/validate",
    "fn": "isLeapSecond",
    "template": "isLeapSecond(\"2016-12-31T23:59:60Z\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "isoString",
        "kind": "string",
        "seed": "2016-12-31T23:59:60Z"
      }
    ]
  },
  "bestAvailable": {
    "module": "transport/calculate",
    "fn": "bestAvailable",
    "template": "bestAvailable([{ classifier: \"ACT\", at: \"2024-06-15T12:52:00Z\", recordedAt: \"2024-06-15T12:53:00Z\" }, { classifier: \"EST\", at: \"2024-06-15T13:05:00Z\", recordedAt: \"2024-06-15T14:00:00Z\" }])",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "events",
        "kind": "list",
        "seed": "",
        "element": "expr",
        "items": [
          "{ classifier: \"ACT\", at: \"2024-06-15T12:52:00Z\", recordedAt: \"2024-06-15T12:53:00Z\" }",
          "{ classifier: \"EST\", at: \"2024-06-15T13:05:00Z\", recordedAt: \"2024-06-15T14:00:00Z\" }"
        ]
      }
    ]
  },
  "crossingTime": {
    "module": "transport/calculate",
    "fn": "crossingTime",
    "template": "crossingTime(\"2024-06-15T08:00:00Z\", \"2024-06-15T17:30:00Z\", \"Europe/Berlin\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "entry",
        "kind": "string",
        "seed": "2024-06-15T08:00:00Z"
      },
      {
        "name": "exit",
        "kind": "string",
        "seed": "2024-06-15T17:30:00Z"
      },
      {
        "name": "targetZone",
        "kind": "string",
        "seed": "Europe/Berlin"
      }
    ]
  },
  "cutoffAt": {
    "module": "transport/calculate",
    "fn": "cutoffAt",
    "template": "cutoffAt(\"2024-06-14T16:00:00Z\", \"P2D\", { timeZone: \"Europe/Amsterdam\", atLocalTime: \"17:00\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "anchor",
        "kind": "string",
        "seed": "2024-06-14T16:00:00Z"
      },
      {
        "name": "offset",
        "kind": "string",
        "seed": "P2D"
      }
    ],
    "optionsSuffix": "{ timeZone: \"Europe/Amsterdam\", atLocalTime: \"17:00\" }"
  },
  "cutoffSchedule": {
    "module": "transport/calculate",
    "fn": "cutoffSchedule",
    "template": "cutoffSchedule(\"2024-06-14T16:00:00Z\", [{ name: \"gate-in\", offset: \"P1D\" }, { name: \"document\", offset: \"P2D\", atLocalTime: \"17:00\" }, { name: \"VGM\", offset: \"P1D\", atLocalTime: \"10:00\" }], { timeZone: \"Europe/Amsterdam\" })",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "anchor",
        "kind": "string",
        "seed": "2024-06-14T16:00:00Z"
      },
      {
        "name": "cutoffs",
        "kind": "list",
        "seed": "",
        "element": "expr",
        "items": [
          "{ name: \"gate-in\", offset: \"P1D\" }",
          "{ name: \"document\", offset: \"P2D\", atLocalTime: \"17:00\" }",
          "{ name: \"VGM\", offset: \"P1D\", atLocalTime: \"10:00\" }"
        ]
      }
    ],
    "optionsSuffix": "{ timeZone: \"Europe/Amsterdam\" }"
  },
  "dwellTime": {
    "module": "transport/calculate",
    "fn": "dwellTime",
    "template": "dwellTime(\"2024-06-15T23:00:00+09:00[Asia/Tokyo]\", \"2024-06-16T01:00:00+09:00[Asia/Tokyo]\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "entry",
        "kind": "string",
        "seed": "2024-06-15T23:00:00+09:00[Asia/Tokyo]"
      },
      {
        "name": "exit",
        "kind": "string",
        "seed": "2024-06-16T01:00:00+09:00[Asia/Tokyo]"
      },
      {
        "name": "targetZone",
        "kind": "string",
        "seed": "",
        "optional": true
      }
    ]
  },
  "estimateDrift": {
    "module": "transport/calculate",
    "fn": "estimateDrift",
    "template": "estimateDrift([{ classifier: \"EST\", at: \"2024-06-20T08:00:00Z\", recordedAt: \"2024-06-01T00:00:00Z\" }, { classifier: \"EST\", at: \"2024-06-20T12:00:00Z\", recordedAt: \"2024-06-05T00:00:00Z\" }, { classifier: \"EST\", at: \"2024-06-20T17:00:00Z\", recordedAt: \"2024-06-10T00:00:00Z\" }])",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "events",
        "kind": "list",
        "seed": "",
        "element": "expr",
        "items": [
          "{ classifier: \"EST\", at: \"2024-06-20T08:00:00Z\", recordedAt: \"2024-06-01T00:00:00Z\" }",
          "{ classifier: \"EST\", at: \"2024-06-20T12:00:00Z\", recordedAt: \"2024-06-05T00:00:00Z\" }",
          "{ classifier: \"EST\", at: \"2024-06-20T17:00:00Z\", recordedAt: \"2024-06-10T00:00:00Z\" }"
        ]
      }
    ]
  },
  "nextDeparture": {
    "module": "transport/calculate",
    "fn": "nextDeparture",
    "template": "nextDeparture(\"2024-06-15T09:00:00Z\", [\"2024-06-15T08:00:00Z\", \"2024-06-15T09:30:00Z\", \"2024-06-15T11:00:00Z\"])",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "after",
        "kind": "string",
        "seed": "2024-06-15T09:00:00Z"
      },
      {
        "name": "timetable",
        "kind": "expr",
        "seed": "[\"2024-06-15T08:00:00Z\", \"2024-06-15T09:30:00Z\", \"2024-06-15T11:00:00Z\"]"
      }
    ]
  },
  "punctualityRate": {
    "module": "transport/calculate",
    "fn": "punctualityRate",
    "template": "punctualityRate([{ planned: \"2024-06-15T10:00:00Z\", actual: \"2024-06-15T10:05:00Z\" }, { planned: \"2024-06-15T10:00:00Z\", actual: \"2024-06-15T10:14:00Z\" }, { planned: \"2024-06-15T10:00:00Z\", actual: \"2024-06-15T10:16:00Z\" }, { planned: \"2024-06-15T10:00:00Z\", actual: \"2024-06-15T09:57:00Z\" }], { late: \"PT15M\" })",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "pairs",
        "kind": "list",
        "seed": "",
        "element": "expr",
        "items": [
          "{ planned: \"2024-06-15T10:00:00Z\", actual: \"2024-06-15T10:05:00Z\" }",
          "{ planned: \"2024-06-15T10:00:00Z\", actual: \"2024-06-15T10:14:00Z\" }",
          "{ planned: \"2024-06-15T10:00:00Z\", actual: \"2024-06-15T10:16:00Z\" }",
          "{ planned: \"2024-06-15T10:00:00Z\", actual: \"2024-06-15T09:57:00Z\" }"
        ]
      },
      {
        "name": "tolerance",
        "kind": "expr",
        "seed": "{ late: \"PT15M\" }"
      }
    ]
  },
  "scheduleDelivery": {
    "module": "transport/calculate",
    "fn": "scheduleDelivery",
    "template": "scheduleDelivery([{ departure: \"2024-06-15T10:00:00Z\", duration: \"PT36H\", timeZone: \"Asia/Tokyo\" }])",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "legs",
        "kind": "list",
        "seed": "",
        "element": "expr",
        "items": [
          "{ departure: \"2024-06-15T10:00:00Z\", duration: \"PT36H\", timeZone: \"Asia/Tokyo\" }"
        ]
      }
    ]
  },
  "transitTime": {
    "module": "transport/calculate",
    "fn": "transitTime",
    "template": "transitTime(\"2024-06-15T10:00:00+09:00[Asia/Tokyo]\", \"PT2H30M\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "departure",
        "kind": "string",
        "seed": "2024-06-15T10:00:00+09:00[Asia/Tokyo]"
      },
      {
        "name": "duration",
        "kind": "string",
        "seed": "PT2H30M"
      }
    ]
  },
  "classifyPunctuality": {
    "module": "transport/compare",
    "fn": "classifyPunctuality",
    "template": "classifyPunctuality(\"2024-06-15T10:00:00Z\", \"2024-06-15T10:14:59Z\", { late: \"PT15M\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "planned",
        "kind": "string",
        "seed": "2024-06-15T10:00:00Z"
      },
      {
        "name": "actual",
        "kind": "string",
        "seed": "2024-06-15T10:14:59Z"
      },
      {
        "name": "tolerance",
        "kind": "expr",
        "seed": "{ late: \"PT15M\" }"
      }
    ]
  },
  "isPastCutoff": {
    "module": "transport/compare",
    "fn": "isPastCutoff",
    "template": "isPastCutoff(\"2024-06-12T16:00:00Z\", \"2024-06-12T17:00:00+02:00[Europe/Amsterdam]\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "now",
        "kind": "string",
        "seed": "2024-06-12T16:00:00Z"
      },
      {
        "name": "cutoff",
        "kind": "string",
        "seed": "2024-06-12T17:00:00+02:00[Europe/Amsterdam]"
      }
    ]
  },
  "scheduleDeviation": {
    "module": "transport/compare",
    "fn": "scheduleDeviation",
    "template": "scheduleDeviation(\"2024-06-15T10:00:00Z\", \"2024-06-15T10:14:00Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "planned",
        "kind": "string",
        "seed": "2024-06-15T10:00:00Z"
      },
      {
        "name": "actual",
        "kind": "string",
        "seed": "2024-06-15T10:14:00Z"
      }
    ]
  },
  "timeToCutoff": {
    "module": "transport/compare",
    "fn": "timeToCutoff",
    "template": "timeToCutoff(\"2024-06-10T15:00:00Z\", \"2024-06-12T17:00:00+02:00[Europe/Amsterdam]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "now",
        "kind": "string",
        "seed": "2024-06-10T15:00:00Z"
      },
      {
        "name": "cutoff",
        "kind": "string",
        "seed": "2024-06-12T17:00:00+02:00[Europe/Amsterdam]"
      }
    ]
  },
  "etaAtZone": {
    "module": "transport/convert",
    "fn": "etaAtZone",
    "template": "etaAtZone(\"2024-06-15T12:30:00Z\", \"Asia/Tokyo\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "arrivalUtc",
        "kind": "string",
        "seed": "2024-06-15T12:30:00Z"
      },
      {
        "name": "targetZone",
        "kind": "string",
        "seed": "Asia/Tokyo"
      }
    ]
  },
  "addUnix": {
    "module": "unix/calculate",
    "fn": "addUnix",
    "template": "addUnix(1706659200000, { days: 1 })",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1706659200000"
      },
      {
        "name": "units",
        "kind": "units",
        "seed": "1",
        "unitKeys": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds"
        ],
        "unitSeed": "days"
      }
    ]
  },
  "diffUnix": {
    "module": "unix/calculate",
    "fn": "diffUnix",
    "template": "diffUnix(1706745600000, 1706659200000, \"days\", { timeZone: \"UTC\" })",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "number",
        "seed": "1706745600000"
      },
      {
        "name": "value2",
        "kind": "number",
        "seed": "1706659200000"
      },
      {
        "name": "units",
        "kind": "enum",
        "seed": "days",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }"
  },
  "diffUnixAsDuration": {
    "module": "unix/calculate",
    "fn": "diffUnixAsDuration",
    "template": "diffUnixAsDuration(1706659200000, 1706745600000, \"days\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "number",
        "seed": "1706659200000"
      },
      {
        "name": "value2",
        "kind": "number",
        "seed": "1706745600000"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "days",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ]
  },
  "endOfQuarterForUnix": {
    "module": "unix/calculate",
    "fn": "endOfQuarterForUnix",
    "template": "endOfQuarterForUnix(1706659200000, { timeZone: \"UTC\" })",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1706659200000"
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }"
  },
  "endOfUnix": {
    "module": "unix/calculate",
    "fn": "endOfUnix",
    "template": "endOfUnix(1706659200000, \"year\", { timeZone: \"UTC\" })",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1706659200000"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "year",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }",
    "choiceSeeds": {
      "unit": {
        "year": {
          "value": {
            "seed": "1706659200000"
          }
        },
        "month": {
          "value": {
            "seed": "1706659200000"
          }
        },
        "day": {
          "value": {
            "seed": "1706659200"
          }
        },
        "hour": {
          "value": {
            "seed": "1729993500000"
          }
        },
        "days": {
          "value": {
            "seed": "1706780800"
          }
        }
      }
    }
  },
  "isBetweenUnix": {
    "module": "unix/calculate",
    "fn": "isBetweenUnix",
    "template": "isBetweenUnix(1705000000000, 1704000000000, 1706000000000)",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1705000000000"
      },
      {
        "name": "start",
        "kind": "number",
        "seed": "1704000000000"
      },
      {
        "name": "end",
        "kind": "number",
        "seed": "1706000000000"
      }
    ]
  },
  "maxUnix": {
    "module": "unix/calculate",
    "fn": "maxUnix",
    "template": "maxUnix([1706659200000, 1704067200000, 1700000000000])",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "unixValues",
        "kind": "list",
        "seed": "",
        "element": "number",
        "items": [
          "1706659200000",
          "1704067200000",
          "1700000000000"
        ]
      }
    ]
  },
  "minUnix": {
    "module": "unix/calculate",
    "fn": "minUnix",
    "template": "minUnix([1706659200000, 1704067200000, 1700000000000])",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "unixValues",
        "kind": "list",
        "seed": "",
        "element": "number",
        "items": [
          "1706659200000",
          "1704067200000",
          "1700000000000"
        ]
      }
    ]
  },
  "roundUnix": {
    "module": "unix/calculate",
    "fn": "roundUnix",
    "template": "roundUnix(1706661000000, { smallestUnit: \"hour\", timeZone: \"UTC\" })",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1706661000000"
      }
    ],
    "optionsSuffix": "{ smallestUnit: \"hour\", timeZone: \"UTC\" }"
  },
  "setUnix": {
    "module": "unix/calculate",
    "fn": "setUnix",
    "template": "setUnix(1710072000000, { hour: 9 }, { timeZone: \"UTC\" })",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1710072000000"
      },
      {
        "name": "fields",
        "kind": "units",
        "seed": "9",
        "unitKeys": [
          "year",
          "month",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ],
        "unitSeed": "hour"
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }"
  },
  "sortUnix": {
    "module": "unix/calculate",
    "fn": "sortUnix",
    "template": "sortUnix([1706659200000, 1704067200000, 1700000000000])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "unixValues",
        "kind": "list",
        "seed": "",
        "element": "number",
        "items": [
          "1706659200000",
          "1704067200000",
          "1700000000000"
        ]
      },
      {
        "name": "order",
        "kind": "enum",
        "seed": "",
        "choices": [
          "asc",
          "desc"
        ],
        "optional": true
      }
    ]
  },
  "startOfQuarterForUnix": {
    "module": "unix/calculate",
    "fn": "startOfQuarterForUnix",
    "template": "startOfQuarterForUnix(1706659200000, { timeZone: \"UTC\" })",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1706659200000"
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }"
  },
  "startOfUnix": {
    "module": "unix/calculate",
    "fn": "startOfUnix",
    "template": "startOfUnix(1706659200000, \"year\", { timeZone: \"UTC\" })",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1706659200000"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "year",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }",
    "choiceSeeds": {
      "unit": {
        "year": {
          "value": {
            "seed": "1706659200000"
          }
        },
        "month": {
          "value": {
            "seed": "1706659200000"
          }
        },
        "day": {
          "value": {
            "seed": "1706659200"
          }
        },
        "hour": {
          "value": {
            "seed": "1729993500000"
          }
        },
        "days": {
          "value": {
            "seed": "1706780800"
          }
        }
      }
    }
  },
  "subtractUnix": {
    "module": "unix/calculate",
    "fn": "subtractUnix",
    "template": "subtractUnix(1706745600000, { days: 1 })",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1706745600000"
      },
      {
        "name": "units",
        "kind": "units",
        "seed": "1",
        "unitKeys": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds"
        ],
        "unitSeed": "days"
      }
    ]
  },
  "areUnixEqual": {
    "module": "unix/compare",
    "fn": "areUnixEqual",
    "template": "areUnixEqual(1706659200, 1706659200)",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "number",
        "seed": "1706659200"
      },
      {
        "name": "value2",
        "kind": "number",
        "seed": "1706659200"
      }
    ]
  },
  "areUnixEqualBy": {
    "module": "unix/compare",
    "fn": "areUnixEqualBy",
    "template": "areUnixEqualBy(1710498000000, 1710503000000, \"day\", { timeZone: \"UTC\" })",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "number",
        "seed": "1710498000000"
      },
      {
        "name": "value2",
        "kind": "number",
        "seed": "1710503000000"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "day",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }"
  },
  "isAfterUnix": {
    "module": "unix/compare",
    "fn": "isAfterUnix",
    "template": "isAfterUnix(1706659200, 1704067200)",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "number",
        "seed": "1706659200"
      },
      {
        "name": "value2",
        "kind": "number",
        "seed": "1704067200"
      }
    ]
  },
  "isBeforeUnix": {
    "module": "unix/compare",
    "fn": "isBeforeUnix",
    "template": "isBeforeUnix(1704067200, 1706659200)",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "number",
        "seed": "1704067200"
      },
      {
        "name": "value2",
        "kind": "number",
        "seed": "1706659200"
      }
    ]
  },
  "convertUnixToPlainDate": {
    "module": "unix/convert",
    "fn": "convertUnixToPlainDate",
    "template": "convertUnixToPlainDate(1709164800000, { timeZone: \"UTC\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "unix",
        "kind": "number",
        "seed": "1709164800000"
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }"
  },
  "convertUnixToPlainDateTime": {
    "module": "unix/convert",
    "fn": "convertUnixToPlainDateTime",
    "template": "convertUnixToPlainDateTime(1709164800000, { timeZone: \"UTC\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "unix",
        "kind": "number",
        "seed": "1709164800000"
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }"
  },
  "convertUnixToPlainTime": {
    "module": "unix/convert",
    "fn": "convertUnixToPlainTime",
    "template": "convertUnixToPlainTime(1706659200000, { timeZone: \"UTC\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "unix",
        "kind": "number",
        "seed": "1706659200000"
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }"
  },
  "convertUnixToUtc": {
    "module": "unix/convert",
    "fn": "convertUnixToUtc",
    "template": "convertUnixToUtc(1709164800000)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1709164800000"
      }
    ]
  },
  "convertUnixToZoned": {
    "module": "unix/convert",
    "fn": "convertUnixToZoned",
    "template": "convertUnixToZoned(1709164800000, \"Asia/Kolkata\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1709164800000"
      },
      {
        "name": "timeZone",
        "kind": "enum",
        "seed": "Asia/Kolkata",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ],
    "choiceSeeds": {
      "timeZone": {
        "Asia/Kolkata": {
          "value": {
            "seed": "1709164800000"
          }
        },
        "UTC": {
          "value": {
            "seed": "1709164800"
          }
        }
      }
    }
  },
  "formatCalendarUnix": {
    "module": "unix/format",
    "fn": "formatCalendarUnix",
    "template": "formatCalendarUnix(1710685845000, \"ja-JP\", { epochUnit: \"milliseconds\", timeZone: \"Asia/Tokyo\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1710685845000"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "ja-JP",
        "optional": true
      }
    ],
    "optionsSuffix": "{ epochUnit: \"milliseconds\", timeZone: \"Asia/Tokyo\" }"
  },
  "formatRelativeUnix": {
    "module": "unix/format",
    "fn": "formatRelativeUnix",
    "template": "formatRelativeUnix(1710685845000, \"en-GB\", { epochUnit: \"milliseconds\", reference: 1805358645000 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1710685845000"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "en-GB",
        "optional": true
      }
    ],
    "optionsSuffix": "{ epochUnit: \"milliseconds\", reference: 1805358645000 }"
  },
  "formatUnix": {
    "module": "unix/format",
    "fn": "formatUnix",
    "template": "formatUnix(\"1710685845000\", \"en-GB\", { epochUnit: \"milliseconds\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "1710685845000"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "en-GB",
        "optional": true
      }
    ],
    "optionsSuffix": "{ epochUnit: \"milliseconds\" }"
  },
  "getUnixDay": {
    "module": "unix/get",
    "fn": "getUnixDay",
    "template": "getUnixDay()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getUnixHour": {
    "module": "unix/get",
    "fn": "getUnixHour",
    "template": "getUnixHour()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getUnixMicrosecond": {
    "module": "unix/get",
    "fn": "getUnixMicrosecond",
    "template": "getUnixMicrosecond()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getUnixMillisecond": {
    "module": "unix/get",
    "fn": "getUnixMillisecond",
    "template": "getUnixMillisecond()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getUnixMinute": {
    "module": "unix/get",
    "fn": "getUnixMinute",
    "template": "getUnixMinute()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getUnixMonth": {
    "module": "unix/get",
    "fn": "getUnixMonth",
    "template": "getUnixMonth()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getUnixNanosecond": {
    "module": "unix/get",
    "fn": "getUnixNanosecond",
    "template": "getUnixNanosecond()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getUnixNow": {
    "module": "unix/get",
    "fn": "getUnixNow",
    "template": "getUnixNow()",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": []
  },
  "getUnixNowUnit": {
    "module": "unix/get",
    "fn": "getUnixNowUnit",
    "template": "getUnixNowUnit(\"year\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "unit",
        "kind": "enum",
        "seed": "year",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
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
          "dayOfWeek"
        ]
      }
    ]
  },
  "getUnixSecond": {
    "module": "unix/get",
    "fn": "getUnixSecond",
    "template": "getUnixSecond()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getUnixYear": {
    "module": "unix/get",
    "fn": "getUnixYear",
    "template": "getUnixYear()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "intervalAbutsUnix": {
    "module": "unix/interval",
    "fn": "intervalAbutsUnix",
    "template": "intervalAbutsUnix(0, 1500000000, 1500000000, 1700000000)",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "number",
        "seed": "0"
      },
      {
        "name": "aEnd",
        "kind": "number",
        "seed": "1500000000"
      },
      {
        "name": "bStart",
        "kind": "number",
        "seed": "1500000000"
      },
      {
        "name": "bEnd",
        "kind": "number",
        "seed": "1700000000"
      }
    ]
  },
  "intervalContainsUnix": {
    "module": "unix/interval",
    "fn": "intervalContainsUnix",
    "template": "intervalContainsUnix(0, 1700000000, 170000000)",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "intervalStart",
        "kind": "number",
        "seed": "0"
      },
      {
        "name": "intervalEnd",
        "kind": "number",
        "seed": "1700000000"
      },
      {
        "name": "pointOrStart",
        "kind": "number",
        "seed": "170000000"
      },
      {
        "name": "pointEnd",
        "kind": "string",
        "seed": "",
        "optional": true
      }
    ]
  },
  "intervalCountUnix": {
    "module": "unix/interval",
    "fn": "intervalCountUnix",
    "template": "intervalCountUnix(0, 86400000, \"hour\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "number",
        "seed": "0"
      },
      {
        "name": "end",
        "kind": "number",
        "seed": "86400000"
      },
      {
        "name": "unit",
        "kind": "string",
        "seed": "hour"
      }
    ]
  },
  "intervalDifferenceUnix": {
    "module": "unix/interval",
    "fn": "intervalDifferenceUnix",
    "template": "intervalDifferenceUnix(0, 1700000000, 1500000000, 1600000000)",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "number",
        "seed": "0"
      },
      {
        "name": "aEnd",
        "kind": "number",
        "seed": "1700000000"
      },
      {
        "name": "bStart",
        "kind": "number",
        "seed": "1500000000"
      },
      {
        "name": "bEnd",
        "kind": "number",
        "seed": "1600000000"
      }
    ]
  },
  "intervalDivideEquallyUnix": {
    "module": "unix/interval",
    "fn": "intervalDivideEquallyUnix",
    "template": "intervalDivideEquallyUnix(0, 90000000, 3)",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "start",
        "kind": "number",
        "seed": "0"
      },
      {
        "name": "end",
        "kind": "number",
        "seed": "90000000"
      },
      {
        "name": "n",
        "kind": "number",
        "seed": "3"
      }
    ]
  },
  "intervalEngulfsUnix": {
    "module": "unix/interval",
    "fn": "intervalEngulfsUnix",
    "template": "intervalEngulfsUnix(0, 1700000000, 1500000000, 1600000000)",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "number",
        "seed": "0"
      },
      {
        "name": "aEnd",
        "kind": "number",
        "seed": "1700000000"
      },
      {
        "name": "bStart",
        "kind": "number",
        "seed": "1500000000"
      },
      {
        "name": "bEnd",
        "kind": "number",
        "seed": "1600000000"
      }
    ]
  },
  "intervalFromDurationUnix": {
    "module": "unix/interval",
    "fn": "intervalFromDurationUnix",
    "template": "intervalFromDurationUnix(1704067200000, \"P1D\", \"start\", { timeZone: \"UTC\" })",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1704067200000"
      },
      {
        "name": "duration",
        "kind": "string",
        "seed": "P1D"
      },
      {
        "name": "anchor",
        "kind": "enum",
        "seed": "start",
        "choices": [
          "start",
          "end"
        ]
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }",
    "choiceSeeds": {
      "anchor": {
        "start": {
          "value": {
            "seed": "1704067200000"
          },
          "duration": {
            "seed": "P1D"
          }
        },
        "end": {
          "value": {
            "seed": "1704153600000"
          },
          "duration": {
            "seed": "P1D"
          }
        }
      }
    }
  },
  "intervalIntersectionUnix": {
    "module": "unix/interval",
    "fn": "intervalIntersectionUnix",
    "template": "intervalIntersectionUnix(0, 1700000000, 1000000, 2000000)",
    "returnType": "object",
    "allowEmptyArray": false,
    "nullIsEmpty": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "number",
        "seed": "0"
      },
      {
        "name": "aEnd",
        "kind": "number",
        "seed": "1700000000"
      },
      {
        "name": "bStart",
        "kind": "number",
        "seed": "1000000"
      },
      {
        "name": "bEnd",
        "kind": "number",
        "seed": "2000000"
      }
    ]
  },
  "intervalLengthUnix": {
    "module": "unix/interval",
    "fn": "intervalLengthUnix",
    "template": "intervalLengthUnix(0, 86400000, \"hour\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "number",
        "seed": "0"
      },
      {
        "name": "end",
        "kind": "number",
        "seed": "86400000"
      },
      {
        "name": "unit",
        "kind": "string",
        "seed": "hour"
      }
    ]
  },
  "intervalOverlappingDaysUnix": {
    "module": "unix/interval",
    "fn": "intervalOverlappingDaysUnix",
    "template": "intervalOverlappingDaysUnix(0, 172800000, 86400000, 259200000, { timeZone: \"UTC\" })",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "number",
        "seed": "0"
      },
      {
        "name": "aEnd",
        "kind": "number",
        "seed": "172800000"
      },
      {
        "name": "bStart",
        "kind": "number",
        "seed": "86400000"
      },
      {
        "name": "bEnd",
        "kind": "number",
        "seed": "259200000"
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }"
  },
  "intervalSplitAtUnix": {
    "module": "unix/interval",
    "fn": "intervalSplitAtUnix",
    "template": "intervalSplitAtUnix(0, 100000, [50000])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "start",
        "kind": "number",
        "seed": "0"
      },
      {
        "name": "end",
        "kind": "number",
        "seed": "100000"
      },
      {
        "name": "points",
        "kind": "list",
        "seed": "",
        "element": "number",
        "items": [
          "50000"
        ]
      }
    ]
  },
  "intervalUnionUnix": {
    "module": "unix/interval",
    "fn": "intervalUnionUnix",
    "template": "intervalUnionUnix(0, 1700000000, 1000000, 2000000)",
    "returnType": "object",
    "allowEmptyArray": false,
    "nullIsEmpty": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "number",
        "seed": "0"
      },
      {
        "name": "aEnd",
        "kind": "number",
        "seed": "1700000000"
      },
      {
        "name": "bStart",
        "kind": "number",
        "seed": "1000000"
      },
      {
        "name": "bEnd",
        "kind": "number",
        "seed": "2000000"
      }
    ]
  },
  "intervalXorAllUnix": {
    "module": "unix/interval",
    "fn": "intervalXorAllUnix",
    "template": "intervalXorAllUnix([{ start: 0, end: 1500000000 }, { start: 1400000000, end: 1700000000 }])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "intervals",
        "kind": "intervals",
        "seed": "",
        "pairs": [
          [
            "",
            ""
          ],
          [
            "",
            ""
          ]
        ]
      }
    ]
  },
  "intervalXorUnix": {
    "module": "unix/interval",
    "fn": "intervalXorUnix",
    "template": "intervalXorUnix(0, 1500000000, 1400000000, 1700000000)",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "number",
        "seed": "0"
      },
      {
        "name": "aEnd",
        "kind": "number",
        "seed": "1500000000"
      },
      {
        "name": "bStart",
        "kind": "number",
        "seed": "1400000000"
      },
      {
        "name": "bEnd",
        "kind": "number",
        "seed": "1700000000"
      }
    ]
  },
  "intervalsOverlapUnix": {
    "module": "unix/interval",
    "fn": "intervalsOverlapUnix",
    "template": "intervalsOverlapUnix(0, 1700000000, 1000000, 2000000)",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "number",
        "seed": "0"
      },
      {
        "name": "aEnd",
        "kind": "number",
        "seed": "1700000000"
      },
      {
        "name": "bStart",
        "kind": "number",
        "seed": "1000000"
      },
      {
        "name": "bEnd",
        "kind": "number",
        "seed": "2000000"
      }
    ]
  },
  "mergeIntervalsUnix": {
    "module": "unix/interval",
    "fn": "mergeIntervalsUnix",
    "template": "mergeIntervalsUnix([{ start: 0, end: 1000000 }, { start: 500000, end: 1500000 }])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "intervals",
        "kind": "intervals",
        "seed": "",
        "pairs": [
          [
            "",
            ""
          ],
          [
            "",
            ""
          ]
        ]
      }
    ]
  },
  "splitIntervalByUnitUnix": {
    "module": "unix/interval",
    "fn": "splitIntervalByUnitUnix",
    "template": "splitIntervalByUnitUnix(0, 86400000, \"hour\", 6)",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "start",
        "kind": "number",
        "seed": "0"
      },
      {
        "name": "end",
        "kind": "number",
        "seed": "86400000"
      },
      {
        "name": "unit",
        "kind": "string",
        "seed": "hour"
      },
      {
        "name": "amount",
        "kind": "number",
        "seed": "6"
      }
    ]
  },
  "isValidUnixInterval": {
    "module": "unix/interval",
    "fn": "isValidUnixInterval",
    "template": "isValidUnixInterval(0, 1700000000)",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "number",
        "seed": "0"
      },
      {
        "name": "end",
        "kind": "number",
        "seed": "1700000000"
      }
    ]
  },
  "parseDateFromUnix": {
    "module": "unix/parse",
    "fn": "parseDateFromUnix",
    "template": "parseDateFromUnix(1700000000000, { timeZone: \"UTC\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1700000000000"
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }"
  },
  "parseDayFromUnix": {
    "module": "unix/parse",
    "fn": "parseDayFromUnix",
    "template": "parseDayFromUnix(1700000000000, { timeZone: \"UTC\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1700000000000"
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }"
  },
  "parseDayOfWeekFromUnix": {
    "module": "unix/parse",
    "fn": "parseDayOfWeekFromUnix",
    "template": "parseDayOfWeekFromUnix(1704067200000, { timeZone: \"UTC\" })",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1704067200000"
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }"
  },
  "parseHourFromUnix": {
    "module": "unix/parse",
    "fn": "parseHourFromUnix",
    "template": "parseHourFromUnix(1700000000000, { timeZone: \"UTC\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1700000000000"
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }"
  },
  "parseMicrosecondFromUnix": {
    "module": "unix/parse",
    "fn": "parseMicrosecondFromUnix",
    "template": "parseMicrosecondFromUnix(1700000000000)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1700000000000"
      }
    ]
  },
  "parseMillisecondFromUnix": {
    "module": "unix/parse",
    "fn": "parseMillisecondFromUnix",
    "template": "parseMillisecondFromUnix(1700000000000)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1700000000000"
      }
    ]
  },
  "parseMinuteFromUnix": {
    "module": "unix/parse",
    "fn": "parseMinuteFromUnix",
    "template": "parseMinuteFromUnix(1700000000000, { timeZone: \"UTC\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1700000000000"
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }"
  },
  "parseMonthFromUnix": {
    "module": "unix/parse",
    "fn": "parseMonthFromUnix",
    "template": "parseMonthFromUnix(1700000000000, { timeZone: \"UTC\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1700000000000"
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }"
  },
  "parseNanosecondFromUnix": {
    "module": "unix/parse",
    "fn": "parseNanosecondFromUnix",
    "template": "parseNanosecondFromUnix(1700000000000)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1700000000000"
      }
    ]
  },
  "parseSecondFromUnix": {
    "module": "unix/parse",
    "fn": "parseSecondFromUnix",
    "template": "parseSecondFromUnix(1700000000000, { timeZone: \"UTC\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1700000000000"
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }"
  },
  "parseTimeFromUnix": {
    "module": "unix/parse",
    "fn": "parseTimeFromUnix",
    "template": "parseTimeFromUnix(1700000000000, { timeZone: \"UTC\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1700000000000"
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }"
  },
  "parseUnitFromUnix": {
    "module": "unix/parse",
    "fn": "parseUnitFromUnix",
    "template": "parseUnitFromUnix(1700000000000, \"year\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1700000000000"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "year",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
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
          "dayOfWeek"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "year": {
          "value": {
            "seed": "1700000000000"
          }
        },
        "hour": {
          "value": {
            "seed": "1700000000"
          }
        },
        "week": {
          "value": {
            "seed": "1704067200000"
          }
        },
        "nanosecond": {
          "value": {
            "seed": "1709217045123"
          }
        },
        "minute": {
          "value": {
            "seed": "45870000"
          }
        }
      }
    }
  },
  "parseWeekFromUnix": {
    "module": "unix/parse",
    "fn": "parseWeekFromUnix",
    "template": "parseWeekFromUnix(1704067200000, { timeZone: \"UTC\" })",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1704067200000"
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }"
  },
  "parseYearFromUnix": {
    "module": "unix/parse",
    "fn": "parseYearFromUnix",
    "template": "parseYearFromUnix(1700000000000)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "number",
        "seed": "1700000000000"
      }
    ]
  },
  "isValidUnixMilliseconds": {
    "module": "unix/validate",
    "fn": "isValidUnixMilliseconds",
    "template": "isValidUnixMilliseconds(1700000000000)",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "timestamp",
        "kind": "number",
        "seed": "1700000000000"
      }
    ]
  },
  "isValidUnixRange": {
    "module": "unix/validate",
    "fn": "isValidUnixRange",
    "template": "isValidUnixRange({ value1: 0, value2: 1700000000 })",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "number",
        "seed": "0"
      },
      {
        "name": "value2",
        "kind": "number",
        "seed": "1700000000"
      }
    ],
    "objectArg": true
  },
  "isValidUnixSeconds": {
    "module": "unix/validate",
    "fn": "isValidUnixSeconds",
    "template": "isValidUnixSeconds(1700000000)",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "timestamp",
        "kind": "number",
        "seed": "1700000000"
      }
    ]
  },
  "isValidUnixUnit": {
    "module": "unix/validate",
    "fn": "isValidUnixUnit",
    "template": "isValidUnixUnit(\"seconds\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "unit",
        "kind": "string",
        "seed": "seconds"
      }
    ]
  },
  "addUtc": {
    "module": "utc/calculate",
    "fn": "addUtc",
    "template": "addUtc(\"2024-03-10T12:00:00Z\", { days: 5 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-10T12:00:00Z"
      },
      {
        "name": "units",
        "kind": "units",
        "seed": "5",
        "unitKeys": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds"
        ],
        "unitSeed": "days"
      }
    ]
  },
  "diffUtc": {
    "module": "utc/calculate",
    "fn": "diffUtc",
    "template": "diffUtc(\"2024-03-10T12:00:00Z\", \"2024-03-11T12:00:00Z\", \"hours\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-03-10T12:00:00Z"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-03-11T12:00:00Z"
      },
      {
        "name": "units",
        "kind": "enum",
        "seed": "hours",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ]
  },
  "diffUtcAsDuration": {
    "module": "utc/calculate",
    "fn": "diffUtcAsDuration",
    "template": "diffUtcAsDuration(\"2024-03-10T12:00:00Z\", \"2024-03-11T12:00:00Z\", \"hours\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-03-10T12:00:00Z"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-03-11T12:00:00Z"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "hours",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ]
  },
  "endOfQuarterForUtc": {
    "module": "utc/calculate",
    "fn": "endOfQuarterForUtc",
    "template": "endOfQuarterForUtc(\"2024-03-15T12:00:00Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T12:00:00Z"
      }
    ]
  },
  "endOfUtc": {
    "module": "utc/calculate",
    "fn": "endOfUtc",
    "template": "endOfUtc(\"2024-03-15T14:30:45Z\", \"year\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:45Z"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "year",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ]
  },
  "isBetweenUtc": {
    "module": "utc/calculate",
    "fn": "isBetweenUtc",
    "template": "isBetweenUtc(\"2024-03-15T12:00:00Z\", \"2024-03-10T12:00:00Z\", \"2024-03-20T12:00:00Z\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T12:00:00Z"
      },
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-03-10T12:00:00Z"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-03-20T12:00:00Z"
      }
    ]
  },
  "maxUtc": {
    "module": "utc/calculate",
    "fn": "maxUtc",
    "template": "maxUtc([\"2024-03-10T12:00:00Z\", \"2024-03-15T12:00:00Z\", \"2024-03-12T12:00:00Z\"])",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "utcDateTimes",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "2024-03-10T12:00:00Z",
          "2024-03-15T12:00:00Z",
          "2024-03-12T12:00:00Z"
        ]
      }
    ]
  },
  "minUtc": {
    "module": "utc/calculate",
    "fn": "minUtc",
    "template": "minUtc([\"2024-03-10T12:00:00Z\", \"2024-03-15T12:00:00Z\", \"2024-03-12T12:00:00Z\"])",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "utcDateTimes",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "2024-03-10T12:00:00Z",
          "2024-03-15T12:00:00Z",
          "2024-03-12T12:00:00Z"
        ]
      }
    ]
  },
  "roundUtc": {
    "module": "utc/calculate",
    "fn": "roundUtc",
    "template": "roundUtc(\"2024-06-15T12:34:56Z\", { smallestUnit: \"hour\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15T12:34:56Z"
      }
    ],
    "optionsSuffix": "{ smallestUnit: \"hour\" }"
  },
  "setUtc": {
    "module": "utc/calculate",
    "fn": "setUtc",
    "template": "setUtc(\"2024-03-10T12:00:00Z\", { hour: 9 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-10T12:00:00Z"
      },
      {
        "name": "fields",
        "kind": "units",
        "seed": "9",
        "unitKeys": [
          "year",
          "month",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ],
        "unitSeed": "hour"
      }
    ]
  },
  "sortUtc": {
    "module": "utc/calculate",
    "fn": "sortUtc",
    "template": "sortUtc([\"2024-03-12T12:00:00Z\", \"2024-03-10T12:00:00Z\", \"2024-03-15T12:00:00Z\"])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "utcDateTimes",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "2024-03-12T12:00:00Z",
          "2024-03-10T12:00:00Z",
          "2024-03-15T12:00:00Z"
        ]
      },
      {
        "name": "order",
        "kind": "enum",
        "seed": "",
        "choices": [
          "asc",
          "desc"
        ],
        "optional": true
      }
    ]
  },
  "startOfQuarterForUtc": {
    "module": "utc/calculate",
    "fn": "startOfQuarterForUtc",
    "template": "startOfQuarterForUtc(\"2024-03-15T12:00:00Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T12:00:00Z"
      }
    ]
  },
  "startOfUtc": {
    "module": "utc/calculate",
    "fn": "startOfUtc",
    "template": "startOfUtc(\"2024-03-15T14:30:45Z\", \"year\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:45Z"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "year",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ]
  },
  "subtractUtc": {
    "module": "utc/calculate",
    "fn": "subtractUtc",
    "template": "subtractUtc(\"2024-03-15T12:00:00Z\", { days: 5 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T12:00:00Z"
      },
      {
        "name": "units",
        "kind": "units",
        "seed": "5",
        "unitKeys": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds"
        ],
        "unitSeed": "days"
      }
    ]
  },
  "chopUtc": {
    "module": "utc/chop",
    "fn": "chopUtc",
    "template": "chopUtc(\"2024-03-10T12:00:00Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-10T12:00:00Z"
      }
    ]
  },
  "areUtcEqual": {
    "module": "utc/compare",
    "fn": "areUtcEqual",
    "template": "areUtcEqual(\"2024-03-17T14:30:45Z\", \"2024-03-17T14:30:45Z\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-03-17T14:30:45Z"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-03-17T14:30:45Z"
      }
    ]
  },
  "areUtcEqualBy": {
    "module": "utc/compare",
    "fn": "areUtcEqualBy",
    "template": "areUtcEqualBy(\"2024-03-15T02:00:00Z\", \"2024-03-15T22:00:00Z\", \"day\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-03-15T02:00:00Z"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-03-15T22:00:00Z"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "day",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "day": {
          "value1": {
            "seed": "2024-03-15T02:00:00Z"
          },
          "value2": {
            "seed": "2024-03-15T22:00:00Z"
          }
        },
        "second": {
          "value1": {
            "seed": "2024-05-15T10:20:30.123Z"
          },
          "value2": {
            "seed": "2024-05-15T10:20:30.999Z"
          }
        }
      }
    }
  },
  "isAfterUtc": {
    "module": "utc/compare",
    "fn": "isAfterUtc",
    "template": "isAfterUtc(\"2024-03-17T15:30:45Z\", \"2024-03-17T14:30:45Z\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-03-17T15:30:45Z"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-03-17T14:30:45Z"
      }
    ]
  },
  "isBeforeUtc": {
    "module": "utc/compare",
    "fn": "isBeforeUtc",
    "template": "isBeforeUtc(\"2024-03-17T14:30:45Z\", \"2024-03-17T15:30:45Z\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-03-17T14:30:45Z"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-03-17T15:30:45Z"
      }
    ]
  },
  "convertUtcToPlainDate": {
    "module": "utc/convert",
    "fn": "convertUtcToPlainDate",
    "template": "convertUtcToPlainDate(\"2024-02-29T00:00:00Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T00:00:00Z"
      }
    ]
  },
  "convertUtcToPlainDateTime": {
    "module": "utc/convert",
    "fn": "convertUtcToPlainDateTime",
    "template": "convertUtcToPlainDateTime(\"2024-02-29T00:00:00Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T00:00:00Z"
      }
    ]
  },
  "convertUtcToPlainTime": {
    "module": "utc/convert",
    "fn": "convertUtcToPlainTime",
    "template": "convertUtcToPlainTime(\"2024-02-29T00:00:00Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T00:00:00Z"
      }
    ]
  },
  "convertUtcToUnix": {
    "module": "utc/convert",
    "fn": "convertUtcToUnix",
    "template": "convertUtcToUnix(\"2024-02-29T00:00:00Z\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T00:00:00Z"
      }
    ]
  },
  "convertUtcToZoned": {
    "module": "utc/convert",
    "fn": "convertUtcToZoned",
    "template": "convertUtcToZoned(\"2024-02-29T00:00:00Z\", \"Australia/Sydney\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T00:00:00Z"
      },
      {
        "name": "timeZone",
        "kind": "enum",
        "seed": "Australia/Sydney",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ]
  },
  "formatCalendarUtc": {
    "module": "utc/format",
    "fn": "formatCalendarUtc",
    "template": "formatCalendarUtc(\"2026-03-16T18:30:00Z\", \"en-GB\", { timeZone: \"Africa/Johannesburg\", reference: \"2026-03-15T13:00:00Z\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2026-03-16T18:30:00Z"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "en-GB",
        "optional": true
      }
    ],
    "optionsSuffix": "{ timeZone: \"Africa/Johannesburg\", reference: \"2026-03-15T13:00:00Z\" }"
  },
  "formatHttpDate": {
    "module": "utc/format",
    "fn": "formatHttpDate",
    "template": "formatHttpDate(\"2024-03-15T14:30:00Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:00Z"
      }
    ]
  },
  "formatRelativeUtc": {
    "module": "utc/format",
    "fn": "formatRelativeUtc",
    "template": "formatRelativeUtc(\"2026-01-15T14:30:45Z\", \"de-DE\", { reference: \"2026-04-15T14:30:45Z\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2026-01-15T14:30:45Z"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "de-DE",
        "optional": true
      }
    ],
    "optionsSuffix": "{ reference: \"2026-04-15T14:30:45Z\" }"
  },
  "formatUtc": {
    "module": "utc/format",
    "fn": "formatUtc",
    "template": "formatUtc(\"2026-03-16T18:30:00Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2026-03-16T18:30:00Z"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "",
        "optional": true
      }
    ]
  },
  "getUtcDay": {
    "module": "utc/get",
    "fn": "getUtcDay",
    "template": "getUtcDay()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getUtcHour": {
    "module": "utc/get",
    "fn": "getUtcHour",
    "template": "getUtcHour()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getUtcMicrosecond": {
    "module": "utc/get",
    "fn": "getUtcMicrosecond",
    "template": "getUtcMicrosecond()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getUtcMillisecond": {
    "module": "utc/get",
    "fn": "getUtcMillisecond",
    "template": "getUtcMillisecond()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getUtcMinute": {
    "module": "utc/get",
    "fn": "getUtcMinute",
    "template": "getUtcMinute()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getUtcMonth": {
    "module": "utc/get",
    "fn": "getUtcMonth",
    "template": "getUtcMonth()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getUtcNanosecond": {
    "module": "utc/get",
    "fn": "getUtcNanosecond",
    "template": "getUtcNanosecond()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getUtcNow": {
    "module": "utc/get",
    "fn": "getUtcNow",
    "template": "getUtcNow()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getUtcNowUnit": {
    "module": "utc/get",
    "fn": "getUtcNowUnit",
    "template": "getUtcNowUnit(\"year\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "unit",
        "kind": "enum",
        "seed": "year",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
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
          "dayOfWeek"
        ]
      }
    ]
  },
  "getUtcSecond": {
    "module": "utc/get",
    "fn": "getUtcSecond",
    "template": "getUtcSecond()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getUtcYear": {
    "module": "utc/get",
    "fn": "getUtcYear",
    "template": "getUtcYear()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "intervalAbutsUtc": {
    "module": "utc/interval",
    "fn": "intervalAbutsUtc",
    "template": "intervalAbutsUtc(\"2024-01-01T09:00:00Z\", \"2024-01-01T12:00:00Z\", \"2024-01-01T12:00:00Z\", \"2024-01-01T17:00:00Z\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T09:00:00Z"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-01-01T12:00:00Z"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-01-01T12:00:00Z"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-01-01T17:00:00Z"
      }
    ]
  },
  "intervalContainsUtc": {
    "module": "utc/interval",
    "fn": "intervalContainsUtc",
    "template": "intervalContainsUtc(\"2024-01-01T09:00:00Z\", \"2024-01-01T17:00:00Z\", \"2024-01-01T12:00:00Z\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "intervalStart",
        "kind": "string",
        "seed": "2024-01-01T09:00:00Z"
      },
      {
        "name": "intervalEnd",
        "kind": "string",
        "seed": "2024-01-01T17:00:00Z"
      },
      {
        "name": "pointOrStart",
        "kind": "string",
        "seed": "2024-01-01T12:00:00Z"
      },
      {
        "name": "pointEnd",
        "kind": "string",
        "seed": "",
        "optional": true
      }
    ]
  },
  "intervalCountUtc": {
    "module": "utc/interval",
    "fn": "intervalCountUtc",
    "template": "intervalCountUtc(\"2024-01-01T23:59:00Z\", \"2024-01-02T00:01:00Z\", \"day\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01T23:59:00Z"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-01-02T00:01:00Z"
      },
      {
        "name": "unit",
        "kind": "string",
        "seed": "day"
      }
    ]
  },
  "intervalDifferenceUtc": {
    "module": "utc/interval",
    "fn": "intervalDifferenceUtc",
    "template": "intervalDifferenceUtc(\"2024-01-01T09:00:00Z\", \"2024-01-01T17:00:00Z\", \"2024-01-01T12:00:00Z\", \"2024-01-01T13:00:00Z\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T09:00:00Z"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-01-01T17:00:00Z"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-01-01T12:00:00Z"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-01-01T13:00:00Z"
      }
    ]
  },
  "intervalDivideEquallyUtc": {
    "module": "utc/interval",
    "fn": "intervalDivideEquallyUtc",
    "template": "intervalDivideEquallyUtc(\"2024-01-01T00:00:00Z\", \"2024-01-04T00:00:00Z\", 3)",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01T00:00:00Z"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-01-04T00:00:00Z"
      },
      {
        "name": "n",
        "kind": "number",
        "seed": "3"
      }
    ]
  },
  "intervalEngulfsUtc": {
    "module": "utc/interval",
    "fn": "intervalEngulfsUtc",
    "template": "intervalEngulfsUtc(\"2024-01-01T09:00:00Z\", \"2024-01-01T17:00:00Z\", \"2024-01-01T12:00:00Z\", \"2024-01-01T13:00:00Z\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T09:00:00Z"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-01-01T17:00:00Z"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-01-01T12:00:00Z"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-01-01T13:00:00Z"
      }
    ]
  },
  "intervalFromDurationUtc": {
    "module": "utc/interval",
    "fn": "intervalFromDurationUtc",
    "template": "intervalFromDurationUtc(\"2024-01-01T00:00:00Z\", \"P1D\", \"start\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-01-01T00:00:00Z"
      },
      {
        "name": "duration",
        "kind": "string",
        "seed": "P1D"
      },
      {
        "name": "anchor",
        "kind": "enum",
        "seed": "start",
        "choices": [
          "start",
          "end"
        ]
      }
    ],
    "choiceSeeds": {
      "anchor": {
        "start": {
          "value": {
            "seed": "2024-01-01T00:00:00Z"
          },
          "duration": {
            "seed": "P1D"
          }
        },
        "end": {
          "value": {
            "seed": "2024-01-02T00:00:00Z"
          },
          "duration": {
            "seed": "P1D"
          }
        }
      }
    }
  },
  "intervalIntersectionUtc": {
    "module": "utc/interval",
    "fn": "intervalIntersectionUtc",
    "template": "intervalIntersectionUtc(\"2024-01-01T09:00:00Z\", \"2024-01-01T13:00:00Z\", \"2024-01-01T12:00:00Z\", \"2024-01-01T17:00:00Z\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "nullIsEmpty": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T09:00:00Z"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-01-01T13:00:00Z"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-01-01T12:00:00Z"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-01-01T17:00:00Z"
      }
    ]
  },
  "intervalLengthUtc": {
    "module": "utc/interval",
    "fn": "intervalLengthUtc",
    "template": "intervalLengthUtc(\"2024-01-01T23:59:00Z\", \"2024-01-02T00:01:00Z\", \"day\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01T23:59:00Z"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-01-02T00:01:00Z"
      },
      {
        "name": "unit",
        "kind": "string",
        "seed": "day"
      }
    ]
  },
  "intervalOverlappingDaysUtc": {
    "module": "utc/interval",
    "fn": "intervalOverlappingDaysUtc",
    "template": "intervalOverlappingDaysUtc(\"2024-01-01T23:59:00Z\", \"2024-01-02T00:01:00Z\", \"2024-01-01T23:59:00Z\", \"2024-01-02T00:01:00Z\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T23:59:00Z"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-01-02T00:01:00Z"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-01-01T23:59:00Z"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-01-02T00:01:00Z"
      }
    ]
  },
  "intervalSplitAtUtc": {
    "module": "utc/interval",
    "fn": "intervalSplitAtUtc",
    "template": "intervalSplitAtUtc(\"2024-01-01T00:00:00Z\", \"2024-01-10T00:00:00Z\", [\"2024-01-05T00:00:00Z\"])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01T00:00:00Z"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-01-10T00:00:00Z"
      },
      {
        "name": "points",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "2024-01-05T00:00:00Z"
        ]
      }
    ]
  },
  "intervalUnionUtc": {
    "module": "utc/interval",
    "fn": "intervalUnionUtc",
    "template": "intervalUnionUtc(\"2024-01-01T09:00:00Z\", \"2024-01-01T13:00:00Z\", \"2024-01-01T12:00:00Z\", \"2024-01-01T17:00:00Z\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "nullIsEmpty": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T09:00:00Z"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-01-01T13:00:00Z"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-01-01T12:00:00Z"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-01-01T17:00:00Z"
      }
    ]
  },
  "intervalXorAllUtc": {
    "module": "utc/interval",
    "fn": "intervalXorAllUtc",
    "template": "intervalXorAllUtc([{ start: \"2024-01-01T09:00:00Z\", end: \"2024-01-01T13:00:00Z\" }, { start: \"2024-01-01T12:00:00Z\", end: \"2024-01-01T17:00:00Z\" }])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "intervals",
        "kind": "intervals",
        "seed": "",
        "pairs": [
          [
            "2024-01-01T09:00:00Z",
            "2024-01-01T13:00:00Z"
          ],
          [
            "2024-01-01T12:00:00Z",
            "2024-01-01T17:00:00Z"
          ]
        ]
      }
    ]
  },
  "intervalXorUtc": {
    "module": "utc/interval",
    "fn": "intervalXorUtc",
    "template": "intervalXorUtc(\"2024-01-01T09:00:00Z\", \"2024-01-01T13:00:00Z\", \"2024-01-01T12:00:00Z\", \"2024-01-01T17:00:00Z\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T09:00:00Z"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-01-01T13:00:00Z"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-01-01T12:00:00Z"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-01-01T17:00:00Z"
      }
    ]
  },
  "intervalsOverlapUtc": {
    "module": "utc/interval",
    "fn": "intervalsOverlapUtc",
    "template": "intervalsOverlapUtc(\"2024-01-01T09:00:00Z\", \"2024-01-01T13:00:00Z\", \"2024-01-01T12:00:00Z\", \"2024-01-01T17:00:00Z\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T09:00:00Z"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-01-01T13:00:00Z"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-01-01T12:00:00Z"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-01-01T17:00:00Z"
      }
    ]
  },
  "mergeIntervalsUtc": {
    "module": "utc/interval",
    "fn": "mergeIntervalsUtc",
    "template": "mergeIntervalsUtc([{ start: \"2024-01-01T00:00:00Z\", end: \"2024-01-10T00:00:00Z\" }, { start: \"2024-01-05T00:00:00Z\", end: \"2024-01-15T00:00:00Z\" }])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "intervals",
        "kind": "intervals",
        "seed": "",
        "pairs": [
          [
            "2024-01-01T00:00:00Z",
            "2024-01-10T00:00:00Z"
          ],
          [
            "2024-01-05T00:00:00Z",
            "2024-01-15T00:00:00Z"
          ]
        ]
      }
    ]
  },
  "splitIntervalByUnitUtc": {
    "module": "utc/interval",
    "fn": "splitIntervalByUnitUtc",
    "template": "splitIntervalByUnitUtc(\"2024-01-01T00:00:00Z\", \"2024-01-02T00:00:00Z\", \"hour\", 6)",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01T00:00:00Z"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-01-02T00:00:00Z"
      },
      {
        "name": "unit",
        "kind": "string",
        "seed": "hour"
      },
      {
        "name": "amount",
        "kind": "number",
        "seed": "6"
      }
    ]
  },
  "isValidUtcInterval": {
    "module": "utc/interval",
    "fn": "isValidUtcInterval",
    "template": "isValidUtcInterval(\"2024-01-01T10:00:00Z\", \"2024-12-31T23:59:59Z\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01T10:00:00Z"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-12-31T23:59:59Z"
      }
    ]
  },
  "parseDateFromUtc": {
    "module": "utc/parse",
    "fn": "parseDateFromUtc",
    "template": "parseDateFromUtc(\"2024-03-17T14:30:45Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-17T14:30:45Z"
      }
    ]
  },
  "parseDayFromUtc": {
    "module": "utc/parse",
    "fn": "parseDayFromUtc",
    "template": "parseDayFromUtc(\"2024-03-17T14:30:45Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-17T14:30:45Z"
      }
    ]
  },
  "parseDayOfWeekFromUtc": {
    "module": "utc/parse",
    "fn": "parseDayOfWeekFromUtc",
    "template": "parseDayOfWeekFromUtc(\"2024-03-17T14:30:45Z\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-17T14:30:45Z"
      }
    ]
  },
  "parseHourFromUtc": {
    "module": "utc/parse",
    "fn": "parseHourFromUtc",
    "template": "parseHourFromUtc(\"2024-03-17T14:30:45Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-17T14:30:45Z"
      }
    ]
  },
  "parseHttpDate": {
    "module": "utc/parse",
    "fn": "parseHttpDate",
    "template": "parseHttpDate(\"Fri, 15 Mar 2024 14:30:00 GMT\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "Fri, 15 Mar 2024 14:30:00 GMT"
      }
    ]
  },
  "parseMicrosecondFromUtc": {
    "module": "utc/parse",
    "fn": "parseMicrosecondFromUtc",
    "template": "parseMicrosecondFromUtc(\"2024-03-17T14:30:45.123Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-17T14:30:45.123Z"
      }
    ]
  },
  "parseMillisecondFromUtc": {
    "module": "utc/parse",
    "fn": "parseMillisecondFromUtc",
    "template": "parseMillisecondFromUtc(\"2024-03-17T14:30:45.123Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-17T14:30:45.123Z"
      }
    ]
  },
  "parseMinuteFromUtc": {
    "module": "utc/parse",
    "fn": "parseMinuteFromUtc",
    "template": "parseMinuteFromUtc(\"2024-03-17T14:30:45Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-17T14:30:45Z"
      }
    ]
  },
  "parseMonthFromUtc": {
    "module": "utc/parse",
    "fn": "parseMonthFromUtc",
    "template": "parseMonthFromUtc(\"2024-03-17T14:30:45Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-17T14:30:45Z"
      }
    ]
  },
  "parseNanosecondFromUtc": {
    "module": "utc/parse",
    "fn": "parseNanosecondFromUtc",
    "template": "parseNanosecondFromUtc(\"2024-03-17T14:30:45.123Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-17T14:30:45.123Z"
      }
    ]
  },
  "parseSecondFromUtc": {
    "module": "utc/parse",
    "fn": "parseSecondFromUtc",
    "template": "parseSecondFromUtc(\"2024-03-17T14:30:45Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-17T14:30:45Z"
      }
    ]
  },
  "parseTimeFromUtc": {
    "module": "utc/parse",
    "fn": "parseTimeFromUtc",
    "template": "parseTimeFromUtc(\"2024-03-17T14:30:45Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-17T14:30:45Z"
      }
    ]
  },
  "parseUnitFromUtc": {
    "module": "utc/parse",
    "fn": "parseUnitFromUtc",
    "template": "parseUnitFromUtc(\"2024-03-17T14:30:45Z\", \"month\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-17T14:30:45Z"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "month",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
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
          "dayOfWeek"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "month": {
          "value": {
            "seed": "2024-03-17T14:30:45Z"
          }
        },
        "hours": {
          "value": {
            "seed": "2024-03-17T14:30:45Z"
          }
        },
        "year": {
          "value": {
            "seed": "2024-03-17T14:30:45Z"
          }
        },
        "day": {
          "value": {
            "seed": "2024-03-17T02:30:45Z"
          }
        },
        "week": {
          "value": {
            "seed": "2024-01-01T00:00:00Z"
          }
        },
        "minute": {
          "value": {
            "seed": "1970-01-01T12:44:30Z"
          }
        }
      }
    }
  },
  "parseWeekFromUtc": {
    "module": "utc/parse",
    "fn": "parseWeekFromUtc",
    "template": "parseWeekFromUtc(\"2024-03-17T14:30:45Z\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-17T14:30:45Z"
      }
    ]
  },
  "parseYearFromUtc": {
    "module": "utc/parse",
    "fn": "parseYearFromUtc",
    "template": "parseYearFromUtc(\"2024-03-17T14:30:45Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-17T14:30:45Z"
      }
    ]
  },
  "isValidHttpDate": {
    "module": "utc/validate",
    "fn": "isValidHttpDate",
    "template": "isValidHttpDate(\"Fri, 15 Mar 2024 14:30:00 GMT\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "Fri, 15 Mar 2024 14:30:00 GMT"
      }
    ]
  },
  "isValidUtc": {
    "module": "utc/validate",
    "fn": "isValidUtc",
    "template": "isValidUtc(\"2024-03-17T14:30:45Z\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-17T14:30:45Z"
      }
    ]
  },
  "isValidUtcRange": {
    "module": "utc/validate",
    "fn": "isValidUtcRange",
    "template": "isValidUtcRange({ value1: \"2024-01-01T10:00:00Z\", value2: \"2024-12-31T23:59:59Z\" })",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-01-01T10:00:00Z"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-12-31T23:59:59Z"
      }
    ],
    "objectArg": true
  },
  "isValidUtcTimestamp": {
    "module": "utc/validate",
    "fn": "isValidUtcTimestamp",
    "template": "isValidUtcTimestamp(\"2026-10-06T12:00:00Z\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2026-10-06T12:00:00Z"
      }
    ]
  },
  "dutyDayFor": {
    "module": "workforce/calculate",
    "fn": "dutyDayFor",
    "template": "dutyDayFor(\"2024-01-01T08:59:00Z\", { timeZone: \"America/New_York\", dayStartTime: \"04:00\" })",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "instant",
        "kind": "string",
        "seed": "2024-01-01T08:59:00Z"
      },
      {
        "name": "day",
        "kind": "expr",
        "seed": "{ timeZone: \"America/New_York\", dayStartTime: \"04:00\" }"
      }
    ]
  },
  "dutyTotals": {
    "module": "workforce/calculate",
    "fn": "dutyTotals",
    "template": "dutyTotals([{ status: \"driving\", start: \"2024-01-01T10:00:00Z\", end: \"2024-01-01T15:00:00Z\" }, { status: \"onDuty\", start: \"2024-01-01T15:00:00Z\", end: \"2024-01-01T17:00:00Z\" }, { status: \"driving\", start: \"2024-01-01T17:00:00Z\", end: \"2024-01-01T20:00:00Z\" }], { start: \"2024-01-01T00:00:00Z\", end: \"2024-01-02T00:00:00Z\" }, [\"driving\"])",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "log",
        "kind": "list",
        "seed": "",
        "element": "expr",
        "items": [
          "{ status: \"driving\", start: \"2024-01-01T10:00:00Z\", end: \"2024-01-01T15:00:00Z\" }",
          "{ status: \"onDuty\", start: \"2024-01-01T15:00:00Z\", end: \"2024-01-01T17:00:00Z\" }",
          "{ status: \"driving\", start: \"2024-01-01T17:00:00Z\", end: \"2024-01-01T20:00:00Z\" }"
        ]
      },
      {
        "name": "window",
        "kind": "expr",
        "seed": "{ start: \"2024-01-01T00:00:00Z\", end: \"2024-01-02T00:00:00Z\" }"
      },
      {
        "name": "statuses",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "driving"
        ]
      }
    ]
  },
  "dutyViolations": {
    "module": "workforce/calculate",
    "fn": "dutyViolations",
    "template": "dutyViolations([{ status: \"off\", start: \"2024-01-01T00:00:00Z\", end: \"2024-01-01T10:00:00Z\" }, { status: \"driving\", start: \"2024-01-01T10:00:00Z\", end: \"2024-01-01T22:00:00Z\" }], { start: \"2024-01-01T00:00:00Z\", end: \"2024-01-02T00:00:00Z\" }, [{ label: \"11 driving\", kind: \"cumulativeCap\", statuses: [\"driving\"], cap: \"PT11H\", since: { statuses: [\"off\"], consecutive: \"PT10H\" } }], { timeZone: \"UTC\" })",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "log",
        "kind": "list",
        "seed": "",
        "element": "expr",
        "items": [
          "{ status: \"off\", start: \"2024-01-01T00:00:00Z\", end: \"2024-01-01T10:00:00Z\" }",
          "{ status: \"driving\", start: \"2024-01-01T10:00:00Z\", end: \"2024-01-01T22:00:00Z\" }"
        ]
      },
      {
        "name": "range",
        "kind": "expr",
        "seed": "{ start: \"2024-01-01T00:00:00Z\", end: \"2024-01-02T00:00:00Z\" }"
      },
      {
        "name": "rules",
        "kind": "list",
        "seed": "",
        "element": "expr",
        "items": [
          "{ label: \"11 driving\", kind: \"cumulativeCap\", statuses: [\"driving\"], cap: \"PT11H\", since: { statuses: [\"off\"], consecutive: \"PT10H\" } }"
        ]
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }"
  },
  "evaluateDutyLog": {
    "module": "workforce/calculate",
    "fn": "evaluateDutyLog",
    "template": "evaluateDutyLog([{ status: \"off\", start: \"2024-01-01T00:00:00Z\", end: \"2024-01-01T10:00:00Z\" }, { status: \"driving\", start: \"2024-01-01T10:00:00Z\", end: \"2024-01-01T21:00:00Z\" }], \"2024-01-01T21:00:00Z\", [{ label: \"11 driving\", kind: \"cumulativeCap\", statuses: [\"driving\"], cap: \"PT11H\", since: { statuses: [\"off\"], consecutive: \"PT10H\" } }], { timeZone: \"UTC\" })",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "log",
        "kind": "list",
        "seed": "",
        "element": "expr",
        "items": [
          "{ status: \"off\", start: \"2024-01-01T00:00:00Z\", end: \"2024-01-01T10:00:00Z\" }",
          "{ status: \"driving\", start: \"2024-01-01T10:00:00Z\", end: \"2024-01-01T21:00:00Z\" }"
        ]
      },
      {
        "name": "at",
        "kind": "string",
        "seed": "2024-01-01T21:00:00Z"
      },
      {
        "name": "rules",
        "kind": "list",
        "seed": "",
        "element": "expr",
        "items": [
          "{ label: \"11 driving\", kind: \"cumulativeCap\", statuses: [\"driving\"], cap: \"PT11H\", since: { statuses: [\"off\"], consecutive: \"PT10H\" } }"
        ]
      }
    ],
    "optionsSuffix": "{ timeZone: \"UTC\" }"
  },
  "longestRun": {
    "module": "workforce/calculate",
    "fn": "longestRun",
    "template": "longestRun([{ status: \"driving\", start: \"2024-01-01T00:00:00Z\", end: \"2024-01-01T03:00:00Z\" }, { status: \"onDuty\", start: \"2024-01-01T03:00:00Z\", end: \"2024-01-01T04:00:00Z\" }, { status: \"driving\", start: \"2024-01-01T04:00:00Z\", end: \"2024-01-01T08:00:00Z\" }], { start: \"2024-01-01T00:00:00Z\", end: \"2024-01-02T00:00:00Z\" }, [\"driving\"])",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "log",
        "kind": "list",
        "seed": "",
        "element": "expr",
        "items": [
          "{ status: \"driving\", start: \"2024-01-01T00:00:00Z\", end: \"2024-01-01T03:00:00Z\" }",
          "{ status: \"onDuty\", start: \"2024-01-01T03:00:00Z\", end: \"2024-01-01T04:00:00Z\" }",
          "{ status: \"driving\", start: \"2024-01-01T04:00:00Z\", end: \"2024-01-01T08:00:00Z\" }"
        ]
      },
      {
        "name": "window",
        "kind": "expr",
        "seed": "{ start: \"2024-01-01T00:00:00Z\", end: \"2024-01-02T00:00:00Z\" }"
      },
      {
        "name": "statuses",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "driving"
        ]
      }
    ]
  },
  "qualifyingRestPairs": {
    "module": "workforce/calculate",
    "fn": "qualifyingRestPairs",
    "template": "qualifyingRestPairs([{ status: \"sleeper\", start: \"2024-01-01T00:00:00Z\", end: \"2024-01-01T07:30:00Z\" }, { status: \"work\", start: \"2024-01-01T07:30:00Z\", end: \"2024-01-01T11:30:00Z\" }, { status: \"off\", start: \"2024-01-01T11:30:00Z\", end: \"2024-01-01T14:00:00Z\" }], { statuses: [\"off\", \"sleeper\"], minimum: \"PT10H\", pair: { eachAtLeast: \"PT2H\", oneAtLeast: \"PT7H\", combinedAtLeast: \"PT10H\" } })",
    "returnType": "array",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "log",
        "kind": "list",
        "seed": "",
        "element": "expr",
        "items": [
          "{ status: \"sleeper\", start: \"2024-01-01T00:00:00Z\", end: \"2024-01-01T07:30:00Z\" }",
          "{ status: \"work\", start: \"2024-01-01T07:30:00Z\", end: \"2024-01-01T11:30:00Z\" }",
          "{ status: \"off\", start: \"2024-01-01T11:30:00Z\", end: \"2024-01-01T14:00:00Z\" }"
        ]
      },
      {
        "name": "spec",
        "kind": "expr",
        "seed": "{ statuses: [\"off\", \"sleeper\"], minimum: \"PT10H\", pair: { eachAtLeast: \"PT2H\", oneAtLeast: \"PT7H\", combinedAtLeast: \"PT10H\" } }"
      }
    ]
  },
  "qualifyingRests": {
    "module": "workforce/calculate",
    "fn": "qualifyingRests",
    "template": "qualifyingRests([{ status: \"off\", start: \"2024-01-01T00:00:00Z\", end: \"2024-01-01T10:00:00Z\" }, { status: \"work\", start: \"2024-01-01T10:00:00Z\", end: \"2024-01-01T16:00:00Z\" }, { status: \"off\", start: \"2024-01-01T16:00:00Z\", end: \"2024-01-01T23:00:00Z\" }], { statuses: [\"off\"], minimum: \"PT10H\" })",
    "returnType": "array",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "log",
        "kind": "list",
        "seed": "",
        "element": "expr",
        "items": [
          "{ status: \"off\", start: \"2024-01-01T00:00:00Z\", end: \"2024-01-01T10:00:00Z\" }",
          "{ status: \"work\", start: \"2024-01-01T10:00:00Z\", end: \"2024-01-01T16:00:00Z\" }",
          "{ status: \"off\", start: \"2024-01-01T16:00:00Z\", end: \"2024-01-01T23:00:00Z\" }"
        ]
      },
      {
        "name": "spec",
        "kind": "expr",
        "seed": "{ statuses: [\"off\"], minimum: \"PT10H\" }"
      }
    ]
  },
  "isValidDutyLog": {
    "module": "workforce/validate",
    "fn": "isValidDutyLog",
    "template": "isValidDutyLog([{ status: \"off\", start: \"2024-01-01T00:00:00Z\", end: \"2024-01-01T10:00:00Z\" }, { status: \"driving\", start: \"2024-01-01T10:00:00Z\", end: \"2024-01-01T15:00:00Z\" }])",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "log",
        "kind": "expr",
        "seed": "[{ status: \"off\", start: \"2024-01-01T00:00:00Z\", end: \"2024-01-01T10:00:00Z\" }, { status: \"driving\", start: \"2024-01-01T10:00:00Z\", end: \"2024-01-01T15:00:00Z\" }]"
      }
    ]
  },
  "addZoned": {
    "module": "zoned/calculate",
    "fn": "addZoned",
    "template": "addZoned(\"2024-02-29T14:30:45.123+00:00[Europe/London]\", { days: 1 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T14:30:45.123+00:00[Europe/London]"
      },
      {
        "name": "units",
        "kind": "units",
        "seed": "1",
        "unitKeys": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds"
        ],
        "unitSeed": "days"
      }
    ]
  },
  "addZonedBusinessDays": {
    "module": "zoned/calculate",
    "fn": "addZonedBusinessDays",
    "template": "addZonedBusinessDays(\"2024-03-15T14:30:00+09:00[Asia/Tokyo]\", 1)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:00+09:00[Asia/Tokyo]"
      },
      {
        "name": "amount",
        "kind": "number",
        "seed": "1"
      }
    ]
  },
  "clampZoned": {
    "module": "zoned/calculate",
    "fn": "clampZoned",
    "template": "clampZoned(\"2024-03-15T12:00:00+00:00[UTC]\", \"2024-03-01T00:00:00+00:00[UTC]\", \"2024-03-31T23:59:59+00:00[UTC]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T12:00:00+00:00[UTC]"
      },
      {
        "name": "min",
        "kind": "string",
        "seed": "2024-03-01T00:00:00+00:00[UTC]"
      },
      {
        "name": "max",
        "kind": "string",
        "seed": "2024-03-31T23:59:59+00:00[UTC]"
      }
    ]
  },
  "closestZonedTo": {
    "module": "zoned/calculate",
    "fn": "closestZonedTo",
    "template": "closestZonedTo(\"2024-03-15T12:00:00+00:00[UTC]\", [\"2024-03-01T00:00:00+00:00[UTC]\", \"2024-03-20T00:00:00+00:00[UTC]\", \"2024-03-18T00:00:00+00:00[UTC]\"])",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "target",
        "kind": "string",
        "seed": "2024-03-15T12:00:00+00:00[UTC]"
      },
      {
        "name": "candidates",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "2024-03-01T00:00:00+00:00[UTC]",
          "2024-03-20T00:00:00+00:00[UTC]",
          "2024-03-18T00:00:00+00:00[UTC]"
        ]
      }
    ]
  },
  "cycleZoned": {
    "module": "zoned/calculate",
    "fn": "cycleZoned",
    "template": "cycleZoned(\"2024-06-15T09:30:00-05:00[America/Chicago]\", \"hour\", 1)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15T09:30:00-05:00[America/Chicago]"
      },
      {
        "name": "field",
        "kind": "enum",
        "seed": "hour",
        "choices": [
          "year",
          "month",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      },
      {
        "name": "amount",
        "kind": "number",
        "seed": "1"
      }
    ],
    "choiceSeeds": {
      "field": {
        "hour": {
          "value": {
            "seed": "2024-06-15T09:30:00-05:00[America/Chicago]"
          },
          "amount": {
            "seed": "1"
          }
        },
        "month": {
          "value": {
            "seed": "2024-12-15T09:30:00-06:00[America/Chicago]"
          },
          "amount": {
            "seed": "1"
          }
        }
      }
    }
  },
  "diffZoned": {
    "module": "zoned/calculate",
    "fn": "diffZoned",
    "template": "diffZoned(\"2024-02-28T14:30:00+00:00[UTC]\", \"2024-03-01T15:30:00+00:00[UTC]\", \"days\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-02-28T14:30:00+00:00[UTC]"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-03-01T15:30:00+00:00[UTC]"
      },
      {
        "name": "units",
        "kind": "enum",
        "seed": "days",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "choiceSeeds": {
      "units": {
        "days": {
          "value1": {
            "seed": "2024-02-28T14:30:00+00:00[UTC]"
          },
          "value2": {
            "seed": "2024-03-01T15:30:00+00:00[UTC]"
          }
        },
        "months": {
          "value1": {
            "seed": "2023-09-16T00:00:00-03:00[America/Sao_Paulo][u-ca=hebrew]"
          },
          "value2": {
            "seed": "2024-10-03T00:00:00-03:00[America/Sao_Paulo][u-ca=hebrew]"
          }
        }
      }
    }
  },
  "diffZonedAsDuration": {
    "module": "zoned/calculate",
    "fn": "diffZonedAsDuration",
    "template": "diffZonedAsDuration(\"2024-10-05T12:00:00+10:00[Australia/Sydney]\", \"2024-10-07T12:00:00+11:00[Australia/Sydney]\", \"days\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-10-05T12:00:00+10:00[Australia/Sydney]"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-10-07T12:00:00+11:00[Australia/Sydney]"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "days",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "days": {
          "value1": {
            "seed": "2024-10-05T12:00:00+10:00[Australia/Sydney]"
          },
          "value2": {
            "seed": "2024-10-07T12:00:00+11:00[Australia/Sydney]"
          }
        },
        "hours": {
          "value1": {
            "seed": "2028-01-01T00:00:00+00:00[UTC]"
          },
          "value2": {
            "seed": "2028-01-01T00:00:00+00:00[UTC]"
          }
        },
        "months": {
          "value1": {
            "seed": "2023-09-16T00:00:00+02:00[Africa/Johannesburg][u-ca=hebrew]"
          },
          "value2": {
            "seed": "2024-10-03T00:00:00+02:00[Africa/Johannesburg][u-ca=hebrew]"
          }
        }
      }
    }
  },
  "endOfQuarterForZoned": {
    "module": "zoned/calculate",
    "fn": "endOfQuarterForZoned",
    "template": "endOfQuarterForZoned(\"2024-02-15T14:30:00+00:00[UTC]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-15T14:30:00+00:00[UTC]"
      }
    ]
  },
  "endOfZoned": {
    "module": "zoned/calculate",
    "fn": "endOfZoned",
    "template": "endOfZoned(\"2024-02-29T12:34:56+00:00[UTC]\", \"month\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:34:56+00:00[UTC]"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "month",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "month": {
          "value": {
            "seed": "2024-02-29T12:34:56+00:00[UTC]"
          }
        },
        "hours": {
          "value": {
            "seed": "2024-02-29T12:34:56+01:00[Europe/Berlin]"
          }
        },
        "hour": {
          "value": {
            "seed": "2024-10-27T01:15:00+00:00[Europe/London]"
          }
        },
        "day": {
          "value": {
            "seed": "2024-11-03T00:30:00-04:00[America/Havana]"
          }
        }
      }
    }
  },
  "getHoursInZonedDay": {
    "module": "zoned/calculate",
    "fn": "getHoursInZonedDay",
    "template": "getHoursInZonedDay(\"2024-03-31T12:00:00+01:00[Europe/London]\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-31T12:00:00+01:00[Europe/London]"
      }
    ]
  },
  "getLocaleZonedDayOfWeek": {
    "module": "zoned/calculate",
    "fn": "getLocaleZonedDayOfWeek",
    "template": "getLocaleZonedDayOfWeek(\"2024-02-25T12:00:00+00:00[UTC]\", \"pt-BR\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-25T12:00:00+00:00[UTC]"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "pt-BR"
      }
    ]
  },
  "getLocaleZonedEndOfWeek": {
    "module": "zoned/calculate",
    "fn": "getLocaleZonedEndOfWeek",
    "template": "getLocaleZonedEndOfWeek(\"2024-02-29T12:00:00+00:00[UTC]\", \"ja-JP\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:00:00+00:00[UTC]"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "ja-JP"
      }
    ]
  },
  "getLocaleZonedStartOfWeek": {
    "module": "zoned/calculate",
    "fn": "getLocaleZonedStartOfWeek",
    "template": "getLocaleZonedStartOfWeek(\"2024-02-29T12:00:00+00:00[UTC]\", \"hi-IN\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:00:00+00:00[UTC]"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "hi-IN"
      }
    ]
  },
  "getQuarterForZoned": {
    "module": "zoned/calculate",
    "fn": "getQuarterForZoned",
    "template": "getQuarterForZoned(\"2024-02-15T14:30:00+00:00[UTC]\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-15T14:30:00+00:00[UTC]"
      }
    ]
  },
  "maxZoned": {
    "module": "zoned/calculate",
    "fn": "maxZoned",
    "template": "maxZoned([\"2024-03-10T12:00:00[Asia/Kolkata]\", \"2024-03-15T12:00:00[Asia/Kolkata]\"])",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "zonedDateTimes",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "2024-03-10T12:00:00[Asia/Kolkata]",
          "2024-03-15T12:00:00[Asia/Kolkata]"
        ]
      }
    ]
  },
  "minZoned": {
    "module": "zoned/calculate",
    "fn": "minZoned",
    "template": "minZoned([\"2024-03-10T12:00:00[America/Sao_Paulo]\", \"2024-03-15T12:00:00[America/Sao_Paulo]\"])",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "zonedDateTimes",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "2024-03-10T12:00:00[America/Sao_Paulo]",
          "2024-03-15T12:00:00[America/Sao_Paulo]"
        ]
      }
    ]
  },
  "roundZoned": {
    "module": "zoned/calculate",
    "fn": "roundZoned",
    "template": "roundZoned(\"2024-06-15T12:34:56+02:00[Africa/Johannesburg]\", { smallestUnit: \"hour\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-06-15T12:34:56+02:00[Africa/Johannesburg]"
      }
    ],
    "optionsSuffix": "{ smallestUnit: \"hour\" }"
  },
  "setZoned": {
    "module": "zoned/calculate",
    "fn": "setZoned",
    "template": "setZoned(\"2024-03-10T12:00:00+09:00[Asia/Tokyo]\", { hour: 9 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-10T12:00:00+09:00[Asia/Tokyo]"
      },
      {
        "name": "fields",
        "kind": "units",
        "seed": "9",
        "unitKeys": [
          "year",
          "month",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ],
        "unitSeed": "hour"
      }
    ]
  },
  "sortZoned": {
    "module": "zoned/calculate",
    "fn": "sortZoned",
    "template": "sortZoned([\"2024-03-10T12:00:00[Australia/Sydney]\", \"2024-01-01T08:00:00[Australia/Sydney]\", \"2024-02-15T15:30:00[Australia/Sydney]\"])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "zonedDateTimes",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "2024-03-10T12:00:00[Australia/Sydney]",
          "2024-01-01T08:00:00[Australia/Sydney]",
          "2024-02-15T15:30:00[Australia/Sydney]"
        ]
      },
      {
        "name": "order",
        "kind": "enum",
        "seed": "",
        "choices": [
          "asc",
          "desc"
        ],
        "optional": true
      }
    ]
  },
  "startOfQuarterForZoned": {
    "module": "zoned/calculate",
    "fn": "startOfQuarterForZoned",
    "template": "startOfQuarterForZoned(\"2024-02-15T14:30:00+00:00[UTC]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-15T14:30:00+00:00[UTC]"
      }
    ]
  },
  "startOfZoned": {
    "module": "zoned/calculate",
    "fn": "startOfZoned",
    "template": "startOfZoned(\"2024-02-29T12:34:56+00:00[UTC]\", \"month\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:34:56+00:00[UTC]"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "month",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "month": {
          "value": {
            "seed": "2024-02-29T12:34:56+00:00[UTC]"
          }
        },
        "milliseconds": {
          "value": {
            "seed": "2024-02-29T12:34:56.789+01:00[Europe/Berlin]"
          }
        },
        "hour": {
          "value": {
            "seed": "2024-10-27T01:45:00+00:00[Europe/London]"
          }
        },
        "day": {
          "value": {
            "seed": "2024-11-03T00:30:00-05:00[America/Havana]"
          }
        }
      }
    }
  },
  "subtractZoned": {
    "module": "zoned/calculate",
    "fn": "subtractZoned",
    "template": "subtractZoned(\"2024-03-10T12:00:00+09:00[Asia/Tokyo]\", { days: 5 })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-10T12:00:00+09:00[Asia/Tokyo]"
      },
      {
        "name": "units",
        "kind": "units",
        "seed": "5",
        "unitKeys": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds"
        ],
        "unitSeed": "days"
      }
    ]
  },
  "subtractZonedBusinessDays": {
    "module": "zoned/calculate",
    "fn": "subtractZonedBusinessDays",
    "template": "subtractZonedBusinessDays(\"2024-03-18T14:30:00+02:00[Africa/Johannesburg]\", 1)",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-18T14:30:00+02:00[Africa/Johannesburg]"
      },
      {
        "name": "amount",
        "kind": "number",
        "seed": "1"
      }
    ]
  },
  "chopZonedDate": {
    "module": "zoned/chop",
    "fn": "chopZonedDate",
    "template": "chopZonedDate(\"2024-02-29T14:30:45.123+09:00[Asia/Tokyo]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T14:30:45.123+09:00[Asia/Tokyo]"
      }
    ]
  },
  "chopZonedDateTime": {
    "module": "zoned/chop",
    "fn": "chopZonedDateTime",
    "template": "chopZonedDateTime(\"2024-02-29T12:30:45+01:00[Europe/Paris]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:30:45+01:00[Europe/Paris]"
      }
    ]
  },
  "chopZonedMilliseconds": {
    "module": "zoned/chop",
    "fn": "chopZonedMilliseconds",
    "template": "chopZonedMilliseconds(\"2024-02-29T14:30:45.123+00:00[Europe/London]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T14:30:45.123+00:00[Europe/London]"
      }
    ]
  },
  "chopZonedSeconds": {
    "module": "zoned/chop",
    "fn": "chopZonedSeconds",
    "template": "chopZonedSeconds(\"2024-02-29T14:30:45.123+11:00[Australia/Sydney]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T14:30:45.123+11:00[Australia/Sydney]"
      }
    ]
  },
  "chopZonedTime": {
    "module": "zoned/chop",
    "fn": "chopZonedTime",
    "template": "chopZonedTime(\"2024-02-29T14:30:45.123-03:00[America/Sao_Paulo]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T14:30:45.123-03:00[America/Sao_Paulo]"
      }
    ]
  },
  "chopZonedTimezone": {
    "module": "zoned/chop",
    "fn": "chopZonedTimezone",
    "template": "chopZonedTimezone(\"2024-02-29T14:30:45.123+05:30[Asia/Kolkata]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T14:30:45.123+05:30[Asia/Kolkata]"
      }
    ]
  },
  "classifyStoredZoned": {
    "module": "zoned/classify",
    "fn": "classifyStoredZoned",
    "template": "classifyStoredZoned(\"2016-12-01T09:00:00+02:00[Europe/Istanbul]\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2016-12-01T09:00:00+02:00[Europe/Istanbul]"
      }
    ]
  },
  "areZonedEqual": {
    "module": "zoned/compare",
    "fn": "areZonedEqual",
    "template": "areZonedEqual(\"2024-02-29T12:34:56.789+00:00[UTC]\", \"2024-02-29T12:34:56.789+00:00[UTC]\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-02-29T12:34:56.789+00:00[UTC]"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-02-29T12:34:56.789+00:00[UTC]"
      }
    ]
  },
  "areZonedEqualBy": {
    "module": "zoned/compare",
    "fn": "areZonedEqualBy",
    "template": "areZonedEqualBy(\"2024-03-15T10:00:00+09:00[Asia/Tokyo]\", \"2024-03-15T20:00:00+01:00[Europe/Berlin]\", \"day\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-03-15T10:00:00+09:00[Asia/Tokyo]"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-03-15T20:00:00+01:00[Europe/Berlin]"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "day",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
          "year",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond",
          "microsecond",
          "nanosecond"
        ]
      }
    ]
  },
  "isAfterZoned": {
    "module": "zoned/compare",
    "fn": "isAfterZoned",
    "template": "isAfterZoned(\"2024-02-29T12:34:56.789+00:00[UTC]\", \"2024-02-29T12:34:56.788+00:00[UTC]\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-02-29T12:34:56.789+00:00[UTC]"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-02-29T12:34:56.788+00:00[UTC]"
      }
    ]
  },
  "isBeforeZoned": {
    "module": "zoned/compare",
    "fn": "isBeforeZoned",
    "template": "isBeforeZoned(\"2024-03-17T14:30:45+02:00[Africa/Johannesburg]\", \"2024-03-17T15:30:45+02:00[Africa/Johannesburg]\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-03-17T14:30:45+02:00[Africa/Johannesburg]"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-03-17T15:30:45+02:00[Africa/Johannesburg]"
      }
    ]
  },
  "isBetweenZoned": {
    "module": "zoned/compare",
    "fn": "isBetweenZoned",
    "template": "isBetweenZoned(\"2024-02-29T12:00:00+00:00[UTC]\", \"2024-02-29T11:00:00+00:00[UTC]\", \"2024-02-29T13:00:00+00:00[UTC]\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "zoned",
        "kind": "string",
        "seed": "2024-02-29T12:00:00+00:00[UTC]"
      },
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-02-29T11:00:00+00:00[UTC]"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-02-29T13:00:00+00:00[UTC]"
      }
    ]
  },
  "isInDaylightSaving": {
    "module": "zoned/compare",
    "fn": "isInDaylightSaving",
    "template": "isInDaylightSaving(\"2024-07-15T12:00:00+01:00[Europe/London]\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-07-15T12:00:00+01:00[Europe/London]"
      }
    ]
  },
  "isZonedBusinessDay": {
    "module": "zoned/compare",
    "fn": "isZonedBusinessDay",
    "template": "isZonedBusinessDay(\"2024-02-05T10:00:00+05:30[Asia/Kolkata]\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-05T10:00:00+05:30[Asia/Kolkata]"
      }
    ]
  },
  "isZonedFuture": {
    "module": "zoned/compare",
    "fn": "isZonedFuture",
    "template": "isZonedFuture(\"2999-01-01T00:00:00Z[UTC]\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2999-01-01T00:00:00Z[UTC]"
      }
    ]
  },
  "isZonedPast": {
    "module": "zoned/compare",
    "fn": "isZonedPast",
    "template": "isZonedPast(\"2020-01-01T00:00:00Z[UTC]\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2020-01-01T00:00:00Z[UTC]"
      }
    ]
  },
  "isZonedRelativeDay": {
    "module": "zoned/compare",
    "fn": "isZonedRelativeDay",
    "template": "isZonedRelativeDay(\"2024-03-15T10:00:00+09:00[Asia/Tokyo]\", 0)",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T10:00:00+09:00[Asia/Tokyo]"
      },
      {
        "name": "offsetDays",
        "kind": "number",
        "seed": "0"
      }
    ]
  },
  "isZonedThisUnit": {
    "module": "zoned/compare",
    "fn": "isZonedThisUnit",
    "template": "isZonedThisUnit(\"2024-03-15T10:00:00+11:00[Australia/Sydney]\", \"month\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T10:00:00+11:00[Australia/Sydney]"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "month",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "year",
          "month",
          "week",
          "day"
        ]
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "",
        "optional": true
      }
    ],
    "choiceSeeds": {
      "unit": {
        "month": {
          "value": {
            "seed": "2024-03-15T10:00:00+11:00[Australia/Sydney]"
          },
          "locale": {
            "seed": ""
          }
        },
        "week": {
          "value": {
            "seed": "2024-02-26T10:00:00+01:00[Europe/Paris]"
          },
          "locale": {
            "seed": "fr-FR"
          }
        },
        "months": {
          "value": {
            "seed": "2024-03-15T10:00:00+11:00[Australia/Sydney]"
          },
          "locale": {
            "seed": ""
          }
        }
      }
    }
  },
  "isZonedWeekend": {
    "module": "zoned/compare",
    "fn": "isZonedWeekend",
    "template": "isZonedWeekend(\"2024-02-03T10:00:00+00:00[Europe/London]\", \"en-GB\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-03T10:00:00+00:00[Europe/London]"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "en-GB"
      }
    ]
  },
  "convertPlainDateTimeToZoned": {
    "module": "zoned/convert",
    "fn": "convertPlainDateTimeToZoned",
    "template": "convertPlainDateTimeToZoned(\"2024-02-29T14:30:45\", \"Asia/Tokyo\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T14:30:45"
      },
      {
        "name": "timeZone",
        "kind": "enum",
        "seed": "Asia/Tokyo",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ],
    "choiceSeeds": {
      "timeZone": {
        "Asia/Tokyo": {
          "value": {
            "seed": "2024-02-29T14:30:45"
          }
        },
        "UTC": {
          "value": {
            "seed": "2024-02-29T14:30:45.123456789"
          }
        },
        "Australia/Sydney": {
          "value": {
            "seed": "2024-10-06T02:30:00"
          }
        },
        "Europe/London": {
          "value": {
            "seed": "2024-10-27T01:30:00"
          }
        }
      }
    }
  },
  "convertZonedToCalendar": {
    "module": "zoned/convert",
    "fn": "convertZonedToCalendar",
    "template": "convertZonedToCalendar(\"2024-10-03T14:30:45+01:00[Europe/London]\", \"hebrew\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-10-03T14:30:45+01:00[Europe/London]"
      },
      {
        "name": "calendar",
        "kind": "enum",
        "seed": "hebrew",
        "choices": [
          "iso8601",
          "gregory",
          "hebrew",
          "islamic-civil",
          "islamic-tbla",
          "islamic-umalqura",
          "japanese",
          "buddhist",
          "roc",
          "persian",
          "indian",
          "ethiopic",
          "ethioaa",
          "coptic"
        ]
      }
    ],
    "choiceSeeds": {
      "calendar": {
        "hebrew": {
          "value": {
            "seed": "2024-10-03T14:30:45+01:00[Europe/London]"
          }
        },
        "iso8601": {
          "value": {
            "seed": "2024-10-03T14:30:45+01:00[Europe/London][u-ca=hebrew]"
          }
        },
        "japanese": {
          "value": {
            "seed": "2024-10-03T14:30:45+09:00[Asia/Tokyo]"
          }
        },
        "roc": {
          "value": {
            "seed": "2024-10-03T14:30:45+08:00[Asia/Taipei]"
          }
        }
      }
    }
  },
  "convertZonedToPlainDateTime": {
    "module": "zoned/convert",
    "fn": "convertZonedToPlainDateTime",
    "template": "convertZonedToPlainDateTime(\"2024-02-29T14:30:45.123-03:00[America/Sao_Paulo]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T14:30:45.123-03:00[America/Sao_Paulo]"
      }
    ]
  },
  "convertZonedToUnix": {
    "module": "zoned/convert",
    "fn": "convertZonedToUnix",
    "template": "convertZonedToUnix(\"2024-02-29T12:34:56.789+00:00[UTC]\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:34:56.789+00:00[UTC]"
      }
    ]
  },
  "convertZonedToUtc": {
    "module": "zoned/convert",
    "fn": "convertZonedToUtc",
    "template": "convertZonedToUtc(\"2024-02-29T12:34:56.789+00:00[UTC]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:34:56.789+00:00[UTC]"
      }
    ]
  },
  "convertZonedToZoned": {
    "module": "zoned/convert",
    "fn": "convertZonedToZoned",
    "template": "convertZonedToZoned(\"2024-02-29T12:34:56.789+00:00[UTC]\", \"Asia/Kolkata\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:34:56.789+00:00[UTC]"
      },
      {
        "name": "timeZone",
        "kind": "enum",
        "seed": "Asia/Kolkata",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ]
  },
  "formatCalendarZoned": {
    "module": "zoned/format",
    "fn": "formatCalendarZoned",
    "template": "formatCalendarZoned(\"2026-03-16T14:30:00+00:00[Europe/London]\", \"en-GB\", { reference: \"2026-03-15T09:00:00+00:00[Europe/London]\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2026-03-16T14:30:00+00:00[Europe/London]"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "en-GB",
        "optional": true
      }
    ],
    "optionsSuffix": "{ reference: \"2026-03-15T09:00:00+00:00[Europe/London]\" }"
  },
  "formatRelativeZoned": {
    "module": "zoned/format",
    "fn": "formatRelativeZoned",
    "template": "formatRelativeZoned(\"2023-12-29T00:00:00+00:00[UTC]\", \"en-GB\", { reference: \"2024-02-29T00:00:00+00:00[UTC]\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2023-12-29T00:00:00+00:00[UTC]"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "en-GB",
        "optional": true
      }
    ],
    "optionsSuffix": "{ reference: \"2024-02-29T00:00:00+00:00[UTC]\" }"
  },
  "formatRfc2822": {
    "module": "zoned/format",
    "fn": "formatRfc2822",
    "template": "formatRfc2822(\"2024-03-15T14:30:00+05:30[Asia/Kolkata]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:00+05:30[Asia/Kolkata]"
      }
    ]
  },
  "formatRfc3339": {
    "module": "zoned/format",
    "fn": "formatRfc3339",
    "template": "formatRfc3339(\"2024-03-15T14:30:00-03:00[America/Sao_Paulo]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:00-03:00[America/Sao_Paulo]"
      }
    ]
  },
  "formatTimeZoneName": {
    "module": "zoned/format",
    "fn": "formatTimeZoneName",
    "template": "formatTimeZoneName(\"Australia/Sydney\", \"en-AU\", { style: \"shortGeneric\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "timeZone",
        "kind": "enum",
        "seed": "Australia/Sydney",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "en-AU"
      }
    ],
    "optionsSuffix": "{ style: \"shortGeneric\" }",
    "choiceSeeds": {
      "timeZone": {
        "Australia/Sydney": {
          "locale": {
            "seed": "en-AU"
          }
        },
        "Asia/Tokyo": {
          "locale": {
            "seed": "ja-JP"
          }
        }
      }
    }
  },
  "formatZonedDateTime": {
    "module": "zoned/format",
    "fn": "formatZonedDateTime",
    "template": "formatZonedDateTime(\"2024-02-29T12:34:56.789+00:00[UTC]\", \"de-DE\", { dateStyle: \"long\", timeStyle: \"long\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:34:56.789+00:00[UTC]"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "de-DE",
        "optional": true
      }
    ],
    "optionsSuffix": "{ dateStyle: \"long\", timeStyle: \"long\" }"
  },
  "formatZonedRange": {
    "module": "zoned/format",
    "fn": "formatZonedRange",
    "template": "formatZonedRange(\"2024-02-29T12:00:00.000+00:00[UTC]\", \"2024-02-29T14:00:00.000+00:00[UTC]\", \"de-DE\", { dateStyle: \"long\", timeStyle: \"short\" })",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "from",
        "kind": "string",
        "seed": "2024-02-29T12:00:00.000+00:00[UTC]"
      },
      {
        "name": "to",
        "kind": "string",
        "seed": "2024-02-29T14:00:00.000+00:00[UTC]"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "de-DE",
        "optional": true
      }
    ],
    "optionsSuffix": "{ dateStyle: \"long\", timeStyle: \"short\" }"
  },
  "formatZonedToParts": {
    "module": "zoned/format",
    "fn": "formatZonedToParts",
    "template": "formatZonedToParts(\"2024-03-15T14:30:00.000+00:00[Europe/London]\", \"en-GB\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:00.000+00:00[Europe/London]"
      },
      {
        "name": "locale",
        "kind": "string",
        "seed": "en-GB",
        "optional": true
      }
    ]
  },
  "getDstTransitions": {
    "module": "zoned/get",
    "fn": "getDstTransitions",
    "template": "getDstTransitions(\"Australia/Sydney\", 2024)",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "timeZone",
        "kind": "enum",
        "seed": "Australia/Sydney",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      },
      {
        "name": "year",
        "kind": "number",
        "seed": "2024"
      }
    ]
  },
  "getSystemTimeZone": {
    "module": "zoned/get",
    "fn": "getSystemTimeZone",
    "template": "getSystemTimeZone()",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": []
  },
  "getTimeZoneOffset": {
    "module": "zoned/get",
    "fn": "getTimeZoneOffset",
    "template": "getTimeZoneOffset(\"Australia/Sydney\", \"2024-07-15T12:00:00Z\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "timeZone",
        "kind": "enum",
        "seed": "Australia/Sydney",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      },
      {
        "name": "instant",
        "kind": "string",
        "seed": "2024-07-15T12:00:00Z"
      }
    ]
  },
  "getTimeZones": {
    "module": "zoned/get",
    "fn": "getTimeZones",
    "template": "getTimeZones()",
    "returnType": "array",
    "allowEmptyArray": false,
    "fields": []
  },
  "getZonedDay": {
    "module": "zoned/get",
    "fn": "getZonedDay",
    "template": "getZonedDay(\"Asia/Tokyo\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "ianaTimezone",
        "kind": "enum",
        "seed": "Asia/Tokyo",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ]
  },
  "getZonedDayOfWeek": {
    "module": "zoned/get",
    "fn": "getZonedDayOfWeek",
    "template": "getZonedDayOfWeek(\"Australia/Sydney\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "ianaTimezone",
        "kind": "enum",
        "seed": "Australia/Sydney",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ]
  },
  "getZonedHour": {
    "module": "zoned/get",
    "fn": "getZonedHour",
    "template": "getZonedHour(\"Africa/Johannesburg\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "ianaTimezone",
        "kind": "enum",
        "seed": "Africa/Johannesburg",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ]
  },
  "getZonedMicrosecond": {
    "module": "zoned/get",
    "fn": "getZonedMicrosecond",
    "template": "getZonedMicrosecond(\"Europe/London\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "ianaTimezone",
        "kind": "enum",
        "seed": "Europe/London",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ]
  },
  "getZonedMillisecond": {
    "module": "zoned/get",
    "fn": "getZonedMillisecond",
    "template": "getZonedMillisecond(\"America/Sao_Paulo\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "ianaTimezone",
        "kind": "enum",
        "seed": "Pacific/Honolulu",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ]
  },
  "getZonedMinute": {
    "module": "zoned/get",
    "fn": "getZonedMinute",
    "template": "getZonedMinute(\"Asia/Kolkata\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "ianaTimezone",
        "kind": "enum",
        "seed": "Asia/Kolkata",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ]
  },
  "getZonedMonth": {
    "module": "zoned/get",
    "fn": "getZonedMonth",
    "template": "getZonedMonth(\"Australia/Sydney\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "ianaTimezone",
        "kind": "enum",
        "seed": "Australia/Sydney",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ]
  },
  "getZonedNanosecond": {
    "module": "zoned/get",
    "fn": "getZonedNanosecond",
    "template": "getZonedNanosecond(\"Africa/Johannesburg\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "ianaTimezone",
        "kind": "enum",
        "seed": "Africa/Johannesburg",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ]
  },
  "getZonedNow": {
    "module": "zoned/get",
    "fn": "getZonedNow",
    "template": "getZonedNow(\"Asia/Tokyo\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "ianaTimezone",
        "kind": "enum",
        "seed": "Asia/Tokyo",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ]
  },
  "getZonedNowUnit": {
    "module": "zoned/get",
    "fn": "getZonedNowUnit",
    "template": "getZonedNowUnit(\"Asia/Tokyo\", \"hour\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "ianaTimezone",
        "kind": "enum",
        "seed": "Asia/Tokyo",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "hour",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
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
          "dayOfWeek"
        ]
      }
    ],
    "choiceSeeds": {
      "ianaTimezone": {
        "Asia/Tokyo": {
          "unit": {
            "seed": "hour"
          }
        },
        "UTC": {
          "unit": {
            "seed": "hours"
          }
        }
      },
      "unit": {
        "hour": {
          "ianaTimezone": {
            "seed": "Asia/Tokyo"
          }
        },
        "hours": {
          "ianaTimezone": {
            "seed": "UTC"
          }
        }
      }
    }
  },
  "getZonedSecond": {
    "module": "zoned/get",
    "fn": "getZonedSecond",
    "template": "getZonedSecond(\"Europe/London\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "ianaTimezone",
        "kind": "enum",
        "seed": "Europe/London",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ]
  },
  "getZonedToday": {
    "module": "zoned/get",
    "fn": "getZonedToday",
    "template": "getZonedToday(\"Asia/Kolkata\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "ianaTimezone",
        "kind": "enum",
        "seed": "Asia/Kolkata",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ]
  },
  "getZonedWeekOfYear": {
    "module": "zoned/get",
    "fn": "getZonedWeekOfYear",
    "template": "getZonedWeekOfYear(\"America/Sao_Paulo\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "ianaTimezone",
        "kind": "enum",
        "seed": "Pacific/Honolulu",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ]
  },
  "getZonedYear": {
    "module": "zoned/get",
    "fn": "getZonedYear",
    "template": "getZonedYear(\"Africa/Johannesburg\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "ianaTimezone",
        "kind": "enum",
        "seed": "Africa/Johannesburg",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ]
  },
  "intervalAbutsZoned": {
    "module": "zoned/interval",
    "fn": "intervalAbutsZoned",
    "template": "intervalAbutsZoned(\"2024-01-01T09:00:00+00:00[UTC]\", \"2024-06-30T12:00:00+00:00[UTC]\", \"2024-06-30T12:00:00+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T09:00:00+00:00[UTC]"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-06-30T12:00:00+00:00[UTC]"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-06-30T12:00:00+00:00[UTC]"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-12-31T17:00:00+00:00[UTC]"
      }
    ]
  },
  "intervalContainsZoned": {
    "module": "zoned/interval",
    "fn": "intervalContainsZoned",
    "template": "intervalContainsZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\", \"2024-06-15T12:00:00+00:00[UTC]\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "intervalStart",
        "kind": "string",
        "seed": "2024-01-01T00:00:00+00:00[UTC]"
      },
      {
        "name": "intervalEnd",
        "kind": "string",
        "seed": "2024-12-31T23:59:59+00:00[UTC]"
      },
      {
        "name": "pointOrStart",
        "kind": "string",
        "seed": "2024-06-15T12:00:00+00:00[UTC]"
      },
      {
        "name": "pointEnd",
        "kind": "string",
        "seed": "",
        "optional": true
      }
    ]
  },
  "intervalCountZoned": {
    "module": "zoned/interval",
    "fn": "intervalCountZoned",
    "template": "intervalCountZoned(\"2024-01-01T23:59:00+00:00[UTC]\", \"2024-01-02T00:01:00+00:00[UTC]\", \"day\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01T23:59:00+00:00[UTC]"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-01-02T00:01:00+00:00[UTC]"
      },
      {
        "name": "unit",
        "kind": "string",
        "seed": "day"
      }
    ]
  },
  "intervalDifferenceZoned": {
    "module": "zoned/interval",
    "fn": "intervalDifferenceZoned",
    "template": "intervalDifferenceZoned(\"2024-01-01T09:00:00+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\", \"2024-06-01T12:00:00+00:00[UTC]\", \"2024-07-01T13:00:00+00:00[UTC]\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T09:00:00+00:00[UTC]"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-12-31T17:00:00+00:00[UTC]"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-06-01T12:00:00+00:00[UTC]"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-07-01T13:00:00+00:00[UTC]"
      }
    ]
  },
  "intervalDivideEquallyZoned": {
    "module": "zoned/interval",
    "fn": "intervalDivideEquallyZoned",
    "template": "intervalDivideEquallyZoned(\"2024-10-05T12:00:00+10:00[Australia/Sydney]\", \"2024-10-07T12:00:00+11:00[Australia/Sydney]\", 2)",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-10-05T12:00:00+10:00[Australia/Sydney]"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-10-07T12:00:00+11:00[Australia/Sydney]"
      },
      {
        "name": "n",
        "kind": "number",
        "seed": "2"
      }
    ]
  },
  "intervalEngulfsZoned": {
    "module": "zoned/interval",
    "fn": "intervalEngulfsZoned",
    "template": "intervalEngulfsZoned(\"2024-01-01T09:00:00+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\", \"2024-06-01T12:00:00+00:00[UTC]\", \"2024-07-01T13:00:00+00:00[UTC]\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T09:00:00+00:00[UTC]"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-12-31T17:00:00+00:00[UTC]"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-06-01T12:00:00+00:00[UTC]"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-07-01T13:00:00+00:00[UTC]"
      }
    ]
  },
  "intervalFromDurationZoned": {
    "module": "zoned/interval",
    "fn": "intervalFromDurationZoned",
    "template": "intervalFromDurationZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"P1D\", \"start\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-01-01T00:00:00+00:00[UTC]"
      },
      {
        "name": "duration",
        "kind": "string",
        "seed": "P1D"
      },
      {
        "name": "anchor",
        "kind": "enum",
        "seed": "start",
        "choices": [
          "start",
          "end"
        ]
      }
    ],
    "choiceSeeds": {
      "anchor": {
        "start": {
          "value": {
            "seed": "2024-01-01T00:00:00+00:00[UTC]"
          },
          "duration": {
            "seed": "P1D"
          }
        },
        "end": {
          "value": {
            "seed": "2024-01-02T00:00:00+00:00[UTC]"
          },
          "duration": {
            "seed": "P1D"
          }
        }
      }
    }
  },
  "intervalIntersectionZoned": {
    "module": "zoned/interval",
    "fn": "intervalIntersectionZoned",
    "template": "intervalIntersectionZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-06-30T23:59:59+00:00[UTC]\", \"2024-04-01T00:00:00+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "nullIsEmpty": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T00:00:00+00:00[UTC]"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-06-30T23:59:59+00:00[UTC]"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-04-01T00:00:00+00:00[UTC]"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-12-31T23:59:59+00:00[UTC]"
      }
    ]
  },
  "intervalLengthZoned": {
    "module": "zoned/interval",
    "fn": "intervalLengthZoned",
    "template": "intervalLengthZoned(\"2024-03-31T00:00:00+00:00[Europe/London]\", \"2024-04-01T00:00:00+01:00[Europe/London]\", \"hour\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-03-31T00:00:00+00:00[Europe/London]"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-04-01T00:00:00+01:00[Europe/London]"
      },
      {
        "name": "unit",
        "kind": "string",
        "seed": "hour"
      }
    ]
  },
  "intervalOverlappingDaysZoned": {
    "module": "zoned/interval",
    "fn": "intervalOverlappingDaysZoned",
    "template": "intervalOverlappingDaysZoned(\"2024-03-30T12:00:00+00:00[Europe/London]\", \"2024-04-01T12:00:00+01:00[Europe/London]\", \"2024-03-30T12:00:00+00:00[Europe/London]\", \"2024-04-01T12:00:00+01:00[Europe/London]\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-03-30T12:00:00+00:00[Europe/London]"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-04-01T12:00:00+01:00[Europe/London]"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-03-30T12:00:00+00:00[Europe/London]"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-04-01T12:00:00+01:00[Europe/London]"
      }
    ]
  },
  "intervalSplitAtZoned": {
    "module": "zoned/interval",
    "fn": "intervalSplitAtZoned",
    "template": "intervalSplitAtZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-01-10T00:00:00+00:00[UTC]\", [\"2024-01-05T00:00:00+00:00[UTC]\"])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01T00:00:00+00:00[UTC]"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-01-10T00:00:00+00:00[UTC]"
      },
      {
        "name": "points",
        "kind": "list",
        "seed": "",
        "element": "string",
        "items": [
          "2024-01-05T00:00:00+00:00[UTC]"
        ]
      }
    ]
  },
  "intervalUnionZoned": {
    "module": "zoned/interval",
    "fn": "intervalUnionZoned",
    "template": "intervalUnionZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-06-30T23:59:59+00:00[UTC]\", \"2024-04-01T00:00:00+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\")",
    "returnType": "object",
    "allowEmptyArray": false,
    "nullIsEmpty": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T00:00:00+00:00[UTC]"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-06-30T23:59:59+00:00[UTC]"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-04-01T00:00:00+00:00[UTC]"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-12-31T23:59:59+00:00[UTC]"
      }
    ]
  },
  "intervalXorAllZoned": {
    "module": "zoned/interval",
    "fn": "intervalXorAllZoned",
    "template": "intervalXorAllZoned([{ start: \"2024-01-01T00:00:00+00:00[UTC]\", end: \"2024-01-10T00:00:00+00:00[UTC]\" }, { start: \"2024-01-05T00:00:00+00:00[UTC]\", end: \"2024-01-15T00:00:00+00:00[UTC]\" }])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "intervals",
        "kind": "intervals",
        "seed": "",
        "pairs": [
          [
            "2024-01-01T00:00:00+00:00[UTC]",
            "2024-01-10T00:00:00+00:00[UTC]"
          ],
          [
            "2024-01-05T00:00:00+00:00[UTC]",
            "2024-01-15T00:00:00+00:00[UTC]"
          ]
        ]
      }
    ]
  },
  "intervalXorZoned": {
    "module": "zoned/interval",
    "fn": "intervalXorZoned",
    "template": "intervalXorZoned(\"2024-01-01T09:00:00+00:00[UTC]\", \"2024-06-30T12:00:00+00:00[UTC]\", \"2024-04-01T11:00:00+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T09:00:00+00:00[UTC]"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-06-30T12:00:00+00:00[UTC]"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-04-01T11:00:00+00:00[UTC]"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-12-31T17:00:00+00:00[UTC]"
      }
    ]
  },
  "intervalsOverlapZoned": {
    "module": "zoned/interval",
    "fn": "intervalsOverlapZoned",
    "template": "intervalsOverlapZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-06-30T23:59:59+00:00[UTC]\", \"2024-04-01T00:00:00+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "aStart",
        "kind": "string",
        "seed": "2024-01-01T00:00:00+00:00[UTC]"
      },
      {
        "name": "aEnd",
        "kind": "string",
        "seed": "2024-06-30T23:59:59+00:00[UTC]"
      },
      {
        "name": "bStart",
        "kind": "string",
        "seed": "2024-04-01T00:00:00+00:00[UTC]"
      },
      {
        "name": "bEnd",
        "kind": "string",
        "seed": "2024-12-31T23:59:59+00:00[UTC]"
      }
    ]
  },
  "mergeIntervalsZoned": {
    "module": "zoned/interval",
    "fn": "mergeIntervalsZoned",
    "template": "mergeIntervalsZoned([{ start: \"2024-01-01T00:00:00+00:00[UTC]\", end: \"2024-01-10T00:00:00+00:00[UTC]\" }, { start: \"2024-01-05T00:00:00+00:00[UTC]\", end: \"2024-01-15T00:00:00+00:00[UTC]\" }])",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "intervals",
        "kind": "intervals",
        "seed": "",
        "pairs": [
          [
            "2024-01-01T00:00:00+00:00[UTC]",
            "2024-01-10T00:00:00+00:00[UTC]"
          ],
          [
            "2024-01-05T00:00:00+00:00[UTC]",
            "2024-01-15T00:00:00+00:00[UTC]"
          ]
        ]
      }
    ]
  },
  "splitIntervalByUnitZoned": {
    "module": "zoned/interval",
    "fn": "splitIntervalByUnitZoned",
    "template": "splitIntervalByUnitZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-01-02T00:00:00+00:00[UTC]\", \"hour\", 6)",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01T00:00:00+00:00[UTC]"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-01-02T00:00:00+00:00[UTC]"
      },
      {
        "name": "unit",
        "kind": "string",
        "seed": "hour"
      },
      {
        "name": "amount",
        "kind": "number",
        "seed": "6"
      }
    ]
  },
  "isValidCalendarZonedInterval": {
    "module": "zoned/interval",
    "fn": "isValidCalendarZonedInterval",
    "template": "isValidCalendarZonedInterval(\"2024-01-01T10:00:00+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01T10:00:00+00:00[UTC]"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-12-31T23:59:59+00:00[UTC]"
      }
    ]
  },
  "isValidZonedInterval": {
    "module": "zoned/interval",
    "fn": "isValidZonedInterval",
    "template": "isValidZonedInterval(\"2024-01-01T10:00:00+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "start",
        "kind": "string",
        "seed": "2024-01-01T10:00:00+00:00[UTC]"
      },
      {
        "name": "end",
        "kind": "string",
        "seed": "2024-12-31T23:59:59+00:00[UTC]"
      }
    ]
  },
  "mapZonedDatesInRange": {
    "module": "zoned/map",
    "fn": "mapZonedDatesInRange",
    "template": "mapZonedDatesInRange(\"+275760-09-12T00:00:00+00:00[UTC]\", \"+275760-09-13T00:00:00+00:00[UTC]\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "startZonedDateTime",
        "kind": "string",
        "seed": "+275760-09-12T00:00:00+00:00[UTC]"
      },
      {
        "name": "endZonedDateTime",
        "kind": "string",
        "seed": "+275760-09-13T00:00:00+00:00[UTC]"
      },
      {
        "name": "stepDays",
        "kind": "number",
        "seed": "",
        "optional": true
      }
    ]
  },
  "mapZonedHoursInDay": {
    "module": "zoned/map",
    "fn": "mapZonedHoursInDay",
    "template": "mapZonedHoursInDay(\"2024-02-29T12:34:56.789+00:00[UTC]\")",
    "returnType": "array",
    "allowEmptyArray": true,
    "fields": [
      {
        "name": "anchor",
        "kind": "string",
        "seed": "2024-02-29T12:34:56.789+00:00[UTC]"
      }
    ]
  },
  "getZonedOffset": {
    "module": "zoned/parse",
    "fn": "getZonedOffset",
    "template": "getZonedOffset(\"2024-02-29T12:34:56.789+00:00[UTC]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:34:56.789+00:00[UTC]"
      }
    ]
  },
  "getZonedOffsetAs": {
    "module": "zoned/parse",
    "fn": "getZonedOffsetAs",
    "template": "getZonedOffsetAs(\"2024-07-15T12:00:00-03:00[America/Sao_Paulo]\", \"minutes\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-07-15T12:00:00-03:00[America/Sao_Paulo]"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "minutes",
        "choices": [
          "minutes",
          "nanoseconds",
          "minute",
          "nanosecond"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "minutes": {
          "value": {
            "seed": "2024-07-15T12:00:00-03:00[America/Sao_Paulo]"
          }
        },
        "nanoseconds": {
          "value": {
            "seed": "2024-02-29T12:00:00+00:00[UTC]"
          }
        },
        "minute": {
          "value": {
            "seed": "2024-07-15T12:00:00-03:00[America/Sao_Paulo]"
          }
        }
      }
    }
  },
  "parseDateFromZoned": {
    "module": "zoned/parse",
    "fn": "parseDateFromZoned",
    "template": "parseDateFromZoned(\"2024-02-29T12:34:56.789+00:00[UTC]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:34:56.789+00:00[UTC]"
      }
    ]
  },
  "parseDateTimeFromZoned": {
    "module": "zoned/parse",
    "fn": "parseDateTimeFromZoned",
    "template": "parseDateTimeFromZoned(\"2024-02-29T12:34:56.789+00:00[UTC]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:34:56.789+00:00[UTC]"
      }
    ]
  },
  "parseDayFromZoned": {
    "module": "zoned/parse",
    "fn": "parseDayFromZoned",
    "template": "parseDayFromZoned(\"2024-03-15T14:30:45+00:00[UTC]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:45+00:00[UTC]"
      }
    ]
  },
  "parseDayOfWeekFromZoned": {
    "module": "zoned/parse",
    "fn": "parseDayOfWeekFromZoned",
    "template": "parseDayOfWeekFromZoned(\"2024-03-15T14:30:45+00:00[UTC]\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:45+00:00[UTC]"
      }
    ]
  },
  "parseHourFromZoned": {
    "module": "zoned/parse",
    "fn": "parseHourFromZoned",
    "template": "parseHourFromZoned(\"2024-03-15T14:30:45+00:00[UTC]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:45+00:00[UTC]"
      }
    ]
  },
  "parseMicrosecondFromZoned": {
    "module": "zoned/parse",
    "fn": "parseMicrosecondFromZoned",
    "template": "parseMicrosecondFromZoned(\"2024-03-15T14:30:45.123+00:00[UTC]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:45.123+00:00[UTC]"
      }
    ]
  },
  "parseMillisecondFromZoned": {
    "module": "zoned/parse",
    "fn": "parseMillisecondFromZoned",
    "template": "parseMillisecondFromZoned(\"2024-03-15T14:30:45.123+00:00[UTC]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:45.123+00:00[UTC]"
      }
    ]
  },
  "parseMinuteFromZoned": {
    "module": "zoned/parse",
    "fn": "parseMinuteFromZoned",
    "template": "parseMinuteFromZoned(\"2024-03-15T14:30:45+00:00[UTC]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:45+00:00[UTC]"
      }
    ]
  },
  "parseMonthFromZoned": {
    "module": "zoned/parse",
    "fn": "parseMonthFromZoned",
    "template": "parseMonthFromZoned(\"2024-03-15T14:30:45+00:00[UTC]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:45+00:00[UTC]"
      }
    ]
  },
  "parseNanosecondFromZoned": {
    "module": "zoned/parse",
    "fn": "parseNanosecondFromZoned",
    "template": "parseNanosecondFromZoned(\"2024-03-15T14:30:45.123+00:00[UTC]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:45.123+00:00[UTC]"
      }
    ]
  },
  "parseRfc2822": {
    "module": "zoned/parse",
    "fn": "parseRfc2822",
    "template": "parseRfc2822(\"Fri, 15 Mar 2024 14:30:00 -0400\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "Fri, 15 Mar 2024 14:30:00 -0400"
      }
    ]
  },
  "parseRfc3339": {
    "module": "zoned/parse",
    "fn": "parseRfc3339",
    "template": "parseRfc3339(\"2024-03-15T14:30:00-04:00\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:00-04:00"
      }
    ]
  },
  "parseSecondFromZoned": {
    "module": "zoned/parse",
    "fn": "parseSecondFromZoned",
    "template": "parseSecondFromZoned(\"2024-03-15T14:30:45+00:00[UTC]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:45+00:00[UTC]"
      }
    ]
  },
  "parseTimeFromZoned": {
    "module": "zoned/parse",
    "fn": "parseTimeFromZoned",
    "template": "parseTimeFromZoned(\"2024-02-29T12:34:56.789+00:00[UTC]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:34:56.789+00:00[UTC]"
      }
    ]
  },
  "parseTimeZoneFromZoned": {
    "module": "zoned/parse",
    "fn": "parseTimeZoneFromZoned",
    "template": "parseTimeZoneFromZoned(\"2024-02-29T12:34:56.789+00:00[UTC]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:34:56.789+00:00[UTC]"
      }
    ]
  },
  "parseUnitFromZoned": {
    "module": "zoned/parse",
    "fn": "parseUnitFromZoned",
    "template": "parseUnitFromZoned(\"2024-02-29T12:34:56.789+00:00[UTC]\", \"year\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:34:56.789+00:00[UTC]"
      },
      {
        "name": "unit",
        "kind": "enum",
        "seed": "year",
        "choices": [
          "years",
          "months",
          "weeks",
          "days",
          "hours",
          "minutes",
          "seconds",
          "milliseconds",
          "microseconds",
          "nanoseconds",
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
          "dayOfWeek",
          "timeZone"
        ]
      }
    ],
    "choiceSeeds": {
      "unit": {
        "year": {
          "value": {
            "seed": "2024-02-29T12:34:56.789+00:00[UTC]"
          }
        },
        "milliseconds": {
          "value": {
            "seed": "2024-02-29T12:34:56.789+00:00[UTC]"
          }
        },
        "week": {
          "value": {
            "seed": "2024-12-31T12:00:00+00:00[UTC]"
          }
        }
      }
    }
  },
  "parseWeekFromZoned": {
    "module": "zoned/parse",
    "fn": "parseWeekFromZoned",
    "template": "parseWeekFromZoned(\"2024-01-01T14:30:45.123+00:00[UTC]\")",
    "returnType": "number",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-01-01T14:30:45.123+00:00[UTC]"
      }
    ]
  },
  "parseYearFromZoned": {
    "module": "zoned/parse",
    "fn": "parseYearFromZoned",
    "template": "parseYearFromZoned(\"2024-03-15T14:30:45.123+00:00[UTC]\")",
    "returnType": "string",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:45.123+00:00[UTC]"
      }
    ]
  },
  "hasDaylightSaving": {
    "module": "zoned/validate",
    "fn": "hasDaylightSaving",
    "template": "hasDaylightSaving(\"Europe/London\", { at: \"2024-01-15T12:00:00Z\" })",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "timeZone",
        "kind": "enum",
        "seed": "Europe/London",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ],
    "optionsSuffix": "{ at: \"2024-01-15T12:00:00Z\" }"
  },
  "isValidCalendarZonedDateTime": {
    "module": "zoned/validate",
    "fn": "isValidCalendarZonedDateTime",
    "template": "isValidCalendarZonedDateTime(\"2024-10-03T14:30:45+02:00[Africa/Johannesburg]\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-10-03T14:30:45+02:00[Africa/Johannesburg]"
      }
    ]
  },
  "isValidRfc2822DateTime": {
    "module": "zoned/validate",
    "fn": "isValidRfc2822DateTime",
    "template": "isValidRfc2822DateTime(\"Fri, 15 Mar 2024 14:30:00 -0400\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "Fri, 15 Mar 2024 14:30:00 -0400"
      }
    ]
  },
  "isValidRfc3339DateTime": {
    "module": "zoned/validate",
    "fn": "isValidRfc3339DateTime",
    "template": "isValidRfc3339DateTime(\"2024-03-15T14:30:00-04:00\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-03-15T14:30:00-04:00"
      }
    ]
  },
  "isValidTimeZone": {
    "module": "zoned/validate",
    "fn": "isValidTimeZone",
    "template": "isValidTimeZone(\"Asia/Kolkata\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "timeZone",
        "kind": "enum",
        "seed": "Asia/Kolkata",
        "choices": [
          "Pacific/Honolulu",
          "America/Los_Angeles",
          "America/Denver",
          "America/Chicago",
          "America/New_York",
          "UTC",
          "Europe/London",
          "Europe/Paris",
          "Europe/Berlin",
          "Africa/Lagos",
          "Africa/Cairo",
          "Africa/Johannesburg",
          "Europe/Moscow",
          "Asia/Dubai",
          "Asia/Kolkata",
          "Asia/Shanghai",
          "Asia/Tokyo",
          "Australia/Adelaide",
          "Australia/Sydney",
          "Pacific/Auckland"
        ]
      }
    ]
  },
  "isValidZonedDateTime": {
    "module": "zoned/validate",
    "fn": "isValidZonedDateTime",
    "template": "isValidZonedDateTime(\"2024-02-29T12:34:56.789+00:00[UTC]\")",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value",
        "kind": "string",
        "seed": "2024-02-29T12:34:56.789+00:00[UTC]"
      }
    ]
  },
  "isValidZonedRange": {
    "module": "zoned/validate",
    "fn": "isValidZonedRange",
    "template": "isValidZonedRange({ value1: \"2024-01-01T10:00:00+00:00[UTC]\", value2: \"2024-12-31T23:59:59+00:00[UTC]\" })",
    "returnType": "boolean",
    "allowEmptyArray": false,
    "fields": [
      {
        "name": "value1",
        "kind": "string",
        "seed": "2024-01-01T10:00:00+00:00[UTC]"
      },
      {
        "name": "value2",
        "kind": "string",
        "seed": "2024-12-31T23:59:59+00:00[UTC]"
      }
    ],
    "objectArg": true
  }
};
