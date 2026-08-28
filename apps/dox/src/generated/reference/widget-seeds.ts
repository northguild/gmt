// GENERATED FILE — do not edit by hand.
// Produced by apps/dox/scripts/build-reference.ts (`nx run dox:generate`).
import type { WidgetSeed } from "~/reference-types";

export const widgetSeeds: WidgetSeed[] = [
  {
    "route": "/reference/duration/calculate/absDuration",
    "fnName": "absDuration",
    "examples": [
      {
        "call": "absDuration(\"-P1DT2H\")",
        "result": "\"P1DT2H\""
      },
      {
        "call": "absDuration(\"P1DT2H\")",
        "result": "\"P1DT2H\""
      },
      {
        "call": "absDuration(\"-P1Y2M\")",
        "result": "\"P1Y2M\" (no relativeTo needed)"
      },
      {
        "call": "absDuration(\"PT0S\")",
        "result": "\"PT0S\""
      },
      {
        "call": "absDuration(\"not a duration\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/duration/calculate/addDuration",
    "fnName": "addDuration",
    "examples": [
      {
        "call": "addDuration(\"P1D\", \"PT2H\")",
        "result": "\"P1DT2H\""
      },
      {
        "call": "addDuration(\"PT1H\", \"-PT2H\")",
        "result": "\"-PT1H\""
      },
      {
        "call": "addDuration(\"P1Y\", \"P1M\")",
        "result": "\"\" (calendar units need relativeTo, unsupported)"
      },
      {
        "call": "addDuration(\"P1D\", \"not a duration\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/duration/calculate/durationAs",
    "fnName": "durationAs",
    "examples": [
      {
        "call": "durationAs(\"P1DT2H30M\", \"hours\")",
        "result": "26.5"
      },
      {
        "call": "durationAs(\"P1DT2H30M\", \"minutes\")",
        "result": "1590"
      },
      {
        "call": "durationAs(\"PT36H\", \"days\")",
        "result": "1.5"
      },
      {
        "call": "durationAs(\"-PT90M\", \"hours\")",
        "result": "-1.5"
      },
      {
        "call": "durationAs(\"P1M\", \"days\")",
        "result": "null (calendar unit needs relativeTo)"
      },
      {
        "call": "durationAs(\"P1M\", \"days\", { relativeTo: \"2024-02-01\" })",
        "result": "29"
      },
      {
        "call": "durationAs(\"P1D\", \"hours\", { relativeTo: \"2024-03-10T00:00:00-05:00[America/New_York]\" })",
        "result": "23 (spring-forward)"
      },
      {
        "call": "durationAs(\"not a duration\", \"hours\")",
        "result": "null"
      },
      {
        "call": "durationAs(\"P1Y\", \"days\", { relativeTo: \"5784-06-15[u-ca=hebrew]\" })",
        "result": "385 (Hebrew leap year — relativeTo accepts GMT's calendar-annotated PlainDate string, not Temporal's own ISO-digit u-ca convention)"
      }
    ]
  },
  {
    "route": "/reference/duration/calculate/getDurationSign",
    "fnName": "getDurationSign",
    "examples": [
      {
        "call": "getDurationSign(\"P1DT2H\")",
        "result": "1"
      },
      {
        "call": "getDurationSign(\"-P1DT2H\")",
        "result": "-1"
      },
      {
        "call": "getDurationSign(\"PT0S\")",
        "result": "0"
      },
      {
        "call": "getDurationSign(\"-PT0S\")",
        "result": "0"
      },
      {
        "call": "getDurationSign(\"-P1Y\")",
        "result": "-1 (no relativeTo needed)"
      },
      {
        "call": "getDurationSign(\"not a duration\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/duration/calculate/getDurationUnit",
    "fnName": "getDurationUnit",
    "examples": [
      {
        "call": "getDurationUnit(\"P1DT2H30M\", \"hours\")",
        "result": "2"
      },
      {
        "call": "getDurationUnit(\"P1DT2H30M\", \"minutes\")",
        "result": "30"
      },
      {
        "call": "getDurationUnit(\"PT90M\", \"hours\")",
        "result": "0 (stored as minutes, not converted)"
      },
      {
        "call": "getDurationUnit(\"-P1DT2H\", \"hours\")",
        "result": "-2"
      },
      {
        "call": "getDurationUnit(\"P1M\", \"months\")",
        "result": "1 (no relativeTo needed to read a field)"
      },
      {
        "call": "getDurationUnit(\"PT0S\", \"days\")",
        "result": "0"
      },
      {
        "call": "getDurationUnit(\"not a duration\", \"hours\")",
        "result": "null"
      },
      {
        "call": "getDurationUnit(\"P1D\", \"fortnights\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/duration/calculate/negateDuration",
    "fnName": "negateDuration",
    "examples": [
      {
        "call": "negateDuration(\"P1DT2H\")",
        "result": "\"-P1DT2H\""
      },
      {
        "call": "negateDuration(\"-P1DT2H\")",
        "result": "\"P1DT2H\""
      },
      {
        "call": "negateDuration(\"P1Y2M\")",
        "result": "\"-P1Y2M\" (no relativeTo needed)"
      },
      {
        "call": "negateDuration(\"PT0S\")",
        "result": "\"PT0S\""
      },
      {
        "call": "negateDuration(\"not a duration\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/duration/calculate/subtractDuration",
    "fnName": "subtractDuration",
    "examples": [
      {
        "call": "subtractDuration(\"P1D\", \"PT2H\")",
        "result": "\"PT22H\""
      },
      {
        "call": "subtractDuration(\"PT1H\", \"PT2H\")",
        "result": "\"-PT1H\""
      },
      {
        "call": "subtractDuration(\"P1Y\", \"P1M\")",
        "result": "\"\" (calendar units need relativeTo, unsupported)"
      },
      {
        "call": "subtractDuration(\"P1D\", \"not a duration\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/duration/compare/compareDurations",
    "fnName": "compareDurations",
    "examples": [
      {
        "call": "compareDurations(\"PT1H\", \"PT30M\")",
        "result": "1"
      },
      {
        "call": "compareDurations(\"PT60M\", \"PT1H\")",
        "result": "0"
      },
      {
        "call": "compareDurations(\"-PT1H\", \"PT1H\")",
        "result": "-1"
      },
      {
        "call": "compareDurations(\"P1M\", \"P30D\")",
        "result": "null (calendar unit needs relativeTo)"
      },
      {
        "call": "compareDurations(\"P1M\", \"P30D\", { relativeTo: \"2024-01-01\" })",
        "result": "1"
      },
      {
        "call": "compareDurations(\"P1M\", \"P30D\", { relativeTo: \"2024-02-01\" })",
        "result": "-1"
      },
      {
        "call": "compareDurations(\"P1D\", \"PT24H\", { relativeTo: \"2024-03-10T00:00:00-05:00[America/New_York]\" })",
        "result": "-1 (spring-forward)"
      },
      {
        "call": "compareDurations(\"not a duration\", \"PT1H\")",
        "result": "null"
      },
      {
        "call": "compareDurations(\"P1M\", \"P30D\", { relativeTo: \"5785-04-15[u-ca=hebrew]\" })",
        "result": "-1 (Tevet, a 29-day Hebrew month — relativeTo accepts GMT's calendar-annotated PlainDate string, not Temporal's own ISO-digit u-ca convention)"
      }
    ]
  },
  {
    "route": "/reference/duration/format/formatDuration",
    "fnName": "formatDuration",
    "examples": [
      {
        "call": "formatDuration(\"P1DT2H30M\", \"en-US\")",
        "result": "\"1 day, 2 hours, and 30 minutes\""
      },
      {
        "call": "formatDuration(\"PT90M\", \"en-US\", { style: \"short\" })",
        "result": "\"90 min\""
      },
      {
        "call": "formatDuration(\"PT90M\", \"en-US\", { style: \"narrow\" })",
        "result": "\"90m\""
      },
      {
        "call": "formatDuration(\"P1DT0H30M\", \"en-US\")",
        "result": "\"1 day and 30 minutes\""
      },
      {
        "call": "formatDuration(\"PT0S\", \"en-US\")",
        "result": "\"0 seconds\""
      },
      {
        "call": "formatDuration(\"-P1DT2H\", \"en-US\")",
        "result": "\"-1 day and -2 hours\""
      },
      {
        "call": "formatDuration(\"P1DT2H30M\", \"de-DE\")",
        "result": "\"1 Tag, 2 Stunden und 30 Minuten\""
      },
      {
        "call": "formatDuration(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/duration/normalize/normalizeDuration",
    "fnName": "normalizeDuration",
    "examples": [
      {
        "call": "normalizeDuration(\"PT90M\", { largestUnit: \"hour\" })",
        "result": "\"PT1H30M\""
      },
      {
        "call": "normalizeDuration(\"PT90M30S\", { smallestUnit: \"minute\" })",
        "result": "\"PT91M\""
      },
      {
        "call": "normalizeDuration(\"P45D\", { largestUnit: \"month\" })",
        "result": "\"\" (relativeTo required)"
      },
      {
        "call": "normalizeDuration(\"P45D\", { largestUnit: \"month\", relativeTo: \"2024-01-01\" })",
        "result": "\"P1M14D\""
      },
      {
        "call": "normalizeDuration(\"invalid\")",
        "result": "\"\""
      },
      {
        "call": "normalizeDuration(\"P400D\", { largestUnit: \"year\", relativeTo: \"5784-06-15[u-ca=hebrew]\" })",
        "result": "\"P1Y15D\" (Hebrew leap year — relativeTo accepts GMT's calendar-annotated PlainDate string, not Temporal's own ISO-digit u-ca convention)"
      }
    ]
  },
  {
    "route": "/reference/duration/parse/parseDuration",
    "fnName": "parseDuration",
    "examples": [
      {
        "call": "parseDuration(\"P1DT2H30M\")",
        "result": "\"P1DT2H30M\""
      },
      {
        "call": "parseDuration(\"PT1.5S\")",
        "result": "\"PT1.5S\""
      },
      {
        "call": "parseDuration(\"PT1.5S\", { smallestUnit: \"second\" })",
        "result": "\"PT1S\""
      },
      {
        "call": "parseDuration(\"PT1.5S\", { fractionalSecondDigits: 3 })",
        "result": "\"PT1.500S\""
      },
      {
        "call": "parseDuration(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/duration/validate/isValidDuration",
    "fnName": "isValidDuration",
    "examples": [
      {
        "call": "isValidDuration(\"P1DT2H30M\")",
        "result": "true"
      },
      {
        "call": "isValidDuration(\"PT0S\")",
        "result": "true"
      },
      {
        "call": "isValidDuration(\"-P1D\")",
        "result": "true"
      },
      {
        "call": "isValidDuration(\"not a duration\")",
        "result": "false"
      },
      {
        "call": "isValidDuration(\"\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/addBusinessDays",
    "fnName": "addBusinessDays",
    "examples": [
      {
        "call": "addBusinessDays(\"2024-03-15\", 1)",
        "result": "\"2024-03-18\""
      },
      {
        "call": "addBusinessDays(\"2024-03-16\", 1)",
        "result": "\"2024-03-18\""
      },
      {
        "call": "addBusinessDays(\"2024-03-15\", 0)",
        "result": "\"2024-03-15\""
      },
      {
        "call": "addBusinessDays(\"invalid\", 1)",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/addDate",
    "fnName": "addDate",
    "examples": [
      {
        "call": "addDate(\"2024-03-10\", { days: 5 })",
        "result": "\"2024-03-15\""
      },
      {
        "call": "addDate(\"invalid\", { days: 5 })",
        "result": "\"\""
      },
      {
        "call": "addDate(\"2024-01-31\", { months: 1 }, { overflow: \"constrain\" })",
        "result": "\"2024-02-29\""
      },
      {
        "call": "addDate(\"2024-01-31\", { months: 1 }, { overflow: \"reject\" })",
        "result": "\"\""
      },
      {
        "call": "addDate(\"5784-06-15[u-ca=hebrew]\", { months: 1 })",
        "result": "\"5784-07-15[u-ca=hebrew]\" (Adar I -> Adar, both 30 days)"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/addDateTime",
    "fnName": "addDateTime",
    "examples": [
      {
        "call": "addDateTime(\"2024-03-10T12:00:00\", { days: 5 })",
        "result": "\"2024-03-15T12:00:00\""
      },
      {
        "call": "addDateTime(\"invalid\", { days: 5 })",
        "result": "\"\""
      },
      {
        "call": "addDateTime(\"2024-01-31T12:00:00\", { months: 1 }, { overflow: \"reject\" })",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/addTime",
    "fnName": "addTime",
    "examples": [
      {
        "call": "addTime(\"12:00:00\", { hours: 1 })",
        "result": "\"13:00:00\""
      },
      {
        "call": "addTime(\"invalid\", { hours: 1 })",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/clampDate",
    "fnName": "clampDate",
    "examples": [
      {
        "call": "clampDate(\"2024-03-15\", \"2024-03-01\", \"2024-03-31\")",
        "result": "\"2024-03-15\""
      },
      {
        "call": "clampDate(\"2024-02-01\", \"2024-03-01\", \"2024-03-31\")",
        "result": "\"2024-03-01\""
      },
      {
        "call": "clampDate(\"2024-05-01\", \"2024-03-01\", \"2024-03-31\")",
        "result": "\"2024-03-31\""
      },
      {
        "call": "clampDate(\"2024-03-15\", \"2024-03-31\", \"2024-03-01\")",
        "result": "\"\""
      },
      {
        "call": "clampDate(\"invalid\", \"2024-03-01\", \"2024-03-31\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/closestDateTo",
    "fnName": "closestDateTo",
    "examples": [
      {
        "call": "closestDateTo(\"2024-03-15\", [\"2024-03-01\", \"2024-03-20\", \"2024-03-18\"])",
        "result": "\"2024-03-18\""
      },
      {
        "call": "closestDateTo(\"2024-03-15\", [\"2024-03-01\", \"2024-03-29\"])",
        "result": "\"2024-03-01\""
      },
      {
        "call": "closestDateTo(\"2024-03-15\", [])",
        "result": "null"
      },
      {
        "call": "closestDateTo(\"invalid\", [\"2024-03-01\"])",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/cycleDate",
    "fnName": "cycleDate",
    "examples": [
      {
        "call": "cycleDate(\"2024-06-15\", \"month\", 1)",
        "result": "\"2024-07-15\""
      },
      {
        "call": "cycleDate(\"2024-12-15\", \"month\", 1)",
        "result": "\"2024-01-15\" (wraps, stays in the same year)"
      },
      {
        "call": "cycleDate(\"2024-12-31\", \"day\", 1)",
        "result": "\"2024-12-01\" (wraps within the same month)"
      },
      {
        "call": "cycleDate(\"2024-01-15\", \"month\", 13)",
        "result": "\"2024-02-15\" (amount larger than the range)"
      },
      {
        "call": "cycleDate(\"2024-01-31\", \"month\", 1)",
        "result": "\"2024-02-29\" (constrain clamps the day)"
      },
      {
        "call": "cycleDate(\"2024-01-31\", \"month\", 1, { overflow: \"reject\" })",
        "result": "\"\""
      },
      {
        "call": "cycleDate(\"2022-02-03\", \"year\", 5, { round: true })",
        "result": "\"2025-02-03\""
      },
      {
        "call": "cycleDate(\"2024-06-15\", \"week\", 1)",
        "result": "\"\" (\"week\" is not a cyclable date field)"
      },
      {
        "call": "cycleDate(\"invalid\", \"month\", 1)",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/cycleDateTime",
    "fnName": "cycleDateTime",
    "examples": [
      {
        "call": "cycleDateTime(\"2024-06-15T09:30:00\", \"hour\", 1)",
        "result": "\"2024-06-15T10:30:00\""
      },
      {
        "call": "cycleDateTime(\"2024-12-15T23:30:00\", \"month\", 1)",
        "result": "\"2024-01-15T23:30:00\" (wraps, stays in the same year)"
      },
      {
        "call": "cycleDateTime(\"2024-12-15T23:30:00\", \"hour\", 1)",
        "result": "\"2024-12-15T00:30:00\" (wraps, stays on the same day)"
      },
      {
        "call": "cycleDateTime(\"2024-06-15T09:22:00\", \"minute\", 15, { round: true })",
        "result": "\"2024-06-15T09:30:00\""
      },
      {
        "call": "cycleDateTime(\"2024-06-15T09:30:00\", \"week\", 1)",
        "result": "\"\" (\"week\" is not a cyclable field)"
      },
      {
        "call": "cycleDateTime(\"invalid\", \"hour\", 1)",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/cycleTime",
    "fnName": "cycleTime",
    "examples": [
      {
        "call": "cycleTime(\"09:30:00\", \"hour\", 1)",
        "result": "\"10:30:00\""
      },
      {
        "call": "cycleTime(\"23:00:00\", \"hour\", 1)",
        "result": "\"00:00:00\" (wraps)"
      },
      {
        "call": "cycleTime(\"00:00:00\", \"hour\", 25)",
        "result": "\"01:00:00\" (amount larger than the range)"
      },
      {
        "call": "cycleTime(\"09:22:00\", \"minute\", 15, { round: true })",
        "result": "\"09:30:00\""
      },
      {
        "call": "cycleTime(\"09:30:00\", \"year\", 1)",
        "result": "\"\" (\"year\" is not a cyclable time field)"
      },
      {
        "call": "cycleTime(\"invalid\", \"hour\", 1)",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/diffDate",
    "fnName": "diffDate",
    "examples": [
      {
        "call": "diffDate(\"2024-03-10\", \"2024-03-15\", \"day\")",
        "result": "5"
      },
      {
        "call": "diffDate(\"invalid\", \"2024-03-15\", \"day\")",
        "result": "null"
      },
      {
        "call": "diffDate(\"2024-01-01\", \"2024-01-16\", \"week\", { smallestUnit: \"week\", roundingMode: \"halfExpand\" })",
        "result": "2"
      },
      {
        "call": "diffDate(\"5784-06-15[u-ca=hebrew]\", \"5784-07-15[u-ca=hebrew]\", \"months\")",
        "result": "1 (measured in Hebrew, Adar I -> Adar)"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/diffDateAsDuration",
    "fnName": "diffDateAsDuration",
    "examples": [
      {
        "call": "diffDateAsDuration(\"2024-03-10\", \"2024-04-05\", \"days\")",
        "result": "\"P26D\""
      },
      {
        "call": "diffDateAsDuration(\"2024-01-01\", \"2023-01-01\", \"days\")",
        "result": "\"-P365D\""
      },
      {
        "call": "diffDateAsDuration(\"2024-01-01\", \"2024-01-01\", \"days\")",
        "result": "\"PT0S\""
      },
      {
        "call": "diffDateAsDuration(\"invalid\", \"2024-03-15\", \"days\")",
        "result": "\"\""
      },
      {
        "call": "diffDateAsDuration(\"2024-01-01\", \"2024-01-16\", \"weeks\", { smallestUnit: \"weeks\", roundingMode: \"halfExpand\" })",
        "result": "\"P2W\""
      },
      {
        "call": "diffDateAsDuration(\"5784-06-15[u-ca=hebrew]\", \"5784-07-15[u-ca=hebrew]\", \"months\")",
        "result": "\"P1M\" (measured in Hebrew, Adar I -> Adar)"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/diffDateTime",
    "fnName": "diffDateTime",
    "examples": [
      {
        "call": "diffDateTime(\"2024-03-10T12:00:00\", \"2024-03-15T12:00:00\", \"day\")",
        "result": "5"
      },
      {
        "call": "diffDateTime(\"invalid\", \"2024-03-15T12:00:00\", \"day\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/diffDateTimeAsDuration",
    "fnName": "diffDateTimeAsDuration",
    "examples": [
      {
        "call": "diffDateTimeAsDuration(\"2024-03-10T00:00:00\", \"2024-03-11T02:00:00\", \"days\")",
        "result": "\"P1DT2H\""
      },
      {
        "call": "diffDateTimeAsDuration(\"2024-03-11T02:00:00\", \"2024-03-10T00:00:00\", \"days\")",
        "result": "\"-P1DT2H\""
      },
      {
        "call": "diffDateTimeAsDuration(\"2024-01-01T00:00:00\", \"2024-01-01T00:00:00\", \"days\")",
        "result": "\"PT0S\""
      },
      {
        "call": "diffDateTimeAsDuration(\"invalid\", \"2024-03-15T12:00:00\", \"days\")",
        "result": "\"\""
      },
      {
        "call": "diffDateTimeAsDuration(\"2024-02-29T00:00:00\", \"2024-02-29T01:30:00\", \"hours\", { smallestUnit: \"hours\", roundingMode: \"halfExpand\" })",
        "result": "\"PT2H\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/diffTime",
    "fnName": "diffTime",
    "examples": [
      {
        "call": "diffTime(\"12:00:00\", \"14:30:00\", \"hour\")",
        "result": "2"
      },
      {
        "call": "diffTime(\"invalid\", \"14:30:00\", \"hour\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/endOfDate",
    "fnName": "endOfDate",
    "examples": [
      {
        "call": "endOfDate(\"2024-02-29\", \"month\")",
        "result": "\"2024-02-29\""
      },
      {
        "call": "endOfDate(\"invalid-date\", \"month\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/endOfDateTime",
    "fnName": "endOfDateTime",
    "examples": [
      {
        "call": "endOfDateTime(\"2024-02-29T12:34:56\", \"month\")",
        "result": "\"2024-02-29T23:59:59.999999999\""
      },
      {
        "call": "endOfDateTime(\"invalid-date\", \"month\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/endOfQuarterForDate",
    "fnName": "endOfQuarterForDate",
    "examples": [
      {
        "call": "endOfQuarterForDate(\"2024-03-15\")",
        "result": "\"2024-03-31\""
      },
      {
        "call": "endOfQuarterForDate(\"2024-06-15\")",
        "result": "\"2024-06-30\""
      },
      {
        "call": "endOfQuarterForDate(\"2024-09-15\")",
        "result": "\"2024-09-30\""
      },
      {
        "call": "endOfQuarterForDate(\"2024-12-15\")",
        "result": "\"2024-12-31\""
      },
      {
        "call": "endOfQuarterForDate(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/endOfQuarterForDateTime",
    "fnName": "endOfQuarterForDateTime",
    "examples": [
      {
        "call": "endOfQuarterForDateTime(\"2024-03-15T12:00:00\")",
        "result": "\"2024-03-31T23:59:59.999999999\""
      },
      {
        "call": "endOfQuarterForDateTime(\"2024-06-15T12:00:00\")",
        "result": "\"2024-06-30T23:59:59.999999999\""
      },
      {
        "call": "endOfQuarterForDateTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/endOfTime",
    "fnName": "endOfTime",
    "examples": [
      {
        "call": "endOfTime(\"12:34:56\", \"hour\")",
        "result": "\"12:59:59.999999999\""
      },
      {
        "call": "endOfTime(\"invalid\", \"hour\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/getDayOfYear",
    "fnName": "getDayOfYear",
    "examples": [
      {
        "call": "getDayOfYear(\"2024-01-01\")",
        "result": "1"
      },
      {
        "call": "getDayOfYear(\"2024-12-31\")",
        "result": "366 (leap year)"
      },
      {
        "call": "getDayOfYear(\"2023-12-31\")",
        "result": "365"
      },
      {
        "call": "getDayOfYear(\"2024-03-01\")",
        "result": "61 (after the Feb 29 leap day)"
      },
      {
        "call": "getDayOfYear(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/getDaysInMonth",
    "fnName": "getDaysInMonth",
    "examples": [
      {
        "call": "getDaysInMonth(\"2024-02-15\")",
        "result": "29 (leap year)"
      },
      {
        "call": "getDaysInMonth(\"2023-02-15\")",
        "result": "28"
      },
      {
        "call": "getDaysInMonth(\"2024-04-01\")",
        "result": "30"
      },
      {
        "call": "getDaysInMonth(\"2024-01-01\")",
        "result": "31"
      },
      {
        "call": "getDaysInMonth(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/getDaysInYear",
    "fnName": "getDaysInYear",
    "examples": [
      {
        "call": "getDaysInYear(\"2024-06-15\")",
        "result": "366 (leap year)"
      },
      {
        "call": "getDaysInYear(\"2023-06-15\")",
        "result": "365"
      },
      {
        "call": "getDaysInYear(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/getLargestDateDurationUnit",
    "fnName": "getLargestDateDurationUnit",
    "examples": [
      {
        "call": "getLargestDateDurationUnit([\"months\", \"days\"])",
        "result": "\"months\""
      },
      {
        "call": "getLargestDateDurationUnit([\"weeks\", \"days\"])",
        "result": "\"weeks\""
      },
      {
        "call": "getLargestDateDurationUnit([\"days\"])",
        "result": "\"days\""
      },
      {
        "call": "getLargestDateDurationUnit([])",
        "result": "\"days\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/getLargestDateTimeDurationUnit",
    "fnName": "getLargestDateTimeDurationUnit",
    "examples": [
      {
        "call": "getLargestDateTimeDurationUnit([\"hours\", \"minutes\", \"seconds\"])",
        "result": "\"hours\""
      },
      {
        "call": "getLargestDateTimeDurationUnit([\"minutes\", \"seconds\"])",
        "result": "\"minutes\""
      },
      {
        "call": "getLargestDateTimeDurationUnit([\"seconds\"])",
        "result": "\"seconds\""
      },
      {
        "call": "getLargestDateTimeDurationUnit([])",
        "result": "\"seconds\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/getLargestTimeDurationUnit",
    "fnName": "getLargestTimeDurationUnit",
    "examples": [
      {
        "call": "getLargestTimeDurationUnit([\"minutes\", \"seconds\"])",
        "result": "\"minutes\""
      },
      {
        "call": "getLargestTimeDurationUnit([\"seconds\", \"milliseconds\"])",
        "result": "\"seconds\""
      },
      {
        "call": "getLargestTimeDurationUnit([\"milliseconds\", \"microseconds\"])",
        "result": "\"milliseconds\""
      },
      {
        "call": "getLargestTimeDurationUnit([])",
        "result": "\"seconds\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/getLocaleDayOfWeek",
    "fnName": "getLocaleDayOfWeek",
    "examples": [
      {
        "call": "getLocaleDayOfWeek(\"2024-02-25\", \"en-US\")",
        "result": "0 (Sunday)"
      },
      {
        "call": "getLocaleDayOfWeek(\"2024-02-26\", \"en-US\")",
        "result": "1 (Monday)"
      },
      {
        "call": "getLocaleDayOfWeek(\"2024-02-26\", \"fr-FR\")",
        "result": "0 (Monday)"
      },
      {
        "call": "getLocaleDayOfWeek(\"invalid-date\", \"en-US\")",
        "result": "null"
      },
      {
        "call": "getLocaleDayOfWeek(\"2024-02-29\", \"not-a-locale\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/getLocaleEndOfWeek",
    "fnName": "getLocaleEndOfWeek",
    "examples": [
      {
        "call": "getLocaleEndOfWeek(\"2024-02-29\", \"en-US\")",
        "result": "\"2024-03-02\" (Saturday)"
      },
      {
        "call": "getLocaleEndOfWeek(\"2024-02-29\", \"fr-FR\")",
        "result": "\"2024-03-03\" (Sunday)"
      },
      {
        "call": "getLocaleEndOfWeek(\"invalid-date\", \"en-US\")",
        "result": "\"\""
      },
      {
        "call": "getLocaleEndOfWeek(\"2024-02-29\", \"not-a-locale\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/getLocaleStartOfWeek",
    "fnName": "getLocaleStartOfWeek",
    "examples": [
      {
        "call": "getLocaleStartOfWeek(\"2024-02-29\", \"en-US\")",
        "result": "\"2024-02-25\" (Sunday)"
      },
      {
        "call": "getLocaleStartOfWeek(\"2024-02-29\", \"fr-FR\")",
        "result": "\"2024-02-26\" (Monday)"
      },
      {
        "call": "getLocaleStartOfWeek(\"invalid-date\", \"en-US\")",
        "result": "\"\""
      },
      {
        "call": "getLocaleStartOfWeek(\"2024-02-29\", \"not-a-locale\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/getLocaleWeekYear",
    "fnName": "getLocaleWeekYear",
    "examples": [
      {
        "call": "getLocaleWeekYear(\"2024-06-15\", \"en-US\")",
        "result": "2024"
      },
      {
        "call": "getLocaleWeekYear(\"2022-01-01\", \"en-US\")",
        "result": "2022 (Jan 1 is always week 1 in en-US)"
      },
      {
        "call": "getLocaleWeekYear(\"2022-01-01\", \"de-DE\")",
        "result": "2021 (ISO-style: Jan 1, 2022 is a Saturday, in week 52 of 2021)"
      },
      {
        "call": "getLocaleWeekYear(\"invalid\", \"en-US\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/getQuarterForDate",
    "fnName": "getQuarterForDate",
    "examples": [
      {
        "call": "getQuarterForDate(\"2024-01-15\")",
        "result": "1"
      },
      {
        "call": "getQuarterForDate(\"2024-04-15\")",
        "result": "2"
      },
      {
        "call": "getQuarterForDate(\"2024-07-15\")",
        "result": "3"
      },
      {
        "call": "getQuarterForDate(\"2024-10-15\")",
        "result": "4"
      },
      {
        "call": "getQuarterForDate(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/getQuarterForDateTime",
    "fnName": "getQuarterForDateTime",
    "examples": [
      {
        "call": "getQuarterForDateTime(\"2024-01-15T12:00:00\")",
        "result": "1"
      },
      {
        "call": "getQuarterForDateTime(\"2024-04-15T12:00:00\")",
        "result": "2"
      },
      {
        "call": "getQuarterForDateTime(\"2024-07-15T12:00:00\")",
        "result": "3"
      },
      {
        "call": "getQuarterForDateTime(\"2024-10-15T12:00:00\")",
        "result": "4"
      },
      {
        "call": "getQuarterForDateTime(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/getWeekNumber",
    "fnName": "getWeekNumber",
    "examples": [
      {
        "call": "getWeekNumber(\"2024-01-01\")",
        "result": "1"
      },
      {
        "call": "getWeekNumber(\"2024-01-08\")",
        "result": "2"
      },
      {
        "call": "getWeekNumber(\"2024-12-31\")",
        "result": "1"
      },
      {
        "call": "getWeekNumber(\"2024-01-01\", \"sunday\")",
        "result": "1"
      },
      {
        "call": "getWeekNumber(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/getWeekOfMonth",
    "fnName": "getWeekOfMonth",
    "examples": [
      {
        "call": "getWeekOfMonth(\"2024-02-01\", \"en-US\")",
        "result": "1"
      },
      {
        "call": "getWeekOfMonth(\"2024-02-29\", \"en-US\")",
        "result": "5"
      },
      {
        "call": "getWeekOfMonth(\"2026-02-01\", \"en-US\")",
        "result": "1"
      },
      {
        "call": "getWeekOfMonth(\"2026-02-01\", \"en-GB\")",
        "result": "1"
      },
      {
        "call": "getWeekOfMonth(\"invalid\", \"en-US\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/getWeekYear",
    "fnName": "getWeekYear",
    "examples": [
      {
        "call": "getWeekYear(\"2024-06-15\")",
        "result": "2024"
      },
      {
        "call": "getWeekYear(\"2024-12-30\")",
        "result": "2025 (Monday of ISO week 1, 2025)"
      },
      {
        "call": "getWeekYear(\"2021-01-01\")",
        "result": "2020 (belongs to ISO week 53 of 2020)"
      },
      {
        "call": "getWeekYear(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/getWeeksInLocaleWeekYear",
    "fnName": "getWeeksInLocaleWeekYear",
    "examples": [
      {
        "call": "getWeeksInLocaleWeekYear(\"2024-06-15\", \"en-US\")",
        "result": "52"
      },
      {
        "call": "getWeeksInLocaleWeekYear(\"2020-06-15\", \"de-DE\")",
        "result": "53"
      },
      {
        "call": "getWeeksInLocaleWeekYear(\"invalid\", \"en-US\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/getWeeksInMonth",
    "fnName": "getWeeksInMonth",
    "examples": [
      {
        "call": "getWeeksInMonth(\"2024-02-15\", \"en-US\")",
        "result": "5"
      },
      {
        "call": "getWeeksInMonth(\"2026-02-15\", \"en-US\")",
        "result": "4"
      },
      {
        "call": "getWeeksInMonth(\"2026-02-15\", \"en-GB\")",
        "result": "5"
      },
      {
        "call": "getWeeksInMonth(\"invalid\", \"en-US\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/getWeeksInYear",
    "fnName": "getWeeksInYear",
    "examples": [
      {
        "call": "getWeeksInYear(\"2024-06-15\")",
        "result": "52"
      },
      {
        "call": "getWeeksInYear(\"2020-06-15\")",
        "result": "53"
      },
      {
        "call": "getWeeksInYear(\"2021-01-01\")",
        "result": "53 (belongs to ISO week-year 2020)"
      },
      {
        "call": "getWeeksInYear(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/maxDate",
    "fnName": "maxDate",
    "examples": [
      {
        "call": "maxDate([\"2024-03-10\", \"2024-03-15\", \"2024-03-12\"])",
        "result": "\"2024-03-15\""
      },
      {
        "call": "maxDate([])",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/maxDateTime",
    "fnName": "maxDateTime",
    "examples": [
      {
        "call": "maxDateTime([\"2024-03-10T12:00:00\", \"2024-03-15T12:00:00\", \"2024-03-12T12:00:00\"])",
        "result": "\"2024-03-15T12:00:00\""
      },
      {
        "call": "maxDateTime([])",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/maxTime",
    "fnName": "maxTime",
    "examples": [
      {
        "call": "maxTime([\"14:30:00\", \"09:00:00\", \"20:45:00\"])",
        "result": "\"20:45:00\""
      },
      {
        "call": "maxTime([])",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/minDate",
    "fnName": "minDate",
    "examples": [
      {
        "call": "minDate([\"2024-03-10\", \"2024-03-15\", \"2024-03-12\"])",
        "result": "\"2024-03-10\""
      },
      {
        "call": "minDate([])",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/minDateTime",
    "fnName": "minDateTime",
    "examples": [
      {
        "call": "minDateTime([\"2024-03-10T12:00:00\", \"2024-03-15T12:00:00\", \"2024-03-12T12:00:00\"])",
        "result": "\"2024-03-10T12:00:00\""
      },
      {
        "call": "minDateTime([])",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/minTime",
    "fnName": "minTime",
    "examples": [
      {
        "call": "minTime([\"14:30:00\", \"09:00:00\", \"20:45:00\"])",
        "result": "\"09:00:00\""
      },
      {
        "call": "minTime([])",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/nextWeekday",
    "fnName": "nextWeekday",
    "examples": [
      {
        "call": "nextWeekday(\"2024-03-15\", 5)",
        "result": "\"2024-03-22\" (2024-03-15 is already a Friday, so it advances a full week)"
      },
      {
        "call": "nextWeekday(\"2024-03-15\", 5, { inclusive: true })",
        "result": "\"2024-03-15\""
      },
      {
        "call": "nextWeekday(\"2024-03-13\", 5)",
        "result": "\"2024-03-15\" (Wednesday -> next Friday)"
      },
      {
        "call": "nextWeekday(\"invalid\", 5)",
        "result": "\"\""
      },
      {
        "call": "nextWeekday(\"2024-03-15\", 8)",
        "result": "\"\" (dayOfWeek out of range)"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/previousWeekday",
    "fnName": "previousWeekday",
    "examples": [
      {
        "call": "previousWeekday(\"2024-03-15\", 5)",
        "result": "\"2024-03-08\" (2024-03-15 is already a Friday, so it goes back a full week)"
      },
      {
        "call": "previousWeekday(\"2024-03-15\", 5, { inclusive: true })",
        "result": "\"2024-03-15\""
      },
      {
        "call": "previousWeekday(\"2024-03-13\", 5)",
        "result": "\"2024-03-08\" (Wednesday -> previous Friday)"
      },
      {
        "call": "previousWeekday(\"invalid\", 5)",
        "result": "\"\""
      },
      {
        "call": "previousWeekday(\"2024-03-15\", 0)",
        "result": "\"\" (dayOfWeek out of range)"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/roundDate",
    "fnName": "roundDate",
    "examples": [
      {
        "call": "roundDate(\"2024-06-15\", { smallestUnit: \"year\" })",
        "result": "\"2024-01-01\""
      },
      {
        "call": "roundDate(\"2024-06-15\", { smallestUnit: \"month\" })",
        "result": "\"2024-07-01\""
      },
      {
        "call": "roundDate(\"2024-06-15\", { smallestUnit: \"week\" })",
        "result": "\"2024-06-16\""
      },
      {
        "call": "roundDate(\"2024-06-15\", { smallestUnit: \"day\" })",
        "result": "\"2024-06-15\""
      },
      {
        "call": "roundDate(\"invalid\", { smallestUnit: \"year\" })",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/roundDateTime",
    "fnName": "roundDateTime",
    "examples": [
      {
        "call": "roundDateTime(\"2024-06-15T12:34:56\", { smallestUnit: \"year\" })",
        "result": "\"2024-01-01T00:00:00\""
      },
      {
        "call": "roundDateTime(\"2024-06-15T12:34:56\", { smallestUnit: \"month\" })",
        "result": "\"2024-07-01T00:00:00\""
      },
      {
        "call": "roundDateTime(\"2024-06-15T12:34:56\", { smallestUnit: \"day\" })",
        "result": "\"2024-06-16T00:00:00\""
      },
      {
        "call": "roundDateTime(\"2024-06-15T12:34:56\", { smallestUnit: \"hour\" })",
        "result": "\"2024-06-15T13:00:00\""
      },
      {
        "call": "roundDateTime(\"invalid\", { smallestUnit: \"year\" })",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/roundTime",
    "fnName": "roundTime",
    "examples": [
      {
        "call": "roundTime(\"12:34:56\", { smallestUnit: \"hour\" })",
        "result": "\"13:00:00\""
      },
      {
        "call": "roundTime(\"12:34:56\", { smallestUnit: \"minute\" })",
        "result": "\"12:35:00\""
      },
      {
        "call": "roundTime(\"12:34:56\", { smallestUnit: \"second\", roundingMode: \"floor\" })",
        "result": "\"12:34:56\""
      },
      {
        "call": "roundTime(\"invalid\", { smallestUnit: \"hour\" })",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/setDate",
    "fnName": "setDate",
    "examples": [
      {
        "call": "setDate(\"2024-03-10\", { year: 2025 })",
        "result": "\"2025-03-10\""
      },
      {
        "call": "setDate(\"2024-01-31\", { month: 2 })",
        "result": "\"2024-02-29\" (constrain clamps to the last valid day)"
      },
      {
        "call": "setDate(\"2024-01-31\", { month: 2 }, { overflow: \"reject\" })",
        "result": "\"\""
      },
      {
        "call": "setDate(\"2024-03-10\", {})",
        "result": "\"2024-03-10\" (empty fields object is a no-op)"
      },
      {
        "call": "setDate(\"invalid\", { year: 2025 })",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/setDateTime",
    "fnName": "setDateTime",
    "examples": [
      {
        "call": "setDateTime(\"2024-03-10T12:00:00\", { hour: 9 })",
        "result": "\"2024-03-10T09:00:00\""
      },
      {
        "call": "setDateTime(\"2024-01-31T12:00:00\", { month: 2 })",
        "result": "\"2024-02-29T12:00:00\" (constrain clamps to the last valid day)"
      },
      {
        "call": "setDateTime(\"2024-01-31T12:00:00\", { month: 2 }, { overflow: \"reject\" })",
        "result": "\"\""
      },
      {
        "call": "setDateTime(\"2024-03-10T12:00:00\", {})",
        "result": "\"2024-03-10T12:00:00\" (empty fields object is a no-op)"
      },
      {
        "call": "setDateTime(\"invalid\", { hour: 9 })",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/setTime",
    "fnName": "setTime",
    "examples": [
      {
        "call": "setTime(\"12:00:00\", { hour: 9 })",
        "result": "\"09:00:00\""
      },
      {
        "call": "setTime(\"12:00:00\", { hour: 25 })",
        "result": "\"23:00:00\" (constrain clamps to the max valid hour)"
      },
      {
        "call": "setTime(\"12:00:00\", { hour: 25 }, { overflow: \"reject\" })",
        "result": "\"\""
      },
      {
        "call": "setTime(\"12:00:00\", {})",
        "result": "\"12:00:00\" (empty fields object is a no-op)"
      },
      {
        "call": "setTime(\"invalid\", { hour: 9 })",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/sortDateTimes",
    "fnName": "sortDateTimes",
    "examples": [
      {
        "call": "sortDateTimes([\"2024-03-10T12:00:00\", \"2024-01-01T08:00:00\", \"2024-02-15T15:30:00\"])",
        "result": "[\"2024-01-01T08:00:00\", \"2024-02-15T15:30:00\", \"2024-03-10T12:00:00\"]"
      },
      {
        "call": "sortDateTimes([])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/sortDates",
    "fnName": "sortDates",
    "examples": [
      {
        "call": "sortDates([\"2024-03-10\", \"2024-01-01\", \"2024-02-15\"])",
        "result": "[\"2024-01-01\", \"2024-02-15\", \"2024-03-10\"]"
      },
      {
        "call": "sortDates([])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/sortTimes",
    "fnName": "sortTimes",
    "examples": [
      {
        "call": "sortTimes([\"14:30:00\", \"09:00:00\", \"20:45:00\"])",
        "result": "[\"09:00:00\", \"14:30:00\", \"20:45:00\"]"
      },
      {
        "call": "sortTimes([])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/startOfDate",
    "fnName": "startOfDate",
    "examples": [
      {
        "call": "startOfDate(\"2024-02-29\", \"month\")",
        "result": "\"2024-02-01\""
      },
      {
        "call": "startOfDate(\"invalid-date\", \"month\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/startOfDateTime",
    "fnName": "startOfDateTime",
    "examples": [
      {
        "call": "startOfDateTime(\"2024-02-29T12:34:56\", \"month\")",
        "result": "\"2024-02-01T00:00:00\""
      },
      {
        "call": "startOfDateTime(\"invalid-datetime\", \"month\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/startOfQuarterForDate",
    "fnName": "startOfQuarterForDate",
    "examples": [
      {
        "call": "startOfQuarterForDate(\"2024-03-15\")",
        "result": "\"2024-01-01\""
      },
      {
        "call": "startOfQuarterForDate(\"2024-06-15\")",
        "result": "\"2024-04-01\""
      },
      {
        "call": "startOfQuarterForDate(\"2024-09-15\")",
        "result": "\"2024-07-01\""
      },
      {
        "call": "startOfQuarterForDate(\"2024-12-15\")",
        "result": "\"2024-10-01\""
      },
      {
        "call": "startOfQuarterForDate(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/startOfQuarterForDateTime",
    "fnName": "startOfQuarterForDateTime",
    "examples": [
      {
        "call": "startOfQuarterForDateTime(\"2024-03-15T12:00:00\")",
        "result": "\"2024-01-01T00:00:00\""
      },
      {
        "call": "startOfQuarterForDateTime(\"2024-06-15T12:00:00\")",
        "result": "\"2024-04-01T00:00:00\""
      },
      {
        "call": "startOfQuarterForDateTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/startOfTime",
    "fnName": "startOfTime",
    "examples": [
      {
        "call": "startOfTime(\"12:34:56\", \"hour\")",
        "result": "\"12:00:00\""
      },
      {
        "call": "startOfTime(\"invalid\", \"hour\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/subtractBusinessDays",
    "fnName": "subtractBusinessDays",
    "examples": [
      {
        "call": "subtractBusinessDays(\"2024-03-18\", 1)",
        "result": "\"2024-03-15\""
      },
      {
        "call": "subtractBusinessDays(\"2024-03-17\", 1)",
        "result": "\"2024-03-15\""
      },
      {
        "call": "subtractBusinessDays(\"2024-03-18\", 0)",
        "result": "\"2024-03-18\""
      },
      {
        "call": "subtractBusinessDays(\"invalid\", 1)",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/subtractDate",
    "fnName": "subtractDate",
    "examples": [
      {
        "call": "subtractDate(\"2024-03-15\", { day: 5 })",
        "result": "\"2024-03-10\""
      },
      {
        "call": "subtractDate(\"invalid\", { day: 5 })",
        "result": "\"\""
      },
      {
        "call": "subtractDate(\"2024-03-31\", { months: 1 }, { overflow: \"reject\" })",
        "result": "\"\""
      },
      {
        "call": "subtractDate(\"5784-07-15[u-ca=hebrew]\", { months: 1 })",
        "result": "\"5784-06-15[u-ca=hebrew]\" (Adar -> Adar I)"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/subtractDateTime",
    "fnName": "subtractDateTime",
    "examples": [
      {
        "call": "subtractDateTime(\"2024-03-15T12:00:00\", { days: 5 })",
        "result": "\"2024-03-10T12:00:00\""
      },
      {
        "call": "subtractDateTime(\"invalid\", { days: 5 })",
        "result": "\"\""
      },
      {
        "call": "subtractDateTime(\"2024-03-31T12:00:00\", { months: 1 }, { overflow: \"reject\" })",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/subtractTime",
    "fnName": "subtractTime",
    "examples": [
      {
        "call": "subtractTime(\"14:30:00\", { hours: 1 })",
        "result": "\"13:30:00\""
      },
      {
        "call": "subtractTime(\"invalid\", { hours: 1 })",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/weekOfYearForDate",
    "fnName": "weekOfYearForDate",
    "examples": [
      {
        "call": "weekOfYearForDate(\"2024-01-01\")",
        "result": "1"
      },
      {
        "call": "weekOfYearForDate(\"2024-01-07\")",
        "result": "1"
      },
      {
        "call": "weekOfYearForDate(\"2024-01-08\")",
        "result": "2"
      },
      {
        "call": "weekOfYearForDate(\"2024-12-31\")",
        "result": "1"
      },
      {
        "call": "weekOfYearForDate(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/calculate/weekOfYearForDateTime",
    "fnName": "weekOfYearForDateTime",
    "examples": [
      {
        "call": "weekOfYearForDateTime(\"2024-01-01T12:00:00\")",
        "result": "1"
      },
      {
        "call": "weekOfYearForDateTime(\"2024-01-08T00:00:00\")",
        "result": "2"
      },
      {
        "call": "weekOfYearForDateTime(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/chop/chopDate",
    "fnName": "chopDate",
    "examples": [
      {
        "call": "chopDate(\"2024-02-29T12:34:56\")",
        "result": "\"12:34:56\""
      },
      {
        "call": "chopDate(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/chop/chopMilliseconds",
    "fnName": "chopMilliseconds",
    "examples": [
      {
        "call": "chopMilliseconds(\"2024-02-29T12:34:56.789\")",
        "result": "\"2024-02-29T12:34:56\""
      },
      {
        "call": "chopMilliseconds(\"12:34:56.789\")",
        "result": "\"12:34:56\""
      },
      {
        "call": "chopMilliseconds(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/chop/chopSeconds",
    "fnName": "chopSeconds",
    "examples": [
      {
        "call": "chopSeconds(\"2024-02-29T12:34:56\")",
        "result": "\"2024-02-29T12:34\""
      },
      {
        "call": "chopSeconds(\"12:34:56\")",
        "result": "\"12:34\""
      },
      {
        "call": "chopSeconds(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/chop/chopTime",
    "fnName": "chopTime",
    "examples": [
      {
        "call": "chopTime(\"2024-02-29T12:34:56\")",
        "result": "\"2024-02-29\""
      },
      {
        "call": "chopTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/compare/areDateTimesEqual",
    "fnName": "areDateTimesEqual",
    "examples": [
      {
        "call": "areDateTimesEqual(\"2024-02-29T12:34:56\", \"2024-02-29T12:34:56\")",
        "result": "true"
      },
      {
        "call": "areDateTimesEqual(\"2024-02-29T12:34:56\", \"2024-02-29T12:34:57\")",
        "result": "false"
      },
      {
        "call": "areDateTimesEqual(\"2024-02-29T12:34:56\", \"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/compare/areDateTimesEqualBy",
    "fnName": "areDateTimesEqualBy",
    "examples": [
      {
        "call": "areDateTimesEqualBy(\"2024-03-15T10:00:00\", \"2024-03-15T18:00:00\", \"day\")",
        "result": "true"
      },
      {
        "call": "areDateTimesEqualBy(\"2024-03-15T10:30:00\", \"2024-03-15T10:45:00\", \"hour\")",
        "result": "true"
      },
      {
        "call": "areDateTimesEqualBy(\"2024-03-15T10:30:00\", \"2024-03-15T11:00:00\", \"hour\")",
        "result": "false"
      },
      {
        "call": "areDateTimesEqualBy(\"2023-03-15T10:00:00\", \"2024-03-15T10:00:00\", \"month\")",
        "result": "false (same month, different year)"
      },
      {
        "call": "areDateTimesEqualBy(\"invalid\", \"2024-03-15T10:00:00\", \"day\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/compare/areDatesEqual",
    "fnName": "areDatesEqual",
    "examples": [
      {
        "call": "areDatesEqual(\"2024-02-29\", \"2024-02-29T12:34:56\")",
        "result": "true"
      },
      {
        "call": "areDatesEqual(\"2024-02-29\", \"2024-03-01\")",
        "result": "false"
      },
      {
        "call": "areDatesEqual(\"invalid\", \"2024-02-29\")",
        "result": "false"
      },
      {
        "call": "areDatesEqual(\"2024-02-29\", \"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/compare/areDatesEqualBy",
    "fnName": "areDatesEqualBy",
    "examples": [
      {
        "call": "areDatesEqualBy(\"2024-03-15\", \"2024-03-20\", \"month\")",
        "result": "true"
      },
      {
        "call": "areDatesEqualBy(\"2023-03-15\", \"2024-03-15\", \"month\")",
        "result": "false (same month, different year)"
      },
      {
        "call": "areDatesEqualBy(\"2024-03-15\", \"2024-03-16\", \"day\")",
        "result": "false"
      },
      {
        "call": "areDatesEqualBy(\"2024-03-15\", \"2024-03-15\", \"hour\" as never)",
        "result": "false (unsupported unit)"
      },
      {
        "call": "areDatesEqualBy(\"invalid\", \"2024-03-15\", \"month\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/compare/areTimesEqual",
    "fnName": "areTimesEqual",
    "examples": [
      {
        "call": "areTimesEqual(\"12:34:56\", \"12:34:56\")",
        "result": "true"
      },
      {
        "call": "areTimesEqual(\"12:34:56\", \"12:34:57\")",
        "result": "false"
      },
      {
        "call": "areTimesEqual(\"12:34:56.789\", \"12:34:56.789\")",
        "result": "true"
      },
      {
        "call": "areTimesEqual(\"12:34:56.789\", \"12:34:56.790\")",
        "result": "false"
      },
      {
        "call": "areTimesEqual(\"invalid\", \"12:34:56\")",
        "result": "false"
      },
      {
        "call": "areTimesEqual(\"12:34:56\", \"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/compare/isAfterDate",
    "fnName": "isAfterDate",
    "examples": [
      {
        "call": "isAfterDate(\"2024-03-01\", \"2024-02-29\")",
        "result": "true"
      },
      {
        "call": "isAfterDate(\"2024-02-28\", \"2024-02-29\")",
        "result": "false"
      },
      {
        "call": "isAfterDate(\"invalid\", \"2024-02-29\")",
        "result": "false"
      },
      {
        "call": "isAfterDate(\"2024-02-29\", \"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/compare/isAfterDateTime",
    "fnName": "isAfterDateTime",
    "examples": [
      {
        "call": "isAfterDateTime(\"2024-02-29T12:34:56\", \"2024-02-28T12:34:56\")",
        "result": "true"
      },
      {
        "call": "isAfterDateTime(\"2024-02-29T12:34:56\", \"2024-02-29T12:34:56\")",
        "result": "false"
      },
      {
        "call": "isAfterDateTime(\"2024-02-28T12:34:56\", \"2024-02-29T12:34:56\")",
        "result": "false"
      },
      {
        "call": "isAfterDateTime(\"invalid\", \"2024-02-29T12:34:56\")",
        "result": "false"
      },
      {
        "call": "isAfterDateTime(\"2024-02-29T12:34:56\", \"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/compare/isAfterTime",
    "fnName": "isAfterTime",
    "examples": [
      {
        "call": "isAfterTime(\"12:34:56\", \"11:34:56\")",
        "result": "true"
      },
      {
        "call": "isAfterTime(\"12:34:56\", \"12:34:56\")",
        "result": "false"
      },
      {
        "call": "isAfterTime(\"11:34:56\", \"12:34:56\")",
        "result": "false"
      },
      {
        "call": "isAfterTime(\"invalid\", \"12:34:56\")",
        "result": "false"
      },
      {
        "call": "isAfterTime(\"12:34:56\", \"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/compare/isBeforeDate",
    "fnName": "isBeforeDate",
    "examples": [
      {
        "call": "isBeforeDate(\"2024-02-28\", \"2024-02-29\")",
        "result": "true"
      },
      {
        "call": "isBeforeDate(\"2024-02-29\", \"2024-02-29\")",
        "result": "false"
      },
      {
        "call": "isBeforeDate(\"2024-02-29\", \"2024-02-28\")",
        "result": "false"
      },
      {
        "call": "isBeforeDate(\"invalid\", \"2024-02-29\")",
        "result": "false"
      },
      {
        "call": "isBeforeDate(\"2024-02-29\", \"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/compare/isBeforeDateTime",
    "fnName": "isBeforeDateTime",
    "examples": [
      {
        "call": "isBeforeDateTime(\"2024-02-28T12:34:56\", \"2024-02-29T12:34:56\")",
        "result": "true"
      },
      {
        "call": "isBeforeDateTime(\"2024-02-29T12:34:56\", \"2024-02-29T12:34:56\")",
        "result": "false"
      },
      {
        "call": "isBeforeDateTime(\"2024-02-29T12:34:56\", \"2024-02-28T12:34:56\")",
        "result": "false"
      },
      {
        "call": "isBeforeDateTime(\"invalid\", \"2024-02-29T12:34:56\")",
        "result": "false"
      },
      {
        "call": "isBeforeDateTime(\"2024-02-29T12:34:56\", \"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/compare/isBeforeTime",
    "fnName": "isBeforeTime",
    "examples": [
      {
        "call": "isBeforeTime(\"12:34:56\", \"13:34:56\")",
        "result": "true"
      },
      {
        "call": "isBeforeTime(\"12:34:56\", \"12:34:56\")",
        "result": "false"
      },
      {
        "call": "isBeforeTime(\"13:34:56\", \"12:34:56\")",
        "result": "false"
      },
      {
        "call": "isBeforeTime(\"invalid\", \"12:34:56\")",
        "result": "false"
      },
      {
        "call": "isBeforeTime(\"12:34:56\", \"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/compare/isBetweenDate",
    "fnName": "isBetweenDate",
    "examples": [
      {
        "call": "isBetweenDate(\"2024-02-29\", \"2024-02-01\", \"2024-02-28\")",
        "result": "false"
      },
      {
        "call": "isBetweenDate(\"2024-02-29\", \"2024-02-01\", \"2024-02-29\")",
        "result": "true"
      },
      {
        "call": "isBetweenDate(\"2024-02-29\", \"2024-02-29\", \"2024-02-28\")",
        "result": "false"
      },
      {
        "call": "isBetweenDate(\"2024-02-29\", \"2024-02-28\", \"2024-03-01\")",
        "result": "true"
      },
      {
        "call": "isBetweenDate(\"invalid\", \"2024-02-01\", \"2024-02-28\")",
        "result": "false"
      },
      {
        "call": "isBetweenDate(\"2024-02-29\", \"invalid\", \"2024-02-28\")",
        "result": "false"
      },
      {
        "call": "isBetweenDate(\"2024-02-29\", \"2024-02-01\", \"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/compare/isBetweenDateTime",
    "fnName": "isBetweenDateTime",
    "examples": [
      {
        "call": "isBetweenDateTime(\"2024-02-29T12:00:00\", \"2024-02-01T00:00:00\", \"2024-02-28T23:59:59\")",
        "result": "false"
      },
      {
        "call": "isBetweenDateTime(\"2024-02-29T12:00:00\", \"2024-02-01T00:00:00\", \"2024-02-29T12:00:00\")",
        "result": "true"
      },
      {
        "call": "isBetweenDateTime(\"2024-02-29T12:00:00\", \"2024-02-29T12:00:00\", \"2024-02-28T23:59:59\")",
        "result": "false"
      },
      {
        "call": "isBetweenDateTime(\"2024-02-29T12:00:00\", \"2024-02-28T23:59:59\", \"2024-03-01T00:00:00\")",
        "result": "true"
      },
      {
        "call": "isBetweenDateTime(\"invalid\", \"2024-02-01T00:00:00\", \"2024-02-28T23:59:59\")",
        "result": "false"
      },
      {
        "call": "isBetweenDateTime(\"2024-02-29T12:00:00\", \"invalid\", \"2024-02-28T23:59:59\")",
        "result": "false"
      },
      {
        "call": "isBetweenDateTime(\"2024-02-29T12:00:00\", \"2024-02-01T00:00:00\", \"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/compare/isBetweenTime",
    "fnName": "isBetweenTime",
    "examples": [
      {
        "call": "isBetweenTime(\"12:34:56\", \"12:00:00\", \"13:00:00\")",
        "result": "true"
      },
      {
        "call": "isBetweenTime(\"12:34:56\", \"12:34:56\", \"13:00:00\")",
        "result": "true"
      },
      {
        "call": "isBetweenTime(\"12:34:56\", \"12:34:57\", \"13:00:00\")",
        "result": "false"
      },
      {
        "call": "isBetweenTime(\"12:34:56\", \"12:00:00\", \"12:34:56\")",
        "result": "true"
      },
      {
        "call": "isBetweenTime(\"12:34:56\", \"12:00:00\", \"12:34:55\")",
        "result": "false"
      },
      {
        "call": "isBetweenTime(\"invalid\", \"12:00:00\", \"13:00:00\")",
        "result": "false"
      },
      {
        "call": "isBetweenTime(\"12:34:56\", \"invalid\", \"13:00:00\")",
        "result": "false"
      },
      {
        "call": "isBetweenTime(\"12:34:56\", \"12:00:00\", \"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/compare/isBusinessDay",
    "fnName": "isBusinessDay",
    "examples": [
      {
        "call": "isBusinessDay(\"2024-02-05\")",
        "result": "true (Monday)"
      },
      {
        "call": "isBusinessDay(\"2024-02-10\")",
        "result": "false (Saturday)"
      },
      {
        "call": "isBusinessDay(\"2024-02-04\")",
        "result": "false (Sunday)"
      },
      {
        "call": "isBusinessDay(\"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/compare/isFuture",
    "fnName": "isFuture",
    "examples": [
      {
        "call": "isFuture(\"2024-03-16\")",
        "result": "true, if today is 2024-03-15"
      },
      {
        "call": "isFuture(\"2024-03-15\")",
        "result": "false, if today is 2024-03-15 (equal is not future)"
      },
      {
        "call": "isFuture(\"2024-03-14\")",
        "result": "false, if today is 2024-03-15"
      },
      {
        "call": "isFuture(\"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/compare/isPast",
    "fnName": "isPast",
    "examples": [
      {
        "call": "isPast(\"2024-03-14\")",
        "result": "true, if today is 2024-03-15"
      },
      {
        "call": "isPast(\"2024-03-15\")",
        "result": "false, if today is 2024-03-15 (equal is not past)"
      },
      {
        "call": "isPast(\"2024-03-16\")",
        "result": "false, if today is 2024-03-15"
      },
      {
        "call": "isPast(\"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/compare/isRelativeDay",
    "fnName": "isRelativeDay",
    "examples": [
      {
        "call": "isRelativeDay(\"2024-03-15\", 0)",
        "result": "true, if today is 2024-03-15"
      },
      {
        "call": "isRelativeDay(\"2024-03-14\", -1)",
        "result": "true, if today is 2024-03-15"
      },
      {
        "call": "isRelativeDay(\"2024-03-22\", 7)",
        "result": "true, if today is 2024-03-15"
      },
      {
        "call": "isRelativeDay(\"2024-03-15\", 1.5)",
        "result": "false (offsetDays must be an integer)"
      },
      {
        "call": "isRelativeDay(\"invalid\", 0)",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/compare/isThisUnit",
    "fnName": "isThisUnit",
    "examples": [
      {
        "call": "isThisUnit(\"2024-03-15\", \"month\")",
        "result": "true, if today is any day in March 2024"
      },
      {
        "call": "isThisUnit(\"2024-03-15\", \"year\")",
        "result": "true, if today is any day in 2024"
      },
      {
        "call": "isThisUnit(\"2024-02-26\", \"week\", \"fr-FR\")",
        "result": "true, if today is 2024-03-01 (same fr-FR Monday-start week)"
      },
      {
        "call": "isThisUnit(\"2024-03-15\", \"hour\" as never)",
        "result": "false (unsupported unit)"
      },
      {
        "call": "isThisUnit(\"invalid\", \"month\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/compare/isWeekend",
    "fnName": "isWeekend",
    "examples": [
      {
        "call": "isWeekend(\"2024-02-03\", \"en-US\")",
        "result": "true (Saturday, en-US weekend is Sat/Sun)"
      },
      {
        "call": "isWeekend(\"2024-02-02\", \"he-IL\")",
        "result": "true (Friday, he-IL weekend is Fri/Sat)"
      },
      {
        "call": "isWeekend(\"2024-02-04\", \"he-IL\")",
        "result": "false (Sunday, not part of he-IL's weekend)"
      },
      {
        "call": "isWeekend(\"invalid\", \"en-US\")",
        "result": "false"
      },
      {
        "call": "isWeekend(\"2024-02-03\", \"not-a-locale\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/convert/convertDateToCalendar",
    "fnName": "convertDateToCalendar",
    "examples": [
      {
        "call": "convertDateToCalendar(\"2024-10-03\", \"hebrew\")",
        "result": "\"5785-01-01[u-ca=hebrew]\""
      },
      {
        "call": "convertDateToCalendar(\"5785-01-01[u-ca=hebrew]\", \"gregorian\")",
        "result": "\"2024-10-03\""
      },
      {
        "call": "convertDateToCalendar(\"2024-10-03\", \"gregorian\")",
        "result": "\"2024-10-03\""
      },
      {
        "call": "convertDateToCalendar(\"2024-10-03\", \"islamic-umalqura\")",
        "result": "\"1446-03-30[u-ca=islamic-umalqura]\""
      },
      {
        "call": "convertDateToCalendar(\"2024-10-03\", \"japanese\")",
        "result": "\"0006-10-03[u-ca=japanese;era=reiwa]\""
      },
      {
        "call": "convertDateToCalendar(\"2024-10-03\", \"buddhist\")",
        "result": "\"2567-10-03[u-ca=buddhist]\""
      },
      {
        "call": "convertDateToCalendar(\"2024-10-03\", \"taiwan\")",
        "result": "\"0113-10-03[u-ca=taiwan]\""
      },
      {
        "call": "convertDateToCalendar(\"2024-10-03\", \"persian\")",
        "result": "\"1403-07-12[u-ca=persian]\""
      },
      {
        "call": "convertDateToCalendar(\"2024-10-03\", \"indian\")",
        "result": "\"1946-07-11[u-ca=indian]\""
      },
      {
        "call": "convertDateToCalendar(\"2024-10-03\", \"ethiopic\")",
        "result": "\"2017-01-23[u-ca=ethiopic;era=ethiopic]\""
      },
      {
        "call": "convertDateToCalendar(\"2024-10-03\", \"ethiopic-amete-alem\")",
        "result": "\"7517-01-23[u-ca=ethiopic-amete-alem]\""
      },
      {
        "call": "convertDateToCalendar(\"2024-10-03\", \"coptic\")",
        "result": "\"1741-01-23[u-ca=coptic]\""
      },
      {
        "call": "convertDateToCalendar(\"invalid\", \"hebrew\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/format/formatCalendar",
    "fnName": "formatCalendar",
    "examples": [
      {
        "call": "formatCalendar(\"2026-03-16T14:30:00\", \"en-US\", { reference: \"2026-03-15T09:00:00\" })",
        "result": "\"tomorrow at 2:30 PM\""
      },
      {
        "call": "formatCalendar(\"2026-03-08T14:30:00\", \"en-US\", { reference: \"2026-03-15T09:00:00\" })",
        "result": "\"March 8, 2026 at 2:30 PM\" (7 days out — beyond the threshold, absolute fallback)"
      },
      {
        "call": "formatCalendar(\"not-a-date\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/format/formatDate",
    "fnName": "formatDate",
    "examples": [
      {
        "call": "formatDate(\"2024-03-15\", \"en-US\", { year: \"numeric\", month: \"long\", day: \"numeric\" })",
        "result": "\"March 15, 2024\""
      },
      {
        "call": "formatDate(\"2024-03-15\", \"de-DE\", { year: \"numeric\", month: \"long\", day: \"numeric\" })",
        "result": "\"15. März 2024\""
      },
      {
        "call": "formatDate(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/format/formatDateRange",
    "fnName": "formatDateRange",
    "examples": [
      {
        "call": "formatDateRange(\"2024-02-03\", \"2024-02-05\", \"en-US\", { dateStyle: \"long\" })",
        "result": "\"February 3 – 5, 2024\""
      },
      {
        "call": "formatDateRange(\"2024-02-03\", \"2024-06-10\", \"en-US\", { dateStyle: \"long\" })",
        "result": "\"February 3 – June 10, 2024\""
      },
      {
        "call": "formatDateRange(\"invalid\", \"2024-02-05\", \"en-US\")",
        "result": "\"\" (invalid input)"
      }
    ]
  },
  {
    "route": "/reference/plain/format/formatDateTime",
    "fnName": "formatDateTime",
    "examples": [
      {
        "call": "formatDateTime(\"2024-03-15T14:30:00\", \"en-US\", { dateStyle: \"medium\", timeStyle: \"short\" })",
        "result": "\"Mar 15, 2024 at 2:30 PM\""
      },
      {
        "call": "formatDateTime(\"2024-03-15T14:30:00\", \"de-DE\", { dateStyle: \"medium\", timeStyle: \"short\" })",
        "result": "\"15.03.2024, 14:30\""
      },
      {
        "call": "formatDateTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/format/formatDateTimeRange",
    "fnName": "formatDateTimeRange",
    "examples": [
      {
        "call": "formatDateTimeRange(\"2024-02-03T09:00:00\", \"2024-02-03T17:00:00\", \"en-US\", { dateStyle: \"long\", timeStyle: \"short\" })",
        "result": "\"February 3, 2024, 9:00 AM – 5:00 PM\""
      },
      {
        "call": "formatDateTimeRange(\"2024-02-03T09:00:00\", \"2024-02-10T17:00:00\", \"en-US\", { dateStyle: \"long\", timeStyle: \"short\" })",
        "result": "\"February 3, 2024 at 9:00 AM – February 10, 2024 at 5:00 PM\""
      },
      {
        "call": "formatDateTimeRange(\"invalid\", \"2024-02-03T17:00:00\", \"en-US\")",
        "result": "\"\" (invalid input)"
      }
    ]
  },
  {
    "route": "/reference/plain/format/formatDateTimeToParts",
    "fnName": "formatDateTimeToParts",
    "examples": [
      {
        "call": "formatDateTimeToParts(\"2024-03-15T14:30:00\", \"en-US\")",
        "result": "[{ type: \"month\", value: \"3\" }, { type: \"literal\", value: \"/\" }, { type: \"day\", value: \"15\" }, { type: \"literal\", value: \"/\" }, { type: \"year\", value: \"2024\" }, { type: \"literal\", value: \",\" }, { type: \"literal\", value: \" \" }, { type: \"hour\", value: \"2\" }, { type: \"literal\", value: \":\" }, { type: \"minute\", value: \"30\" }, { type: \"literal\", value: \" \" }, { type: \"dayPeriod\", value: \"PM\" }]"
      },
      {
        "call": "formatDateTimeToParts(\"2024-03-15T14:30:00\", \"de-DE\")",
        "result": "[{ type: \"day\", value: \"15\" }, { type: \"literal\", value: \".\" }, { type: \"month\", value: \"3\" }, { type: \"literal\", value: \".\" }, { type: \"year\", value: \"2024\" }, { type: \"literal\", value: \",\" }, { type: \"literal\", value: \" \" }, { type: \"hour\", value: \"14\" }, { type: \"literal\", value: \":\" }, { type: \"minute\", value: \"30\" }]"
      },
      {
        "call": "formatDateTimeToParts(\"invalid\")",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/format/formatDateToParts",
    "fnName": "formatDateToParts",
    "examples": [
      {
        "call": "formatDateToParts(\"2024-03-15\", \"en-US\")",
        "result": "[{ type: \"month\", value: \"3\" }, { type: \"literal\", value: \"/\" }, { type: \"day\", value: \"15\" }, { type: \"literal\", value: \"/\" }, { type: \"year\", value: \"2024\" }]"
      },
      {
        "call": "formatDateToParts(\"2024-03-15\", \"de-DE\")",
        "result": "[{ type: \"day\", value: \"15\" }, { type: \"literal\", value: \".\" }, { type: \"month\", value: \"3\" }, { type: \"literal\", value: \".\" }, { type: \"year\", value: \"2024\" }]"
      },
      {
        "call": "formatDateToParts(\"invalid\")",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/format/formatRelativeDate",
    "fnName": "formatRelativeDate",
    "examples": [
      {
        "call": "formatRelativeDate(\"2026-01-15\", \"en-US\", { reference: \"2026-04-15\" })",
        "result": "\"3 months ago\""
      },
      {
        "call": "formatRelativeDate(value, \"en-US\", { roundingMethod: \"floor\" })",
        "result": "rounds toward the earlier boundary"
      },
      {
        "call": "formatRelativeDate(\"not-a-date\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/format/formatRelativeDateTime",
    "fnName": "formatRelativeDateTime",
    "examples": [
      {
        "call": "formatRelativeDateTime(\"2026-03-17T09:00:00\", \"en-GB\", { style: \"long\" })",
        "result": "\"in 3 hours\""
      },
      {
        "call": "formatRelativeDateTime(value, \"en-US\", { roundingMethod: \"floor\" })",
        "result": "rounds toward the earlier boundary"
      },
      {
        "call": "formatRelativeDateTime(\"not-a-date\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/format/formatRelativeTime",
    "fnName": "formatRelativeTime",
    "examples": [
      {
        "call": "formatRelativeTime(\"14:30:00\", \"en-US\", { style: \"short\" })",
        "result": "\"2 hr. ago\""
      },
      {
        "call": "formatRelativeTime(value, \"en-US\", { roundingMethod: \"floor\" })",
        "result": "rounds toward the earlier boundary"
      },
      {
        "call": "formatRelativeTime(\"not-a-time\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/format/formatSql",
    "fnName": "formatSql",
    "examples": [
      {
        "call": "formatSql(\"2024-03-15T14:30:00\")",
        "result": "\"2024-03-15 14:30:00\""
      },
      {
        "call": "formatSql(\"2024-03-15T14:30:00.500\")",
        "result": "\"2024-03-15 14:30:00.5\""
      },
      {
        "call": "formatSql(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/format/formatTime",
    "fnName": "formatTime",
    "examples": [
      {
        "call": "formatTime(\"14:30:00\", \"en-US\", { timeStyle: \"short\" })",
        "result": "\"2:30 PM\""
      },
      {
        "call": "formatTime(\"14:30:00\", \"de-DE\", { timeStyle: \"short\" })",
        "result": "\"14:30\""
      },
      {
        "call": "formatTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/get/getDay",
    "fnName": "getDay",
    "examples": [
      {
        "call": "getDay()",
        "result": "\"29\""
      },
      {
        "call": "getDay()",
        "result": "\"\" (when system timeZone unavailable)"
      }
    ]
  },
  {
    "route": "/reference/plain/get/getDayOfWeek",
    "fnName": "getDayOfWeek",
    "examples": [
      {
        "call": "getDayOfWeek()",
        "result": "4"
      },
      {
        "call": "getDayOfWeek()",
        "result": "null (when system timeZone unavailable)"
      }
    ]
  },
  {
    "route": "/reference/plain/get/getHour",
    "fnName": "getHour",
    "examples": [
      {
        "call": "getHour()",
        "result": "\"00\""
      },
      {
        "call": "getHour()",
        "result": "\"\" (when system timeZone unavailable)"
      }
    ]
  },
  {
    "route": "/reference/plain/get/getMicrosecond",
    "fnName": "getMicrosecond",
    "examples": [
      {
        "call": "getMicrosecond()",
        "result": "\"000\""
      },
      {
        "call": "getMicrosecond()",
        "result": "\"\" (when system timeZone unavailable)"
      }
    ]
  },
  {
    "route": "/reference/plain/get/getMillisecond",
    "fnName": "getMillisecond",
    "examples": [
      {
        "call": "getMillisecond()",
        "result": "\"000\""
      },
      {
        "call": "getMillisecond()",
        "result": "\"\" (when system timeZone unavailable)"
      }
    ]
  },
  {
    "route": "/reference/plain/get/getMinute",
    "fnName": "getMinute",
    "examples": [
      {
        "call": "getMinute()",
        "result": "\"00\""
      },
      {
        "call": "getMinute()",
        "result": "\"\" (when system timeZone unavailable)"
      }
    ]
  },
  {
    "route": "/reference/plain/get/getMonth",
    "fnName": "getMonth",
    "examples": [
      {
        "call": "getMonth()",
        "result": "\"02\""
      },
      {
        "call": "getMonth()",
        "result": "\"\" (when system timeZone unavailable)"
      }
    ]
  },
  {
    "route": "/reference/plain/get/getNanosecond",
    "fnName": "getNanosecond",
    "examples": [
      {
        "call": "getNanosecond()",
        "result": "\"000\""
      },
      {
        "call": "getNanosecond()",
        "result": "\"\" (when system timeZone unavailable)"
      }
    ]
  },
  {
    "route": "/reference/plain/get/getNow",
    "fnName": "getNow",
    "examples": [
      {
        "call": "getNow()",
        "result": "\"2024-03-15T14:30:45\" (current time)"
      }
    ]
  },
  {
    "route": "/reference/plain/get/isValidPlainNowUnit",
    "fnName": "isValidPlainNowUnit",
    "examples": []
  },
  {
    "route": "/reference/plain/get/getNowUnit",
    "fnName": "getNowUnit",
    "examples": [
      {
        "call": "getNowUnit(\"year\")",
        "result": "\"2024\""
      },
      {
        "call": "getNowUnit(\"month\")",
        "result": "\"03\""
      },
      {
        "call": "getNowUnit(\"week\")",
        "result": "\"11\""
      },
      {
        "call": "getNowUnit(\"day\")",
        "result": "\"15\""
      },
      {
        "call": "getNowUnit(\"dayOfWeek\")",
        "result": "\"5\""
      },
      {
        "call": "getNowUnit(\"hour\")",
        "result": "\"14\""
      },
      {
        "call": "getNowUnit(\"minute\")",
        "result": "\"30\""
      },
      {
        "call": "getNowUnit(\"second\")",
        "result": "\"45\""
      },
      {
        "call": "getNowUnit(\"millisecond\")",
        "result": "\"000\""
      },
      {
        "call": "getNowUnit(\"microsecond\")",
        "result": "\"000\""
      },
      {
        "call": "getNowUnit(\"nanosecond\")",
        "result": "\"000\""
      },
      {
        "call": "getNowUnit(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/get/getSecond",
    "fnName": "getSecond",
    "examples": [
      {
        "call": "getSecond()",
        "result": "\"00\""
      },
      {
        "call": "getSecond()",
        "result": "\"\" (when system timeZone unavailable)"
      }
    ]
  },
  {
    "route": "/reference/plain/get/getToday",
    "fnName": "getToday",
    "examples": [
      {
        "call": "getToday()",
        "result": "\"2024-03-15\" (current date)"
      }
    ]
  },
  {
    "route": "/reference/plain/get/getWeekOfYear",
    "fnName": "getWeekOfYear",
    "examples": [
      {
        "call": "getWeekOfYear()",
        "result": "15"
      },
      {
        "call": "getWeekOfYear()",
        "result": "null (when system timeZone unavailable)"
      }
    ]
  },
  {
    "route": "/reference/plain/get/getYear",
    "fnName": "getYear",
    "examples": [
      {
        "call": "getYear()",
        "result": "\"2024\""
      },
      {
        "call": "getYear()",
        "result": "\"\" (when system timeZone unavailable)"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalAbutsDate",
    "fnName": "intervalAbutsDate",
    "examples": [
      {
        "call": "intervalAbutsDate(\"2024-01-01\", \"2024-06-30\", \"2024-07-01\", \"2024-12-31\")",
        "result": "true"
      },
      {
        "call": "intervalAbutsDate(\"2024-07-01\", \"2024-12-31\", \"2024-01-01\", \"2024-06-30\")",
        "result": "true"
      },
      {
        "call": "intervalAbutsDate(\"2024-01-01\", \"2024-06-30\", \"2024-07-02\", \"2024-12-31\")",
        "result": "false (gap)"
      },
      {
        "call": "intervalAbutsDate(\"2024-01-01\", \"2024-07-01\", \"2024-06-30\", \"2024-12-31\")",
        "result": "false (overlap)"
      },
      {
        "call": "intervalAbutsDate(\"invalid\", \"2024-06-30\", \"2024-07-01\", \"2024-12-31\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalAbutsDateTime",
    "fnName": "intervalAbutsDateTime",
    "examples": [
      {
        "call": "intervalAbutsDateTime(\"2024-01-01T09:00:00\", \"2024-06-30T12:00:00\", \"2024-06-30T12:00:00.000000001\", \"2024-12-31T17:00:00\")",
        "result": "true"
      },
      {
        "call": "intervalAbutsDateTime(\"2024-06-30T12:00:00\", \"2024-12-31T17:00:00\", \"2024-01-01T09:00:00\", \"2024-06-30T12:00:00.000000001\")",
        "result": "true"
      },
      {
        "call": "intervalAbutsDateTime(\"2024-01-01T09:00:00\", \"2024-06-30T12:00:00\", \"2024-06-30T12:00:01\", \"2024-12-31T17:00:00\")",
        "result": "false (gap)"
      },
      {
        "call": "intervalAbutsDateTime(\"2024-01-01T09:00:00\", \"2024-06-30T13:00:00\", \"2024-06-30T12:00:00\", \"2024-12-31T17:00:00\")",
        "result": "false (overlap)"
      },
      {
        "call": "intervalAbutsDateTime(\"invalid\", \"2024-06-30T12:00:00\", \"2024-06-30T12:00:00\", \"2024-12-31T17:00:00\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalAbutsTime",
    "fnName": "intervalAbutsTime",
    "examples": [
      {
        "call": "intervalAbutsTime(\"09:00:00\", \"12:00:00\", \"12:00:00.000000001\", \"17:00:00\")",
        "result": "true"
      },
      {
        "call": "intervalAbutsTime(\"12:00:00\", \"17:00:00\", \"09:00:00\", \"12:00:00\")",
        "result": "true"
      },
      {
        "call": "intervalAbutsTime(\"09:00:00\", \"12:00:00\", \"12:00:01\", \"17:00:00\")",
        "result": "false (gap)"
      },
      {
        "call": "intervalAbutsTime(\"09:00:00\", \"13:00:00\", \"12:00:00\", \"17:00:00\")",
        "result": "false (overlap)"
      },
      {
        "call": "intervalAbutsTime(\"invalid\", \"12:00:00\", \"12:00:00\", \"17:00:00\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalContainsDate",
    "fnName": "intervalContainsDate",
    "examples": [
      {
        "call": "intervalContainsDate(\"2024-01-01\", \"2024-12-31\", \"2024-06-15\")",
        "result": "true"
      },
      {
        "call": "intervalContainsDate(\"2024-01-01\", \"2024-12-31\", \"2024-06-15\", \"2024-07-15\")",
        "result": "true"
      },
      {
        "call": "intervalContainsDate(\"2024-12-31\", \"2024-01-01\", \"2024-06-15\")",
        "result": "false"
      },
      {
        "call": "intervalContainsDate(\"2024-01-01\", \"2024-12-31\", \"2024-06-15\", \"2024-06-10\")",
        "result": "false"
      },
      {
        "call": "intervalContainsDate(\"invalid\", \"2024-12-31\", \"2024-06-15\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalContainsDateTime",
    "fnName": "intervalContainsDateTime",
    "examples": [
      {
        "call": "intervalContainsDateTime(\"2024-01-01T10:00:00\", \"2024-12-31T23:59:59\", \"2024-06-15T12:00:00\")",
        "result": "true"
      },
      {
        "call": "intervalContainsDateTime(\"2024-01-01T10:00:00\", \"2024-12-31T23:59:59\", \"2024-06-15T12:00:00\", \"2024-07-15T12:00:00\")",
        "result": "true"
      },
      {
        "call": "intervalContainsDateTime(\"2024-12-31T23:59:59\", \"2024-01-01T10:00:00\", \"2024-06-15T12:00:00\")",
        "result": "false"
      },
      {
        "call": "intervalContainsDateTime(\"2024-01-01T10:00:00\", \"2024-12-31T23:59:59\", \"2024-06-15T12:00:00\", \"2024-06-10T12:00:00\")",
        "result": "false"
      },
      {
        "call": "intervalContainsDateTime(\"invalid\", \"2024-12-31T23:59:59\", \"2024-06-15T12:00:00\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalContainsTime",
    "fnName": "intervalContainsTime",
    "examples": [
      {
        "call": "intervalContainsTime(\"09:00:00\", \"17:00:00\", \"12:00:00\")",
        "result": "true"
      },
      {
        "call": "intervalContainsTime(\"09:00:00\", \"17:00:00\", \"12:00:00\", \"13:00:00\")",
        "result": "true"
      },
      {
        "call": "intervalContainsTime(\"17:00:00\", \"09:00:00\", \"12:00:00\")",
        "result": "false"
      },
      {
        "call": "intervalContainsTime(\"09:00:00\", \"17:00:00\", \"12:00:00\", \"11:00:00\")",
        "result": "false"
      },
      {
        "call": "intervalContainsTime(\"invalid\", \"17:00:00\", \"12:00:00\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalCountDate",
    "fnName": "intervalCountDate",
    "examples": [
      {
        "call": "intervalCountDate(\"2024-01-01\", \"2024-01-03\", \"day\")",
        "result": "2"
      },
      {
        "call": "intervalCountDate(\"2024-01-15\", \"2024-03-10\", \"month\")",
        "result": "3"
      },
      {
        "call": "intervalCountDate(\"2024-01-15\", \"2024-01-15\", \"month\")",
        "result": "1 (zero-length, mid-month)"
      },
      {
        "call": "intervalCountDate(\"2024-01-01\", \"2024-01-01\", \"month\")",
        "result": "0 (zero-length, on the boundary)"
      },
      {
        "call": "intervalCountDate(\"2024-01-01\", \"2024-01-10\", \"hour\")",
        "result": "null"
      },
      {
        "call": "intervalCountDate(\"invalid\", \"2024-01-10\", \"day\")",
        "result": "null"
      },
      {
        "call": "intervalCountDate(\"5784-01-01[u-ca=hebrew]\", \"5785-01-01[u-ca=hebrew]\", \"month\")",
        "result": "13 (Hebrew leap year, measured in Hebrew)"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/startOfUnit",
    "fnName": "startOfUnit",
    "examples": []
  },
  {
    "route": "/reference/plain/interval/intervalCountDateTime",
    "fnName": "intervalCountDateTime",
    "examples": [
      {
        "call": "intervalCountDateTime(\"2024-01-01T23:59:00\", \"2024-01-02T00:01:00\", \"day\")",
        "result": "2"
      },
      {
        "call": "intervalCountDateTime(\"2024-01-01T00:00:00\", \"2024-01-03T00:00:00\", \"day\")",
        "result": "2"
      },
      {
        "call": "intervalCountDateTime(\"2024-01-01T10:30:00\", \"2024-01-01T12:00:00\", \"hour\")",
        "result": "2"
      },
      {
        "call": "intervalCountDateTime(\"2024-01-01T05:00:00\", \"2024-01-01T05:00:00\", \"day\")",
        "result": "1 (zero-length, mid-day)"
      },
      {
        "call": "intervalCountDateTime(\"2024-01-01T00:00:00\", \"2024-01-01T00:00:00\", \"day\")",
        "result": "0 (zero-length, on the boundary)"
      },
      {
        "call": "intervalCountDateTime(\"invalid\", \"2024-01-02T00:00:00\", \"day\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalCountTime",
    "fnName": "intervalCountTime",
    "examples": [
      {
        "call": "intervalCountTime(\"12:00:00\", \"14:00:00\", \"hour\")",
        "result": "2"
      },
      {
        "call": "intervalCountTime(\"12:30:00\", \"13:00:00\", \"hour\")",
        "result": "1"
      },
      {
        "call": "intervalCountTime(\"12:30:00\", \"12:30:00\", \"hour\")",
        "result": "1 (zero-length, mid-hour)"
      },
      {
        "call": "intervalCountTime(\"12:00:00\", \"12:00:00\", \"hour\")",
        "result": "0 (zero-length, on the boundary)"
      },
      {
        "call": "intervalCountTime(\"12:00:00\", \"14:00:00\", \"day\")",
        "result": "null"
      },
      {
        "call": "intervalCountTime(\"invalid\", \"14:00:00\", \"hour\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalDifferenceDate",
    "fnName": "intervalDifferenceDate",
    "examples": [
      {
        "call": "intervalDifferenceDate(\"2024-01-01\", \"2024-12-31\", \"2024-06-01\", \"2024-07-01\")",
        "result": "[{ start: \"2024-01-01\", end: \"2024-05-31\" }, { start: \"2024-07-02\", end: \"2024-12-31\" }]"
      },
      {
        "call": "intervalDifferenceDate(\"2024-01-01\", \"2024-12-31\", \"2024-03-01\", \"2024-10-31\")",
        "result": "[{ start: \"2024-01-01\", end: \"2024-02-29\" }, { start: \"2024-11-01\", end: \"2024-12-31\" }]"
      },
      {
        "call": "intervalDifferenceDate(\"2024-01-01\", \"2024-12-31\", \"2024-01-01\", \"2024-12-31\")",
        "result": "[]"
      },
      {
        "call": "intervalDifferenceDate(\"2024-01-01\", \"2024-12-31\", \"2024-06-01\", \"2024-12-31\")",
        "result": "[{ start: \"2024-01-01\", end: \"2024-05-31\" }]"
      },
      {
        "call": "intervalDifferenceDate(\"invalid\", \"2024-12-31\", \"2024-06-01\", \"2024-07-01\")",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalDifferenceDateTime",
    "fnName": "intervalDifferenceDateTime",
    "examples": [
      {
        "call": "intervalDifferenceDateTime(\"2024-01-01T09:00:00\", \"2024-12-31T17:00:00\", \"2024-06-01T12:00:00\", \"2024-07-01T13:00:00\")",
        "result": "[{ start: \"2024-01-01T09:00:00\", end: \"2024-05-31T17:00:00\" }, { start: \"2024-07-01T13:00:01\", end: \"2024-12-31T17:00:00\" }]"
      },
      {
        "call": "intervalDifferenceDateTime(\"2024-01-01T09:00:00\", \"2024-12-31T17:00:00\", \"2024-01-01T09:00:00\", \"2024-12-31T17:00:00\")",
        "result": "[]"
      },
      {
        "call": "intervalDifferenceDateTime(\"invalid\", \"2024-12-31T17:00:00\", \"2024-06-01T12:00:00\", \"2024-07-01T13:00:00\")",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalDifferenceTime",
    "fnName": "intervalDifferenceTime",
    "examples": [
      {
        "call": "intervalDifferenceTime(\"09:00:00\", \"17:00:00\", \"12:00:00\", \"13:00:00\")",
        "result": "[{ start: \"09:00:00\", end: \"11:59:59\" }, { start: \"13:00:01\", end: \"17:00:00\" }]"
      },
      {
        "call": "intervalDifferenceTime(\"09:00:00\", \"17:00:00\", \"09:00:00\", \"17:00:00\")",
        "result": "[]"
      },
      {
        "call": "intervalDifferenceTime(\"09:00:00\", \"17:00:00\", \"12:00:00\", \"17:00:00\")",
        "result": "[{ start: \"09:00:00\", end: \"11:59:59\" }]"
      },
      {
        "call": "intervalDifferenceTime(\"invalid\", \"17:00:00\", \"12:00:00\", \"13:00:00\")",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalDivideEquallyDate",
    "fnName": "intervalDivideEquallyDate",
    "examples": [
      {
        "call": "intervalDivideEquallyDate(\"2024-01-01\", \"2024-01-05\", 4)",
        "result": "[{ start: \"2024-01-01\", end: \"2024-01-02\" }, { start: \"2024-01-02\", end: \"2024-01-03\" }, { start: \"2024-01-03\", end: \"2024-01-04\" }, { start: \"2024-01-04\", end: \"2024-01-05\" }]"
      },
      {
        "call": "intervalDivideEquallyDate(\"2024-01-01\", \"2024-01-10\", 3)",
        "result": "[{ start: \"2024-01-01\", end: \"2024-01-04\" }, { start: \"2024-01-04\", end: \"2024-01-07\" }, { start: \"2024-01-07\", end: \"2024-01-10\" }]"
      },
      {
        "call": "intervalDivideEquallyDate(\"2024-01-01\", \"2024-01-10\", 1)",
        "result": "[{ start: \"2024-01-01\", end: \"2024-01-10\" }]"
      },
      {
        "call": "intervalDivideEquallyDate(\"2024-01-01\", \"2024-01-01\", 3)",
        "result": "[{ start: \"2024-01-01\", end: \"2024-01-01\" }, { start: \"2024-01-01\", end: \"2024-01-01\" }, { start: \"2024-01-01\", end: \"2024-01-01\" }]"
      },
      {
        "call": "intervalDivideEquallyDate(\"2024-01-01\", \"2024-01-10\", 0)",
        "result": "[]"
      },
      {
        "call": "intervalDivideEquallyDate(\"invalid\", \"2024-01-10\", 3)",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalDivideEquallyDateTime",
    "fnName": "intervalDivideEquallyDateTime",
    "examples": [
      {
        "call": "intervalDivideEquallyDateTime(\"2024-01-01T00:00:00\", \"2024-01-04T00:00:00\", 3)",
        "result": "[{ start: \"2024-01-01T00:00:00\", end: \"2024-01-02T00:00:00\" }, { start: \"2024-01-02T00:00:00\", end: \"2024-01-03T00:00:00\" }, { start: \"2024-01-03T00:00:00\", end: \"2024-01-04T00:00:00\" }]"
      },
      {
        "call": "intervalDivideEquallyDateTime(\"2024-01-01T00:00:00\", \"2024-01-04T00:00:00\", 1)",
        "result": "[{ start: \"2024-01-01T00:00:00\", end: \"2024-01-04T00:00:00\" }]"
      },
      {
        "call": "intervalDivideEquallyDateTime(\"2024-01-01T00:00:00\", \"2024-01-04T00:00:00\", 0)",
        "result": "[]"
      },
      {
        "call": "intervalDivideEquallyDateTime(\"invalid\", \"2024-01-04T00:00:00\", 3)",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalDivideEquallyTime",
    "fnName": "intervalDivideEquallyTime",
    "examples": [
      {
        "call": "intervalDivideEquallyTime(\"09:00:00\", \"17:00:00\", 4)",
        "result": "[{ start: \"09:00:00\", end: \"11:00:00\" }, { start: \"11:00:00\", end: \"13:00:00\" }, { start: \"13:00:00\", end: \"15:00:00\" }, { start: \"15:00:00\", end: \"17:00:00\" }]"
      },
      {
        "call": "intervalDivideEquallyTime(\"09:00:00\", \"17:00:00\", 3)",
        "result": "[{ start: \"09:00:00\", end: \"11:40:00\" }, { start: \"11:40:00\", end: \"14:20:00\" }, { start: \"14:20:00\", end: \"17:00:00\" }]"
      },
      {
        "call": "intervalDivideEquallyTime(\"09:00:00\", \"17:00:00\", 1)",
        "result": "[{ start: \"09:00:00\", end: \"17:00:00\" }]"
      },
      {
        "call": "intervalDivideEquallyTime(\"09:00:00\", \"17:00:00\", 0)",
        "result": "[]"
      },
      {
        "call": "intervalDivideEquallyTime(\"invalid\", \"17:00:00\", 3)",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalEngulfsDate",
    "fnName": "intervalEngulfsDate",
    "examples": [
      {
        "call": "intervalEngulfsDate(\"2024-01-01\", \"2024-12-31\", \"2024-06-01\", \"2024-07-01\")",
        "result": "true"
      },
      {
        "call": "intervalEngulfsDate(\"2024-01-01\", \"2024-12-31\", \"2024-01-01\", \"2024-12-31\")",
        "result": "true (equal intervals)"
      },
      {
        "call": "intervalEngulfsDate(\"2024-01-01\", \"2024-12-31\", \"2024-06-01\", \"2024-12-31\")",
        "result": "true"
      },
      {
        "call": "intervalEngulfsDate(\"2024-06-01\", \"2024-07-01\", \"2024-01-01\", \"2024-12-31\")",
        "result": "false"
      },
      {
        "call": "intervalEngulfsDate(\"invalid\", \"2024-12-31\", \"2024-06-01\", \"2024-07-01\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalEngulfsDateTime",
    "fnName": "intervalEngulfsDateTime",
    "examples": [
      {
        "call": "intervalEngulfsDateTime(\"2024-01-01T09:00:00\", \"2024-12-31T17:00:00\", \"2024-06-01T12:00:00\", \"2024-07-01T13:00:00\")",
        "result": "true"
      },
      {
        "call": "intervalEngulfsDateTime(\"2024-01-01T09:00:00\", \"2024-12-31T17:00:00\", \"2024-01-01T09:00:00\", \"2024-12-31T17:00:00\")",
        "result": "true (equal intervals)"
      },
      {
        "call": "intervalEngulfsDateTime(\"2024-01-01T09:00:00\", \"2024-12-31T17:00:00\", \"2024-01-01T09:00:00\", \"2024-06-30T12:00:00\")",
        "result": "true"
      },
      {
        "call": "intervalEngulfsDateTime(\"2024-06-01T12:00:00\", \"2024-07-01T13:00:00\", \"2024-01-01T09:00:00\", \"2024-12-31T17:00:00\")",
        "result": "false"
      },
      {
        "call": "intervalEngulfsDateTime(\"invalid\", \"2024-12-31T17:00:00\", \"2024-06-01T12:00:00\", \"2024-07-01T13:00:00\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalEngulfsTime",
    "fnName": "intervalEngulfsTime",
    "examples": [
      {
        "call": "intervalEngulfsTime(\"09:00:00\", \"17:00:00\", \"12:00:00\", \"13:00:00\")",
        "result": "true"
      },
      {
        "call": "intervalEngulfsTime(\"09:00:00\", \"17:00:00\", \"09:00:00\", \"17:00:00\")",
        "result": "true (equal intervals)"
      },
      {
        "call": "intervalEngulfsTime(\"09:00:00\", \"17:00:00\", \"09:00:00\", \"12:00:00\")",
        "result": "true"
      },
      {
        "call": "intervalEngulfsTime(\"12:00:00\", \"13:00:00\", \"09:00:00\", \"17:00:00\")",
        "result": "false"
      },
      {
        "call": "intervalEngulfsTime(\"invalid\", \"17:00:00\", \"12:00:00\", \"13:00:00\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalFromDurationDate",
    "fnName": "intervalFromDurationDate",
    "examples": [
      {
        "call": "intervalFromDurationDate(\"2024-01-01\", \"P1M\", \"start\")",
        "result": "{ start: \"2024-01-01\", end: \"2024-02-01\" }"
      },
      {
        "call": "intervalFromDurationDate(\"2024-02-01\", \"P1M\", \"end\")",
        "result": "{ start: \"2024-01-01\", end: \"2024-02-01\" }"
      },
      {
        "call": "intervalFromDurationDate(\"2024-01-31\", \"P1M\", \"start\", { overflow: \"reject\" })",
        "result": "null"
      },
      {
        "call": "intervalFromDurationDate(\"2024-01-05\", \"-P10D\", \"start\")",
        "result": "null (inverted span)"
      },
      {
        "call": "intervalFromDurationDate(\"invalid\", \"P1M\", \"start\")",
        "result": "null"
      },
      {
        "call": "intervalFromDurationDate(\"5784-06-15[u-ca=hebrew]\", \"P1M\", \"start\")",
        "result": "{ start: \"5784-06-15[u-ca=hebrew]\", end: \"5784-07-15[u-ca=hebrew]\" } (Adar I -> Adar)"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalFromDurationDateTime",
    "fnName": "intervalFromDurationDateTime",
    "examples": [
      {
        "call": "intervalFromDurationDateTime(\"2024-01-01T00:00:00\", \"P1DT2H\", \"start\")",
        "result": "{ start: \"2024-01-01T00:00:00\", end: \"2024-01-02T02:00:00\" }"
      },
      {
        "call": "intervalFromDurationDateTime(\"2024-01-02T02:00:00\", \"P1DT2H\", \"end\")",
        "result": "{ start: \"2024-01-01T00:00:00\", end: \"2024-01-02T02:00:00\" }"
      },
      {
        "call": "intervalFromDurationDateTime(\"2024-01-31T12:00:00\", \"P1M\", \"start\", { overflow: \"reject\" })",
        "result": "null"
      },
      {
        "call": "intervalFromDurationDateTime(\"2024-01-05T00:00:00\", \"-P10D\", \"start\")",
        "result": "null (inverted span)"
      },
      {
        "call": "intervalFromDurationDateTime(\"invalid\", \"P1D\", \"start\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalFromDurationTime",
    "fnName": "intervalFromDurationTime",
    "examples": [
      {
        "call": "intervalFromDurationTime(\"12:00:00\", \"PT1H\", \"start\")",
        "result": "{ start: \"12:00:00\", end: \"13:00:00\" }"
      },
      {
        "call": "intervalFromDurationTime(\"13:00:00\", \"PT1H\", \"end\")",
        "result": "{ start: \"12:00:00\", end: \"13:00:00\" }"
      },
      {
        "call": "intervalFromDurationTime(\"12:00:00\", \"P1D\", \"start\")",
        "result": "null (date units need relativeTo, unsupported)"
      },
      {
        "call": "intervalFromDurationTime(\"23:00:00\", \"PT2H\", \"start\")",
        "result": "null (wraps past midnight, inverted span)"
      },
      {
        "call": "intervalFromDurationTime(\"invalid\", \"PT1H\", \"start\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalIntersectionDate",
    "fnName": "intervalIntersectionDate",
    "examples": [
      {
        "call": "intervalIntersectionDate(\"2024-01-01\", \"2024-06-30\", \"2024-04-01\", \"2024-12-31\")",
        "result": "{ start: \"2024-04-01\", end: \"2024-06-30\" }"
      },
      {
        "call": "intervalIntersectionDate(\"2024-01-01\", \"2024-06-30\", \"2024-06-30\", \"2024-12-31\")",
        "result": "{ start: \"2024-06-30\", end: \"2024-06-30\" }"
      },
      {
        "call": "intervalIntersectionDate(\"2024-01-01\", \"2024-06-30\", \"2024-07-01\", \"2024-12-31\")",
        "result": "null"
      },
      {
        "call": "intervalIntersectionDate(\"2024-01-01\", \"2024-06-30\", \"2024-02-01\", \"2024-03-01\")",
        "result": "{ start: \"2024-02-01\", end: \"2024-03-01\" }"
      },
      {
        "call": "intervalIntersectionDate(\"invalid\", \"2024-06-30\", \"2024-04-01\", \"2024-12-31\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalIntersectionDateTime",
    "fnName": "intervalIntersectionDateTime",
    "examples": [
      {
        "call": "intervalIntersectionDateTime(\"2024-01-01T10:00:00\", \"2024-06-30T23:59:59\", \"2024-04-01T00:00:00\", \"2024-12-31T23:59:59\")",
        "result": "{ start: \"2024-04-01T00:00:00\", end: \"2024-06-30T23:59:59\" }"
      },
      {
        "call": "intervalIntersectionDateTime(\"2024-01-01T10:00:00\", \"2024-06-30T23:59:59\", \"2024-07-01T00:00:00\", \"2024-12-31T23:59:59\")",
        "result": "null"
      },
      {
        "call": "intervalIntersectionDateTime(\"2024-01-01T10:00:00\", \"2024-06-30T23:59:59\", \"2024-07-02T00:00:00\", \"2024-12-31T23:59:59\")",
        "result": "null"
      },
      {
        "call": "intervalIntersectionDateTime(\"invalid\", \"2024-06-30T23:59:59\", \"2024-04-01T00:00:00\", \"2024-12-31T23:59:59\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalIntersectionTime",
    "fnName": "intervalIntersectionTime",
    "examples": [
      {
        "call": "intervalIntersectionTime(\"09:00:00\", \"17:00:00\", \"12:00:00\", \"18:00:00\")",
        "result": "{ start: \"12:00:00\", end: \"17:00:00\" }"
      },
      {
        "call": "intervalIntersectionTime(\"09:00:00\", \"17:00:00\", \"17:00:00\", \"18:00:00\")",
        "result": "{ start: \"17:00:00\", end: \"17:00:00\" }"
      },
      {
        "call": "intervalIntersectionTime(\"09:00:00\", \"17:00:00\", \"18:00:00\", \"20:00:00\")",
        "result": "null"
      },
      {
        "call": "intervalIntersectionTime(\"09:00:00\", \"17:00:00\", \"10:00:00\", \"11:00:00\")",
        "result": "{ start: \"10:00:00\", end: \"11:00:00\" }"
      },
      {
        "call": "intervalIntersectionTime(\"invalid\", \"17:00:00\", \"12:00:00\", \"18:00:00\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalLengthDate",
    "fnName": "intervalLengthDate",
    "examples": [
      {
        "call": "intervalLengthDate(\"2024-01-01\", \"2024-01-03\", \"day\")",
        "result": "2"
      },
      {
        "call": "intervalLengthDate(\"2024-01-01\", \"2024-01-16\", \"day\")",
        "result": "15"
      },
      {
        "call": "intervalLengthDate(\"2024-01-01\", \"2024-01-16\", \"month\")",
        "result": "0.4838709677419355 (15 of January's 31 days)"
      },
      {
        "call": "intervalLengthDate(\"2024-01-01\", \"2024-01-01\", \"day\")",
        "result": "0"
      },
      {
        "call": "intervalLengthDate(\"2024-01-01\", \"2024-01-10\", \"hour\")",
        "result": "null"
      },
      {
        "call": "intervalLengthDate(\"invalid\", \"2024-01-10\", \"day\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalLengthDateTime",
    "fnName": "intervalLengthDateTime",
    "examples": [
      {
        "call": "intervalLengthDateTime(\"2024-01-01T23:59:00\", \"2024-01-02T00:01:00\", \"day\")",
        "result": "0.001388888888888889"
      },
      {
        "call": "intervalLengthDateTime(\"2024-01-01T23:59:00\", \"2024-01-02T00:01:00\", \"minute\")",
        "result": "2"
      },
      {
        "call": "intervalLengthDateTime(\"2024-01-01T00:00:00\", \"2024-01-01T00:00:00\", \"day\")",
        "result": "0"
      },
      {
        "call": "intervalLengthDateTime(\"invalid\", \"2024-01-02T00:00:00\", \"day\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalLengthTime",
    "fnName": "intervalLengthTime",
    "examples": [
      {
        "call": "intervalLengthTime(\"12:00:00\", \"14:30:00\", \"hour\")",
        "result": "2.5"
      },
      {
        "call": "intervalLengthTime(\"12:59:00\", \"13:01:00\", \"hour\")",
        "result": "0.03333333333333333"
      },
      {
        "call": "intervalLengthTime(\"12:00:00\", \"12:00:00\", \"hour\")",
        "result": "0"
      },
      {
        "call": "intervalLengthTime(\"12:00:00\", \"14:00:00\", \"day\")",
        "result": "null"
      },
      {
        "call": "intervalLengthTime(\"invalid\", \"14:00:00\", \"hour\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalOverlappingDaysDate",
    "fnName": "intervalOverlappingDaysDate",
    "examples": [
      {
        "call": "intervalOverlappingDaysDate(\"2024-01-01\", \"2024-06-30\", \"2024-04-01\", \"2024-12-31\")",
        "result": "91"
      },
      {
        "call": "intervalOverlappingDaysDate(\"2024-01-01\", \"2024-12-31\", \"2024-02-01\", \"2024-02-29\")",
        "result": "29"
      },
      {
        "call": "intervalOverlappingDaysDate(\"2024-01-01\", \"2024-06-30\", \"2024-06-30\", \"2024-12-31\")",
        "result": "1 (adjacent)"
      },
      {
        "call": "intervalOverlappingDaysDate(\"2024-01-01\", \"2024-06-30\", \"2024-07-01\", \"2024-12-31\")",
        "result": "0 (disjoint)"
      },
      {
        "call": "intervalOverlappingDaysDate(\"invalid\", \"2024-06-30\", \"2024-04-01\", \"2024-12-31\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalOverlappingDaysDateTime",
    "fnName": "intervalOverlappingDaysDateTime",
    "examples": [
      {
        "call": "intervalOverlappingDaysDateTime(\"2024-01-01T23:59:00\", \"2024-01-02T00:01:00\", \"2024-01-01T23:59:00\", \"2024-01-02T00:01:00\")",
        "result": "2"
      },
      {
        "call": "intervalOverlappingDaysDateTime(\"2024-01-01T00:00:00\", \"2024-01-02T00:00:00\", \"2024-01-02T00:00:00\", \"2024-01-03T00:00:00\")",
        "result": "1 (adjacent)"
      },
      {
        "call": "intervalOverlappingDaysDateTime(\"2024-01-01T00:00:00\", \"2024-01-02T00:00:00\", \"2024-01-02T00:00:00.001\", \"2024-01-03T00:00:00\")",
        "result": "0 (disjoint)"
      },
      {
        "call": "intervalOverlappingDaysDateTime(\"invalid\", \"2024-06-30T23:59:59\", \"2024-04-01T00:00:00\", \"2024-12-31T23:59:59\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalSplitAtDate",
    "fnName": "intervalSplitAtDate",
    "examples": [
      {
        "call": "intervalSplitAtDate(\"2024-01-01\", \"2024-01-10\", [\"2024-01-05\"])",
        "result": "[{ start: \"2024-01-01\", end: \"2024-01-05\" }, { start: \"2024-01-05\", end: \"2024-01-10\" }]"
      },
      {
        "call": "intervalSplitAtDate(\"2024-01-01\", \"2024-01-10\", [\"2024-01-07\", \"2024-01-03\"])",
        "result": "[{ start: \"2024-01-01\", end: \"2024-01-03\" }, { start: \"2024-01-03\", end: \"2024-01-07\" }, { start: \"2024-01-07\", end: \"2024-01-10\" }]"
      },
      {
        "call": "intervalSplitAtDate(\"2024-01-01\", \"2024-01-10\", [\"2024-01-01\", \"2024-01-10\", \"2024-06-01\"])",
        "result": "[{ start: \"2024-01-01\", end: \"2024-01-10\" }] (start, end, and out-of-range points all drop)"
      },
      {
        "call": "intervalSplitAtDate(\"2024-01-01\", \"2024-01-10\", [])",
        "result": "[{ start: \"2024-01-01\", end: \"2024-01-10\" }]"
      },
      {
        "call": "intervalSplitAtDate(\"invalid\", \"2024-01-10\", [\"2024-01-05\"])",
        "result": "[]"
      },
      {
        "call": "intervalSplitAtDate(\"2024-01-01\", \"2024-01-10\", [\"not-a-date\"])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalSplitAtDateTime",
    "fnName": "intervalSplitAtDateTime",
    "examples": [
      {
        "call": "intervalSplitAtDateTime(\"2024-01-01T00:00:00\", \"2024-01-10T00:00:00\", [\"2024-01-05T00:00:00\"])",
        "result": "[{ start: \"2024-01-01T00:00:00\", end: \"2024-01-05T00:00:00\" }, { start: \"2024-01-05T00:00:00\", end: \"2024-01-10T00:00:00\" }]"
      },
      {
        "call": "intervalSplitAtDateTime(\"2024-01-01T00:00:00\", \"2024-01-10T00:00:00\", [])",
        "result": "[{ start: \"2024-01-01T00:00:00\", end: \"2024-01-10T00:00:00\" }]"
      },
      {
        "call": "intervalSplitAtDateTime(\"invalid\", \"2024-01-10T00:00:00\", [\"2024-01-05T00:00:00\"])",
        "result": "[]"
      },
      {
        "call": "intervalSplitAtDateTime(\"2024-01-01T00:00:00\", \"2024-01-10T00:00:00\", [\"not-a-datetime\"])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalSplitAtTime",
    "fnName": "intervalSplitAtTime",
    "examples": [
      {
        "call": "intervalSplitAtTime(\"09:00:00\", \"17:00:00\", [\"12:00:00\"])",
        "result": "[{ start: \"09:00:00\", end: \"12:00:00\" }, { start: \"12:00:00\", end: \"17:00:00\" }]"
      },
      {
        "call": "intervalSplitAtTime(\"09:00:00\", \"17:00:00\", [\"15:00:00\", \"11:00:00\"])",
        "result": "[{ start: \"09:00:00\", end: \"11:00:00\" }, { start: \"11:00:00\", end: \"15:00:00\" }, { start: \"15:00:00\", end: \"17:00:00\" }]"
      },
      {
        "call": "intervalSplitAtTime(\"09:00:00\", \"17:00:00\", [\"09:00:00\", \"17:00:00\", \"20:00:00\"])",
        "result": "[{ start: \"09:00:00\", end: \"17:00:00\" }]"
      },
      {
        "call": "intervalSplitAtTime(\"09:00:00\", \"17:00:00\", [])",
        "result": "[{ start: \"09:00:00\", end: \"17:00:00\" }]"
      },
      {
        "call": "intervalSplitAtTime(\"invalid\", \"17:00:00\", [\"12:00:00\"])",
        "result": "[]"
      },
      {
        "call": "intervalSplitAtTime(\"09:00:00\", \"17:00:00\", [\"not-a-time\"])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalUnionDate",
    "fnName": "intervalUnionDate",
    "examples": [
      {
        "call": "intervalUnionDate(\"2024-01-01\", \"2024-06-30\", \"2024-04-01\", \"2024-12-31\")",
        "result": "{ start: \"2024-01-01\", end: \"2024-12-31\" }"
      },
      {
        "call": "intervalUnionDate(\"2024-01-01\", \"2024-06-30\", \"2024-06-30\", \"2024-12-31\")",
        "result": "{ start: \"2024-01-01\", end: \"2024-12-31\" }"
      },
      {
        "call": "intervalUnionDate(\"2024-01-01\", \"2024-06-30\", \"2024-07-01\", \"2024-12-31\")",
        "result": "null"
      },
      {
        "call": "intervalUnionDate(\"invalid\", \"2024-06-30\", \"2024-04-01\", \"2024-12-31\")",
        "result": "null"
      },
      {
        "call": "intervalUnionDate(\"5785-01-01[u-ca=hebrew]\", \"2024-06-30\", \"2024-04-01\", \"2024-12-31\")",
        "result": "null (mismatched calendars)"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalUnionDateTime",
    "fnName": "intervalUnionDateTime",
    "examples": [
      {
        "call": "intervalUnionDateTime(\"2024-01-01T10:00:00\", \"2024-06-30T23:59:59\", \"2024-04-01T00:00:00\", \"2024-12-31T23:59:59\")",
        "result": "{ start: \"2024-01-01T10:00:00\", end: \"2024-12-31T23:59:59\" }"
      },
      {
        "call": "intervalUnionDateTime(\"2024-01-01T10:00:00\", \"2024-06-30T23:59:59\", \"2024-06-30T23:59:59\", \"2024-12-31T23:59:59\")",
        "result": "{ start: \"2024-01-01T10:00:00\", end: \"2024-12-31T23:59:59\" }"
      },
      {
        "call": "intervalUnionDateTime(\"2024-01-01T10:00:00\", \"2024-06-30T23:59:59\", \"2024-07-01T00:00:00\", \"2024-12-31T23:59:59\")",
        "result": "null"
      },
      {
        "call": "intervalUnionDateTime(\"invalid\", \"2024-06-30T23:59:59\", \"2024-04-01T00:00:00\", \"2024-12-31T23:59:59\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalUnionTime",
    "fnName": "intervalUnionTime",
    "examples": [
      {
        "call": "intervalUnionTime(\"09:00:00\", \"17:00:00\", \"12:00:00\", \"18:00:00\")",
        "result": "{ start: \"09:00:00\", end: \"18:00:00\" }"
      },
      {
        "call": "intervalUnionTime(\"09:00:00\", \"17:00:00\", \"17:00:00\", \"18:00:00\")",
        "result": "{ start: \"09:00:00\", end: \"18:00:00\" }"
      },
      {
        "call": "intervalUnionTime(\"09:00:00\", \"17:00:00\", \"18:00:00\", \"20:00:00\")",
        "result": "null"
      },
      {
        "call": "intervalUnionTime(\"invalid\", \"17:00:00\", \"12:00:00\", \"18:00:00\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalXorAllDate",
    "fnName": "intervalXorAllDate",
    "examples": [
      {
        "call": "intervalXorAllDate([{ start: \"2024-01-01\", end: \"2024-01-10\" }, { start: \"2024-01-05\", end: \"2024-01-15\" }, { start: \"2024-01-08\", end: \"2024-01-20\" }])",
        "result": "[{ start: \"2024-01-01\", end: \"2024-01-04\" }, { start: \"2024-01-08\", end: \"2024-01-10\" }, { start: \"2024-01-16\", end: \"2024-01-20\" }]"
      },
      {
        "call": "intervalXorAllDate([{ start: \"2024-01-01\", end: \"2024-01-05\" }, { start: \"2024-01-01\", end: \"2024-01-05\" }])",
        "result": "[] (identical intervals cancel out)"
      },
      {
        "call": "intervalXorAllDate([])",
        "result": "[]"
      },
      {
        "call": "intervalXorAllDate([{ start: \"2024-01-10\", end: \"2024-01-01\" }])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalXorAllDateTime",
    "fnName": "intervalXorAllDateTime",
    "examples": [
      {
        "call": "intervalXorAllDateTime([{ start: \"2024-01-01T00:00:00\", end: \"2024-01-10T00:00:00\" }, { start: \"2024-01-05T00:00:00\", end: \"2024-01-15T00:00:00\" }])",
        "result": "[{ start: \"2024-01-01T00:00:00\", end: \"2024-01-04T23:59:59.999999999\" }, { start: \"2024-01-10T00:00:00.000000001\", end: \"2024-01-15T00:00:00\" }]"
      },
      {
        "call": "intervalXorAllDateTime([])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalXorAllTime",
    "fnName": "intervalXorAllTime",
    "examples": [
      {
        "call": "intervalXorAllTime([{ start: \"09:00:00\", end: \"12:00:00\" }, { start: \"11:00:00\", end: \"15:00:00\" }])",
        "result": "[{ start: \"09:00:00\", end: \"10:59:59.999999999\" }, { start: \"12:00:00.000000001\", end: \"15:00:00\" }]"
      },
      {
        "call": "intervalXorAllTime([])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalXorDate",
    "fnName": "intervalXorDate",
    "examples": [
      {
        "call": "intervalXorDate(\"2024-01-01\", \"2024-06-30\", \"2024-04-01\", \"2024-12-31\")",
        "result": "[{ start: \"2024-01-01\", end: \"2024-03-31\" }, { start: \"2024-07-01\", end: \"2024-12-31\" }]"
      },
      {
        "call": "intervalXorDate(\"2024-01-01\", \"2024-12-31\", \"2024-04-01\", \"2024-06-30\")",
        "result": "[{ start: \"2024-01-01\", end: \"2024-03-31\" }, { start: \"2024-07-01\", end: \"2024-12-31\" }]"
      },
      {
        "call": "intervalXorDate(\"2024-01-01\", \"2024-12-31\", \"2024-01-01\", \"2024-12-31\")",
        "result": "[]"
      },
      {
        "call": "intervalXorDate(\"2024-01-01\", \"2024-06-30\", \"2024-07-01\", \"2024-12-31\")",
        "result": "[{ start: \"2024-01-01\", end: \"2024-06-30\" }, { start: \"2024-07-01\", end: \"2024-12-31\" }]"
      },
      {
        "call": "intervalXorDate(\"invalid\", \"2024-06-30\", \"2024-07-01\", \"2024-12-31\")",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalXorDateTime",
    "fnName": "intervalXorDateTime",
    "examples": [
      {
        "call": "intervalXorDateTime(\"2024-01-01T09:00:00\", \"2024-06-30T12:00:00\", \"2024-04-01T11:00:00\", \"2024-12-31T17:00:00\")",
        "result": "[{ start: \"2024-01-01T09:00:00\", end: \"2024-03-31T17:00:00\" }, { start: \"2024-06-30T12:00:01\", end: \"2024-12-31T17:00:00\" }]"
      },
      {
        "call": "intervalXorDateTime(\"2024-01-01T09:00:00\", \"2024-12-31T17:00:00\", \"2024-04-01T11:00:00\", \"2024-06-30T12:00:00\")",
        "result": "[{ start: \"2024-01-01T09:00:00\", end: \"2024-03-31T17:00:00\" }, { start: \"2024-06-30T12:00:01\", end: \"2024-12-31T17:00:00\" }]"
      },
      {
        "call": "intervalXorDateTime(\"2024-01-01T09:00:00\", \"2024-12-31T17:00:00\", \"2024-01-01T09:00:00\", \"2024-12-31T17:00:00\")",
        "result": "[]"
      },
      {
        "call": "intervalXorDateTime(\"invalid\", \"2024-06-30T12:00:00\", \"2024-07-01T13:00:00\", \"2024-12-31T17:00:00\")",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalXorTime",
    "fnName": "intervalXorTime",
    "examples": [
      {
        "call": "intervalXorTime(\"09:00:00\", \"12:00:00\", \"11:00:00\", \"17:00:00\")",
        "result": "[{ start: \"09:00:00\", end: \"10:59:59\" }, { start: \"12:00:01\", end: \"17:00:00\" }]"
      },
      {
        "call": "intervalXorTime(\"09:00:00\", \"17:00:00\", \"11:00:00\", \"12:00:00\")",
        "result": "[{ start: \"09:00:00\", end: \"10:59:59\" }, { start: \"12:00:01\", end: \"17:00:00\" }]"
      },
      {
        "call": "intervalXorTime(\"09:00:00\", \"17:00:00\", \"09:00:00\", \"17:00:00\")",
        "result": "[]"
      },
      {
        "call": "intervalXorTime(\"09:00:00\", \"12:00:00\", \"13:00:00\", \"17:00:00\")",
        "result": "[{ start: \"09:00:00\", end: \"12:00:00\" }, { start: \"13:00:00\", end: \"17:00:00\" }]"
      },
      {
        "call": "intervalXorTime(\"invalid\", \"12:00:00\", \"13:00:00\", \"17:00:00\")",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalsOverlapDate",
    "fnName": "intervalsOverlapDate",
    "examples": [
      {
        "call": "intervalsOverlapDate(\"2024-01-01\", \"2024-06-30\", \"2024-04-01\", \"2024-12-31\")",
        "result": "true"
      },
      {
        "call": "intervalsOverlapDate(\"2024-01-01\", \"2024-06-30\", \"2024-07-01\", \"2024-12-31\")",
        "result": "false (adjacent)"
      },
      {
        "call": "intervalsOverlapDate(\"2024-01-01\", \"2024-06-30\", \"2024-07-02\", \"2024-12-31\")",
        "result": "false (disjoint)"
      },
      {
        "call": "intervalsOverlapDate(\"2024-01-01\", \"2024-06-30\", \"2024-02-01\", \"2024-03-01\")",
        "result": "true (partial)"
      },
      {
        "call": "intervalsOverlapDate(\"invalid\", \"2024-06-30\", \"2024-04-01\", \"2024-12-31\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalsOverlapDateTime",
    "fnName": "intervalsOverlapDateTime",
    "examples": [
      {
        "call": "intervalsOverlapDateTime(\"2024-01-01T10:00:00\", \"2024-06-30T23:59:59\", \"2024-04-01T00:00:00\", \"2024-12-31T23:59:59\")",
        "result": "true"
      },
      {
        "call": "intervalsOverlapDateTime(\"2024-01-01T10:00:00\", \"2024-06-30T23:59:59\", \"2024-07-01T00:00:00\", \"2024-12-31T23:59:59\")",
        "result": "false (adjacent)"
      },
      {
        "call": "intervalsOverlapDateTime(\"2024-01-01T10:00:00\", \"2024-06-30T23:59:59\", \"2024-07-02T00:00:00\", \"2024-12-31T23:59:59\")",
        "result": "false (disjoint)"
      },
      {
        "call": "intervalsOverlapDateTime(\"invalid\", \"2024-06-30T23:59:59\", \"2024-04-01T00:00:00\", \"2024-12-31T23:59:59\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/intervalsOverlapTime",
    "fnName": "intervalsOverlapTime",
    "examples": [
      {
        "call": "intervalsOverlapTime(\"09:00:00\", \"17:00:00\", \"12:00:00\", \"18:00:00\")",
        "result": "true"
      },
      {
        "call": "intervalsOverlapTime(\"09:00:00\", \"17:00:00\", \"17:00:00\", \"18:00:00\")",
        "result": "false (adjacent)"
      },
      {
        "call": "intervalsOverlapTime(\"09:00:00\", \"17:00:00\", \"18:00:00\", \"20:00:00\")",
        "result": "false (disjoint)"
      },
      {
        "call": "intervalsOverlapTime(\"09:00:00\", \"17:00:00\", \"10:00:00\", \"11:00:00\")",
        "result": "true (contained)"
      },
      {
        "call": "intervalsOverlapTime(\"invalid\", \"17:00:00\", \"12:00:00\", \"18:00:00\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/mergeIntervalsDate",
    "fnName": "mergeIntervalsDate",
    "examples": [
      {
        "call": "mergeIntervalsDate([{ start: \"2024-01-01\", end: \"2024-01-10\" }, { start: \"2024-01-05\", end: \"2024-01-15\" }])",
        "result": "[{ start: \"2024-01-01\", end: \"2024-01-15\" }]"
      },
      {
        "call": "mergeIntervalsDate([{ start: \"2024-01-01\", end: \"2024-01-10\" }, { start: \"2024-01-10\", end: \"2024-01-20\" }])",
        "result": "[{ start: \"2024-01-01\", end: \"2024-01-20\" }] (adjacent, merged)"
      },
      {
        "call": "mergeIntervalsDate([{ start: \"2024-01-01\", end: \"2024-01-05\" }, { start: \"2024-01-10\", end: \"2024-01-15\" }])",
        "result": "[{ start: \"2024-01-01\", end: \"2024-01-05\" }, { start: \"2024-01-10\", end: \"2024-01-15\" }] (disjoint)"
      },
      {
        "call": "mergeIntervalsDate([])",
        "result": "[]"
      },
      {
        "call": "mergeIntervalsDate([{ start: \"2024-01-10\", end: \"2024-01-01\" }])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/mergeIntervalsDateTime",
    "fnName": "mergeIntervalsDateTime",
    "examples": [
      {
        "call": "mergeIntervalsDateTime([{ start: \"2024-01-01T00:00:00\", end: \"2024-01-10T00:00:00\" }, { start: \"2024-01-05T00:00:00\", end: \"2024-01-15T00:00:00\" }])",
        "result": "[{ start: \"2024-01-01T00:00:00\", end: \"2024-01-15T00:00:00\" }]"
      },
      {
        "call": "mergeIntervalsDateTime([])",
        "result": "[]"
      },
      {
        "call": "mergeIntervalsDateTime([{ start: \"2024-01-10T00:00:00\", end: \"2024-01-01T00:00:00\" }])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/mergeIntervalsTime",
    "fnName": "mergeIntervalsTime",
    "examples": [
      {
        "call": "mergeIntervalsTime([{ start: \"09:00:00\", end: \"12:00:00\" }, { start: \"11:00:00\", end: \"15:00:00\" }])",
        "result": "[{ start: \"09:00:00\", end: \"15:00:00\" }]"
      },
      {
        "call": "mergeIntervalsTime([])",
        "result": "[]"
      },
      {
        "call": "mergeIntervalsTime([{ start: \"15:00:00\", end: \"09:00:00\" }])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/splitIntervalByUnitDate",
    "fnName": "splitIntervalByUnitDate",
    "examples": [
      {
        "call": "splitIntervalByUnitDate(\"2024-01-01\", \"2024-01-10\", \"day\", 2)",
        "result": "[{ start: \"2024-01-01\", end: \"2024-01-03\" }, { start: \"2024-01-03\", end: \"2024-01-05\" }, { start: \"2024-01-05\", end: \"2024-01-07\" }, { start: \"2024-01-07\", end: \"2024-01-09\" }, { start: \"2024-01-09\", end: \"2024-01-10\" }]"
      },
      {
        "call": "splitIntervalByUnitDate(\"2024-01-01\", \"2024-01-09\", \"day\", 2)",
        "result": "[{ start: \"2024-01-01\", end: \"2024-01-03\" }, { start: \"2024-01-03\", end: \"2024-01-05\" }, { start: \"2024-01-05\", end: \"2024-01-07\" }, { start: \"2024-01-07\", end: \"2024-01-09\" }]"
      },
      {
        "call": "splitIntervalByUnitDate(\"2024-01-01\", \"2024-01-01\", \"day\", 2)",
        "result": "[{ start: \"2024-01-01\", end: \"2024-01-01\" }]"
      },
      {
        "call": "splitIntervalByUnitDate(\"2024-01-01\", \"2024-01-10\", \"day\", 0)",
        "result": "[]"
      },
      {
        "call": "splitIntervalByUnitDate(\"invalid\", \"2024-01-10\", \"day\", 2)",
        "result": "[]"
      },
      {
        "call": "splitIntervalByUnitDate(\"5784-01-01[u-ca=hebrew]\", \"5785-01-01[u-ca=hebrew]\", \"month\", 1)",
        "result": "13 slices, tiling the Hebrew leap year (including Adar I)"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/splitIntervalByUnitDateTime",
    "fnName": "splitIntervalByUnitDateTime",
    "examples": [
      {
        "call": "splitIntervalByUnitDateTime(\"2024-01-01T12:00:00\", \"2024-01-01T14:00:00\", \"hour\", 1)",
        "result": "[{ start: \"2024-01-01T12:00:00\", end: \"2024-01-01T13:00:00\" }, { start: \"2024-01-01T13:00:00\", end: \"2024-01-01T14:00:00\" }]"
      },
      {
        "call": "splitIntervalByUnitDateTime(\"2024-01-01T12:00:00\", \"2024-01-01T14:30:00\", \"hour\", 1)",
        "result": "[{ start: \"2024-01-01T12:00:00\", end: \"2024-01-01T13:00:00\" }, { start: \"2024-01-01T13:00:00\", end: \"2024-01-01T14:00:00\" }, { start: \"2024-01-01T14:00:00\", end: \"2024-01-01T14:30:00\" }]"
      },
      {
        "call": "splitIntervalByUnitDateTime(\"2024-01-01T12:00:00\", \"2024-01-01T12:00:00\", \"hour\", 1)",
        "result": "[{ start: \"2024-01-01T12:00:00\", end: \"2024-01-01T12:00:00\" }]"
      },
      {
        "call": "splitIntervalByUnitDateTime(\"2024-01-01T12:00:00\", \"2024-01-01T14:00:00\", \"hour\", 0)",
        "result": "[]"
      },
      {
        "call": "splitIntervalByUnitDateTime(\"invalid\", \"2024-01-01T14:00:00\", \"hour\", 1)",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/splitIntervalByUnitTime",
    "fnName": "splitIntervalByUnitTime",
    "examples": [
      {
        "call": "splitIntervalByUnitTime(\"12:00:00\", \"14:00:00\", \"hour\", 1)",
        "result": "[{ start: \"12:00:00\", end: \"13:00:00\" }, { start: \"13:00:00\", end: \"14:00:00\" }]"
      },
      {
        "call": "splitIntervalByUnitTime(\"12:00:00\", \"14:30:00\", \"hour\", 1)",
        "result": "[{ start: \"12:00:00\", end: \"13:00:00\" }, { start: \"13:00:00\", end: \"14:00:00\" }, { start: \"14:00:00\", end: \"14:30:00\" }]"
      },
      {
        "call": "splitIntervalByUnitTime(\"12:00:00\", \"12:00:00\", \"hour\", 1)",
        "result": "[{ start: \"12:00:00\", end: \"12:00:00\" }]"
      },
      {
        "call": "splitIntervalByUnitTime(\"12:00:00\", \"14:00:00\", \"hour\", 0)",
        "result": "[]"
      },
      {
        "call": "splitIntervalByUnitTime(\"invalid\", \"14:00:00\", \"hour\", 1)",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/isValidDateInterval",
    "fnName": "isValidDateInterval",
    "examples": [
      {
        "call": "isValidDateInterval(\"2024-01-01\", \"2024-12-31\")",
        "result": "true"
      },
      {
        "call": "isValidDateInterval(\"2024-01-01\", \"2024-01-01\")",
        "result": "true"
      },
      {
        "call": "isValidDateInterval(\"2024-12-31\", \"2024-01-01\")",
        "result": "false"
      },
      {
        "call": "isValidDateInterval(\"invalid\", \"2024-12-31\")",
        "result": "false"
      },
      {
        "call": "isValidDateInterval(\"5785-01-01[u-ca=hebrew]\", \"2024-12-31\")",
        "result": "true (mixed calendars — ordering is calendar-independent)"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/isValidDateTimeInterval",
    "fnName": "isValidDateTimeInterval",
    "examples": [
      {
        "call": "isValidDateTimeInterval(\"2024-01-01T10:00:00\", \"2024-12-31T23:59:59\")",
        "result": "true"
      },
      {
        "call": "isValidDateTimeInterval(\"2024-01-01T10:00:00\", \"2024-01-01T10:00:00\")",
        "result": "true"
      },
      {
        "call": "isValidDateTimeInterval(\"2024-12-31T23:59:59\", \"2024-01-01T10:00:00\")",
        "result": "false"
      },
      {
        "call": "isValidDateTimeInterval(\"invalid\", \"2024-12-31T23:59:59\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/interval/isValidTimeInterval",
    "fnName": "isValidTimeInterval",
    "examples": [
      {
        "call": "isValidTimeInterval(\"09:00:00\", \"17:00:00\")",
        "result": "true"
      },
      {
        "call": "isValidTimeInterval(\"12:00:00\", \"12:00:00\")",
        "result": "true"
      },
      {
        "call": "isValidTimeInterval(\"17:00:00\", \"09:00:00\")",
        "result": "false"
      },
      {
        "call": "isValidTimeInterval(\"invalid\", \"12:00:00\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/locale/getLocaleEraNames",
    "fnName": "getLocaleEraNames",
    "examples": [
      {
        "call": "getLocaleEraNames(\"en-US\")",
        "result": "[\"Before Christ\", \"Anno Domini\"]"
      },
      {
        "call": "getLocaleEraNames(\"de-DE\", \"short\")",
        "result": "[\"v. Chr.\", \"n. Chr.\"]"
      },
      {
        "call": "getLocaleEraNames(\"ja-JP\", \"narrow\")",
        "result": "[\"BC\", \"AD\"]"
      },
      {
        "call": "getLocaleEraNames(\"not-a-locale\")",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/locale/getLocaleMeridiems",
    "fnName": "getLocaleMeridiems",
    "examples": [
      {
        "call": "getLocaleMeridiems(\"en-US\")",
        "result": "[\"AM\", \"PM\"]"
      },
      {
        "call": "getLocaleMeridiems(\"en-GB\")",
        "result": "[\"am\", \"pm\"]"
      },
      {
        "call": "getLocaleMeridiems(\"zh-CN\")",
        "result": "[\"上午\", \"下午\"]"
      },
      {
        "call": "getLocaleMeridiems(\"not-a-locale\")",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/locale/getLocaleMonthNames",
    "fnName": "getLocaleMonthNames",
    "examples": [
      {
        "call": "getLocaleMonthNames(\"en-US\")",
        "result": "[\"January\", \"February\", ... \"December\"]"
      },
      {
        "call": "getLocaleMonthNames(\"de-DE\", \"short\")",
        "result": "[\"Jan\", \"Feb\", \"Mär\", ... \"Dez\"]"
      },
      {
        "call": "getLocaleMonthNames(\"fr-FR\", \"narrow\")",
        "result": "[\"J\", \"F\", \"M\", ... \"D\"]"
      },
      {
        "call": "getLocaleMonthNames(\"not-a-locale\")",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/locale/getLocaleWeekdayNames",
    "fnName": "getLocaleWeekdayNames",
    "examples": [
      {
        "call": "getLocaleWeekdayNames(\"en-US\")",
        "result": "[\"Sunday\", \"Monday\", ... \"Saturday\"]"
      },
      {
        "call": "getLocaleWeekdayNames(\"fr-FR\")",
        "result": "[\"lundi\", \"mardi\", ... \"dimanche\"]"
      },
      {
        "call": "getLocaleWeekdayNames(\"de-DE\", \"short\")",
        "result": "[\"Mo\", \"Di\", \"Mi\", ... \"So\"]"
      },
      {
        "call": "getLocaleWeekdayNames(\"not-a-locale\")",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/map/mapDatesInRange",
    "fnName": "mapDatesInRange",
    "examples": [
      {
        "call": "mapDatesInRange(\"2024-03-01\", \"2024-03-05\")",
        "result": "[\"2024-03-01\", \"2024-03-02\", \"2024-03-03\", \"2024-03-04\", \"2024-03-05\"]"
      },
      {
        "call": "mapDatesInRange(\"2024-03-01\", \"2024-03-05\", 2)",
        "result": "[\"2024-03-01\", \"2024-03-03\", \"2024-03-05\"]"
      },
      {
        "call": "mapDatesInRange(\"2024-03-05\", \"2024-03-01\")",
        "result": "[]"
      },
      {
        "call": "mapDatesInRange(\"invalid\", \"2024-03-05\")",
        "result": "[]"
      },
      {
        "call": "mapDatesInRange(\"2024-03-01\", \"invalid\")",
        "result": "[]"
      },
      {
        "call": "mapDatesInRange(\"2024-03-01\", \"2024-03-05\", 0)",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/map/mapDaysInMonth",
    "fnName": "mapDaysInMonth",
    "examples": [
      {
        "call": "mapDaysInMonth(\"2024-02\")",
        "result": "[\"2024-02-01\", \"2024-02-02\", ..., \"2024-02-29\"]"
      },
      {
        "call": "mapDaysInMonth(\"2024-04\")",
        "result": "[\"2024-04-01\", \"2024-04-02\", ..., \"2024-04-30\"]"
      },
      {
        "call": "mapDaysInMonth(\"invalid\")",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseDateTimeWithPattern",
    "fnName": "parseDateTimeWithPattern",
    "examples": [
      {
        "call": "parseDateTimeWithPattern(\"03/15/2024 14:30:00\", \"MM/dd/yyyy HH:mm:ss\")",
        "result": "\"2024-03-15T14:30:00\""
      },
      {
        "call": "parseDateTimeWithPattern(\"15-Mar-2024 02:30 PM\", \"dd-MMM-yyyy hh:mm a\")",
        "result": "\"2024-03-15T14:30:00\""
      },
      {
        "call": "parseDateTimeWithPattern(\"02/31/2024 14:30:00\", \"MM/dd/yyyy HH:mm:ss\")",
        "result": "\"\" (shape-valid, not a real date)"
      },
      {
        "call": "parseDateTimeWithPattern(\"not a date\", \"MM/dd/yyyy HH:mm:ss\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseDateWithPattern",
    "fnName": "parseDateWithPattern",
    "examples": [
      {
        "call": "parseDateWithPattern(\"03/15/2024\", \"MM/dd/yyyy\")",
        "result": "\"2024-03-15\""
      },
      {
        "call": "parseDateWithPattern(\"15-Mar-2024\", \"dd-MMM-yyyy\")",
        "result": "\"2024-03-15\""
      },
      {
        "call": "parseDateWithPattern(\"02/31/2024\", \"MM/dd/yyyy\")",
        "result": "\"\" (shape-valid, not a real date)"
      },
      {
        "call": "parseDateWithPattern(\"14:30\", \"HH:mm\")",
        "result": "\"\" (time token in a date-only pattern)"
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseDayFromDate",
    "fnName": "parseDayFromDate",
    "examples": [
      {
        "call": "parseDayFromDate(\"2024-03-15\")",
        "result": "\"15\""
      },
      {
        "call": "parseDayFromDate(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseDayFromDateTime",
    "fnName": "parseDayFromDateTime",
    "examples": [
      {
        "call": "parseDayFromDateTime(\"2024-03-15T12:30:00\")",
        "result": "\"15\""
      },
      {
        "call": "parseDayFromDateTime(\"2024-12-31T23:59:59\")",
        "result": "\"31\""
      },
      {
        "call": "parseDayFromDateTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseDayOfWeekFromDate",
    "fnName": "parseDayOfWeekFromDate",
    "examples": [
      {
        "call": "parseDayOfWeekFromDate(\"2024-01-01\")",
        "result": "1 (Monday)"
      },
      {
        "call": "parseDayOfWeekFromDate(\"2024-01-07\")",
        "result": "7 (Sunday)"
      },
      {
        "call": "parseDayOfWeekFromDate(\"2024-01-08\")",
        "result": "1 (Monday)"
      },
      {
        "call": "parseDayOfWeekFromDate(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseDayOfWeekFromDateTime",
    "fnName": "parseDayOfWeekFromDateTime",
    "examples": [
      {
        "call": "parseDayOfWeekFromDateTime(\"2024-01-01T12:00:00\")",
        "result": "1 (Monday)"
      },
      {
        "call": "parseDayOfWeekFromDateTime(\"2024-01-07T00:00:00\")",
        "result": "7 (Sunday)"
      },
      {
        "call": "parseDayOfWeekFromDateTime(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseHourFromDateTime",
    "fnName": "parseHourFromDateTime",
    "examples": [
      {
        "call": "parseHourFromDateTime(\"2024-03-15T14:30:00\")",
        "result": "\"14\""
      },
      {
        "call": "parseHourFromDateTime(\"2024-03-15T00:00:00\")",
        "result": "\"00\""
      },
      {
        "call": "parseHourFromDateTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseHourFromTime",
    "fnName": "parseHourFromTime",
    "examples": [
      {
        "call": "parseHourFromTime(\"12:30:00\")",
        "result": "\"12\""
      },
      {
        "call": "parseHourFromTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseMicrosecondFromDateTime",
    "fnName": "parseMicrosecondFromDateTime",
    "examples": [
      {
        "call": "parseMicrosecondFromDateTime(\"2024-03-15T14:30:45.123\")",
        "result": "\"123\""
      },
      {
        "call": "parseMicrosecondFromDateTime(\"2024-03-15T14:30:45.000\")",
        "result": "\"000\""
      },
      {
        "call": "parseMicrosecondFromDateTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseMicrosecondFromTime",
    "fnName": "parseMicrosecondFromTime",
    "examples": [
      {
        "call": "parseMicrosecondFromTime(\"12:30:45.123\")",
        "result": "\"123\""
      },
      {
        "call": "parseMicrosecondFromTime(\"12:30:45.000\")",
        "result": "\"000\""
      },
      {
        "call": "parseMicrosecondFromTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseMillisecondFromDateTime",
    "fnName": "parseMillisecondFromDateTime",
    "examples": [
      {
        "call": "parseMillisecondFromDateTime(\"2024-03-15T14:30:45.123\")",
        "result": "\"123\""
      },
      {
        "call": "parseMillisecondFromDateTime(\"2024-03-15T14:30:45.000\")",
        "result": "\"000\""
      },
      {
        "call": "parseMillisecondFromDateTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseMillisecondFromTime",
    "fnName": "parseMillisecondFromTime",
    "examples": [
      {
        "call": "parseMillisecondFromTime(\"12:30:45.123\")",
        "result": "\"123\""
      },
      {
        "call": "parseMillisecondFromTime(\"12:30:45.000\")",
        "result": "\"000\""
      },
      {
        "call": "parseMillisecondFromTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseMinuteFromDateTime",
    "fnName": "parseMinuteFromDateTime",
    "examples": [
      {
        "call": "parseMinuteFromDateTime(\"2024-03-15T14:30:45\")",
        "result": "\"30\""
      },
      {
        "call": "parseMinuteFromDateTime(\"2024-03-15T14:00:00\")",
        "result": "\"00\""
      },
      {
        "call": "parseMinuteFromDateTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseMinuteFromTime",
    "fnName": "parseMinuteFromTime",
    "examples": [
      {
        "call": "parseMinuteFromTime(\"12:30:00\")",
        "result": "\"30\""
      },
      {
        "call": "parseMinuteFromTime(\"12:00:00\")",
        "result": "\"00\""
      },
      {
        "call": "parseMinuteFromTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseMonthFromDate",
    "fnName": "parseMonthFromDate",
    "examples": [
      {
        "call": "parseMonthFromDate(\"2024-03-15\")",
        "result": "\"03\""
      },
      {
        "call": "parseMonthFromDate(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseMonthFromDateTime",
    "fnName": "parseMonthFromDateTime",
    "examples": [
      {
        "call": "parseMonthFromDateTime(\"2024-03-15T12:30:00\")",
        "result": "\"03\""
      },
      {
        "call": "parseMonthFromDateTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseNanosecondFromDateTime",
    "fnName": "parseNanosecondFromDateTime",
    "examples": [
      {
        "call": "parseNanosecondFromDateTime(\"2024-03-15T14:30:45.123\")",
        "result": "\"123\""
      },
      {
        "call": "parseNanosecondFromDateTime(\"2024-03-15T14:30:45.000\")",
        "result": "\"000\""
      },
      {
        "call": "parseNanosecondFromDateTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseNanosecondFromTime",
    "fnName": "parseNanosecondFromTime",
    "examples": [
      {
        "call": "parseNanosecondFromTime(\"12:30:45.123\")",
        "result": "\"123\""
      },
      {
        "call": "parseNanosecondFromTime(\"12:30:45.000\")",
        "result": "\"000\""
      },
      {
        "call": "parseNanosecondFromTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseSecondFromDateTime",
    "fnName": "parseSecondFromDateTime",
    "examples": [
      {
        "call": "parseSecondFromDateTime(\"2024-03-15T14:30:45\")",
        "result": "\"45\""
      },
      {
        "call": "parseSecondFromDateTime(\"2024-03-15T14:30:00\")",
        "result": "\"00\""
      },
      {
        "call": "parseSecondFromDateTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseSecondFromTime",
    "fnName": "parseSecondFromTime",
    "examples": [
      {
        "call": "parseSecondFromTime(\"12:30:45\")",
        "result": "\"45\""
      },
      {
        "call": "parseSecondFromTime(\"12:00:00\")",
        "result": "\"00\""
      },
      {
        "call": "parseSecondFromTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseSql",
    "fnName": "parseSql",
    "examples": [
      {
        "call": "parseSql(\"2024-03-15 14:30:00\")",
        "result": "\"2024-03-15T14:30:00\""
      },
      {
        "call": "parseSql(\"2024-03-15 14:30:00.5\")",
        "result": "\"2024-03-15T14:30:00.5\""
      },
      {
        "call": "parseSql(\"2024-03-15T14:30:00\")",
        "result": "\"\" (wrong separator)"
      },
      {
        "call": "parseSql(\"not a date\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseTimeWithPattern",
    "fnName": "parseTimeWithPattern",
    "examples": [
      {
        "call": "parseTimeWithPattern(\"14:30:45\", \"HH:mm:ss\")",
        "result": "\"14:30:45\""
      },
      {
        "call": "parseTimeWithPattern(\"02:30:45 PM\", \"hh:mm:ss a\")",
        "result": "\"14:30:45\""
      },
      {
        "call": "parseTimeWithPattern(\"25:00\", \"HH:mm\")",
        "result": "\"\" (shape-valid, not a real time)"
      },
      {
        "call": "parseTimeWithPattern(\"2024-03-15\", \"yyyy-MM-dd\")",
        "result": "\"\" (date token in a time-only pattern)"
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseUnitFromDate",
    "fnName": "parseUnitFromDate",
    "examples": [
      {
        "call": "parseUnitFromDate(\"2024-03-15\", \"year\")",
        "result": "\"2024\""
      },
      {
        "call": "parseUnitFromDate(\"2024-03-15\", \"month\")",
        "result": "\"03\""
      },
      {
        "call": "parseUnitFromDate(\"2024-03-15\", \"day\")",
        "result": "\"15\""
      },
      {
        "call": "parseUnitFromDate(\"2024-03-15\", \"week\")",
        "result": "\"11\""
      },
      {
        "call": "parseUnitFromDate(\"2024-03-15\", \"dayOfWeek\")",
        "result": "\"5\""
      },
      {
        "call": "parseUnitFromDate(\"invalid\", \"year\")",
        "result": "\"\""
      },
      {
        "call": "parseUnitFromDate(\"2024-01-01\", \"week\", { weekStartsOn: \"sunday\" })",
        "result": "\"1\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseUnitFromDateTime",
    "fnName": "parseUnitFromDateTime",
    "examples": [
      {
        "call": "parseUnitFromDateTime(\"2024-03-15T14:30:45.123\", \"year\")",
        "result": "\"2024\""
      },
      {
        "call": "parseUnitFromDateTime(\"2024-03-15T14:30:45.123\", \"week\")",
        "result": "\"11\""
      },
      {
        "call": "parseUnitFromDateTime(\"2024-03-15T14:30:45.123\", \"hour\")",
        "result": "\"14\""
      },
      {
        "call": "parseUnitFromDateTime(\"2024-03-15T14:30:45.123\", \"millisecond\")",
        "result": "\"123\""
      },
      {
        "call": "parseUnitFromDateTime(\"invalid\", \"year\")",
        "result": "\"\""
      },
      {
        "call": "parseUnitFromDateTime(\"2024-01-01T00:00:00\", \"week\", { weekStartsOn: \"sunday\" })",
        "result": "\"1\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseUnitFromTime",
    "fnName": "parseUnitFromTime",
    "examples": [
      {
        "call": "parseUnitFromTime(\"14:30:45.123\", \"hour\")",
        "result": "\"14\""
      },
      {
        "call": "parseUnitFromTime(\"14:30:45.123\", \"minute\")",
        "result": "\"30\""
      },
      {
        "call": "parseUnitFromTime(\"14:30:45.123\", \"second\")",
        "result": "\"45\""
      },
      {
        "call": "parseUnitFromTime(\"14:30:45.123\", \"millisecond\")",
        "result": "\"123\""
      },
      {
        "call": "parseUnitFromTime(\"invalid\", \"hour\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseWeekFromDate",
    "fnName": "parseWeekFromDate",
    "examples": [
      {
        "call": "parseWeekFromDate(\"2024-01-01\")",
        "result": "1"
      },
      {
        "call": "parseWeekFromDate(\"2024-01-08\")",
        "result": "2"
      },
      {
        "call": "parseWeekFromDate(\"2024-12-31\")",
        "result": "1"
      },
      {
        "call": "parseWeekFromDate(\"2024-01-01\", { weekStartsOn: \"sunday\" })",
        "result": "1"
      },
      {
        "call": "parseWeekFromDate(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseWeekFromDateTime",
    "fnName": "parseWeekFromDateTime",
    "examples": [
      {
        "call": "parseWeekFromDateTime(\"2024-01-01T12:00:00\")",
        "result": "1"
      },
      {
        "call": "parseWeekFromDateTime(\"2024-01-08T00:00:00\")",
        "result": "2"
      },
      {
        "call": "parseWeekFromDateTime(\"2024-01-01T00:00:00\", { weekStartsOn: \"sunday\" })",
        "result": "1"
      },
      {
        "call": "parseWeekFromDateTime(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseYearFromDate",
    "fnName": "parseYearFromDate",
    "examples": [
      {
        "call": "parseYearFromDate(\"2024-03-15\")",
        "result": "\"2024\""
      },
      {
        "call": "parseYearFromDate(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/parse/parseYearFromDateTime",
    "fnName": "parseYearFromDateTime",
    "examples": [
      {
        "call": "parseYearFromDateTime(\"2024-03-15T12:30:00\")",
        "result": "\"2024\""
      },
      {
        "call": "parseYearFromDateTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/plain/validate/isLeapSecond",
    "fnName": "isLeapSecond",
    "examples": [
      {
        "call": "isLeapSecond(\"2024-12-31T23:59:60Z\")",
        "result": "true"
      },
      {
        "call": "isLeapSecond(\"2024-12-31T23:59:60.123Z\")",
        "result": "true"
      },
      {
        "call": "isLeapSecond(\"2024-12-31T23:59:60+00:00\")",
        "result": "true"
      },
      {
        "call": "isLeapSecond(\"2024-12-31T23:59:60.123+00:00\")",
        "result": "true"
      },
      {
        "call": "isLeapSecond(\"2024-12-31T23:59:59Z\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/validate/isLeapYear",
    "fnName": "isLeapYear",
    "examples": [
      {
        "call": "isLeapYear(\"2024-03-15\")",
        "result": "true"
      },
      {
        "call": "isLeapYear(\"2023-03-15\")",
        "result": "false"
      },
      {
        "call": "isLeapYear(\"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/validate/isValidCalendarDate",
    "fnName": "isValidCalendarDate",
    "examples": [
      {
        "call": "isValidCalendarDate(\"2024-10-03\")",
        "result": "true"
      },
      {
        "call": "isValidCalendarDate(\"5785-01-01[u-ca=hebrew]\")",
        "result": "true"
      },
      {
        "call": "isValidCalendarDate(\"2024-10-03[u-ca=martian]\")",
        "result": "false (unknown calendar identifier)"
      },
      {
        "call": "isValidCalendarDate(\"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/validate/isValidDate",
    "fnName": "isValidDate",
    "examples": [
      {
        "call": "isValidDate(\"2024-03-10\")",
        "result": "true"
      },
      {
        "call": "isValidDate(\"2024-02-30\")",
        "result": "false"
      },
      {
        "call": "isValidDate(\"invalid\")",
        "result": "false"
      },
      {
        "call": "isValidDate(\"2024-12-31T23:59:60\")",
        "result": "false (leap second - not a valid date)"
      }
    ]
  },
  {
    "route": "/reference/plain/validate/isValidDateCycleField",
    "fnName": "isValidDateCycleField",
    "examples": [
      {
        "call": "isValidDateCycleField(\"year\")",
        "result": "true"
      },
      {
        "call": "isValidDateCycleField(\"month\")",
        "result": "true"
      },
      {
        "call": "isValidDateCycleField(\"day\")",
        "result": "true"
      },
      {
        "call": "isValidDateCycleField(\"week\")",
        "result": "false"
      },
      {
        "call": "isValidDateCycleField(\"invalid\")",
        "result": "false"
      },
      {
        "call": "isValidDateCycleField(123)",
        "result": "false"
      },
      {
        "call": "isValidDateCycleField(null)",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/validate/isValidDateDurationUnit",
    "fnName": "isValidDateDurationUnit",
    "examples": []
  },
  {
    "route": "/reference/plain/validate/isValidDateRange",
    "fnName": "isValidDateRange",
    "examples": [
      {
        "call": "isValidDateRange({ value1: \"2024-02-28\", value2: \"2024-02-29\" })",
        "result": "true"
      },
      {
        "call": "isValidDateRange({ value1: \"2024-02-29\", value2: \"2024-02-28\" })",
        "result": "false"
      },
      {
        "call": "isValidDateRange({ value1: \"2024-02-29\", value2: \"2024-02-29\" })",
        "result": "false"
      },
      {
        "call": "isValidDateRange({ value1: \"2024-02-29\", value2: \"2024-02-29\", options: { allowEqual: true } })",
        "result": "true"
      }
    ]
  },
  {
    "route": "/reference/plain/validate/isValidDateTime",
    "fnName": "isValidDateTime",
    "examples": [
      {
        "call": "isValidDateTime(\"2024-02-29T12:34:56\")",
        "result": "true"
      },
      {
        "call": "isValidDateTime(\"2024-02-30T12:34:56\")",
        "result": "false (invalid date)"
      },
      {
        "call": "isValidDateTime(\"2024-02-29T24:00:00\")",
        "result": "false (invalid time)"
      },
      {
        "call": "isValidDateTime(\"2024-02-29T23:59:60\")",
        "result": "false (leap second)"
      }
    ]
  },
  {
    "route": "/reference/plain/validate/isValidDateTimeCycleField",
    "fnName": "isValidDateTimeCycleField",
    "examples": [
      {
        "call": "isValidDateTimeCycleField(\"year\")",
        "result": "true"
      },
      {
        "call": "isValidDateTimeCycleField(\"hour\")",
        "result": "true"
      },
      {
        "call": "isValidDateTimeCycleField(\"week\")",
        "result": "false"
      },
      {
        "call": "isValidDateTimeCycleField(\"invalid\")",
        "result": "false"
      },
      {
        "call": "isValidDateTimeCycleField(123)",
        "result": "false"
      },
      {
        "call": "isValidDateTimeCycleField(null)",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/validate/isValidDateTimeDurationUnit",
    "fnName": "isValidDateTimeDurationUnit",
    "examples": []
  },
  {
    "route": "/reference/plain/validate/isValidDateTimeRange",
    "fnName": "isValidDateTimeRange",
    "examples": [
      {
        "call": "isValidDateTimeRange({ value1: \"2024-01-01T10:00:00\", value2: \"2024-12-31T23:59:59\" })",
        "result": "true"
      },
      {
        "call": "isValidDateTimeRange({ value1: \"2024-12-31T23:59:59\", value2: \"2024-01-01T10:00:00\" })",
        "result": "false"
      },
      {
        "call": "isValidDateTimeRange({ value1: \"2024-01-01T10:00:00\", value2: \"2024-01-01T10:00:00\", options: { allowEqual: true } })",
        "result": "true"
      }
    ]
  },
  {
    "route": "/reference/plain/validate/isValidDateTimeUnit",
    "fnName": "isValidDateTimeUnit",
    "examples": [
      {
        "call": "isValidDateTimeUnit(\"year\")",
        "result": "true"
      },
      {
        "call": "isValidDateTimeUnit(\"month\")",
        "result": "true"
      },
      {
        "call": "isValidDateTimeUnit(\"weeks\")",
        "result": "false"
      },
      {
        "call": "isValidDateTimeUnit(\"invalid\")",
        "result": "false"
      },
      {
        "call": "isValidDateTimeUnit(123)",
        "result": "false"
      },
      {
        "call": "isValidDateTimeUnit(null)",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/validate/isValidDateUnit",
    "fnName": "isValidDateUnit",
    "examples": [
      {
        "call": "isValidDateUnit(\"year\")",
        "result": "true"
      },
      {
        "call": "isValidDateUnit(\"month\")",
        "result": "true"
      },
      {
        "call": "isValidDateUnit(\"week\")",
        "result": "true"
      },
      {
        "call": "isValidDateUnit(\"day\")",
        "result": "true"
      },
      {
        "call": "isValidDateUnit(\"hour\")",
        "result": "false"
      },
      {
        "call": "isValidDateUnit(\"invalid\")",
        "result": "false"
      },
      {
        "call": "isValidDateUnit(123)",
        "result": "false"
      },
      {
        "call": "isValidDateUnit(null)",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/validate/isValidIsoDateLike",
    "fnName": "isValidIsoDateLike",
    "examples": [
      {
        "call": "isValidIsoDateLike(\"2024-02-29\")",
        "result": "true"
      },
      {
        "call": "isValidIsoDateLike(\"2024-02-30\")",
        "result": "false (invalid date)"
      },
      {
        "call": "isValidIsoDateLike(\"2024-02-29T12:34:56\")",
        "result": "true"
      },
      {
        "call": "isValidIsoDateLike(\"2024-02-29T24:00:00\")",
        "result": "false (invalid time)"
      },
      {
        "call": "isValidIsoDateLike(\"2024-12-31T23:59:60\")",
        "result": "false (leap second)"
      }
    ]
  },
  {
    "route": "/reference/plain/validate/isValidTime",
    "fnName": "isValidTime",
    "examples": [
      {
        "call": "isValidTime(\"12:34:56\")",
        "result": "true"
      },
      {
        "call": "isValidTime(\"24:00:00\")",
        "result": "false (invalid hour)"
      },
      {
        "call": "isValidTime(\"23:60:00\")",
        "result": "false (invalid minute)"
      },
      {
        "call": "isValidTime(\"23:59:60\")",
        "result": "false (leap second)"
      }
    ]
  },
  {
    "route": "/reference/plain/validate/isValidTimeCycleField",
    "fnName": "isValidTimeCycleField",
    "examples": [
      {
        "call": "isValidTimeCycleField(\"hour\")",
        "result": "true"
      },
      {
        "call": "isValidTimeCycleField(\"nanosecond\")",
        "result": "true"
      },
      {
        "call": "isValidTimeCycleField(\"year\")",
        "result": "false"
      },
      {
        "call": "isValidTimeCycleField(\"invalid\")",
        "result": "false"
      },
      {
        "call": "isValidTimeCycleField(123)",
        "result": "false"
      },
      {
        "call": "isValidTimeCycleField(null)",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/plain/validate/isValidTimeDurationUnit",
    "fnName": "isValidTimeDurationUnit",
    "examples": []
  },
  {
    "route": "/reference/plain/validate/isValidTimeRange",
    "fnName": "isValidTimeRange",
    "examples": [
      {
        "call": "isValidTimeRange({ value1: \"09:00:00\", value2: \"17:00:00\" })",
        "result": "true"
      },
      {
        "call": "isValidTimeRange({ value1: \"17:00:00\", value2: \"09:00:00\" })",
        "result": "false"
      },
      {
        "call": "isValidTimeRange({ value1: \"12:00:00\", value2: \"12:00:00\", options: { allowEqual: true } })",
        "result": "true"
      }
    ]
  },
  {
    "route": "/reference/plain/validate/isValidTimeUnit",
    "fnName": "isValidTimeUnit",
    "examples": [
      {
        "call": "isValidTimeUnit(\"hour\")",
        "result": "true"
      },
      {
        "call": "isValidTimeUnit(\"minute\")",
        "result": "true"
      },
      {
        "call": "isValidTimeUnit(\"second\")",
        "result": "true"
      },
      {
        "call": "isValidTimeUnit(\"invalid\")",
        "result": "false"
      },
      {
        "call": "isValidTimeUnit(123)",
        "result": "false"
      },
      {
        "call": "isValidTimeUnit(null)",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/unix/calculate/addUnix",
    "fnName": "addUnix",
    "examples": [
      {
        "call": "addUnix(1706659200000, { days: 1 })",
        "result": "1706745600000"
      },
      {
        "call": "addUnix(1706659200, { days: 1 }, { epochUnit: \"seconds\" })",
        "result": "1706745600"
      },
      {
        "call": "addUnix(-86400000, { days: 1 })",
        "result": "0 (Dec 31 1969 + 1 day = Jan 1 1970)"
      }
    ]
  },
  {
    "route": "/reference/unix/calculate/diffUnix",
    "fnName": "diffUnix",
    "examples": [
      {
        "call": "diffUnix(1706745600000, 1706659200000, \"day\")",
        "result": "1"
      },
      {
        "call": "diffUnix(1706745600, 1706659200, \"day\", { epochUnit: \"seconds\" })",
        "result": "1"
      },
      {
        "call": "diffUnix(0, -86400000, \"day\")",
        "result": "1 (Jan 1 1970 - Dec 31 1969 = 1 day)"
      }
    ]
  },
  {
    "route": "/reference/unix/calculate/diffUnixAsDuration",
    "fnName": "diffUnixAsDuration",
    "examples": [
      {
        "call": "diffUnixAsDuration(1706659200000, 1706745600000, \"days\")",
        "result": "\"P1D\""
      },
      {
        "call": "diffUnixAsDuration(1706745600000, 1706659200000, \"days\")",
        "result": "\"-P1D\""
      },
      {
        "call": "diffUnixAsDuration(1706659200, 1706745600, \"days\", { epochUnit: \"seconds\" })",
        "result": "\"P1D\""
      },
      {
        "call": "diffUnixAsDuration(NaN, 1706745600000, \"days\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/unix/calculate/endOfQuarterForUnix",
    "fnName": "endOfQuarterForUnix",
    "examples": [
      {
        "call": "endOfQuarterForUnix(1706659200000)",
        "result": "1711977599999"
      },
      {
        "call": "endOfQuarterForUnix(-86400000)",
        "result": "-1 (Q4 1969 ends Dec 31)"
      }
    ]
  },
  {
    "route": "/reference/unix/calculate/endOfUnix",
    "fnName": "endOfUnix",
    "examples": [
      {
        "call": "endOfUnix(1706659200000, \"year\")",
        "result": "1735689600000"
      },
      {
        "call": "endOfUnix(1706659200000, \"month\")",
        "result": "1708012800000"
      },
      {
        "call": "endOfUnix(1706659200, \"day\", { epochUnit: \"seconds\" })",
        "result": "1706736000"
      },
      {
        "call": "endOfUnix(-86400000, \"year\")",
        "result": "-1 (end of 1969)"
      },
      {
        "call": "endOfUnix(1730616300000, \"hour\", { timeZone: \"America/New_York\", disambiguation: \"reject\" })",
        "result": "null (1730616300000 is the second, repeated 1:45am of the Nov 3 2024 fall-back overlap; end-of-hour is ambiguous)"
      },
      {
        "call": "endOfUnix(1730616300000, \"hour\", { timeZone: \"America/New_York\", disambiguation: \"reject\", offset: \"prefer\" })",
        "result": "1730617199999 (setting offset to \"prefer\" makes disambiguation inert here — the source's -05:00 offset is still valid for 1am, so it's kept and \"reject\" never fires)"
      }
    ]
  },
  {
    "route": "/reference/unix/calculate/isBetweenUnix",
    "fnName": "isBetweenUnix",
    "examples": [
      {
        "call": "isBetweenUnix(1705000000000, 1704000000000, 1706000000000)",
        "result": "true"
      },
      {
        "call": "isBetweenUnix(1705000000, 1704000000, 1706000000, { epochUnit: \"seconds\" })",
        "result": "true"
      },
      {
        "call": "isBetweenUnix(1703000000000, 1704000000000, 1706000000000)",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/unix/calculate/maxUnix",
    "fnName": "maxUnix",
    "examples": [
      {
        "call": "maxUnix([1706659200000, 1704067200000, 1700000000000])",
        "result": "1706659200000"
      },
      {
        "call": "maxUnix([])",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/unix/calculate/minUnix",
    "fnName": "minUnix",
    "examples": [
      {
        "call": "minUnix([1706659200000, 1704067200000, 1700000000000])",
        "result": "1700000000000"
      },
      {
        "call": "minUnix([])",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/unix/calculate/roundUnix",
    "fnName": "roundUnix",
    "examples": [
      {
        "call": "roundUnix(1706659200000, { smallestUnit: \"hour\" })",
        "result": "1706662800000 (rounded up to next hour)"
      },
      {
        "call": "roundUnix(1706659200000, { smallestUnit: \"day\", epochUnit: \"seconds\" })",
        "result": "1706640000 (start of day in seconds)"
      },
      {
        "call": "roundUnix(1706659200000, { smallestUnit: \"hour\", roundingIncrement: 2 })",
        "result": "1706662800000 (rounded to nearest 2-hour mark)"
      },
      {
        "call": "roundUnix(-86400000, { smallestUnit: \"day\" })",
        "result": "-86400000 (start of day for negative timestamp)"
      },
      {
        "call": "roundUnix(\"invalid\", { smallestUnit: \"hour\" })",
        "result": "null"
      },
      {
        "call": "roundUnix(NaN, { smallestUnit: \"hour\" })",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/unix/calculate/setUnix",
    "fnName": "setUnix",
    "examples": [
      {
        "call": "setUnix(1710072000000, { hour: 9 }, { timeZone: \"UTC\" })",
        "result": "1710061200000 (2024-03-10T09:00:00Z)"
      },
      {
        "call": "setUnix(1706659200000, { year: 2025 }, { timeZone: \"UTC\" })",
        "result": "1738281600000 (2025-01-31T00:00:00Z)"
      },
      {
        "call": "setUnix(1706659200000, {}, { timeZone: \"UTC\" })",
        "result": "1706659200000 (empty fields object is a no-op)"
      },
      {
        "call": "setUnix(NaN, { hour: 9 })",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/unix/calculate/sortUnix",
    "fnName": "sortUnix",
    "examples": [
      {
        "call": "sortUnix([1706659200000, 1704067200000, 1700000000000])",
        "result": "[1700000000000, 1704067200000, 1706659200000]"
      },
      {
        "call": "sortUnix([1704067200, 1700000000], \"desc\")",
        "result": "[1704067200, 1700000000]"
      },
      {
        "call": "sortUnix([])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/unix/calculate/startOfQuarterForUnix",
    "fnName": "startOfQuarterForUnix",
    "examples": [
      {
        "call": "startOfQuarterForUnix(1706659200000)",
        "result": "1704067200000"
      },
      {
        "call": "startOfQuarterForUnix(-86400000)",
        "result": "-25598400001 (Q1 1969 starts Jan 1)"
      }
    ]
  },
  {
    "route": "/reference/unix/calculate/startOfUnix",
    "fnName": "startOfUnix",
    "examples": [
      {
        "call": "startOfUnix(1706659200000, \"year\")",
        "result": "1704067200000"
      },
      {
        "call": "startOfUnix(1706659200000, \"month\")",
        "result": "1705353600000"
      },
      {
        "call": "startOfUnix(1706659200, \"day\", { epochUnit: \"seconds\" })",
        "result": "1706640000"
      },
      {
        "call": "startOfUnix(-86400000, \"year\")",
        "result": "-31536000001 (start of 1969)"
      },
      {
        "call": "startOfUnix(1730616300000, \"hour\", { timeZone: \"America/New_York\", disambiguation: \"reject\" })",
        "result": "null (1730616300000 is the second, repeated 1:45am of the Nov 3 2024 fall-back overlap; start-of-hour is ambiguous)"
      },
      {
        "call": "startOfUnix(1730616300000, \"hour\", { timeZone: \"America/New_York\", disambiguation: \"reject\", offset: \"prefer\" })",
        "result": "1730613600000 (setting offset to \"prefer\" makes disambiguation inert here — the source's -05:00 offset is still valid for 1am, so it's kept and \"reject\" never fires)"
      }
    ]
  },
  {
    "route": "/reference/unix/calculate/startOrEndOfUnix",
    "fnName": "startOrEndOfUnix",
    "examples": []
  },
  {
    "route": "/reference/unix/calculate/subtractUnix",
    "fnName": "subtractUnix",
    "examples": [
      {
        "call": "subtractUnix(1706745600000, { days: 1 })",
        "result": "1706659200000"
      },
      {
        "call": "subtractUnix(1706745600, { days: 1 }, { epochUnit: \"seconds\" })",
        "result": "1706659200"
      },
      {
        "call": "subtractUnix(0, { days: 1 })",
        "result": "-86400000 (Jan 1 1970 - 1 day = Dec 31 1969)"
      }
    ]
  },
  {
    "route": "/reference/unix/compare/areUnixEqual",
    "fnName": "areUnixEqual",
    "examples": [
      {
        "call": "areUnixEqual(1706659200, 1706659200)",
        "result": "true"
      },
      {
        "call": "areUnixEqual(1706659200, 1704067200)",
        "result": "false"
      },
      {
        "call": "areUnixEqual(1706659200, 1706659200000, { epochUnit: \"seconds\" })",
        "result": "true"
      },
      {
        "call": "areUnixEqual(1706659200, 1706659200000)",
        "result": "false"
      },
      {
        "call": "areUnixEqual(-86400000, 0)",
        "result": "false (1969-12-31 is not equal to 1970-01-01)"
      }
    ]
  },
  {
    "route": "/reference/unix/compare/areUnixEqualBy",
    "fnName": "areUnixEqualBy",
    "examples": [
      {
        "call": "areUnixEqualBy(1710498000000, 1710503000000, \"day\", { timeZone: \"UTC\" })",
        "result": "true (both fall on 2024-03-15 in UTC)"
      },
      {
        "call": "areUnixEqualBy(1704067200000, 1735689600000, \"year\", { timeZone: \"UTC\" })",
        "result": "false (2024-01-01 vs 2025-01-01)"
      },
      {
        "call": "areUnixEqualBy(Number.NaN, 1710498000000, \"day\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/unix/compare/isAfterUnix",
    "fnName": "isAfterUnix",
    "examples": [
      {
        "call": "isAfterUnix(1706659200, 1704067200)",
        "result": "true"
      },
      {
        "call": "isAfterUnix(1706659200, 1706659200)",
        "result": "false"
      },
      {
        "call": "isAfterUnix(-1, 0)",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/unix/compare/isBeforeUnix",
    "fnName": "isBeforeUnix",
    "examples": [
      {
        "call": "isBeforeUnix(1704067200, 1706659200)",
        "result": "true"
      },
      {
        "call": "isBeforeUnix(1706659200, 1706659200)",
        "result": "false"
      },
      {
        "call": "isBeforeUnix(-1, 0)",
        "result": "true (1969-12-31T23:59:59.999Z is before 1970-01-01T00:00:00Z)"
      },
      {
        "call": "isBeforeUnix('invalid', 1704067200000)",
        "result": "false"
      },
      {
        "call": "isBeforeUnix(1704067200000, 'invalid')",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/unix/convert/convertUnixToPlainDate",
    "fnName": "convertUnixToPlainDate",
    "examples": [
      {
        "call": "convertUnixToPlainDate(1709164800000)",
        "result": "\"2024-02-29\""
      },
      {
        "call": "convertUnixToPlainDate(1709164800, { epochUnit: \"seconds\" })",
        "result": "\"2024-02-29\""
      },
      {
        "call": "convertUnixToPlainDate(-1)",
        "result": "\"1969-12-31\""
      }
    ]
  },
  {
    "route": "/reference/unix/convert/convertUnixToPlainDateTime",
    "fnName": "convertUnixToPlainDateTime",
    "examples": [
      {
        "call": "convertUnixToPlainDateTime(1709164800000)",
        "result": "\"2024-02-29T00:00:00\""
      },
      {
        "call": "convertUnixToPlainDateTime(1709164800, { epochUnit: \"seconds\" })",
        "result": "\"2024-02-29T00:00:00\""
      },
      {
        "call": "convertUnixToPlainDateTime(-1)",
        "result": "\"1969-12-31T23:59:59.999\""
      }
    ]
  },
  {
    "route": "/reference/unix/convert/convertUnixToPlainTime",
    "fnName": "convertUnixToPlainTime",
    "examples": [
      {
        "call": "convertUnixToPlainTime(1706659200000)",
        "result": "\"00:00:00\""
      },
      {
        "call": "convertUnixToPlainTime(1706659200, { epochUnit: \"seconds\" })",
        "result": "\"00:00:00\""
      },
      {
        "call": "convertUnixToPlainTime(-1)",
        "result": "\"23:59:59.999\""
      }
    ]
  },
  {
    "route": "/reference/unix/convert/convertUnixToUtc",
    "fnName": "convertUnixToUtc",
    "examples": [
      {
        "call": "convertUnixToUtc(1709164800000)",
        "result": "\"2024-02-29T00:00:00Z\""
      },
      {
        "call": "convertUnixToUtc(1709164800, \"seconds\")",
        "result": "\"2024-02-29T00:00:00Z\""
      },
      {
        "call": "convertUnixToUtc(-1)",
        "result": "\"1969-12-31T23:59:59.999Z\""
      }
    ]
  },
  {
    "route": "/reference/unix/convert/convertUnixToZoned",
    "fnName": "convertUnixToZoned",
    "examples": [
      {
        "call": "convertUnixToZoned(1709164800000, \"America/New_York\")",
        "result": "\"2024-02-29T00:00:00-05:00[America/New_York]\""
      },
      {
        "call": "convertUnixToZoned(1709164800, \"UTC\", \"seconds\")",
        "result": "\"2024-02-29T00:00:00+00:00[UTC]\""
      },
      {
        "call": "convertUnixToZoned(-1, \"UTC\")",
        "result": "\"1969-12-31T23:59:59.999Z[UTC]\""
      }
    ]
  },
  {
    "route": "/reference/unix/format/toInstant",
    "fnName": "toInstant",
    "examples": []
  },
  {
    "route": "/reference/unix/format/formatCalendarUnix",
    "fnName": "formatCalendarUnix",
    "examples": [
      {
        "call": "formatCalendarUnix(1710685845000, \"en-US\", { epochUnit: \"milliseconds\", timeZone: \"America/New_York\" })",
        "result": "day label + time relative to \"now\", or the absolute fallback beyond the ±6-day threshold"
      },
      {
        "call": "formatCalendarUnix(value, \"en-US\", { reference: 1710685000000 })",
        "result": "e.g. \"tomorrow at 2:30 PM\""
      },
      {
        "call": "formatCalendarUnix(\"not-a-number\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/unix/format/formatRelativeUnix",
    "fnName": "formatRelativeUnix",
    "examples": [
      {
        "call": "formatRelativeUnix(1710685845000, \"en-US\", { epochUnit: \"milliseconds\" })",
        "result": "\"3 years ago\""
      },
      {
        "call": "formatRelativeUnix(value, \"en-US\", { roundingMethod: \"floor\" })",
        "result": "rounds toward the earlier boundary"
      },
      {
        "call": "formatRelativeUnix(\"not-a-number\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/unix/format/parseEpochMs",
    "fnName": "parseEpochMs",
    "examples": []
  },
  {
    "route": "/reference/unix/format/formatUnix",
    "fnName": "formatUnix",
    "examples": [
      {
        "call": "formatUnix(\"1710685845000\", \"en-US\", { epochUnit: \"milliseconds\" })",
        "result": "\"3/17/2024, 2:30:45 PM\""
      },
      {
        "call": "formatUnix(1710685845000, \"en-US\", { epochUnit: \"milliseconds\" })",
        "result": "\"3/17/2024, 2:30:45 PM\""
      },
      {
        "call": "formatUnix(\"1710685845\", \"en-US\", { epochUnit: \"seconds\" })",
        "result": "\"3/17/2024, 2:30:45 PM\""
      },
      {
        "call": "formatUnix(\"1710685845000\", \"en-US\", { epochUnit: \"milliseconds\", includeTimeZoneName: true })",
        "result": "\"3/17/2024, 2:30:45 PM UTC\""
      },
      {
        "call": "formatUnix(\"not-a-number\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/unix/get/getUnixDay",
    "fnName": "getUnixDay",
    "examples": [
      {
        "call": "getUnixDay()",
        "result": "\"29\""
      },
      {
        "call": "getUnixDay()",
        "result": "\"\" (on failure)"
      }
    ]
  },
  {
    "route": "/reference/unix/get/getUnixHour",
    "fnName": "getUnixHour",
    "examples": [
      {
        "call": "getUnixHour()",
        "result": "\"00\""
      },
      {
        "call": "getUnixHour()",
        "result": "\"\" (on failure)"
      }
    ]
  },
  {
    "route": "/reference/unix/get/getUnixMicrosecond",
    "fnName": "getUnixMicrosecond",
    "examples": [
      {
        "call": "getUnixMicrosecond()",
        "result": "\"456\""
      },
      {
        "call": "getUnixMicrosecond()",
        "result": "\"\" (on failure)"
      }
    ]
  },
  {
    "route": "/reference/unix/get/getUnixMillisecond",
    "fnName": "getUnixMillisecond",
    "examples": [
      {
        "call": "getUnixMillisecond()",
        "result": "\"123\""
      },
      {
        "call": "getUnixMillisecond()",
        "result": "\"\" (on failure)"
      }
    ]
  },
  {
    "route": "/reference/unix/get/getUnixMinute",
    "fnName": "getUnixMinute",
    "examples": [
      {
        "call": "getUnixMinute()",
        "result": "\"30\""
      },
      {
        "call": "getUnixMinute()",
        "result": "\"\" (on failure)"
      }
    ]
  },
  {
    "route": "/reference/unix/get/getUnixMonth",
    "fnName": "getUnixMonth",
    "examples": [
      {
        "call": "getUnixMonth()",
        "result": "\"02\""
      },
      {
        "call": "getUnixMonth()",
        "result": "\"\" (on failure)"
      }
    ]
  },
  {
    "route": "/reference/unix/get/getUnixNanosecond",
    "fnName": "getUnixNanosecond",
    "examples": [
      {
        "call": "getUnixNanosecond()",
        "result": "\"789\""
      },
      {
        "call": "getUnixNanosecond()",
        "result": "\"\" (on failure)"
      }
    ]
  },
  {
    "route": "/reference/unix/get/getUnixNow",
    "fnName": "getUnixNow",
    "examples": [
      {
        "call": "getUnixNow()",
        "result": "1700000000000"
      },
      {
        "call": "getUnixNow(\"seconds\")",
        "result": "1700000000"
      }
    ]
  },
  {
    "route": "/reference/unix/get/isValidUnixNowUnit",
    "fnName": "isValidUnixNowUnit",
    "examples": []
  },
  {
    "route": "/reference/unix/get/getUnixNowUnit",
    "fnName": "getUnixNowUnit",
    "examples": [
      {
        "call": "getUnixNowUnit(\"year\")",
        "result": "\"2024\""
      },
      {
        "call": "getUnixNowUnit(\"month\")",
        "result": "\"02\""
      },
      {
        "call": "getUnixNowUnit(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/unix/get/getUnixSecond",
    "fnName": "getUnixSecond",
    "examples": [
      {
        "call": "getUnixSecond()",
        "result": "\"45\""
      },
      {
        "call": "getUnixSecond()",
        "result": "\"\" (on failure)"
      }
    ]
  },
  {
    "route": "/reference/unix/get/getUnixYear",
    "fnName": "getUnixYear",
    "examples": [
      {
        "call": "getUnixYear()",
        "result": "\"2024\""
      },
      {
        "call": "getUnixYear()",
        "result": "\"\" (on failure)"
      }
    ]
  },
  {
    "route": "/reference/unix/interval/intervalAbutsUnix",
    "fnName": "intervalAbutsUnix",
    "examples": [
      {
        "call": "intervalAbutsUnix(0, 1500000000, 1500000001, 1700000000)",
        "result": "true"
      },
      {
        "call": "intervalAbutsUnix(1500000001, 1700000000, 0, 1500000000)",
        "result": "true"
      },
      {
        "call": "intervalAbutsUnix(0, 1500000000, 1500000002, 1700000000)",
        "result": "false (gap)"
      },
      {
        "call": "intervalAbutsUnix(0, 1500000001, 1500000000, 1700000000)",
        "result": "false (overlap)"
      },
      {
        "call": "intervalAbutsUnix(NaN, 1500000000, 1500000001, 1700000000)",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/unix/interval/intervalContainsUnix",
    "fnName": "intervalContainsUnix",
    "examples": [
      {
        "call": "intervalContainsUnix(0, 1700000000, 170000000)",
        "result": "true"
      },
      {
        "call": "intervalContainsUnix(0, 1700000000, 170000000, 1500000000)",
        "result": "true"
      },
      {
        "call": "intervalContainsUnix(1700000000, 0, 170000000)",
        "result": "false"
      },
      {
        "call": "intervalContainsUnix(0, 1700000000, 170000000, 15000000)",
        "result": "false"
      },
      {
        "call": "intervalContainsUnix(NaN, 1700000000, 170000000)",
        "result": "false"
      },
      {
        "call": "intervalContainsUnix(\"0\", \"1700000000\", \"170000000\")",
        "result": "true"
      }
    ]
  },
  {
    "route": "/reference/unix/interval/intervalCountUnix",
    "fnName": "intervalCountUnix",
    "examples": [
      {
        "call": "intervalCountUnix(0, 86400000, \"hour\")",
        "result": "24"
      },
      {
        "call": "intervalCountUnix(1704153540000, 1704153660000, \"day\")",
        "result": "2 (23:59 to 00:01 UTC)"
      },
      {
        "call": "intervalCountUnix(0, 0, \"hour\")",
        "result": "0 (zero-length, on the boundary)"
      },
      {
        "call": "intervalCountUnix(1800000, 1800000, \"hour\")",
        "result": "1 (zero-length, mid-hour)"
      },
      {
        "call": "intervalCountUnix(86400000, 0, \"hour\")",
        "result": "null"
      },
      {
        "call": "intervalCountUnix(NaN, 86400000, \"hour\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/unix/interval/intervalDifferenceUnix",
    "fnName": "intervalDifferenceUnix",
    "examples": [
      {
        "call": "intervalDifferenceUnix(0, 1700000000, 1500000000, 1600000000)",
        "result": "[{ start: 0, end: 1499999999 }]"
      },
      {
        "call": "intervalDifferenceUnix(0, 1700000000, 0, 1700000000)",
        "result": "[]"
      },
      {
        "call": "intervalDifferenceUnix(NaN, 1700000000, 1500000000, 1600000000)",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/unix/interval/intervalDivideEquallyUnix",
    "fnName": "intervalDivideEquallyUnix",
    "examples": [
      {
        "call": "intervalDivideEquallyUnix(0, 90000000, 3)",
        "result": "[{ start: 0, end: 30000000 }, { start: 30000000, end: 60000000 }, { start: 60000000, end: 90000000 }]"
      },
      {
        "call": "intervalDivideEquallyUnix(0, 100000000, 3)",
        "result": "[{ start: 0, end: 33333333 }, { start: 33333333, end: 66666667 }, { start: 66666667, end: 100000000 }]"
      },
      {
        "call": "intervalDivideEquallyUnix(0, 90000000, 1)",
        "result": "[{ start: 0, end: 90000000 }]"
      },
      {
        "call": "intervalDivideEquallyUnix(0, 90000000, 0)",
        "result": "[]"
      },
      {
        "call": "intervalDivideEquallyUnix(NaN, 90000000, 3)",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/unix/interval/intervalEngulfsUnix",
    "fnName": "intervalEngulfsUnix",
    "examples": [
      {
        "call": "intervalEngulfsUnix(0, 1700000000, 1500000000, 1600000000)",
        "result": "true"
      },
      {
        "call": "intervalEngulfsUnix(0, 1700000000, 0, 1700000000)",
        "result": "true (equal intervals)"
      },
      {
        "call": "intervalEngulfsUnix(0, 1700000000, 0, 1500000000)",
        "result": "true"
      },
      {
        "call": "intervalEngulfsUnix(1500000000, 1600000000, 0, 1700000000)",
        "result": "false"
      },
      {
        "call": "intervalEngulfsUnix(NaN, 1700000000, 1500000000, 1600000000)",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/unix/interval/intervalFromDurationUnix",
    "fnName": "intervalFromDurationUnix",
    "examples": [
      {
        "call": "intervalFromDurationUnix(1704067200000, \"P1D\", \"start\", { timeZone: \"UTC\" })",
        "result": "{ start: 1704067200000, end: 1704153600000 }"
      },
      {
        "call": "intervalFromDurationUnix(1704153600000, \"P1D\", \"end\", { timeZone: \"UTC\" })",
        "result": "{ start: 1704067200000, end: 1704153600000 }"
      },
      {
        "call": "intervalFromDurationUnix(1706659200000, \"P1M\", \"start\", { timeZone: \"UTC\", overflow: \"reject\" })",
        "result": "null (Jan 31 + 1 month overflows)"
      },
      {
        "call": "intervalFromDurationUnix(1704067200000, \"-P10D\", \"start\", { timeZone: \"UTC\" })",
        "result": "null (inverted span)"
      },
      {
        "call": "intervalFromDurationUnix(NaN, \"P1D\", \"start\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/unix/interval/intervalIntersectionUnix",
    "fnName": "intervalIntersectionUnix",
    "examples": [
      {
        "call": "intervalIntersectionUnix(0, 1700000000, 1000000, 2000000)",
        "result": "{ start: 1000000, end: 1700000000 }"
      },
      {
        "call": "intervalIntersectionUnix(0, 1000000, 1000000, 2000000)",
        "result": "{ start: 1000000, end: 1000000 }"
      },
      {
        "call": "intervalIntersectionUnix(0, 1000000, 1000001, 2000000)",
        "result": "null"
      },
      {
        "call": "intervalIntersectionUnix(NaN, 1700000000, 1000000, 2000000)",
        "result": "null"
      },
      {
        "call": "intervalIntersectionUnix(\"0\", \"1700000000\", \"1000000\", \"2000000\")",
        "result": "{ start: 1000000, end: 1700000000 }"
      }
    ]
  },
  {
    "route": "/reference/unix/interval/intervalLengthUnix",
    "fnName": "intervalLengthUnix",
    "examples": [
      {
        "call": "intervalLengthUnix(0, 86400000, \"hour\")",
        "result": "24"
      },
      {
        "call": "intervalLengthUnix(0, 5400000, \"hour\")",
        "result": "1.5"
      },
      {
        "call": "intervalLengthUnix(0, 0, \"hour\")",
        "result": "0"
      },
      {
        "call": "intervalLengthUnix(86400000, 0, \"hour\")",
        "result": "null"
      },
      {
        "call": "intervalLengthUnix(NaN, 86400000, \"hour\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/unix/interval/intervalOverlappingDaysUnix",
    "fnName": "intervalOverlappingDaysUnix",
    "examples": [
      {
        "call": "intervalOverlappingDaysUnix(0, 172800000, 86400000, 259200000, { timeZone: \"UTC\" })",
        "result": "2"
      },
      {
        "call": "intervalOverlappingDaysUnix(0, 86400000, 86400000, 172800000, { timeZone: \"UTC\" })",
        "result": "1 (adjacent)"
      },
      {
        "call": "intervalOverlappingDaysUnix(0, 86400000, 172800000, 259200000, { timeZone: \"UTC\" })",
        "result": "0 (disjoint)"
      },
      {
        "call": "intervalOverlappingDaysUnix(NaN, 172800000, 86400000, 259200000, { timeZone: \"UTC\" })",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/unix/interval/intervalSplitAtUnix",
    "fnName": "intervalSplitAtUnix",
    "examples": [
      {
        "call": "intervalSplitAtUnix(0, 100000, [50000])",
        "result": "[{ start: 0, end: 50000 }, { start: 50000, end: 100000 }]"
      },
      {
        "call": "intervalSplitAtUnix(0, 100000, [])",
        "result": "[{ start: 0, end: 100000 }]"
      },
      {
        "call": "intervalSplitAtUnix(NaN, 100000, [50000])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/unix/interval/intervalUnionUnix",
    "fnName": "intervalUnionUnix",
    "examples": [
      {
        "call": "intervalUnionUnix(0, 1700000000, 1000000, 2000000)",
        "result": "{ start: 0, end: 1700000000 }"
      },
      {
        "call": "intervalUnionUnix(0, 1000000, 1000000, 2000000)",
        "result": "{ start: 0, end: 2000000 }"
      },
      {
        "call": "intervalUnionUnix(0, 1000000, 1000001, 2000000)",
        "result": "null"
      },
      {
        "call": "intervalUnionUnix(NaN, 1700000000, 1000000, 2000000)",
        "result": "null"
      },
      {
        "call": "intervalUnionUnix(\"0\", \"1700000000\", \"1000000\", \"2000000\")",
        "result": "{ start: 0, end: 1700000000 }"
      }
    ]
  },
  {
    "route": "/reference/unix/interval/intervalXorAllUnix",
    "fnName": "intervalXorAllUnix",
    "examples": [
      {
        "call": "intervalXorAllUnix([{ start: 0, end: 1500000000 }, { start: 1400000000, end: 1700000000 }])",
        "result": "[{ start: 0, end: 1399999999 }, { start: 1500000001, end: 1700000000 }]"
      },
      {
        "call": "intervalXorAllUnix([])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/unix/interval/intervalXorUnix",
    "fnName": "intervalXorUnix",
    "examples": [
      {
        "call": "intervalXorUnix(0, 1500000000, 1400000000, 1700000000)",
        "result": "[{ start: 0, end: 1399999999 }, { start: 1500000001, end: 1700000000 }]"
      },
      {
        "call": "intervalXorUnix(0, 1700000000, 1400000000, 1500000000)",
        "result": "[{ start: 0, end: 1399999999 }, { start: 1500000001, end: 1700000000 }]"
      },
      {
        "call": "intervalXorUnix(0, 1700000000, 0, 1700000000)",
        "result": "[]"
      },
      {
        "call": "intervalXorUnix(NaN, 1500000000, 1400000000, 1700000000)",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/unix/interval/intervalsOverlapUnix",
    "fnName": "intervalsOverlapUnix",
    "examples": [
      {
        "call": "intervalsOverlapUnix(0, 1700000000, 1000000, 2000000)",
        "result": "true"
      },
      {
        "call": "intervalsOverlapUnix(0, 1000000, 1000000, 2000000)",
        "result": "false (adjacent)"
      },
      {
        "call": "intervalsOverlapUnix(0, 1000000, 1000001, 2000000)",
        "result": "false (disjoint)"
      },
      {
        "call": "intervalsOverlapUnix(NaN, 1700000000, 1000000, 2000000)",
        "result": "false"
      },
      {
        "call": "intervalsOverlapUnix(\"0\", \"1700000000\", \"1000000\", \"2000000\")",
        "result": "true"
      }
    ]
  },
  {
    "route": "/reference/unix/interval/mergeIntervalsUnix",
    "fnName": "mergeIntervalsUnix",
    "examples": [
      {
        "call": "mergeIntervalsUnix([{ start: 0, end: 1000000 }, { start: 500000, end: 1500000 }])",
        "result": "[{ start: 0, end: 1500000 }]"
      },
      {
        "call": "mergeIntervalsUnix([])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/unix/interval/resolveUnixIntervalPair",
    "fnName": "resolveUnixIntervalPair",
    "examples": []
  },
  {
    "route": "/reference/unix/interval/splitIntervalByUnitUnix",
    "fnName": "splitIntervalByUnitUnix",
    "examples": [
      {
        "call": "splitIntervalByUnitUnix(0, 86400000, \"hour\", 6)",
        "result": "[{ start: 0, end: 21600000 }, { start: 21600000, end: 43200000 }, { start: 43200000, end: 64800000 }, { start: 64800000, end: 86400000 }]"
      },
      {
        "call": "splitIntervalByUnitUnix(0, 3600000, \"hour\", 1)",
        "result": "[{ start: 0, end: 3600000 }]"
      },
      {
        "call": "splitIntervalByUnitUnix(0, 0, \"hour\", 1)",
        "result": "[{ start: 0, end: 0 }]"
      },
      {
        "call": "splitIntervalByUnitUnix(0, 86400000, \"hour\", 0)",
        "result": "[]"
      },
      {
        "call": "splitIntervalByUnitUnix(\"invalid\", 86400000, \"hour\", 1)",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/unix/interval/isValidUnixInterval",
    "fnName": "isValidUnixInterval",
    "examples": [
      {
        "call": "isValidUnixInterval(0, 1700000000)",
        "result": "true"
      },
      {
        "call": "isValidUnixInterval(1000, 1000)",
        "result": "true"
      },
      {
        "call": "isValidUnixInterval(1700000000, 0)",
        "result": "false"
      },
      {
        "call": "isValidUnixInterval(\"0\", \"1700000000\")",
        "result": "true"
      }
    ]
  },
  {
    "route": "/reference/unix/parse/parseDateFromUnix",
    "fnName": "parseDateFromUnix",
    "examples": [
      {
        "call": "parseDateFromUnix(1700000000000)",
        "result": "\"2023-11-15\""
      },
      {
        "call": "parseDateFromUnix(1700000000, { epochUnit: \"seconds\" })",
        "result": "\"2023-11-15\""
      },
      {
        "call": "parseDateFromUnix(-86400, { epochUnit: \"seconds\" })",
        "result": "\"1969-12-31\""
      }
    ]
  },
  {
    "route": "/reference/unix/parse/parseDayFromUnix",
    "fnName": "parseDayFromUnix",
    "examples": [
      {
        "call": "parseDayFromUnix(1700000000000)",
        "result": "\"15\""
      },
      {
        "call": "parseDayFromUnix(-86400, { epochUnit: \"seconds\" })",
        "result": "\"31\""
      }
    ]
  },
  {
    "route": "/reference/unix/parse/parseDayOfWeekFromUnix",
    "fnName": "parseDayOfWeekFromUnix",
    "examples": [
      {
        "call": "parseDayOfWeekFromUnix(1704067200000)",
        "result": "1"
      },
      {
        "call": "parseDayOfWeekFromUnix(-86400, { epochUnit: \"seconds\" })",
        "result": "2"
      }
    ]
  },
  {
    "route": "/reference/unix/parse/parseHourFromUnix",
    "fnName": "parseHourFromUnix",
    "examples": [
      {
        "call": "parseHourFromUnix(1700000000000)",
        "result": "\"05\""
      },
      {
        "call": "parseHourFromUnix(-86400, { epochUnit: \"seconds\" })",
        "result": "\"00\""
      }
    ]
  },
  {
    "route": "/reference/unix/parse/parseMicrosecondFromUnix",
    "fnName": "parseMicrosecondFromUnix",
    "examples": [
      {
        "call": "parseMicrosecondFromUnix(1700000000000)",
        "result": "\"000\""
      },
      {
        "call": "parseMicrosecondFromUnix(-86400, { epochUnit: \"seconds\" })",
        "result": "\"000\""
      }
    ]
  },
  {
    "route": "/reference/unix/parse/parseMillisecondFromUnix",
    "fnName": "parseMillisecondFromUnix",
    "examples": [
      {
        "call": "parseMillisecondFromUnix(1700000000000)",
        "result": "\"000\""
      },
      {
        "call": "parseMillisecondFromUnix(-86400, { epochUnit: \"seconds\" })",
        "result": "\"000\""
      }
    ]
  },
  {
    "route": "/reference/unix/parse/parseMinuteFromUnix",
    "fnName": "parseMinuteFromUnix",
    "examples": [
      {
        "call": "parseMinuteFromUnix(1700000000000)",
        "result": "\"26\""
      },
      {
        "call": "parseMinuteFromUnix(-86400, { epochUnit: \"seconds\" })",
        "result": "\"00\""
      }
    ]
  },
  {
    "route": "/reference/unix/parse/parseMonthFromUnix",
    "fnName": "parseMonthFromUnix",
    "examples": [
      {
        "call": "parseMonthFromUnix(1700000000000)",
        "result": "\"09\""
      },
      {
        "call": "parseMonthFromUnix(1704067200000)",
        "result": "\"01\""
      },
      {
        "call": "parseMonthFromUnix(-86400, { epochUnit: \"seconds\" })",
        "result": "\"12\""
      }
    ]
  },
  {
    "route": "/reference/unix/parse/parseNanosecondFromUnix",
    "fnName": "parseNanosecondFromUnix",
    "examples": [
      {
        "call": "parseNanosecondFromUnix(1700000000000)",
        "result": "\"000000000\""
      },
      {
        "call": "parseNanosecondFromUnix(-86400, { epochUnit: \"seconds\" })",
        "result": "\"000000000\""
      }
    ]
  },
  {
    "route": "/reference/unix/parse/parseSecondFromUnix",
    "fnName": "parseSecondFromUnix",
    "examples": [
      {
        "call": "parseSecondFromUnix(1700000000000)",
        "result": "\"26\""
      },
      {
        "call": "parseSecondFromUnix(-86400, { epochUnit: \"seconds\" })",
        "result": "\"00\""
      }
    ]
  },
  {
    "route": "/reference/unix/parse/parseTimeFromUnix",
    "fnName": "parseTimeFromUnix",
    "examples": [
      {
        "call": "parseTimeFromUnix(1700000000000)",
        "result": "\"04:13:20\""
      },
      {
        "call": "parseTimeFromUnix(1700000000, { epochUnit: \"seconds\" })",
        "result": "\"04:13:20\""
      },
      {
        "call": "parseTimeFromUnix(-86400, { epochUnit: \"seconds\" })",
        "result": "\"00:00:00\""
      }
    ]
  },
  {
    "route": "/reference/unix/parse/parseUnitFromUnix",
    "fnName": "parseUnitFromUnix",
    "examples": [
      {
        "call": "parseUnitFromUnix(1700000000000, \"year\")",
        "result": "\"2023\""
      },
      {
        "call": "parseUnitFromUnix(1700000000, \"hour\", { epochUnit: \"seconds\" })",
        "result": "\"12\""
      },
      {
        "call": "parseUnitFromUnix(1704067200000, \"week\")",
        "result": "\"1\""
      },
      {
        "call": "parseUnitFromUnix(1704067200000, \"week\", { weekStartsOn: \"sunday\" })",
        "result": "\"1\""
      },
      {
        "call": "parseUnitFromUnix(-86400, { epochUnit: \"seconds\" }, \"year\")",
        "result": "\"1969\""
      }
    ]
  },
  {
    "route": "/reference/unix/parse/parseWeekFromUnix",
    "fnName": "parseWeekFromUnix",
    "examples": [
      {
        "call": "parseWeekFromUnix(1704067200000)",
        "result": "1"
      },
      {
        "call": "parseWeekFromUnix(1704067200000, { weekStartsOn: \"sunday\" })",
        "result": "1"
      },
      {
        "call": "parseWeekFromUnix(-86400, { epochUnit: \"seconds\" })",
        "result": "1"
      }
    ]
  },
  {
    "route": "/reference/unix/parse/parseYearFromUnix",
    "fnName": "parseYearFromUnix",
    "examples": [
      {
        "call": "parseYearFromUnix(1700000000000)",
        "result": "\"2023\""
      },
      {
        "call": "parseYearFromUnix(1704067200000, { epochUnit: \"milliseconds\" })",
        "result": "\"2024\""
      },
      {
        "call": "parseYearFromUnix(-86400, { epochUnit: \"seconds\" })",
        "result": "\"1969\""
      }
    ]
  },
  {
    "route": "/reference/unix/validate/isValidUnixMilliseconds",
    "fnName": "isValidUnixMilliseconds",
    "examples": [
      {
        "call": "isValidUnixMilliseconds(1700000000000)",
        "result": "true"
      },
      {
        "call": "isValidUnixMilliseconds(-86400000)",
        "result": "true (1969-12-31)"
      },
      {
        "call": "isValidUnixMilliseconds(1.5)",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/unix/validate/isValidUnixRange",
    "fnName": "isValidUnixRange",
    "examples": [
      {
        "call": "isValidUnixRange({ value1: 0, value2: 1700000000 })",
        "result": "true"
      },
      {
        "call": "isValidUnixRange({ value1: 1700000000, value2: 0 })",
        "result": "false"
      },
      {
        "call": "isValidUnixRange({ value1: 1000, value2: 1000, options: { allowEqual: true } })",
        "result": "true"
      }
    ]
  },
  {
    "route": "/reference/unix/validate/isValidUnixSeconds",
    "fnName": "isValidUnixSeconds",
    "examples": [
      {
        "call": "isValidUnixSeconds(1700000000)",
        "result": "true"
      },
      {
        "call": "isValidUnixSeconds(-86400)",
        "result": "true (1969-12-31)"
      },
      {
        "call": "isValidUnixSeconds(1.5)",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/unix/validate/isValidUnixUnit",
    "fnName": "isValidUnixUnit",
    "examples": [
      {
        "call": "isValidUnixUnit(\"seconds\")",
        "result": "true"
      },
      {
        "call": "isValidUnixUnit(\"milliseconds\")",
        "result": "true"
      },
      {
        "call": "isValidUnixUnit(\"invalid\")",
        "result": "false"
      },
      {
        "call": "isValidUnixUnit(123)",
        "result": "false"
      },
      {
        "call": "isValidUnixUnit(null)",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/utc/calculate/addUtc",
    "fnName": "addUtc",
    "examples": [
      {
        "call": "addUtc(\"2024-03-10T12:00:00Z\", { days: 5 })",
        "result": "\"2024-03-15T12:00:00Z\""
      },
      {
        "call": "addUtc(\"2024-03-10T12:00:00Z\", { months: 1, years: 1 })",
        "result": "\"2025-04-10T12:00:00Z\""
      },
      {
        "call": "addUtc(\"invalid\", { days: 5 })",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/calculate/diffUtc",
    "fnName": "diffUtc",
    "examples": [
      {
        "call": "diffUtc(\"2024-03-10T12:00:00Z\", \"2024-03-11T12:00:00Z\", \"hour\")",
        "result": "24"
      },
      {
        "call": "diffUtc(\"2024-03-10T12:00:00Z\", \"2025-04-10T12:00:00Z\", [\"year\", \"month\"])",
        "result": "{ year: 1, month: 1 }"
      },
      {
        "call": "diffUtc(\"invalid\", \"2024-03-11T12:00:00Z\", \"hour\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/utc/calculate/diffUtcAsDuration",
    "fnName": "diffUtcAsDuration",
    "examples": [
      {
        "call": "diffUtcAsDuration(\"2024-03-10T12:00:00Z\", \"2024-03-11T12:00:00Z\", \"hours\")",
        "result": "\"PT24H\""
      },
      {
        "call": "diffUtcAsDuration(\"2024-03-11T12:00:00Z\", \"2024-03-10T12:00:00Z\", \"hours\")",
        "result": "\"-PT24H\""
      },
      {
        "call": "diffUtcAsDuration(\"invalid\", \"2024-03-11T12:00:00Z\", \"hours\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/calculate/endOfQuarterForUtc",
    "fnName": "endOfQuarterForUtc",
    "examples": [
      {
        "call": "endOfQuarterForUtc(\"2024-03-15T12:00:00Z\")",
        "result": "\"2024-03-31T23:59:59.999Z\""
      },
      {
        "call": "endOfQuarterForUtc(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/calculate/endOfUtc",
    "fnName": "endOfUtc",
    "examples": [
      {
        "call": "endOfUtc(\"2024-03-15T14:30:45Z\", \"year\")",
        "result": "\"2024-12-31T23:59:59.999999999Z\""
      },
      {
        "call": "endOfUtc(\"2024-03-15T14:30:45Z\", \"month\")",
        "result": "\"2024-03-31T23:59:59.999999999Z\""
      },
      {
        "call": "endOfUtc(\"invalid\", \"year\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/calculate/isBetweenUtc",
    "fnName": "isBetweenUtc",
    "examples": [
      {
        "call": "isBetweenUtc(\"2024-03-15T12:00:00Z\", \"2024-03-10T12:00:00Z\", \"2024-03-20T12:00:00Z\")",
        "result": "true"
      },
      {
        "call": "isBetweenUtc(\"2024-03-25T12:00:00Z\", \"2024-03-10T12:00:00Z\", \"2024-03-20T12:00:00Z\")",
        "result": "false"
      },
      {
        "call": "isBetweenUtc(\"invalid\", \"2024-03-10T12:00:00Z\", \"2024-03-20T12:00:00Z\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/utc/calculate/maxUtc",
    "fnName": "maxUtc",
    "examples": [
      {
        "call": "maxUtc([\"2024-03-10T12:00:00Z\", \"2024-03-15T12:00:00Z\", \"2024-03-12T12:00:00Z\"])",
        "result": "\"2024-03-15T12:00:00Z\""
      },
      {
        "call": "maxUtc([\"invalid\", \"2024-03-15T12:00:00Z\"])",
        "result": "\"2024-03-15T12:00:00Z\""
      },
      {
        "call": "maxUtc([\"invalid\", \"also invalid\"])",
        "result": "null"
      },
      {
        "call": "maxUtc([])",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/utc/calculate/minUtc",
    "fnName": "minUtc",
    "examples": [
      {
        "call": "minUtc([\"2024-03-10T12:00:00Z\", \"2024-03-15T12:00:00Z\", \"2024-03-12T12:00:00Z\"])",
        "result": "\"2024-03-10T12:00:00Z\""
      },
      {
        "call": "minUtc([\"invalid\", \"2024-03-15T12:00:00Z\"])",
        "result": "\"2024-03-15T12:00:00Z\""
      },
      {
        "call": "minUtc([\"invalid\", \"also invalid\"])",
        "result": "null"
      },
      {
        "call": "minUtc([])",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/utc/calculate/roundUtc",
    "fnName": "roundUtc",
    "examples": [
      {
        "call": "roundUtc(\"2024-06-15T12:34:56Z\", { smallestUnit: \"hour\" })",
        "result": "\"2024-06-15T13:00:00Z\""
      },
      {
        "call": "roundUtc(\"2024-06-15T12:34:56Z\", { smallestUnit: \"minute\", roundingIncrement: 15 })",
        "result": "\"2024-06-15T12:45:00Z\""
      },
      {
        "call": "roundUtc(\"2024-06-15T12:34:56Z\", { smallestUnit: \"second\", roundingMode: \"floor\" })",
        "result": "\"2024-06-15T12:34:56Z\""
      },
      {
        "call": "roundUtc(\"invalid\", { smallestUnit: \"hour\" })",
        "result": "\"\""
      },
      {
        "call": "roundUtc(\"\", { smallestUnit: \"hour\" })",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/calculate/setUtc",
    "fnName": "setUtc",
    "examples": [
      {
        "call": "setUtc(\"2024-03-10T12:00:00Z\", { hour: 9 })",
        "result": "\"2024-03-10T09:00:00Z\""
      },
      {
        "call": "setUtc(\"2024-01-31T12:00:00Z\", { month: 2 })",
        "result": "\"2024-02-29T12:00:00Z\" (constrain clamps to the last valid day)"
      },
      {
        "call": "setUtc(\"2024-01-31T12:00:00Z\", { month: 2 }, { overflow: \"reject\" })",
        "result": "\"\""
      },
      {
        "call": "setUtc(\"2024-03-10T12:00:00Z\", {})",
        "result": "\"2024-03-10T12:00:00Z\" (empty fields object is a no-op)"
      },
      {
        "call": "setUtc(\"invalid\", { hour: 9 })",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/calculate/sortUtc",
    "fnName": "sortUtc",
    "examples": [
      {
        "call": "sortUtc([\"2024-03-12T12:00:00Z\", \"2024-03-10T12:00:00Z\", \"2024-03-15T12:00:00Z\"])",
        "result": "[\"2024-03-10T12:00:00Z\", \"2024-03-12T12:00:00Z\", \"2024-03-15T12:00:00Z\"]"
      },
      {
        "call": "sortUtc([\"2024-03-12T12:00:00Z\", \"2024-03-10T12:00:00Z\", \"2024-03-15T12:00:00Z\"], \"desc\")",
        "result": "[\"2024-03-15T12:00:00Z\", \"2024-03-12T12:00:00Z\", \"2024-03-10T12:00:00Z\"]"
      },
      {
        "call": "sortUtc([\"invalid\", \"2024-03-10T12:00:00Z\", \"also invalid\"])",
        "result": "[\"2024-03-10T12:00:00Z\"]"
      },
      {
        "call": "sortUtc([])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/utc/calculate/startOfQuarterForUtc",
    "fnName": "startOfQuarterForUtc",
    "examples": [
      {
        "call": "startOfQuarterForUtc(\"2024-03-15T12:00:00Z\")",
        "result": "\"2024-01-01T00:00:00Z\""
      },
      {
        "call": "startOfQuarterForUtc(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/calculate/startOfUtc",
    "fnName": "startOfUtc",
    "examples": [
      {
        "call": "startOfUtc(\"2024-03-15T14:30:45Z\", \"year\")",
        "result": "\"2024-01-01T00:00:00Z\""
      },
      {
        "call": "startOfUtc(\"2024-03-15T14:30:45Z\", \"month\")",
        "result": "\"2024-03-01T00:00:00Z\""
      },
      {
        "call": "startOfUtc(\"invalid\", \"year\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/calculate/startOrEndOfUtc",
    "fnName": "startOrEndOfUtc",
    "examples": []
  },
  {
    "route": "/reference/utc/calculate/subtractUtc",
    "fnName": "subtractUtc",
    "examples": [
      {
        "call": "subtractUtc(\"2024-03-15T12:00:00Z\", { days: 5 })",
        "result": "\"2024-03-10T12:00:00Z\""
      },
      {
        "call": "subtractUtc(\"2024-03-15T12:00:00Z\", { months: 1, years: 1 })",
        "result": "\"2023-02-15T12:00:00Z\""
      },
      {
        "call": "subtractUtc(\"invalid\", { days: 5 })",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/chop/chopUtc",
    "fnName": "chopUtc",
    "examples": [
      {
        "call": "chopUtc(\"2024-03-10T12:00:00Z\")",
        "result": "\"2024-03-10T12:00:00\""
      },
      {
        "call": "chopUtc(\"2024-03-10T12:00:00\")",
        "result": "\"2024-03-10T12:00:00\""
      },
      {
        "call": "chopUtc(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/compare/areUtcEqual",
    "fnName": "areUtcEqual",
    "examples": [
      {
        "call": "areUtcEqual(\"2024-03-17T14:30:45Z\", \"2024-03-17T14:30:45Z\")",
        "result": "true"
      },
      {
        "call": "areUtcEqual(\"2024-03-17T14:30:45Z\", \"2024-03-17T14:30:44Z\")",
        "result": "false"
      },
      {
        "call": "areUtcEqual(\"2024-03-17T14:30:45Z\", \"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/utc/compare/areUtcEqualBy",
    "fnName": "areUtcEqualBy",
    "examples": [
      {
        "call": "areUtcEqualBy(\"2024-03-15T02:00:00Z\", \"2024-03-15T22:00:00Z\", \"day\")",
        "result": "true"
      },
      {
        "call": "areUtcEqualBy(\"2024-03-15T23:30:00Z\", \"2024-03-16T00:30:00Z\", \"day\")",
        "result": "false"
      },
      {
        "call": "areUtcEqualBy(\"invalid\", \"2024-03-15T02:00:00Z\", \"day\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/utc/compare/isAfterUtc",
    "fnName": "isAfterUtc",
    "examples": [
      {
        "call": "isAfterUtc(\"2024-03-17T15:30:45Z\", \"2024-03-17T14:30:45Z\")",
        "result": "true"
      },
      {
        "call": "isAfterUtc(\"2024-03-17T14:30:45Z\", \"2024-03-17T14:30:45Z\")",
        "result": "false"
      },
      {
        "call": "isAfterUtc(\"2024-03-17T14:30:45Z\", \"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/utc/compare/isBeforeUtc",
    "fnName": "isBeforeUtc",
    "examples": [
      {
        "call": "isBeforeUtc(\"2024-03-17T14:30:45Z\", \"2024-03-17T15:30:45Z\")",
        "result": "true"
      },
      {
        "call": "isBeforeUtc(\"2024-03-17T14:30:45Z\", \"2024-03-17T14:30:45Z\")",
        "result": "false"
      },
      {
        "call": "isBeforeUtc(\"2024-03-17T14:30:45Z\", \"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/utc/convert/convertUtcToPlainDate",
    "fnName": "convertUtcToPlainDate",
    "examples": [
      {
        "call": "convertUtcToPlainDate(\"2024-02-29T00:00:00Z\")",
        "result": "\"2024-02-29\""
      },
      {
        "call": "convertUtcToPlainDate(\"2024-02-29T00:00:00Z\", { timeZone: \"America/New_York\" })",
        "result": "\"2024-02-28\""
      },
      {
        "call": "convertUtcToPlainDate(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/convert/convertUtcToPlainDateTime",
    "fnName": "convertUtcToPlainDateTime",
    "examples": [
      {
        "call": "convertUtcToPlainDateTime(\"2024-02-29T00:00:00Z\")",
        "result": "\"2024-02-29T00:00:00\""
      },
      {
        "call": "convertUtcToPlainDateTime(\"2024-02-29T00:00:00Z\", { timeZone: \"America/New_York\" })",
        "result": "\"2024-02-28T19:00:00\""
      },
      {
        "call": "convertUtcToPlainDateTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/convert/convertUtcToPlainTime",
    "fnName": "convertUtcToPlainTime",
    "examples": [
      {
        "call": "convertUtcToPlainTime(\"2024-02-29T00:00:00Z\")",
        "result": "\"00:00:00\""
      },
      {
        "call": "convertUtcToPlainTime(\"2024-02-29T00:00:00Z\", { timeZone: \"America/New_York\" })",
        "result": "\"19:00:00\""
      },
      {
        "call": "convertUtcToPlainTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/convert/convertUtcToUnix",
    "fnName": "convertUtcToUnix",
    "examples": [
      {
        "call": "convertUtcToUnix(\"2024-02-29T00:00:00Z\")",
        "result": "1709164800000"
      },
      {
        "call": "convertUtcToUnix(\"2024-02-29T00:00:00Z\", \"seconds\")",
        "result": "1709164800"
      },
      {
        "call": "convertUtcToUnix(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/utc/convert/convertUtcToZoned",
    "fnName": "convertUtcToZoned",
    "examples": [
      {
        "call": "convertUtcToZoned(\"2024-02-29T00:00:00Z\", \"America/New_York\")",
        "result": "\"2024-02-28T19:00:00-05:00[America/New_York]\""
      },
      {
        "call": "convertUtcToZoned(\"invalid\", \"UTC\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/format/formatCalendarUtc",
    "fnName": "formatCalendarUtc",
    "examples": [
      {
        "call": "formatCalendarUtc(\"2026-03-16T18:30:00Z\", \"en-US\", { timeZone: \"America/New_York\", reference: \"2026-03-15T13:00:00Z\" })",
        "result": "\"tomorrow at 2:30 PM\""
      },
      {
        "call": "formatCalendarUtc(value, \"fr-FR\", { timeZone: \"Europe/Paris\" })",
        "result": "\"demain à 14:30\""
      },
      {
        "call": "formatCalendarUtc(\"not-a-date\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/format/formatHttp",
    "fnName": "formatHttp",
    "examples": [
      {
        "call": "formatHttp(\"2024-03-15T14:30:00Z\")",
        "result": "\"Fri, 15 Mar 2024 14:30:00 GMT\""
      },
      {
        "call": "formatHttp(\"2024-03-15T14:30:00.500Z\")",
        "result": "\"Fri, 15 Mar 2024 14:30:00 GMT\""
      },
      {
        "call": "formatHttp(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/format/formatRelativeUtc",
    "fnName": "formatRelativeUtc",
    "examples": [
      {
        "call": "formatRelativeUtc(\"2024-03-17T14:30:45+00:00[UTC]\", \"en-US\")",
        "result": "\"2 years ago\""
      },
      {
        "call": "formatRelativeUtc(value, \"en-US\", { roundingMethod: \"floor\" })",
        "result": "rounds toward the earlier boundary"
      },
      {
        "call": "formatRelativeUtc(\"not-a-date\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/format/formatUtc",
    "fnName": "formatUtc",
    "examples": [
      {
        "call": "formatUtc(\"2026-03-16T18:30:00Z\")",
        "result": "\"3/16/2026, 6:30:00 PM\""
      },
      {
        "call": "formatUtc(\"2026-03-16T18:30:00Z\", \"en-US\", { timeZone: \"America/New_York\" })",
        "result": "\"3/16/2026, 2:30:00 PM\""
      },
      {
        "call": "formatUtc(\"2026-03-16T18:30:00Z\", \"en-US\", { timeZone: \"America/New_York\", includeTimeZoneName: true })",
        "result": "\"3/16/2026, 2:30:00 PM EDT\""
      },
      {
        "call": "formatUtc(\"not-a-date\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/get/getUtcDay",
    "fnName": "getUtcDay",
    "examples": [
      {
        "call": "getUtcDay()",
        "result": "\"29\""
      },
      {
        "call": "getUtcDay()",
        "result": "\"\" (on failure)"
      }
    ]
  },
  {
    "route": "/reference/utc/get/getUtcHour",
    "fnName": "getUtcHour",
    "examples": [
      {
        "call": "getUtcHour()",
        "result": "\"00\""
      },
      {
        "call": "getUtcHour()",
        "result": "\"\" (on failure)"
      }
    ]
  },
  {
    "route": "/reference/utc/get/getUtcMicrosecond",
    "fnName": "getUtcMicrosecond",
    "examples": [
      {
        "call": "getUtcMicrosecond()",
        "result": "\"456\""
      },
      {
        "call": "getUtcMicrosecond()",
        "result": "\"\" (on failure)"
      }
    ]
  },
  {
    "route": "/reference/utc/get/getUtcMillisecond",
    "fnName": "getUtcMillisecond",
    "examples": [
      {
        "call": "getUtcMillisecond()",
        "result": "\"123\""
      },
      {
        "call": "getUtcMillisecond()",
        "result": "\"\" (on failure)"
      }
    ]
  },
  {
    "route": "/reference/utc/get/getUtcMinute",
    "fnName": "getUtcMinute",
    "examples": [
      {
        "call": "getUtcMinute()",
        "result": "\"30\""
      },
      {
        "call": "getUtcMinute()",
        "result": "\"\" (on failure)"
      }
    ]
  },
  {
    "route": "/reference/utc/get/getUtcMonth",
    "fnName": "getUtcMonth",
    "examples": [
      {
        "call": "getUtcMonth()",
        "result": "\"02\""
      },
      {
        "call": "getUtcMonth()",
        "result": "\"\" (on failure)"
      }
    ]
  },
  {
    "route": "/reference/utc/get/getUtcNanosecond",
    "fnName": "getUtcNanosecond",
    "examples": [
      {
        "call": "getUtcNanosecond()",
        "result": "\"789\""
      },
      {
        "call": "getUtcNanosecond()",
        "result": "\"\" (on failure)"
      }
    ]
  },
  {
    "route": "/reference/utc/get/getUtcNow",
    "fnName": "getUtcNow",
    "examples": [
      {
        "call": "getUtcNow()",
        "result": "\"2024-02-29T00:00:00Z\""
      },
      {
        "call": "getUtcNow()",
        "result": "\"\" (on failure)"
      }
    ]
  },
  {
    "route": "/reference/utc/get/isValidUtcNowUnit",
    "fnName": "isValidUtcNowUnit",
    "examples": []
  },
  {
    "route": "/reference/utc/get/getUtcNowUnit",
    "fnName": "getUtcNowUnit",
    "examples": [
      {
        "call": "getUtcNowUnit(\"year\")",
        "result": "\"2024\""
      },
      {
        "call": "getUtcNowUnit(\"month\")",
        "result": "\"02\""
      },
      {
        "call": "getUtcNowUnit(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/get/getUtcSecond",
    "fnName": "getUtcSecond",
    "examples": [
      {
        "call": "getUtcSecond()",
        "result": "\"45\""
      },
      {
        "call": "getUtcSecond()",
        "result": "\"\" (on failure)"
      }
    ]
  },
  {
    "route": "/reference/utc/get/getUtcYear",
    "fnName": "getUtcYear",
    "examples": [
      {
        "call": "getUtcYear()",
        "result": "\"2024\""
      },
      {
        "call": "getUtcYear()",
        "result": "\"\" (on failure)"
      }
    ]
  },
  {
    "route": "/reference/utc/interval/intervalAbutsUtc",
    "fnName": "intervalAbutsUtc",
    "examples": [
      {
        "call": "intervalAbutsUtc(\"2024-01-01T09:00:00Z\", \"2024-06-30T12:00:00Z\", \"2024-06-30T12:00:00.000000001Z\", \"2024-12-31T17:00:00Z\")",
        "result": "true"
      },
      {
        "call": "intervalAbutsUtc(\"2024-06-30T12:00:00Z\", \"2024-12-31T17:00:00Z\", \"2024-01-01T09:00:00Z\", \"2024-06-30T12:00:00.000000001Z\")",
        "result": "true"
      },
      {
        "call": "intervalAbutsUtc(\"2024-01-01T09:00:00Z\", \"2024-06-30T12:00:00Z\", \"2024-06-30T12:00:01Z\", \"2024-12-31T17:00:00Z\")",
        "result": "false (gap)"
      },
      {
        "call": "intervalAbutsUtc(\"2024-01-01T09:00:00Z\", \"2024-06-30T13:00:00Z\", \"2024-06-30T12:00:00Z\", \"2024-12-31T17:00:00Z\")",
        "result": "false (overlap)"
      },
      {
        "call": "intervalAbutsUtc(\"invalid\", \"2024-06-30T12:00:00Z\", \"2024-06-30T12:00:00Z\", \"2024-12-31T17:00:00Z\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/utc/interval/intervalContainsUtc",
    "fnName": "intervalContainsUtc",
    "examples": [
      {
        "call": "intervalContainsUtc(\"2024-01-01T00:00:00Z\", \"2024-12-31T23:59:59Z\", \"2024-06-15T12:00:00Z\")",
        "result": "true"
      },
      {
        "call": "intervalContainsUtc(\"2024-01-01T00:00:00Z\", \"2024-12-31T23:59:59Z\", \"2024-06-15T12:00:00Z\", \"2024-07-15T12:00:00Z\")",
        "result": "true"
      },
      {
        "call": "intervalContainsUtc(\"2024-12-31T23:59:59Z\", \"2024-01-01T00:00:00Z\", \"2024-06-15T12:00:00Z\")",
        "result": "false"
      },
      {
        "call": "intervalContainsUtc(\"invalid\", \"2024-12-31T23:59:59Z\", \"2024-06-15T12:00:00Z\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/utc/interval/intervalCountUtc",
    "fnName": "intervalCountUtc",
    "examples": [
      {
        "call": "intervalCountUtc(\"2024-01-01T23:59:00Z\", \"2024-01-02T00:01:00Z\", \"day\")",
        "result": "2"
      },
      {
        "call": "intervalCountUtc(\"2024-01-01T00:00:00Z\", \"2024-01-03T00:00:00Z\", \"day\")",
        "result": "2"
      },
      {
        "call": "intervalCountUtc(\"2024-01-15T00:00:00Z\", \"2024-03-10T00:00:00Z\", \"month\")",
        "result": "3"
      },
      {
        "call": "intervalCountUtc(\"2024-01-01T05:00:00Z\", \"2024-01-01T05:00:00Z\", \"day\")",
        "result": "1 (zero-length, mid-day)"
      },
      {
        "call": "intervalCountUtc(\"2024-01-01T00:00:00Z\", \"2024-01-01T00:00:00Z\", \"day\")",
        "result": "0 (zero-length, on the boundary)"
      },
      {
        "call": "intervalCountUtc(\"invalid\", \"2024-01-02T00:00:00Z\", \"day\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/utc/interval/intervalDifferenceUtc",
    "fnName": "intervalDifferenceUtc",
    "examples": [
      {
        "call": "intervalDifferenceUtc(\"2024-01-01T09:00:00Z\", \"2024-12-31T17:00:00Z\", \"2024-06-01T12:00:00Z\", \"2024-07-01T13:00:00Z\")",
        "result": "[{ start: \"2024-01-01T09:00:00Z\", end: \"2024-05-31T17:00:00Z\" }, { start: \"2024-07-01T13:00:01Z\", end: \"2024-12-31T17:00:00Z\" }]"
      },
      {
        "call": "intervalDifferenceUtc(\"2024-01-01T09:00:00Z\", \"2024-12-31T17:00:00Z\", \"2024-01-01T09:00:00Z\", \"2024-12-31T17:00:00Z\")",
        "result": "[]"
      },
      {
        "call": "intervalDifferenceUtc(\"invalid\", \"2024-12-31T17:00:00Z\", \"2024-06-01T12:00:00Z\", \"2024-07-01T13:00:00Z\")",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/utc/interval/intervalDivideEquallyUtc",
    "fnName": "intervalDivideEquallyUtc",
    "examples": [
      {
        "call": "intervalDivideEquallyUtc(\"2024-01-01T00:00:00Z\", \"2024-01-04T00:00:00Z\", 3)",
        "result": "[{ start: \"2024-01-01T00:00:00Z\", end: \"2024-01-02T00:00:00Z\" }, { start: \"2024-01-02T00:00:00Z\", end: \"2024-01-03T00:00:00Z\" }, { start: \"2024-01-03T00:00:00Z\", end: \"2024-01-04T00:00:00Z\" }]"
      },
      {
        "call": "intervalDivideEquallyUtc(\"2024-01-01T00:00:00Z\", \"2024-01-04T00:00:00Z\", 1)",
        "result": "[{ start: \"2024-01-01T00:00:00Z\", end: \"2024-01-04T00:00:00Z\" }]"
      },
      {
        "call": "intervalDivideEquallyUtc(\"2024-01-01T00:00:00Z\", \"2024-01-04T00:00:00Z\", 0)",
        "result": "[]"
      },
      {
        "call": "intervalDivideEquallyUtc(\"invalid\", \"2024-01-04T00:00:00Z\", 3)",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/utc/interval/intervalEngulfsUtc",
    "fnName": "intervalEngulfsUtc",
    "examples": [
      {
        "call": "intervalEngulfsUtc(\"2024-01-01T09:00:00Z\", \"2024-12-31T17:00:00Z\", \"2024-06-01T12:00:00Z\", \"2024-07-01T13:00:00Z\")",
        "result": "true"
      },
      {
        "call": "intervalEngulfsUtc(\"2024-01-01T09:00:00Z\", \"2024-12-31T17:00:00Z\", \"2024-01-01T09:00:00Z\", \"2024-12-31T17:00:00Z\")",
        "result": "true (equal intervals)"
      },
      {
        "call": "intervalEngulfsUtc(\"2024-01-01T09:00:00Z\", \"2024-12-31T17:00:00Z\", \"2024-01-01T09:00:00Z\", \"2024-06-30T12:00:00Z\")",
        "result": "true"
      },
      {
        "call": "intervalEngulfsUtc(\"2024-06-01T12:00:00Z\", \"2024-07-01T13:00:00Z\", \"2024-01-01T09:00:00Z\", \"2024-12-31T17:00:00Z\")",
        "result": "false"
      },
      {
        "call": "intervalEngulfsUtc(\"invalid\", \"2024-12-31T17:00:00Z\", \"2024-06-01T12:00:00Z\", \"2024-07-01T13:00:00Z\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/utc/interval/intervalFromDurationUtc",
    "fnName": "intervalFromDurationUtc",
    "examples": [
      {
        "call": "intervalFromDurationUtc(\"2024-01-01T00:00:00Z\", \"P1D\", \"start\")",
        "result": "{ start: \"2024-01-01T00:00:00Z\", end: \"2024-01-02T00:00:00Z\" }"
      },
      {
        "call": "intervalFromDurationUtc(\"2024-01-02T00:00:00Z\", \"P1D\", \"end\")",
        "result": "{ start: \"2024-01-01T00:00:00Z\", end: \"2024-01-02T00:00:00Z\" }"
      },
      {
        "call": "intervalFromDurationUtc(\"2024-01-31T00:00:00Z\", \"P1M\", \"start\", { overflow: \"reject\" })",
        "result": "null"
      },
      {
        "call": "intervalFromDurationUtc(\"2024-01-05T00:00:00Z\", \"-P10D\", \"start\")",
        "result": "null (inverted span)"
      },
      {
        "call": "intervalFromDurationUtc(\"invalid\", \"P1D\", \"start\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/utc/interval/intervalIntersectionUtc",
    "fnName": "intervalIntersectionUtc",
    "examples": [
      {
        "call": "intervalIntersectionUtc(\"2024-01-01T00:00:00Z\", \"2024-06-30T23:59:59Z\", \"2024-04-01T00:00:00Z\", \"2024-12-31T23:59:59Z\")",
        "result": "{ start: \"2024-04-01T00:00:00Z\", end: \"2024-06-30T23:59:59Z\" }"
      },
      {
        "call": "intervalIntersectionUtc(\"2024-01-01T00:00:00Z\", \"2024-06-30T23:59:59Z\", \"2024-07-01T00:00:00Z\", \"2024-12-31T23:59:59Z\")",
        "result": "null"
      },
      {
        "call": "intervalIntersectionUtc(\"2024-01-01T00:00:00Z\", \"2024-06-30T23:59:59Z\", \"2024-07-02T00:00:00Z\", \"2024-12-31T23:59:59Z\")",
        "result": "null"
      },
      {
        "call": "intervalIntersectionUtc(\"invalid\", \"2024-06-30T23:59:59Z\", \"2024-04-01T00:00:00Z\", \"2024-12-31T23:59:59Z\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/utc/interval/intervalLengthUtc",
    "fnName": "intervalLengthUtc",
    "examples": [
      {
        "call": "intervalLengthUtc(\"2024-01-01T23:59:00Z\", \"2024-01-02T00:01:00Z\", \"day\")",
        "result": "0.001388888888888889"
      },
      {
        "call": "intervalLengthUtc(\"2024-01-01T23:59:00Z\", \"2024-01-02T00:01:00Z\", \"minute\")",
        "result": "2"
      },
      {
        "call": "intervalLengthUtc(\"2024-01-01T00:00:00Z\", \"2024-01-01T00:00:00Z\", \"day\")",
        "result": "0"
      },
      {
        "call": "intervalLengthUtc(\"invalid\", \"2024-01-02T00:00:00Z\", \"day\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/utc/interval/intervalOverlappingDaysUtc",
    "fnName": "intervalOverlappingDaysUtc",
    "examples": [
      {
        "call": "intervalOverlappingDaysUtc(\"2024-01-01T23:59:00Z\", \"2024-01-02T00:01:00Z\", \"2024-01-01T23:59:00Z\", \"2024-01-02T00:01:00Z\")",
        "result": "2"
      },
      {
        "call": "intervalOverlappingDaysUtc(\"2024-01-01T00:00:00Z\", \"2024-01-02T00:00:00Z\", \"2024-01-02T00:00:00Z\", \"2024-01-03T00:00:00Z\")",
        "result": "1 (adjacent)"
      },
      {
        "call": "intervalOverlappingDaysUtc(\"2024-01-01T00:00:00Z\", \"2024-01-02T00:00:00Z\", \"2024-01-03T00:00:00Z\", \"2024-01-04T00:00:00Z\")",
        "result": "0 (disjoint)"
      },
      {
        "call": "intervalOverlappingDaysUtc(\"invalid\", \"2024-06-30T23:59:59Z\", \"2024-04-01T00:00:00Z\", \"2024-12-31T23:59:59Z\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/utc/interval/intervalSplitAtUtc",
    "fnName": "intervalSplitAtUtc",
    "examples": [
      {
        "call": "intervalSplitAtUtc(\"2024-01-01T00:00:00Z\", \"2024-01-10T00:00:00Z\", [\"2024-01-05T00:00:00Z\"])",
        "result": "[{ start: \"2024-01-01T00:00:00Z\", end: \"2024-01-05T00:00:00Z\" }, { start: \"2024-01-05T00:00:00Z\", end: \"2024-01-10T00:00:00Z\" }]"
      },
      {
        "call": "intervalSplitAtUtc(\"2024-01-01T00:00:00Z\", \"2024-01-10T00:00:00Z\", [])",
        "result": "[{ start: \"2024-01-01T00:00:00Z\", end: \"2024-01-10T00:00:00Z\" }]"
      },
      {
        "call": "intervalSplitAtUtc(\"invalid\", \"2024-01-10T00:00:00Z\", [\"2024-01-05T00:00:00Z\"])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/utc/interval/intervalUnionUtc",
    "fnName": "intervalUnionUtc",
    "examples": [
      {
        "call": "intervalUnionUtc(\"2024-01-01T00:00:00Z\", \"2024-06-30T23:59:59Z\", \"2024-04-01T00:00:00Z\", \"2024-12-31T23:59:59Z\")",
        "result": "{ start: \"2024-01-01T00:00:00Z\", end: \"2024-12-31T23:59:59Z\" }"
      },
      {
        "call": "intervalUnionUtc(\"2024-01-01T00:00:00Z\", \"2024-06-30T23:59:59Z\", \"2024-06-30T23:59:59Z\", \"2024-12-31T23:59:59Z\")",
        "result": "{ start: \"2024-01-01T00:00:00Z\", end: \"2024-12-31T23:59:59Z\" }"
      },
      {
        "call": "intervalUnionUtc(\"2024-01-01T00:00:00Z\", \"2024-06-30T23:59:59Z\", \"2024-07-01T00:00:00Z\", \"2024-12-31T23:59:59Z\")",
        "result": "null"
      },
      {
        "call": "intervalUnionUtc(\"invalid\", \"2024-06-30T23:59:59Z\", \"2024-04-01T00:00:00Z\", \"2024-12-31T23:59:59Z\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/utc/interval/intervalXorAllUtc",
    "fnName": "intervalXorAllUtc",
    "examples": [
      {
        "call": "intervalXorAllUtc([{ start: \"2024-01-01T00:00:00Z\", end: \"2024-01-10T00:00:00Z\" }, { start: \"2024-01-05T00:00:00Z\", end: \"2024-01-15T00:00:00Z\" }])",
        "result": "[{ start: \"2024-01-01T00:00:00Z\", end: \"2024-01-04T23:59:59.999999999Z\" }, { start: \"2024-01-10T00:00:00.000000001Z\", end: \"2024-01-15T00:00:00Z\" }]"
      },
      {
        "call": "intervalXorAllUtc([])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/utc/interval/intervalXorUtc",
    "fnName": "intervalXorUtc",
    "examples": [
      {
        "call": "intervalXorUtc(\"2024-01-01T09:00:00Z\", \"2024-06-30T12:00:00Z\", \"2024-04-01T11:00:00Z\", \"2024-12-31T17:00:00Z\")",
        "result": "[{ start: \"2024-01-01T09:00:00Z\", end: \"2024-03-31T17:00:00Z\" }, { start: \"2024-06-30T12:00:01Z\", end: \"2024-12-31T17:00:00Z\" }]"
      },
      {
        "call": "intervalXorUtc(\"2024-01-01T09:00:00Z\", \"2024-12-31T17:00:00Z\", \"2024-04-01T11:00:00Z\", \"2024-06-30T12:00:00Z\")",
        "result": "[{ start: \"2024-01-01T09:00:00Z\", end: \"2024-03-31T17:00:00Z\" }, { start: \"2024-06-30T12:00:01Z\", end: \"2024-12-31T17:00:00Z\" }]"
      },
      {
        "call": "intervalXorUtc(\"2024-01-01T09:00:00Z\", \"2024-12-31T17:00:00Z\", \"2024-01-01T09:00:00Z\", \"2024-12-31T17:00:00Z\")",
        "result": "[]"
      },
      {
        "call": "intervalXorUtc(\"invalid\", \"2024-06-30T12:00:00Z\", \"2024-07-01T13:00:00Z\", \"2024-12-31T17:00:00Z\")",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/utc/interval/intervalsOverlapUtc",
    "fnName": "intervalsOverlapUtc",
    "examples": [
      {
        "call": "intervalsOverlapUtc(\"2024-01-01T00:00:00Z\", \"2024-06-30T23:59:59Z\", \"2024-04-01T00:00:00Z\", \"2024-12-31T23:59:59Z\")",
        "result": "true"
      },
      {
        "call": "intervalsOverlapUtc(\"2024-01-01T00:00:00Z\", \"2024-06-30T23:59:59Z\", \"2024-07-01T00:00:00Z\", \"2024-12-31T23:59:59Z\")",
        "result": "false (adjacent)"
      },
      {
        "call": "intervalsOverlapUtc(\"2024-01-01T00:00:00Z\", \"2024-06-30T23:59:59Z\", \"2024-07-02T00:00:00Z\", \"2024-12-31T23:59:59Z\")",
        "result": "false (disjoint)"
      },
      {
        "call": "intervalsOverlapUtc(\"invalid\", \"2024-06-30T23:59:59Z\", \"2024-04-01T00:00:00Z\", \"2024-12-31T23:59:59Z\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/utc/interval/mergeIntervalsUtc",
    "fnName": "mergeIntervalsUtc",
    "examples": [
      {
        "call": "mergeIntervalsUtc([{ start: \"2024-01-01T00:00:00Z\", end: \"2024-01-10T00:00:00Z\" }, { start: \"2024-01-05T00:00:00Z\", end: \"2024-01-15T00:00:00Z\" }])",
        "result": "[{ start: \"2024-01-01T00:00:00Z\", end: \"2024-01-15T00:00:00Z\" }]"
      },
      {
        "call": "mergeIntervalsUtc([])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/utc/interval/splitIntervalByUnitUtc",
    "fnName": "splitIntervalByUnitUtc",
    "examples": [
      {
        "call": "splitIntervalByUnitUtc(\"2024-01-01T00:00:00Z\", \"2024-01-02T00:00:00Z\", \"hour\", 6)",
        "result": "[{ start: \"2024-01-01T00:00:00Z\", end: \"2024-01-01T06:00:00Z\" }, { start: \"2024-01-01T06:00:00Z\", end: \"2024-01-01T12:00:00Z\" }, { start: \"2024-01-01T12:00:00Z\", end: \"2024-01-01T18:00:00Z\" }, { start: \"2024-01-01T18:00:00Z\", end: \"2024-01-02T00:00:00Z\" }]"
      },
      {
        "call": "splitIntervalByUnitUtc(\"2024-01-01T00:00:00Z\", \"2024-01-01T01:30:00Z\", \"hour\", 1)",
        "result": "[{ start: \"2024-01-01T00:00:00Z\", end: \"2024-01-01T01:00:00Z\" }, { start: \"2024-01-01T01:00:00Z\", end: \"2024-01-01T01:30:00Z\" }]"
      },
      {
        "call": "splitIntervalByUnitUtc(\"2024-01-01T00:00:00Z\", \"2024-01-01T00:00:00Z\", \"hour\", 1)",
        "result": "[{ start: \"2024-01-01T00:00:00Z\", end: \"2024-01-01T00:00:00Z\" }]"
      },
      {
        "call": "splitIntervalByUnitUtc(\"2024-01-01T00:00:00Z\", \"2024-01-02T00:00:00Z\", \"hour\", 0)",
        "result": "[]"
      },
      {
        "call": "splitIntervalByUnitUtc(\"invalid\", \"2024-01-02T00:00:00Z\", \"hour\", 1)",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/utc/interval/isValidUtcInterval",
    "fnName": "isValidUtcInterval",
    "examples": [
      {
        "call": "isValidUtcInterval(\"2024-01-01T10:00:00Z\", \"2024-12-31T23:59:59Z\")",
        "result": "true"
      },
      {
        "call": "isValidUtcInterval(\"2024-01-01T10:00:00Z\", \"2024-01-01T10:00:00Z\")",
        "result": "true"
      },
      {
        "call": "isValidUtcInterval(\"2024-12-31T23:59:59Z\", \"2024-01-01T10:00:00Z\")",
        "result": "false"
      },
      {
        "call": "isValidUtcInterval(\"invalid\", \"2024-12-31T23:59:59Z\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/utc/parse/parseDateFromUtc",
    "fnName": "parseDateFromUtc",
    "examples": [
      {
        "call": "parseDateFromUtc(\"2024-03-17T14:30:45Z\")",
        "result": "\"2024-03-17\""
      },
      {
        "call": "parseDateFromUtc(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/parse/parseDayFromUtc",
    "fnName": "parseDayFromUtc",
    "examples": [
      {
        "call": "parseDayFromUtc(\"2024-03-17T14:30:45Z\")",
        "result": "\"17\""
      },
      {
        "call": "parseDayFromUtc(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/parse/parseDayOfWeekFromUtc",
    "fnName": "parseDayOfWeekFromUtc",
    "examples": [
      {
        "call": "parseDayOfWeekFromUtc(\"2024-03-17T14:30:45Z\")",
        "result": "7"
      },
      {
        "call": "parseDayOfWeekFromUtc(\"2024-03-18T00:00:00Z\")",
        "result": "1"
      },
      {
        "call": "parseDayOfWeekFromUtc(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/utc/parse/parseHourFromUtc",
    "fnName": "parseHourFromUtc",
    "examples": [
      {
        "call": "parseHourFromUtc(\"2024-03-17T14:30:45Z\")",
        "result": "\"14\""
      },
      {
        "call": "parseHourFromUtc(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/parse/parseHttp",
    "fnName": "parseHttp",
    "examples": [
      {
        "call": "parseHttp(\"Fri, 15 Mar 2024 14:30:00 GMT\")",
        "result": "\"2024-03-15T14:30:00Z\""
      },
      {
        "call": "parseHttp(\"Fri, 15 Mar 2024 14:30:00 -0400\")",
        "result": "\"\" (not IMF-fixdate)"
      },
      {
        "call": "parseHttp(\"not a date\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/parse/parseMicrosecondFromUtc",
    "fnName": "parseMicrosecondFromUtc",
    "examples": [
      {
        "call": "parseMicrosecondFromUtc(\"2024-03-17T14:30:45.123Z\")",
        "result": "\"123\""
      },
      {
        "call": "parseMicrosecondFromUtc(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/parse/parseMillisecondFromUtc",
    "fnName": "parseMillisecondFromUtc",
    "examples": [
      {
        "call": "parseMillisecondFromUtc(\"2024-03-17T14:30:45.123Z\")",
        "result": "\"123\""
      },
      {
        "call": "parseMillisecondFromUtc(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/parse/parseMinuteFromUtc",
    "fnName": "parseMinuteFromUtc",
    "examples": [
      {
        "call": "parseMinuteFromUtc(\"2024-03-17T14:30:45Z\")",
        "result": "\"30\""
      },
      {
        "call": "parseMinuteFromUtc(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/parse/parseMonthFromUtc",
    "fnName": "parseMonthFromUtc",
    "examples": [
      {
        "call": "parseMonthFromUtc(\"2024-03-17T14:30:45Z\")",
        "result": "\"03\""
      },
      {
        "call": "parseMonthFromUtc(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/parse/parseNanosecondFromUtc",
    "fnName": "parseNanosecondFromUtc",
    "examples": [
      {
        "call": "parseNanosecondFromUtc(\"2024-03-17T14:30:45.123Z\")",
        "result": "\"123000000\""
      },
      {
        "call": "parseNanosecondFromUtc(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/parse/parseSecondFromUtc",
    "fnName": "parseSecondFromUtc",
    "examples": [
      {
        "call": "parseSecondFromUtc(\"2024-03-17T14:30:45Z\")",
        "result": "\"45\""
      },
      {
        "call": "parseSecondFromUtc(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/parse/parseTimeFromUtc",
    "fnName": "parseTimeFromUtc",
    "examples": [
      {
        "call": "parseTimeFromUtc(\"2024-03-17T14:30:45Z\")",
        "result": "\"14:30:45\""
      },
      {
        "call": "parseTimeFromUtc(\"2024-03-17T14:30:45Z\", { timeZone: \"America/New_York\" })",
        "result": "\"10:30:45\""
      },
      {
        "call": "parseTimeFromUtc(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/parse/parseUnitFromUtc",
    "fnName": "parseUnitFromUtc",
    "examples": [
      {
        "call": "parseUnitFromUtc(\"2024-03-17T14:30:45Z\", \"month\")",
        "result": "\"03\""
      },
      {
        "call": "parseUnitFromUtc(\"2024-01-01T00:00:00Z\", \"week\")",
        "result": "\"1\""
      },
      {
        "call": "parseUnitFromUtc(\"2024-01-01T00:00:00Z\", \"week\", { weekStartsOn: \"sunday\" })",
        "result": "\"1\""
      },
      {
        "call": "parseUnitFromUtc(\"invalid\", \"month\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/parse/parseWeekFromUtc",
    "fnName": "parseWeekFromUtc",
    "examples": [
      {
        "call": "parseWeekFromUtc(\"2024-03-17T14:30:45Z\")",
        "result": "11"
      },
      {
        "call": "parseWeekFromUtc(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/utc/parse/parseYearFromUtc",
    "fnName": "parseYearFromUtc",
    "examples": [
      {
        "call": "parseYearFromUtc(\"2024-03-17T14:30:45Z\")",
        "result": "\"2024\""
      },
      {
        "call": "parseYearFromUtc(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/utc/validate/isValidUtc",
    "fnName": "isValidUtc",
    "examples": [
      {
        "call": "isValidUtc(\"2024-03-17T14:30:45Z\")",
        "result": "true"
      },
      {
        "call": "isValidUtc(\"2024-01-01Z\")",
        "result": "false — date-only not supported"
      },
      {
        "call": "isValidUtc(\"2024-12-31T23:59:60Z\")",
        "result": "false"
      },
      {
        "call": "isValidUtc(\"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/utc/validate/isValidUtcRange",
    "fnName": "isValidUtcRange",
    "examples": [
      {
        "call": "isValidUtcRange({ value1: \"2024-01-01T10:00:00Z\", value2: \"2024-12-31T23:59:59Z\" })",
        "result": "true"
      },
      {
        "call": "isValidUtcRange({ value1: \"2024-12-31T23:59:59Z\", value2: \"2024-01-01T10:00:00Z\" })",
        "result": "false"
      },
      {
        "call": "isValidUtcRange({ value1: \"2024-01-01T10:00:00Z\", value2: \"2024-01-01T10:00:00Z\", options: { allowEqual: true } })",
        "result": "true"
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/addZoned",
    "fnName": "addZoned",
    "examples": [
      {
        "call": "addZoned(\"2024-02-29T14:30:45.123-05:00[America/New_York]\", { days: 1 })",
        "result": "\"2024-03-01T14:30:45.123-05:00[America/New_York]\""
      },
      {
        "call": "addZoned(\"invalid\", { days: 1 })",
        "result": "\"\""
      },
      {
        "call": "addZoned(\"5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]\", { months: 1 })",
        "result": "\"5784-07-15T14:30:00-04:00[u-ca=hebrew][America/New_York]\" (Adar I -> Adar, EST -> EDT in one call)"
      },
      {
        "call": "addZoned(\"0031-04-30T12:00:00+09:00[u-ca=japanese;era=heisei][Asia/Tokyo]\", { days: 1 })",
        "result": "\"0001-05-01T12:00:00+09:00[u-ca=japanese;era=reiwa][Asia/Tokyo]\" (era re-derived, not copied)"
      },
      {
        "call": "addZoned(\"7517-12-30T00:30:00-04:00[u-ca=ethiopic-amete-alem][America/Santiago]\", { months: 1 }, { overflow: \"reject\" })",
        "result": "\"\" (day 30 does not exist in the 5-day Pagumen)"
      },
      {
        "call": "addZoned(\"2024-03-10T14:30:00-04:00[America/New_York][u-ca=hebrew]\", { days: 1 })",
        "result": "\"\" (Temporal's segment ordering is not GMT's grammar)"
      },
      {
        "call": "addZoned(\"2024-11-02T01:30:00-04:00[America/New_York]\", { days: 1 }, { disambiguation: \"later\" })",
        "result": "\"2024-11-03T01:30:00-05:00[America/New_York]\" (fall-back overlap resolved; default \"compatible\" would return the -04:00 instant instead)"
      },
      {
        "call": "addZoned(\"2024-11-02T01:30:00-04:00[America/New_York]\", { days: 1 }, { disambiguation: \"reject\" })",
        "result": "\"\" (fall-back overlap rejected)"
      },
      {
        "call": "addZoned(\"2024-03-09T02:30:00-05:00[America/New_York]\", { days: 1 }, { disambiguation: \"reject\" })",
        "result": "\"2024-03-10T03:30:00-04:00[America/New_York]\" (spring-forward gap — disambiguation has no effect, arithmetic already advanced past it, so \"reject\" does not throw here)"
      },
      {
        "call": "addZoned(\"2024-01-31T12:00:00-05:00[America/New_York]\", { months: 1 }, { overflow: \"reject\" })",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/addZonedBusinessDays",
    "fnName": "addZonedBusinessDays",
    "examples": [
      {
        "call": "addZonedBusinessDays(\"2024-03-15T14:30:00-04:00[America/New_York]\", 1)",
        "result": "\"2024-03-18T14:30:00-04:00[America/New_York]\""
      },
      {
        "call": "addZonedBusinessDays(\"2024-03-16T14:30:00-04:00[America/New_York]\", 1)",
        "result": "\"2024-03-18T14:30:00-04:00[America/New_York]\""
      },
      {
        "call": "addZonedBusinessDays(\"2024-03-15T14:30:00-04:00[America/New_York]\", 0)",
        "result": "\"2024-03-15T14:30:00-04:00[America/New_York]\""
      },
      {
        "call": "addZonedBusinessDays(\"invalid\", 1)",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/clampZoned",
    "fnName": "clampZoned",
    "examples": [
      {
        "call": "clampZoned(\"2024-03-15T12:00:00+00:00[UTC]\", \"2024-03-01T00:00:00+00:00[UTC]\", \"2024-03-31T23:59:59+00:00[UTC]\")",
        "result": "\"2024-03-15T12:00:00+00:00[UTC]\""
      },
      {
        "call": "clampZoned(\"2024-02-01T12:00:00+00:00[UTC]\", \"2024-03-01T00:00:00+00:00[UTC]\", \"2024-03-31T23:59:59+00:00[UTC]\")",
        "result": "\"2024-03-01T00:00:00+00:00[UTC]\""
      },
      {
        "call": "clampZoned(\"2024-05-01T12:00:00+00:00[UTC]\", \"2024-03-01T00:00:00+00:00[UTC]\", \"2024-03-31T23:59:59+00:00[UTC]\")",
        "result": "\"2024-03-31T23:59:59+00:00[UTC]\""
      },
      {
        "call": "clampZoned(\"2024-03-15T12:00:00+00:00[UTC]\", \"2024-03-31T00:00:00+00:00[UTC]\", \"2024-03-01T00:00:00+00:00[UTC]\")",
        "result": "\"\""
      },
      {
        "call": "clampZoned(\"invalid\", \"2024-03-01T00:00:00+00:00[UTC]\", \"2024-03-31T23:59:59+00:00[UTC]\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/closestZonedTo",
    "fnName": "closestZonedTo",
    "examples": [
      {
        "call": "closestZonedTo(\"2024-03-15T12:00:00+00:00[UTC]\", [\"2024-03-01T00:00:00+00:00[UTC]\", \"2024-03-20T00:00:00+00:00[UTC]\", \"2024-03-18T00:00:00+00:00[UTC]\"])",
        "result": "\"2024-03-18T00:00:00+00:00[UTC]\""
      },
      {
        "call": "closestZonedTo(\"2024-03-15T12:00:00+00:00[UTC]\", [\"2024-03-01T00:00:00+00:00[UTC]\", \"2024-03-29T00:00:00+00:00[UTC]\"])",
        "result": "\"2024-03-29T00:00:00+00:00[UTC]\""
      },
      {
        "call": "closestZonedTo(\"2024-03-15T12:00:00+00:00[UTC]\", [])",
        "result": "null"
      },
      {
        "call": "closestZonedTo(\"invalid\", [\"2024-03-01T00:00:00+00:00[UTC]\"])",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/cycleZoned",
    "fnName": "cycleZoned",
    "examples": [
      {
        "call": "cycleZoned(\"2024-06-15T09:30:00-05:00[America/Chicago]\", \"hour\", 1)",
        "result": "\"2024-06-15T10:30:00-05:00[America/Chicago]\""
      },
      {
        "call": "cycleZoned(\"2024-12-15T09:30:00-06:00[America/Chicago]\", \"month\", 1)",
        "result": "\"2024-01-15T09:30:00-06:00[America/Chicago]\" (wraps, stays in the same year)"
      },
      {
        "call": "cycleZoned(\"2024-03-10T01:30:00-06:00[America/Chicago]\", \"hour\", 1)",
        "result": "\"2024-03-10T03:30:00-05:00[America/Chicago]\" (cycled hour lands in a spring-forward gap; \"compatible\" skips forward)"
      },
      {
        "call": "cycleZoned(\"2024-03-10T01:30:00-06:00[America/Chicago]\", \"hour\", 1, { disambiguation: \"reject\" })",
        "result": "\"\" (same gap; \"reject\" throws)"
      },
      {
        "call": "cycleZoned(\"2024-06-15T09:30:00-05:00[America/Chicago]\", \"week\", 1)",
        "result": "\"\" (\"week\" is not a cyclable field)"
      },
      {
        "call": "cycleZoned(\"invalid\", \"hour\", 1)",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/diffZoned",
    "fnName": "diffZoned",
    "examples": [
      {
        "call": "diffZoned(\"2024-02-28T14:30:00+00:00[UTC]\", \"2024-03-01T15:30:00+00:00[UTC]\", \"days\")",
        "result": "2"
      },
      {
        "call": "diffZoned(\"invalid\", \"2024-03-01T15:30:00+00:00[UTC]\", \"days\")",
        "result": "null"
      },
      {
        "call": "diffZoned(\"5784-01-01T00:00:00-04:00[u-ca=hebrew][America/New_York]\", \"5785-01-01T00:00:00-04:00[u-ca=hebrew][America/New_York]\", \"months\")",
        "result": "13 (Hebrew leap year; the ISO equivalent is 12)"
      },
      {
        "call": "diffZoned(\"5784-01-01T00:00:00-04:00[u-ca=hebrew][America/New_York]\", \"1446-03-30T00:00:00-04:00[u-ca=islamic-tabular][America/New_York]\", \"hours\")",
        "result": "measured in Gregorian/ISO (mismatched tags fall back rather than returning null)"
      },
      {
        "call": "diffZoned(\"2024-03-10T14:30:00-04:00[America/New_York][u-ca=hebrew]\", \"2024-03-11T14:30:00-04:00[America/New_York]\", \"days\")",
        "result": "null (Temporal's segment ordering is not GMT's grammar)"
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/diffZonedAsDuration",
    "fnName": "diffZonedAsDuration",
    "examples": [
      {
        "call": "diffZonedAsDuration(\"2024-03-09T12:00:00-05:00[America/New_York]\", \"2024-03-11T12:00:00-04:00[America/New_York]\", \"days\")",
        "result": "\"P1DT23H\""
      },
      {
        "call": "diffZonedAsDuration(\"2028-01-01T00:00:00+00:00[UTC]\", \"2028-01-01T00:00:00+00:00[UTC]\", \"hours\")",
        "result": "\"PT0S\""
      },
      {
        "call": "diffZonedAsDuration(\"invalid\", \"2028-01-01T00:00:00+00:00[UTC]\", \"days\")",
        "result": "\"\""
      },
      {
        "call": "diffZonedAsDuration(\"5784-01-01T00:00:00-04:00[u-ca=hebrew][America/New_York]\", \"5785-01-01T00:00:00-04:00[u-ca=hebrew][America/New_York]\", \"months\")",
        "result": "\"P13M\" (Hebrew leap year)"
      },
      {
        "call": "diffZonedAsDuration(\"2024-03-10T14:30:00-04:00[America/New_York][u-ca=hebrew]\", \"2024-03-11T14:30:00-04:00[America/New_York]\", \"days\")",
        "result": "\"\" (Temporal's segment ordering is not GMT's grammar)"
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/endOfQuarterForZoned",
    "fnName": "endOfQuarterForZoned",
    "examples": [
      {
        "call": "endOfQuarterForZoned(\"2024-02-15T14:30:00+00:00[UTC]\")",
        "result": "\"2024-03-31T23:59:59+00:00[UTC]\""
      },
      {
        "call": "endOfQuarterForZoned(\"2024-05-10T10:00:00+00:00[UTC]\")",
        "result": "\"2024-06-30T23:59:59+00:00[UTC]\""
      },
      {
        "call": "endOfQuarterForZoned(\"2024-11-20T08:00:00+00:00[UTC]\")",
        "result": "\"2024-12-31T23:59:59+00:00[UTC]\""
      },
      {
        "call": "endOfQuarterForZoned(\"2024-02-15T14:30:00+00:00[UTC]\", { fractionalSecondDigits: 9 })",
        "result": "\"2024-03-31T23:59:59.999999999+00:00[UTC]\""
      },
      {
        "call": "endOfQuarterForZoned(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/endOfZoned",
    "fnName": "endOfZoned",
    "examples": [
      {
        "call": "endOfZoned(\"2024-02-29T12:34:56+00:00[UTC]\", \"month\")",
        "result": "\"2024-02-29T23:59:59.999999999+00:00[UTC]\""
      },
      {
        "call": "endOfZoned(\"invalid\", \"month\")",
        "result": "\"\""
      },
      {
        "call": "endOfZoned(\"2024-11-03T01:15:00-05:00[America/New_York]\", \"hour\", { disambiguation: \"earlier\" })",
        "result": "\"2024-11-03T01:59:59-04:00[America/New_York]\" (source sits in the second, repeated 1am of the fall-back overlap; \"earlier\" resolves end-of-hour to the first (EDT) pass)"
      },
      {
        "call": "endOfZoned(\"2024-11-03T01:15:00-05:00[America/New_York]\", \"hour\", { disambiguation: \"reject\" })",
        "result": "\"\" (same overlap; \"reject\" throws because end-of-hour is ambiguous between the two 1am instants)"
      },
      {
        "call": "endOfZoned(\"2024-11-03T01:15:00-05:00[America/New_York]\", \"hour\", { disambiguation: \"reject\", offset: \"prefer\" })",
        "result": "\"2024-11-03T01:59:59-05:00[America/New_York]\" (setting offset to \"prefer\" makes disambiguation inert here — the source's -05:00 offset is still valid for 1am, so it's kept and \"reject\" never fires)"
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/getHoursInZonedDay",
    "fnName": "getHoursInZonedDay",
    "examples": [
      {
        "call": "getHoursInZonedDay(\"2024-03-10T12:00:00-04:00[America/New_York]\")",
        "result": "23"
      },
      {
        "call": "getHoursInZonedDay(\"2024-11-03T12:00:00-05:00[America/New_York]\")",
        "result": "25"
      },
      {
        "call": "getHoursInZonedDay(\"2024-02-29T12:00:00+00:00[UTC]\")",
        "result": "24"
      },
      {
        "call": "getHoursInZonedDay(\"2024-10-06T12:00:00+11:00[Australia/Lord_Howe]\")",
        "result": "23.5"
      },
      {
        "call": "getHoursInZonedDay(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/getLocaleZonedDayOfWeek",
    "fnName": "getLocaleZonedDayOfWeek",
    "examples": [
      {
        "call": "getLocaleZonedDayOfWeek(\"2024-02-25T12:00:00+00:00[UTC]\", \"en-US\")",
        "result": "0 (Sunday)"
      },
      {
        "call": "getLocaleZonedDayOfWeek(\"2024-02-26T12:00:00+00:00[UTC]\", \"en-US\")",
        "result": "1 (Monday)"
      },
      {
        "call": "getLocaleZonedDayOfWeek(\"2024-02-26T12:00:00+00:00[UTC]\", \"fr-FR\")",
        "result": "0 (Monday)"
      },
      {
        "call": "getLocaleZonedDayOfWeek(\"invalid-zoned\", \"en-US\")",
        "result": "null"
      },
      {
        "call": "getLocaleZonedDayOfWeek(\"2024-02-26T12:00:00+00:00[UTC]\", \"not-a-locale\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/getLocaleZonedEndOfWeek",
    "fnName": "getLocaleZonedEndOfWeek",
    "examples": [
      {
        "call": "getLocaleZonedEndOfWeek(\"2024-02-29T12:00:00+00:00[UTC]\", \"en-US\")",
        "result": "\"2024-03-02T23:59:59+00:00[UTC]\" (Saturday)"
      },
      {
        "call": "getLocaleZonedEndOfWeek(\"2024-02-29T12:00:00+00:00[UTC]\", \"fr-FR\")",
        "result": "\"2024-03-03T23:59:59+00:00[UTC]\" (Sunday)"
      },
      {
        "call": "getLocaleZonedEndOfWeek(\"invalid\", \"en-US\")",
        "result": "\"\""
      },
      {
        "call": "getLocaleZonedEndOfWeek(\"2024-02-29T12:00:00+00:00[UTC]\", \"not-a-locale\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/getLocaleZonedStartOfWeek",
    "fnName": "getLocaleZonedStartOfWeek",
    "examples": [
      {
        "call": "getLocaleZonedStartOfWeek(\"2024-02-29T12:00:00+00:00[UTC]\", \"en-US\")",
        "result": "\"2024-02-25T00:00:00+00:00[UTC]\" (Sunday)"
      },
      {
        "call": "getLocaleZonedStartOfWeek(\"2024-02-29T12:00:00+00:00[UTC]\", \"fr-FR\")",
        "result": "\"2024-02-26T00:00:00+00:00[UTC]\" (Monday)"
      },
      {
        "call": "getLocaleZonedStartOfWeek(\"invalid\", \"en-US\")",
        "result": "\"\""
      },
      {
        "call": "getLocaleZonedStartOfWeek(\"2024-02-29T12:00:00+00:00[UTC]\", \"not-a-locale\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/getQuarterForZoned",
    "fnName": "getQuarterForZoned",
    "examples": [
      {
        "call": "getQuarterForZoned(\"2024-02-15T14:30:00+00:00[UTC]\")",
        "result": "1"
      },
      {
        "call": "getQuarterForZoned(\"2024-05-10T10:00:00+00:00[UTC]\")",
        "result": "2"
      },
      {
        "call": "getQuarterForZoned(\"2024-11-20T08:00:00+00:00[UTC]\")",
        "result": "4"
      },
      {
        "call": "getQuarterForZoned(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/maxZoned",
    "fnName": "maxZoned",
    "examples": [
      {
        "call": "maxZoned([\"2024-03-10T12:00:00[America/New_York]\", \"2024-03-15T12:00:00[America/New_York]\"])",
        "result": "\"2024-03-15T12:00:00-04:00[America/New_York]\""
      },
      {
        "call": "maxZoned([\"invalid\", \"2024-03-15T12:00:00[America/New_York]\"])",
        "result": "\"2024-03-15T12:00:00-04:00[America/New_York]\""
      },
      {
        "call": "maxZoned([\"invalid\", \"also invalid\"])",
        "result": "null"
      },
      {
        "call": "maxZoned([])",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/minZoned",
    "fnName": "minZoned",
    "examples": [
      {
        "call": "minZoned([\"2024-03-10T12:00:00[America/New_York]\", \"2024-03-15T12:00:00[America/New_York]\"])",
        "result": "\"2024-03-10T12:00:00-05:00[America/New_York]\""
      },
      {
        "call": "minZoned([\"invalid\", \"2024-03-15T12:00:00[America/New_York]\"])",
        "result": "\"2024-03-15T12:00:00-04:00[America/New_York]\""
      },
      {
        "call": "minZoned([\"invalid\", \"also invalid\"])",
        "result": "null"
      },
      {
        "call": "minZoned([])",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/roundZoned",
    "fnName": "roundZoned",
    "examples": [
      {
        "call": "roundZoned(\"2024-06-15T12:34:56-05:00[America/New_York]\", { smallestUnit: \"hour\" })",
        "result": "\"2024-06-15T13:00:00-05:00[America/New_York]\""
      },
      {
        "call": "roundZoned(\"2024-06-15T12:34:56-05:00[America/New_York]\", { smallestUnit: \"minute\", roundingIncrement: 15 })",
        "result": "\"2024-06-15T12:45:00-05:00[America/New_York]\""
      },
      {
        "call": "roundZoned(\"invalid\", { smallestUnit: \"hour\" })",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/setZoned",
    "fnName": "setZoned",
    "examples": [
      {
        "call": "setZoned(\"2024-03-10T12:00:00-04:00[America/New_York]\", { hour: 9 })",
        "result": "\"2024-03-10T09:00:00-04:00[America/New_York]\""
      },
      {
        "call": "setZoned(\"2024-01-31T12:00:00-05:00[America/New_York]\", { month: 2 })",
        "result": "\"2024-02-29T12:00:00-05:00[America/New_York]\" (constrain clamps to the last valid day)"
      },
      {
        "call": "setZoned(\"2024-01-31T12:00:00-05:00[America/New_York]\", { month: 2 }, { overflow: \"reject\" })",
        "result": "\"\""
      },
      {
        "call": "setZoned(\"2024-03-10T12:00:00-04:00[America/New_York]\", {})",
        "result": "\"2024-03-10T12:00:00-04:00[America/New_York]\" (empty fields object is a no-op)"
      },
      {
        "call": "setZoned(\"2024-11-03T01:45:00-05:00[America/New_York]\", { minute: 0 }, { disambiguation: \"reject\" })",
        "result": "\"\" (offset defaults to \"ignore\", so disambiguation actually fires and \"reject\" throws on this fall-back overlap)"
      },
      {
        "call": "setZoned(\"2024-11-03T01:45:00-05:00[America/New_York]\", { minute: 0 }, { disambiguation: \"reject\", offset: \"prefer\" })",
        "result": "\"2024-11-03T01:00:00-05:00[America/New_York]\" (offset:\"prefer\" makes disambiguation inert here — the source's -05:00 offset is still valid, so it's kept and \"reject\" never fires)"
      },
      {
        "call": "setZoned(\"invalid\", { hour: 9 })",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/sortZoned",
    "fnName": "sortZoned",
    "examples": [
      {
        "call": "sortZoned([\"2024-03-10T12:00:00[America/New_York]\", \"2024-01-01T08:00:00[America/New_York]\", \"2024-02-15T15:30:00[America/New_York]\"])",
        "result": "[\"2024-01-01T08:00:00-05:00[America/New_York]\", \"2024-02-15T15:30:00-05:00[America/New_York]\", \"2024-03-10T12:00:00-04:00[America/New_York]\"]"
      },
      {
        "call": "sortZoned([\"2024-03-10T12:00:00[America/New_York]\", \"2024-01-01T08:00:00[America/New_York]\", \"2024-02-15T15:30:00[America/New_York]\"], \"desc\")",
        "result": "[\"2024-03-10T12:00:00-04:00[America/New_York]\", \"2024-02-15T15:30:00-05:00[America/New_York]\", \"2024-01-01T08:00:00-05:00[America/New_York]\"]"
      },
      {
        "call": "sortZoned([\"invalid\", \"2024-01-01T08:00:00[America/New_York]\", \"2024-02-15T15:30:00[America/New_York]\"])",
        "result": "[\"2024-01-01T08:00:00-05:00[America/New_York]\", \"2024-02-15T15:30:00-05:00[America/New_York]\"]"
      },
      {
        "call": "sortZoned([])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/startOfQuarterForZoned",
    "fnName": "startOfQuarterForZoned",
    "examples": [
      {
        "call": "startOfQuarterForZoned(\"2024-02-15T14:30:00+00:00[UTC]\")",
        "result": "\"2024-01-01T00:00:00+00:00[UTC]\""
      },
      {
        "call": "startOfQuarterForZoned(\"2024-05-10T10:00:00+00:00[UTC]\")",
        "result": "\"2024-04-01T00:00:00+00:00[UTC]\""
      },
      {
        "call": "startOfQuarterForZoned(\"2024-11-20T08:00:00+00:00[UTC]\")",
        "result": "\"2024-10-01T00:00:00+00:00[UTC]\""
      },
      {
        "call": "startOfQuarterForZoned(\"2024-02-15T14:30:00+00:00[UTC]\", { fractionalSecondDigits: 3 })",
        "result": "\"2024-01-01T00:00:00.000+00:00[UTC]\""
      },
      {
        "call": "startOfQuarterForZoned(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/startOfZoned",
    "fnName": "startOfZoned",
    "examples": [
      {
        "call": "startOfZoned(\"2024-02-29T12:34:56+00:00[UTC]\", \"month\")",
        "result": "\"2024-02-01T00:00:00+00:00[UTC]\""
      },
      {
        "call": "startOfZoned(\"invalid\", \"month\")",
        "result": "\"\""
      },
      {
        "call": "startOfZoned(\"2024-11-03T01:45:00-05:00[America/New_York]\", \"hour\", { disambiguation: \"earlier\" })",
        "result": "\"2024-11-03T01:00:00-04:00[America/New_York]\" (source sits in the second, repeated 1am of the fall-back overlap; \"earlier\" resolves start-of-hour to the first (EDT) pass)"
      },
      {
        "call": "startOfZoned(\"2024-11-03T01:45:00-05:00[America/New_York]\", \"hour\", { disambiguation: \"reject\" })",
        "result": "\"\" (same overlap; \"reject\" throws because start-of-hour is ambiguous between the two 1am instants)"
      },
      {
        "call": "startOfZoned(\"2024-11-03T01:45:00-05:00[America/New_York]\", \"hour\", { disambiguation: \"reject\", offset: \"prefer\" })",
        "result": "\"2024-11-03T01:00:00-05:00[America/New_York]\" (setting offset to \"prefer\" makes disambiguation inert here — the source's -05:00 offset is still valid for 1am, so it's kept and \"reject\" never fires)"
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/subtractZoned",
    "fnName": "subtractZoned",
    "examples": [
      {
        "call": "subtractZoned(\"2024-03-10T12:00:00-04:00[America/New_York]\", { days: 5 })",
        "result": "\"2024-03-05T12:00:00-05:00[America/New_York]\""
      },
      {
        "call": "subtractZoned(\"invalid\", { days: 5 })",
        "result": "\"\""
      },
      {
        "call": "subtractZoned(\"2024-11-04T01:30:00-05:00[America/New_York]\", { days: 1 }, { disambiguation: \"later\" })",
        "result": "\"2024-11-03T01:30:00-05:00[America/New_York]\" (fall-back overlap resolved; default \"compatible\" would return the -04:00 instant instead)"
      },
      {
        "call": "subtractZoned(\"2024-11-04T01:30:00-05:00[America/New_York]\", { days: 1 }, { disambiguation: \"reject\" })",
        "result": "\"\" (fall-back overlap rejected)"
      },
      {
        "call": "subtractZoned(\"2024-03-11T03:30:00-04:00[America/New_York]\", { days: 1 }, { disambiguation: \"reject\" })",
        "result": "\"2024-03-10T03:30:00-04:00[America/New_York]\" (spring-forward gap — disambiguation has no effect, arithmetic already advanced past it, so \"reject\" does not throw here)"
      },
      {
        "call": "subtractZoned(\"2024-03-31T12:00:00-04:00[America/New_York]\", { months: 1 }, { overflow: \"reject\" })",
        "result": "\"\""
      },
      {
        "call": "subtractZoned(\"5784-07-15T14:30:00-04:00[u-ca=hebrew][America/New_York]\", { months: 1 })",
        "result": "\"5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]\" (Adar -> Adar I, EDT -> EST in one call)"
      },
      {
        "call": "subtractZoned(\"0001-05-01T12:00:00+09:00[u-ca=japanese;era=reiwa][Asia/Tokyo]\", { days: 1 })",
        "result": "\"0031-04-30T12:00:00+09:00[u-ca=japanese;era=heisei][Asia/Tokyo]\" (era re-derived, not copied)"
      },
      {
        "call": "subtractZoned(\"2024-03-10T14:30:00-04:00[America/New_York][u-ca=hebrew]\", { days: 1 })",
        "result": "\"\" (Temporal's segment ordering is not GMT's grammar)"
      }
    ]
  },
  {
    "route": "/reference/zoned/calculate/subtractZonedBusinessDays",
    "fnName": "subtractZonedBusinessDays",
    "examples": [
      {
        "call": "subtractZonedBusinessDays(\"2024-03-18T14:30:00-04:00[America/New_York]\", 1)",
        "result": "\"2024-03-15T14:30:00-04:00[America/New_York]\""
      },
      {
        "call": "subtractZonedBusinessDays(\"2024-03-18T14:30:00-04:00[America/New_York]\", 2)",
        "result": "\"2024-03-14T14:30:00-04:00[America/New_York]\""
      },
      {
        "call": "subtractZonedBusinessDays(\"2024-03-18T14:30:00-04:00[America/New_York]\", 0)",
        "result": "\"2024-03-18T14:30:00-04:00[America/New_York]\""
      },
      {
        "call": "subtractZonedBusinessDays(\"invalid\", 1)",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/chop/chopZonedDate",
    "fnName": "chopZonedDate",
    "examples": [
      {
        "call": "chopZonedDate(\"2024-02-29T14:30:45.123-05:00[America/New_York]\")",
        "result": "\"14:30:45.123\""
      },
      {
        "call": "chopZonedDate(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/chop/chopZonedDateTime",
    "fnName": "chopZonedDateTime",
    "examples": [
      {
        "call": "chopZonedDateTime(\"2024-02-29T12:30:45+01:00[Europe/Paris]\")",
        "result": "\"Europe/Paris\""
      },
      {
        "call": "chopZonedDateTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/chop/chopZonedMilliseconds",
    "fnName": "chopZonedMilliseconds",
    "examples": [
      {
        "call": "chopZonedMilliseconds(\"2024-02-29T14:30:45.123-05:00[America/New_York]\")",
        "result": "\"2024-02-29T14:30:45-05:00[America/New_York]\""
      },
      {
        "call": "chopZonedMilliseconds(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/chop/chopZonedSeconds",
    "fnName": "chopZonedSeconds",
    "examples": [
      {
        "call": "chopZonedSeconds(\"2024-02-29T14:30:45.123-05:00[America/New_York]\")",
        "result": "\"2024-02-29T14:30-05:00[America/New_York]\""
      },
      {
        "call": "chopZonedSeconds(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/chop/chopZonedTime",
    "fnName": "chopZonedTime",
    "examples": [
      {
        "call": "chopZonedTime(\"2024-02-29T14:30:45.123-05:00[America/New_York]\")",
        "result": "\"2024-02-29\""
      },
      {
        "call": "chopZonedTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/chop/chopZonedTimezone",
    "fnName": "chopZonedTimezone",
    "examples": [
      {
        "call": "chopZonedTimezone(\"2024-02-29T14:30:45.123-05:00[America/New_York]\")",
        "result": "\"2024-02-29T14:30:45.123\""
      },
      {
        "call": "chopZonedTimezone(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/compare/areZonedEqual",
    "fnName": "areZonedEqual",
    "examples": [
      {
        "call": "areZonedEqual(\"2024-02-29T12:34:56.789+00:00[UTC]\", \"2024-02-29T12:34:56.789+00:00[UTC]\")",
        "result": "true"
      },
      {
        "call": "areZonedEqual(\"invalid\", \"2024-02-29T12:34:56.789+00:00[UTC]\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/compare/areZonedEqualBy",
    "fnName": "areZonedEqualBy",
    "examples": [
      {
        "call": "areZonedEqualBy(\"2024-03-15T10:00:00-04:00[America/New_York]\", \"2024-03-15T20:00:00+01:00[Europe/Berlin]\", \"day\")",
        "result": "true (both are local March 15 in their own zone)"
      },
      {
        "call": "areZonedEqualBy(\"2024-03-15T23:30:00-04:00[America/New_York]\", \"2024-03-16T04:30:00+00:00[UTC]\", \"day\")",
        "result": "false (same instant, different local calendar day per zone)"
      },
      {
        "call": "areZonedEqualBy(\"invalid\", \"2024-03-15T10:00:00-04:00[America/New_York]\", \"day\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/compare/isAfterZoned",
    "fnName": "isAfterZoned",
    "examples": [
      {
        "call": "isAfterZoned(\"2024-02-29T12:34:56.789+00:00[UTC]\", \"2024-02-29T12:34:56.788+00:00[UTC]\")",
        "result": "true"
      },
      {
        "call": "isAfterZoned(\"invalid\", \"2024-02-29T12:34:56.789+00:00[UTC]\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/compare/isBeforeZoned",
    "fnName": "isBeforeZoned",
    "examples": [
      {
        "call": "isBeforeZoned(\"2024-03-17T14:30:45-05:00[America/New_York]\", \"2024-03-17T15:30:45-05:00[America/New_York]\")",
        "result": "true"
      },
      {
        "call": "isBeforeZoned(\"invalid\", \"2024-03-17T14:30:45-05:00[America/New_York]\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/compare/isBetweenZoned",
    "fnName": "isBetweenZoned",
    "examples": [
      {
        "call": "isBetweenZoned(\"2024-02-29T12:00:00+00:00[UTC]\", \"2024-02-29T11:00:00+00:00[UTC]\", \"2024-02-29T13:00:00+00:00[UTC]\")",
        "result": "true"
      },
      {
        "call": "isBetweenZoned(\"invalid\", \"2024-02-29T11:00:00+00:00[UTC]\", \"2024-02-29T13:00:00+00:00[UTC]\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/compare/isInDaylightSaving",
    "fnName": "isInDaylightSaving",
    "examples": [
      {
        "call": "isInDaylightSaving(\"2024-07-15T12:00:00-04:00[America/New_York]\")",
        "result": "true"
      },
      {
        "call": "isInDaylightSaving(\"2024-01-15T12:00:00-05:00[America/New_York]\")",
        "result": "false"
      },
      {
        "call": "isInDaylightSaving(\"2024-01-15T12:00:00+11:00[Australia/Sydney]\")",
        "result": "true (southern-hemisphere summer)"
      },
      {
        "call": "isInDaylightSaving(\"2024-07-15T12:00:00+09:00[Asia/Tokyo]\")",
        "result": "false (Asia/Tokyo has no DST)"
      },
      {
        "call": "isInDaylightSaving(\"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/compare/isZonedBusinessDay",
    "fnName": "isZonedBusinessDay",
    "examples": [
      {
        "call": "isZonedBusinessDay(\"2024-02-05T10:00:00-05:00[America/New_York]\")",
        "result": "true (Monday)"
      },
      {
        "call": "isZonedBusinessDay(\"2024-02-10T10:00:00-05:00[America/New_York]\")",
        "result": "false (Saturday)"
      },
      {
        "call": "isZonedBusinessDay(\"2024-02-04T10:00:00-05:00[America/New_York]\")",
        "result": "false (Sunday)"
      },
      {
        "call": "isZonedBusinessDay(\"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/compare/isZonedFuture",
    "fnName": "isZonedFuture",
    "examples": [
      {
        "call": "isZonedFuture(\"2999-01-01T00:00:00Z[UTC]\")",
        "result": "true (an instant in the distant future)"
      },
      {
        "call": "isZonedFuture(\"2020-01-01T00:00:00Z[UTC]\")",
        "result": "false (an instant in the distant past)"
      },
      {
        "call": "isZonedFuture(\"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/compare/isZonedPast",
    "fnName": "isZonedPast",
    "examples": [
      {
        "call": "isZonedPast(\"2020-01-01T00:00:00Z[UTC]\")",
        "result": "true (an instant in the distant past)"
      },
      {
        "call": "isZonedPast(\"2999-01-01T00:00:00Z[UTC]\")",
        "result": "false (an instant in the distant future)"
      },
      {
        "call": "isZonedPast(\"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/compare/isZonedRelativeDay",
    "fnName": "isZonedRelativeDay",
    "examples": [
      {
        "call": "isZonedRelativeDay(\"2024-03-15T10:00:00-04:00[America/New_York]\", 0)",
        "result": "true, if today is 2024-03-15 in America/New_York"
      },
      {
        "call": "isZonedRelativeDay(\"2024-03-14T10:00:00-04:00[America/New_York]\", -1)",
        "result": "true, if today is 2024-03-15 in America/New_York"
      },
      {
        "call": "isZonedRelativeDay(\"2024-03-15T10:00:00+13:00[Pacific/Apia]\", 0)",
        "result": "true, when the same instant is \"yesterday\" in Pacific/Niue"
      },
      {
        "call": "isZonedRelativeDay(\"invalid\", 0)",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/compare/isZonedThisUnit",
    "fnName": "isZonedThisUnit",
    "examples": [
      {
        "call": "isZonedThisUnit(\"2024-03-15T10:00:00-04:00[America/New_York]\", \"month\")",
        "result": "true, if today is any day in March 2024 in America/New_York"
      },
      {
        "call": "isZonedThisUnit(\"2024-02-26T10:00:00+01:00[Europe/Paris]\", \"week\", \"fr-FR\")",
        "result": "true, if today is 2024-03-01 in Europe/Paris (same fr-FR Monday-start week)"
      },
      {
        "call": "isZonedThisUnit(\"2024-03-15T10:00:00-04:00[America/New_York]\", \"hour\" as never)",
        "result": "false (unsupported unit)"
      },
      {
        "call": "isZonedThisUnit(\"invalid\", \"month\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/compare/isZonedWeekend",
    "fnName": "isZonedWeekend",
    "examples": [
      {
        "call": "isZonedWeekend(\"2024-02-03T10:00:00-05:00[America/New_York]\", \"en-US\")",
        "result": "true (Saturday)"
      },
      {
        "call": "isZonedWeekend(\"2024-02-02T10:00:00+02:00[Asia/Jerusalem]\", \"he-IL\")",
        "result": "true (Friday, he-IL weekend is Fri/Sat)"
      },
      {
        "call": "isZonedWeekend(\"2024-02-04T10:00:00+02:00[Asia/Jerusalem]\", \"he-IL\")",
        "result": "false (Sunday)"
      },
      {
        "call": "isZonedWeekend(\"invalid\", \"en-US\")",
        "result": "false"
      },
      {
        "call": "isZonedWeekend(\"2024-02-03T10:00:00-05:00[America/New_York]\", \"not-a-locale\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/convert/convertPlainDateTimeToZoned",
    "fnName": "convertPlainDateTimeToZoned",
    "examples": [
      {
        "call": "convertPlainDateTimeToZoned(\"2024-02-29T14:30:45\", \"America/New_York\")",
        "result": "\"2024-02-29T14:30:45.123-05:00[America/New_York]\""
      },
      {
        "call": "convertPlainDateTimeToZoned(\"invalid\", \"America/New_York\")",
        "result": "\"\""
      },
      {
        "call": "convertPlainDateTimeToZoned(\"2024-03-10T02:30:00\", \"America/New_York\", { disambiguation: \"earlier\" })",
        "result": "\"2024-03-10T01:30:00.000-05:00[America/New_York]\" (spring-forward gap)"
      },
      {
        "call": "convertPlainDateTimeToZoned(\"2024-11-03T01:30:00\", \"America/New_York\", { disambiguation: \"later\" })",
        "result": "\"2024-11-03T01:30:00.000-05:00[America/New_York]\" (fall-back overlap)"
      },
      {
        "call": "convertPlainDateTimeToZoned(\"2024-03-10T02:30:00\", \"America/New_York\", { disambiguation: \"reject\" })",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/convert/convertZonedToCalendar",
    "fnName": "convertZonedToCalendar",
    "examples": [
      {
        "call": "convertZonedToCalendar(\"2024-10-03T14:30:45-04:00[America/New_York]\", \"hebrew\")",
        "result": "\"5785-01-01T14:30:45-04:00[u-ca=hebrew][America/New_York]\""
      },
      {
        "call": "convertZonedToCalendar(\"5785-01-01T14:30:45-04:00[u-ca=hebrew][America/New_York]\", \"gregorian\")",
        "result": "\"2024-10-03T14:30:45-04:00[America/New_York]\""
      },
      {
        "call": "convertZonedToCalendar(\"2024-10-03T14:30:45-04:00[America/New_York]\", \"gregorian\")",
        "result": "\"2024-10-03T14:30:45-04:00[America/New_York]\""
      },
      {
        "call": "convertZonedToCalendar(\"2024-10-03T14:30:45-04:00[America/New_York]\", \"islamic-civil\")",
        "result": "\"1446-03-29T14:30:45-04:00[u-ca=islamic-civil][America/New_York]\""
      },
      {
        "call": "convertZonedToCalendar(\"2024-10-03T14:30:45-04:00[America/New_York]\", \"islamic-tabular\")",
        "result": "\"1446-03-30T14:30:45-04:00[u-ca=islamic-tabular][America/New_York]\""
      },
      {
        "call": "convertZonedToCalendar(\"2024-10-03T14:30:45-04:00[America/New_York]\", \"islamic-umalqura\")",
        "result": "\"1446-03-30T14:30:45-04:00[u-ca=islamic-umalqura][America/New_York]\""
      },
      {
        "call": "convertZonedToCalendar(\"2024-10-03T14:30:45-04:00[America/New_York]\", \"japanese\")",
        "result": "\"0006-10-03T14:30:45-04:00[u-ca=japanese;era=reiwa][America/New_York]\""
      },
      {
        "call": "convertZonedToCalendar(\"2024-10-03T14:30:45-04:00[America/New_York]\", \"buddhist\")",
        "result": "\"2567-10-03T14:30:45-04:00[u-ca=buddhist][America/New_York]\""
      },
      {
        "call": "convertZonedToCalendar(\"2024-10-03T14:30:45-04:00[America/New_York]\", \"taiwan\")",
        "result": "\"0113-10-03T14:30:45-04:00[u-ca=taiwan][America/New_York]\""
      },
      {
        "call": "convertZonedToCalendar(\"2024-10-03T14:30:45-04:00[America/New_York]\", \"persian\")",
        "result": "\"1403-07-12T14:30:45-04:00[u-ca=persian][America/New_York]\""
      },
      {
        "call": "convertZonedToCalendar(\"2024-10-03T14:30:45-04:00[America/New_York]\", \"indian\")",
        "result": "\"1946-07-11T14:30:45-04:00[u-ca=indian][America/New_York]\""
      },
      {
        "call": "convertZonedToCalendar(\"2024-10-03T14:30:45-04:00[America/New_York]\", \"ethiopic\")",
        "result": "\"2017-01-23T14:30:45-04:00[u-ca=ethiopic;era=ethiopic][America/New_York]\""
      },
      {
        "call": "convertZonedToCalendar(\"2024-10-03T14:30:45-04:00[America/New_York]\", \"ethiopic-amete-alem\")",
        "result": "\"7517-01-23T14:30:45-04:00[u-ca=ethiopic-amete-alem][America/New_York]\""
      },
      {
        "call": "convertZonedToCalendar(\"2024-10-03T14:30:45-04:00[America/New_York]\", \"coptic\")",
        "result": "\"1741-01-23T14:30:45-04:00[u-ca=coptic][America/New_York]\""
      },
      {
        "call": "convertZonedToCalendar(\"2024-10-03T14:30:45-04:00[America/New_York][u-ca=hebrew]\", \"gregorian\")",
        "result": "\"\" (Temporal's segment ordering is not GMT's grammar)"
      },
      {
        "call": "convertZonedToCalendar(\"invalid\", \"hebrew\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/convert/convertZonedToPlainDateTime",
    "fnName": "convertZonedToPlainDateTime",
    "examples": [
      {
        "call": "convertZonedToPlainDateTime(\"2024-02-29T14:30:45.123-05:00[America/New_York]\")",
        "result": "\"2024-02-29T14:30:45.123\""
      },
      {
        "call": "convertZonedToPlainDateTime(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/convert/convertZonedToUnix",
    "fnName": "convertZonedToUnix",
    "examples": [
      {
        "call": "convertZonedToUnix(\"2024-02-29T12:34:56.789+00:00[UTC]\")",
        "result": "1709200496789"
      },
      {
        "call": "convertZonedToUnix(\"2024-02-29T12:34:56.789+00:00[UTC]\", \"seconds\")",
        "result": "1709200496"
      },
      {
        "call": "convertZonedToUnix(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/zoned/convert/convertZonedToUtc",
    "fnName": "convertZonedToUtc",
    "examples": [
      {
        "call": "convertZonedToUtc(\"2024-02-29T12:34:56.789+00:00[UTC]\")",
        "result": "\"2024-02-29T12:34:56.789Z\""
      },
      {
        "call": "convertZonedToUtc(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/convert/convertZonedToZoned",
    "fnName": "convertZonedToZoned",
    "examples": [
      {
        "call": "convertZonedToZoned(\"2024-02-29T12:34:56.789+00:00[UTC]\", \"America/New_York\")",
        "result": "\"2024-02-29T07:34:56.789-05:00[America/New_York]\""
      },
      {
        "call": "convertZonedToZoned(\"invalid\", \"America/New_York\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/format/formatCalendarZoned",
    "fnName": "formatCalendarZoned",
    "examples": [
      {
        "call": "formatCalendarZoned(\"2026-03-16T14:30:00-04:00[America/New_York]\", \"en-US\", { reference: \"2026-03-15T09:00:00-04:00[America/New_York]\" })",
        "result": "\"tomorrow at 2:30 PM\""
      },
      {
        "call": "formatCalendarZoned(value, \"de-DE\")",
        "result": "\"morgen um 14:30\""
      },
      {
        "call": "formatCalendarZoned(\"not-a-date\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/format/formatRelativeZoned",
    "fnName": "formatRelativeZoned",
    "examples": [
      {
        "call": "formatRelativeZoned(\"2026-03-08T01:00:00-05:00[America/New_York]\", \"en-US\")",
        "result": "\"tomorrow\""
      },
      {
        "call": "formatRelativeZoned(value, \"en-US\", { roundingMethod: \"floor\" })",
        "result": "rounds toward the earlier boundary"
      },
      {
        "call": "formatRelativeZoned(\"not-a-date\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/format/formatRfc2822",
    "fnName": "formatRfc2822",
    "examples": [
      {
        "call": "formatRfc2822(\"2024-03-15T14:30:00-04:00[America/New_York]\")",
        "result": "\"Fri, 15 Mar 2024 14:30:00 -0400\""
      },
      {
        "call": "formatRfc2822(\"2024-01-05T09:00:00+00:00[UTC]\")",
        "result": "\"Fri, 05 Jan 2024 09:00:00 +0000\""
      },
      {
        "call": "formatRfc2822(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/format/formatRfc3339",
    "fnName": "formatRfc3339",
    "examples": [
      {
        "call": "formatRfc3339(\"2024-03-15T14:30:00-04:00[America/New_York]\")",
        "result": "\"2024-03-15T14:30:00-04:00\""
      },
      {
        "call": "formatRfc3339(\"2024-03-15T14:30:00Z[UTC]\")",
        "result": "\"2024-03-15T14:30:00+00:00\""
      },
      {
        "call": "formatRfc3339(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/format/formatTimeZoneName",
    "fnName": "formatTimeZoneName",
    "examples": [
      {
        "call": "formatTimeZoneName(\"America/New_York\", \"en-US\", { style: \"shortGeneric\" })",
        "result": "\"ET\""
      },
      {
        "call": "formatTimeZoneName(\"America/New_York\", \"en-US\", { style: \"longGeneric\" })",
        "result": "\"Eastern Time\""
      },
      {
        "call": "formatTimeZoneName(\"America/New_York\", \"en-US\", { style: \"shortOffset\" })",
        "result": "\"GMT-4\" or \"GMT-5\", depending on the current date"
      },
      {
        "call": "formatTimeZoneName(\"Asia/Tokyo\", \"ja-JP\", { style: \"longGeneric\" })",
        "result": "\"日本標準時\""
      },
      {
        "call": "formatTimeZoneName(\"Invalid/Zone\", \"en-US\")",
        "result": "\"\""
      },
      {
        "call": "formatTimeZoneName(\"America/New_York\", \"!!!\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/format/formatZonedDateTime",
    "fnName": "formatZonedDateTime",
    "examples": [
      {
        "call": "formatZonedDateTime(\"2024-02-29T12:34:56.789+00:00[UTC]\", \"en-US\", { dateStyle: \"long\", timeStyle: \"long\" })",
        "result": "\"February 29, 2024 at 12:34:56 PM Coordinated Universal Time\""
      },
      {
        "call": "formatZonedDateTime(\"2024-02-29T12:34:56.789+00:00[UTC]\", \"en-GB\", { dateStyle: \"short\", timeStyle: \"short\" })",
        "result": "\"29/02/2024, 12:34\""
      },
      {
        "call": "formatZonedDateTime(\"invalid\", \"en-US\")",
        "result": "\"\" (invalid input)"
      }
    ]
  },
  {
    "route": "/reference/zoned/format/formatZonedRange",
    "fnName": "formatZonedRange",
    "examples": [
      {
        "call": "formatZonedRange(\"2024-02-29T12:00:00.000+00:00[UTC]\", \"2024-02-29T14:00:00.000+00:00[UTC]\", \"en-US\", { dateStyle: \"long\", timeStyle: \"short\" })",
        "result": "\"February 29, 2024 at 12:00 PM – 2:00 PM Coordinated Universal Time\""
      },
      {
        "call": "formatZonedRange(\"2024-02-29T12:00:00.000+00:00[UTC]\", \"2024-02-29T14:00:00.000+00:00[UTC]\", \"en-GB\", { dateStyle: \"short\", timeStyle: \"short\" })",
        "result": "\"29/02/2024, 12:00 – 14:00\""
      },
      {
        "call": "formatZonedRange(\"invalid\", \"2024-02-29T14:00:00.000+00:00[UTC]\", \"en-US\")",
        "result": "\"\" (invalid input)"
      }
    ]
  },
  {
    "route": "/reference/zoned/format/formatZonedToParts",
    "fnName": "formatZonedToParts",
    "examples": [
      {
        "call": "formatZonedToParts(\"2024-03-15T14:30:00.000-04:00[America/New_York]\", \"en-US\")",
        "result": "[{ type: \"month\", value: \"3\" }, { type: \"literal\", value: \"/\" }, { type: \"day\", value: \"15\" }, { type: \"literal\", value: \"/\" }, { type: \"year\", value: \"2024\" }, { type: \"literal\", value: \",\" }, { type: \"literal\", value: \" \" }, { type: \"hour\", value: \"2\" }, { type: \"literal\", value: \":\" }, { type: \"minute\", value: \"30\" }, { type: \"literal\", value: \" \" }, { type: \"dayPeriod\", value: \"PM\" }]"
      },
      {
        "call": "formatZonedToParts(\"2024-03-15T14:30:00.000-04:00[America/New_York]\", \"en-US\", { timeZoneName: \"longOffset\" })",
        "result": "includes { type: \"timeZoneName\", value: \"GMT-4\" }"
      },
      {
        "call": "formatZonedToParts(\"invalid\", \"en-US\")",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/zoned/get/getDstTransitions",
    "fnName": "getDstTransitions",
    "examples": [
      {
        "call": "getDstTransitions(\"America/New_York\", 2024)",
        "result": "// [\n//   { instant: \"2024-03-10T07:00:00Z\", offsetBefore: \"-05:00\", offsetAfter: \"-04:00\" },\n//   { instant: \"2024-11-03T06:00:00Z\", offsetBefore: \"-04:00\", offsetAfter: \"-05:00\" },\n// ]"
      },
      {
        "call": "getDstTransitions(\"Asia/Tokyo\", 2024)",
        "result": "[]"
      },
      {
        "call": "getDstTransitions(\"Invalid/Zone\", 2024)",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/zoned/get/getSystemTimeZone",
    "fnName": "getSystemTimeZone",
    "examples": [
      {
        "call": "getSystemTimeZone()",
        "result": "\"America/New_York\""
      }
    ]
  },
  {
    "route": "/reference/zoned/get/getTimeZoneOffset",
    "fnName": "getTimeZoneOffset",
    "examples": [
      {
        "call": "getTimeZoneOffset(\"America/New_York\", \"2024-07-15T12:00:00Z\")",
        "result": "\"-04:00\""
      },
      {
        "call": "getTimeZoneOffset(\"America/New_York\", \"2024-01-15T12:00:00Z\")",
        "result": "\"-05:00\""
      },
      {
        "call": "getTimeZoneOffset(\"Asia/Kathmandu\", \"2024-01-15T12:00:00Z\")",
        "result": "\"+05:45\""
      },
      {
        "call": "getTimeZoneOffset(\"Invalid/Zone\", \"2024-07-15T12:00:00Z\")",
        "result": "\"\""
      },
      {
        "call": "getTimeZoneOffset(\"America/New_York\", \"not an instant\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/get/getTimeZones",
    "fnName": "getTimeZones",
    "examples": [
      {
        "call": "getTimeZones()",
        "result": "[\"America/New_York\", \"Europe/London\", ...]"
      },
      {
        "call": "getTimeZones().length",
        "result": "~422 (varies by runtime/ICU)"
      }
    ]
  },
  {
    "route": "/reference/zoned/get/getZonedDay",
    "fnName": "getZonedDay",
    "examples": [
      {
        "call": "getZonedDay(\"America/New_York\")",
        "result": "\"28\""
      },
      {
        "call": "getZonedDay(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/get/getZonedDayOfWeek",
    "fnName": "getZonedDayOfWeek",
    "examples": [
      {
        "call": "getZonedDayOfWeek(\"America/New_York\")",
        "result": "3"
      },
      {
        "call": "getZonedDayOfWeek(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/zoned/get/getZonedHour",
    "fnName": "getZonedHour",
    "examples": [
      {
        "call": "getZonedHour(\"America/New_York\")",
        "result": "\"19\""
      },
      {
        "call": "getZonedHour(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/get/getZonedMicrosecond",
    "fnName": "getZonedMicrosecond",
    "examples": [
      {
        "call": "getZonedMicrosecond(\"America/New_York\")",
        "result": "\"000\""
      },
      {
        "call": "getZonedMicrosecond(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/get/getZonedMillisecond",
    "fnName": "getZonedMillisecond",
    "examples": [
      {
        "call": "getZonedMillisecond(\"America/New_York\")",
        "result": "\"000\""
      },
      {
        "call": "getZonedMillisecond(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/get/getZonedMinute",
    "fnName": "getZonedMinute",
    "examples": [
      {
        "call": "getZonedMinute(\"America/New_York\")",
        "result": "\"00\""
      },
      {
        "call": "getZonedMinute(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/get/getZonedMonth",
    "fnName": "getZonedMonth",
    "examples": [
      {
        "call": "getZonedMonth(\"America/New_York\")",
        "result": "\"02\""
      },
      {
        "call": "getZonedMonth(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/get/getZonedNanosecond",
    "fnName": "getZonedNanosecond",
    "examples": [
      {
        "call": "getZonedNanosecond(\"America/New_York\")",
        "result": "\"000\""
      },
      {
        "call": "getZonedNanosecond(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/get/getZonedNow",
    "fnName": "getZonedNow",
    "examples": [
      {
        "call": "getZonedNow(\"America/New_York\")",
        "result": "\"2024-02-29T09:30:45.123-05:00[America/New_York]\""
      },
      {
        "call": "getZonedNow(\"Invalid/Zone\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/get/isValidZonedNowUnit",
    "fnName": "isValidZonedNowUnit",
    "examples": []
  },
  {
    "route": "/reference/zoned/get/getZonedNowUnit",
    "fnName": "getZonedNowUnit",
    "examples": [
      {
        "call": "getZonedNowUnit(\"America/New_York\", \"hour\")",
        "result": "\"07\""
      },
      {
        "call": "getZonedNowUnit(\"invalid\", \"hour\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/get/getZonedSecond",
    "fnName": "getZonedSecond",
    "examples": [
      {
        "call": "getZonedSecond(\"America/New_York\")",
        "result": "\"00\""
      },
      {
        "call": "getZonedSecond(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/get/getZonedToday",
    "fnName": "getZonedToday",
    "examples": [
      {
        "call": "getZonedToday(\"America/New_York\")",
        "result": "\"2024-02-29\""
      },
      {
        "call": "getZonedToday(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/get/getZonedWeekOfYear",
    "fnName": "getZonedWeekOfYear",
    "examples": [
      {
        "call": "getZonedWeekOfYear(\"America/New_York\")",
        "result": "9"
      },
      {
        "call": "getZonedWeekOfYear(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/zoned/get/getZonedYear",
    "fnName": "getZonedYear",
    "examples": [
      {
        "call": "getZonedYear(\"America/New_York\")",
        "result": "\"2024\""
      },
      {
        "call": "getZonedYear(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/interval/intervalAbutsZoned",
    "fnName": "intervalAbutsZoned",
    "examples": [
      {
        "call": "intervalAbutsZoned(\"2024-01-01T09:00:00+00:00[UTC]\", \"2024-06-30T12:00:00+00:00[UTC]\", \"2024-06-30T12:00:00.000000001+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\")",
        "result": "true"
      },
      {
        "call": "intervalAbutsZoned(\"2024-06-30T12:00:00+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\", \"2024-01-01T09:00:00+00:00[UTC]\", \"2024-06-30T12:00:00.000000001+00:00[UTC]\")",
        "result": "true"
      },
      {
        "call": "intervalAbutsZoned(\"2024-01-01T09:00:00+00:00[UTC]\", \"2024-06-30T12:00:00+00:00[UTC]\", \"2024-06-30T12:00:01+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\")",
        "result": "false (gap)"
      },
      {
        "call": "intervalAbutsZoned(\"2024-01-01T09:00:00+00:00[UTC]\", \"2024-06-30T13:00:00+00:00[UTC]\", \"2024-06-30T12:00:00+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\")",
        "result": "false (overlap)"
      },
      {
        "call": "intervalAbutsZoned(\"invalid\", \"2024-06-30T12:00:00+00:00[UTC]\", \"2024-06-30T12:00:00+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/interval/intervalContainsZoned",
    "fnName": "intervalContainsZoned",
    "examples": [
      {
        "call": "intervalContainsZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\", \"2024-06-15T12:00:00+00:00[UTC]\")",
        "result": "true"
      },
      {
        "call": "intervalContainsZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\", \"2024-06-15T12:00:00+00:00[UTC]\", \"2024-07-15T12:00:00+00:00[UTC]\")",
        "result": "true"
      },
      {
        "call": "intervalContainsZoned(\"2024-12-31T23:59:59+00:00[UTC]\", \"2024-01-01T00:00:00+00:00[UTC]\", \"2024-06-15T12:00:00+00:00[UTC]\")",
        "result": "false"
      },
      {
        "call": "intervalContainsZoned(\"invalid\", \"2024-12-31T23:59:59+00:00[UTC]\", \"2024-06-15T12:00:00+00:00[UTC]\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/interval/intervalCountZoned",
    "fnName": "intervalCountZoned",
    "examples": [
      {
        "call": "intervalCountZoned(\"2024-01-01T23:59:00+00:00[UTC]\", \"2024-01-02T00:01:00+00:00[UTC]\", \"day\")",
        "result": "2"
      },
      {
        "call": "intervalCountZoned(\"2024-03-10T00:00:00-05:00[America/New_York]\", \"2024-03-11T00:00:00-04:00[America/New_York]\", \"hour\")",
        "result": "23 (spring forward)"
      },
      {
        "call": "intervalCountZoned(\"2024-11-03T00:00:00-04:00[America/New_York]\", \"2024-11-04T00:00:00-05:00[America/New_York]\", \"hour\")",
        "result": "25 (fall back)"
      },
      {
        "call": "intervalCountZoned(\"2024-01-01T00:00:00-05:00[America/New_York]\", \"2024-01-03T00:00:00+09:00[Asia/Tokyo]\", \"day\")",
        "result": "2 (counted in America/New_York)"
      },
      {
        "call": "intervalCountZoned(\"2024-01-01T05:00:00+00:00[UTC]\", \"2024-01-01T05:00:00+00:00[UTC]\", \"day\")",
        "result": "1 (zero-length, mid-day)"
      },
      {
        "call": "intervalCountZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-01-01T00:00:00+00:00[UTC]\", \"day\")",
        "result": "0 (zero-length, on the boundary)"
      },
      {
        "call": "intervalCountZoned(\"5784-01-01T00:00:00-04:00[u-ca=hebrew][America/New_York]\", \"5785-01-01T00:00:00-04:00[u-ca=hebrew][America/New_York]\", \"month\")",
        "result": "13 (Hebrew leap year; the ISO equivalent is 14)"
      },
      {
        "call": "intervalCountZoned(\"invalid\", \"2024-01-02T00:00:00+00:00[UTC]\", \"day\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/zoned/interval/intervalDifferenceZoned",
    "fnName": "intervalDifferenceZoned",
    "examples": [
      {
        "call": "intervalDifferenceZoned(\"2024-01-01T09:00:00+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\", \"2024-06-01T12:00:00+00:00[UTC]\", \"2024-07-01T13:00:00+00:00[UTC]\")",
        "result": "[{ start: \"2024-01-01T09:00:00+00:00[UTC]\", end: \"2024-05-31T17:00:00+00:00[UTC]\" }, { start: \"2024-07-01T13:00:01+00:00[UTC]\", end: \"2024-12-31T17:00:00+00:00[UTC]\" }]"
      },
      {
        "call": "intervalDifferenceZoned(\"2024-01-01T09:00:00+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\", \"2024-01-01T09:00:00+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\")",
        "result": "[]"
      },
      {
        "call": "intervalDifferenceZoned(\"invalid\", \"2024-12-31T17:00:00+00:00[UTC]\", \"2024-06-01T12:00:00+00:00[UTC]\", \"2024-07-01T13:00:00+00:00[UTC]\")",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/zoned/interval/intervalDivideEquallyZoned",
    "fnName": "intervalDivideEquallyZoned",
    "examples": [
      {
        "call": "intervalDivideEquallyZoned(\"2024-03-09T12:00:00-05:00[America/New_York]\", \"2024-03-11T12:00:00-04:00[America/New_York]\", 2)",
        "result": "[{ start: \"2024-03-09T12:00:00-05:00[America/New_York]\", end: \"2024-03-10T12:30:00-04:00[America/New_York]\" }, { start: \"2024-03-10T12:30:00-04:00[America/New_York]\", end: \"2024-03-11T12:00:00-04:00[America/New_York]\" }] (47 real hours split in half)"
      },
      {
        "call": "intervalDivideEquallyZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-01-04T00:00:00+00:00[UTC]\", 1)",
        "result": "[{ start: \"2024-01-01T00:00:00+00:00[UTC]\", end: \"2024-01-04T00:00:00+00:00[UTC]\" }]"
      },
      {
        "call": "intervalDivideEquallyZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-01-04T00:00:00+00:00[UTC]\", 0)",
        "result": "[]"
      },
      {
        "call": "intervalDivideEquallyZoned(\"invalid\", \"2024-01-04T00:00:00+00:00[UTC]\", 3)",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/zoned/interval/intervalEngulfsZoned",
    "fnName": "intervalEngulfsZoned",
    "examples": [
      {
        "call": "intervalEngulfsZoned(\"2024-01-01T09:00:00+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\", \"2024-06-01T12:00:00+00:00[UTC]\", \"2024-07-01T13:00:00+00:00[UTC]\")",
        "result": "true"
      },
      {
        "call": "intervalEngulfsZoned(\"2024-01-01T09:00:00+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\", \"2024-01-01T09:00:00+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\")",
        "result": "true (equal intervals)"
      },
      {
        "call": "intervalEngulfsZoned(\"2024-01-01T09:00:00+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\", \"2024-01-01T09:00:00+00:00[UTC]\", \"2024-06-30T12:00:00+00:00[UTC]\")",
        "result": "true"
      },
      {
        "call": "intervalEngulfsZoned(\"2024-06-01T12:00:00+00:00[UTC]\", \"2024-07-01T13:00:00+00:00[UTC]\", \"2024-01-01T09:00:00+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\")",
        "result": "false"
      },
      {
        "call": "intervalEngulfsZoned(\"invalid\", \"2024-12-31T17:00:00+00:00[UTC]\", \"2024-06-01T12:00:00+00:00[UTC]\", \"2024-07-01T13:00:00+00:00[UTC]\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/interval/intervalFromDurationZoned",
    "fnName": "intervalFromDurationZoned",
    "examples": [
      {
        "call": "intervalFromDurationZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"P1D\", \"start\")",
        "result": "{ start: \"2024-01-01T00:00:00+00:00[UTC]\", end: \"2024-01-02T00:00:00+00:00[UTC]\" }"
      },
      {
        "call": "intervalFromDurationZoned(\"2024-01-02T00:00:00+00:00[UTC]\", \"P1D\", \"end\")",
        "result": "{ start: \"2024-01-01T00:00:00+00:00[UTC]\", end: \"2024-01-02T00:00:00+00:00[UTC]\" }"
      },
      {
        "call": "intervalFromDurationZoned(\"2024-11-02T01:30:00-04:00[America/New_York]\", \"P1D\", \"start\", { disambiguation: \"later\" })",
        "result": "{ start: \"2024-11-02T01:30:00-04:00[America/New_York]\", end: \"2024-11-03T01:30:00-05:00[America/New_York]\" } (fall-back overlap resolved; default \"compatible\" would return the -04:00 instant instead)"
      },
      {
        "call": "intervalFromDurationZoned(\"2024-01-31T12:00:00-05:00[America/New_York]\", \"P1M\", \"start\", { overflow: \"reject\" })",
        "result": "null"
      },
      {
        "call": "intervalFromDurationZoned(\"invalid\", \"P1D\", \"start\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/zoned/interval/intervalIntersectionZoned",
    "fnName": "intervalIntersectionZoned",
    "examples": [
      {
        "call": "intervalIntersectionZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-06-30T23:59:59+00:00[UTC]\", \"2024-04-01T00:00:00+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\")",
        "result": "{ start: \"2024-04-01T00:00:00+00:00[UTC]\", end: \"2024-06-30T23:59:59+00:00[UTC]\" }"
      },
      {
        "call": "intervalIntersectionZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-06-30T23:59:59+00:00[UTC]\", \"2024-07-01T00:00:00+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\")",
        "result": "null"
      },
      {
        "call": "intervalIntersectionZoned(\"invalid\", \"2024-06-30T23:59:59+00:00[UTC]\", \"2024-04-01T00:00:00+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/zoned/interval/intervalLengthZoned",
    "fnName": "intervalLengthZoned",
    "examples": [
      {
        "call": "intervalLengthZoned(\"2024-03-10T00:00:00-05:00[America/New_York]\", \"2024-03-11T00:00:00-04:00[America/New_York]\", \"hour\")",
        "result": "23 (spring forward)"
      },
      {
        "call": "intervalLengthZoned(\"2024-03-10T00:00:00-05:00[America/New_York]\", \"2024-03-11T00:00:00-04:00[America/New_York]\", \"day\")",
        "result": "1"
      },
      {
        "call": "intervalLengthZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-01-01T00:00:00+00:00[UTC]\", \"day\")",
        "result": "0"
      },
      {
        "call": "intervalLengthZoned(\"invalid\", \"2024-01-02T00:00:00+00:00[UTC]\", \"day\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/zoned/interval/intervalOverlappingDaysZoned",
    "fnName": "intervalOverlappingDaysZoned",
    "examples": [
      {
        "call": "intervalOverlappingDaysZoned(\"2024-03-09T12:00:00-05:00[America/New_York]\", \"2024-03-11T12:00:00-04:00[America/New_York]\", \"2024-03-09T12:00:00-05:00[America/New_York]\", \"2024-03-11T12:00:00-04:00[America/New_York]\")",
        "result": "3 (spring-forward, 47 real hours)"
      },
      {
        "call": "intervalOverlappingDaysZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-01-02T00:00:00+00:00[UTC]\", \"2024-01-03T00:00:00+00:00[UTC]\", \"2024-01-04T00:00:00+00:00[UTC]\")",
        "result": "0 (disjoint)"
      },
      {
        "call": "intervalOverlappingDaysZoned(\"invalid\", \"2024-06-30T23:59:59+00:00[UTC]\", \"2024-04-01T00:00:00+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/zoned/interval/intervalSplitAtZoned",
    "fnName": "intervalSplitAtZoned",
    "examples": [
      {
        "call": "intervalSplitAtZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-01-10T00:00:00+00:00[UTC]\", [\"2024-01-05T00:00:00+00:00[UTC]\"])",
        "result": "[{ start: \"2024-01-01T00:00:00+00:00[UTC]\", end: \"2024-01-05T00:00:00+00:00[UTC]\" }, { start: \"2024-01-05T00:00:00+00:00[UTC]\", end: \"2024-01-10T00:00:00+00:00[UTC]\" }]"
      },
      {
        "call": "intervalSplitAtZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-01-10T00:00:00+00:00[UTC]\", [])",
        "result": "[{ start: \"2024-01-01T00:00:00+00:00[UTC]\", end: \"2024-01-10T00:00:00+00:00[UTC]\" }]"
      },
      {
        "call": "intervalSplitAtZoned(\"invalid\", \"2024-01-10T00:00:00+00:00[UTC]\", [\"2024-01-05T00:00:00+00:00[UTC]\"])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/zoned/interval/intervalUnionZoned",
    "fnName": "intervalUnionZoned",
    "examples": [
      {
        "call": "intervalUnionZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-06-30T23:59:59+00:00[UTC]\", \"2024-04-01T00:00:00+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\")",
        "result": "{ start: \"2024-01-01T00:00:00+00:00[UTC]\", end: \"2024-12-31T23:59:59+00:00[UTC]\" }"
      },
      {
        "call": "intervalUnionZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-06-30T23:59:59+00:00[UTC]\", \"2024-06-30T23:59:59+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\")",
        "result": "{ start: \"2024-01-01T00:00:00+00:00[UTC]\", end: \"2024-12-31T23:59:59+00:00[UTC]\" }"
      },
      {
        "call": "intervalUnionZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-06-30T23:59:59+00:00[UTC]\", \"2024-07-01T00:00:00+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\")",
        "result": "null"
      },
      {
        "call": "intervalUnionZoned(\"invalid\", \"2024-06-30T23:59:59+00:00[UTC]\", \"2024-04-01T00:00:00+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/zoned/interval/intervalXorAllZoned",
    "fnName": "intervalXorAllZoned",
    "examples": [
      {
        "call": "intervalXorAllZoned([{ start: \"2024-01-01T00:00:00+00:00[UTC]\", end: \"2024-01-10T00:00:00+00:00[UTC]\" }, { start: \"2024-01-05T00:00:00+00:00[UTC]\", end: \"2024-01-15T00:00:00+00:00[UTC]\" }])",
        "result": "[{ start: \"2024-01-01T00:00:00+00:00[UTC]\", end: \"2024-01-04T23:59:59.999999999+00:00[UTC]\" }, { start: \"2024-01-10T00:00:00.000000001+00:00[UTC]\", end: \"2024-01-15T00:00:00+00:00[UTC]\" }]"
      },
      {
        "call": "intervalXorAllZoned([])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/zoned/interval/intervalXorZoned",
    "fnName": "intervalXorZoned",
    "examples": [
      {
        "call": "intervalXorZoned(\"2024-01-01T09:00:00+00:00[UTC]\", \"2024-06-30T12:00:00+00:00[UTC]\", \"2024-04-01T11:00:00+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\")",
        "result": "[{ start: \"2024-01-01T09:00:00+00:00[UTC]\", end: \"2024-03-31T17:00:00+00:00[UTC]\" }, { start: \"2024-06-30T12:00:01+00:00[UTC]\", end: \"2024-12-31T17:00:00+00:00[UTC]\" }]"
      },
      {
        "call": "intervalXorZoned(\"2024-01-01T09:00:00+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\", \"2024-04-01T11:00:00+00:00[UTC]\", \"2024-06-30T12:00:00+00:00[UTC]\")",
        "result": "[{ start: \"2024-01-01T09:00:00+00:00[UTC]\", end: \"2024-03-31T17:00:00+00:00[UTC]\" }, { start: \"2024-06-30T12:00:01+00:00[UTC]\", end: \"2024-12-31T17:00:00+00:00[UTC]\" }]"
      },
      {
        "call": "intervalXorZoned(\"2024-01-01T09:00:00+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\", \"2024-01-01T09:00:00+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\")",
        "result": "[]"
      },
      {
        "call": "intervalXorZoned(\"invalid\", \"2024-06-30T12:00:00+00:00[UTC]\", \"2024-07-01T13:00:00+00:00[UTC]\", \"2024-12-31T17:00:00+00:00[UTC]\")",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/zoned/interval/intervalsOverlapZoned",
    "fnName": "intervalsOverlapZoned",
    "examples": [
      {
        "call": "intervalsOverlapZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-06-30T23:59:59+00:00[UTC]\", \"2024-04-01T00:00:00+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\")",
        "result": "true"
      },
      {
        "call": "intervalsOverlapZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-06-30T23:59:59+00:00[UTC]\", \"2024-07-01T00:00:00+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\")",
        "result": "false (adjacent)"
      },
      {
        "call": "intervalsOverlapZoned(\"invalid\", \"2024-06-30T23:59:59+00:00[UTC]\", \"2024-04-01T00:00:00+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/interval/mergeIntervalsZoned",
    "fnName": "mergeIntervalsZoned",
    "examples": [
      {
        "call": "mergeIntervalsZoned([{ start: \"2024-01-01T00:00:00+00:00[UTC]\", end: \"2024-01-10T00:00:00+00:00[UTC]\" }, { start: \"2024-01-05T00:00:00+00:00[UTC]\", end: \"2024-01-15T00:00:00+00:00[UTC]\" }])",
        "result": "[{ start: \"2024-01-01T00:00:00+00:00[UTC]\", end: \"2024-01-15T00:00:00+00:00[UTC]\" }]"
      },
      {
        "call": "mergeIntervalsZoned([])",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/zoned/interval/splitIntervalByUnitZoned",
    "fnName": "splitIntervalByUnitZoned",
    "examples": [
      {
        "call": "splitIntervalByUnitZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-01-02T00:00:00+00:00[UTC]\", \"hour\", 6)",
        "result": "[{ start: \"2024-01-01T00:00:00+00:00[UTC]\", end: \"2024-01-01T06:00:00+00:00[UTC]\" }, { start: \"2024-01-01T06:00:00+00:00[UTC]\", end: \"2024-01-01T12:00:00+00:00[UTC]\" }, { start: \"2024-01-01T12:00:00+00:00[UTC]\", end: \"2024-01-01T18:00:00+00:00[UTC]\" }, { start: \"2024-01-01T18:00:00+00:00[UTC]\", end: \"2024-01-02T00:00:00+00:00[UTC]\" }]"
      },
      {
        "call": "splitIntervalByUnitZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-01-01T01:30:00+00:00[UTC]\", \"hour\", 1)",
        "result": "[{ start: \"2024-01-01T00:00:00+00:00[UTC]\", end: \"2024-01-01T01:00:00+00:00[UTC]\" }, { start: \"2024-01-01T01:00:00+00:00[UTC]\", end: \"2024-01-01T01:30:00+00:00[UTC]\" }]"
      },
      {
        "call": "splitIntervalByUnitZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-01-01T00:00:00+00:00[UTC]\", \"hour\", 1)",
        "result": "[{ start: \"2024-01-01T00:00:00+00:00[UTC]\", end: \"2024-01-01T00:00:00+00:00[UTC]\" }]"
      },
      {
        "call": "splitIntervalByUnitZoned(\"2024-01-01T00:00:00+00:00[UTC]\", \"2024-01-02T00:00:00+00:00[UTC]\", \"hour\", 0)",
        "result": "[]"
      },
      {
        "call": "splitIntervalByUnitZoned(\"invalid\", \"2024-01-02T00:00:00+00:00[UTC]\", \"hour\", 1)",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/zoned/interval/isValidCalendarZonedInterval",
    "fnName": "isValidCalendarZonedInterval",
    "examples": [
      {
        "call": "isValidCalendarZonedInterval(\"2024-01-01T10:00:00+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\")",
        "result": "true"
      },
      {
        "call": "isValidCalendarZonedInterval(\"5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]\", \"5784-07-15T14:30:00-04:00[u-ca=hebrew][America/New_York]\")",
        "result": "true"
      },
      {
        "call": "isValidCalendarZonedInterval(\"5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]\", \"1445-09-15T14:30:00-04:00[u-ca=islamic-civil][America/New_York]\")",
        "result": "true (mixed calendars accepted)"
      },
      {
        "call": "isValidCalendarZonedInterval(\"2024-12-31T23:59:59+00:00[UTC]\", \"2024-01-01T10:00:00+00:00[UTC]\")",
        "result": "false (start after end)"
      },
      {
        "call": "isValidCalendarZonedInterval(\"2024-01-01T10:00:00+00:00[UTC][u-ca=hebrew]\", \"2024-12-31T23:59:59+00:00[UTC]\")",
        "result": "false (Temporal's segment ordering)"
      },
      {
        "call": "isValidCalendarZonedInterval(\"invalid\", \"2024-12-31T23:59:59+00:00[UTC]\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/interval/isValidZonedInterval",
    "fnName": "isValidZonedInterval",
    "examples": [
      {
        "call": "isValidZonedInterval(\"2024-01-01T10:00:00+00:00[UTC]\", \"2024-12-31T23:59:59+00:00[UTC]\")",
        "result": "true"
      },
      {
        "call": "isValidZonedInterval(\"2024-06-15T12:00:00-04:00[America/New_York]\", \"2024-06-15T12:00:00-04:00[America/New_York]\")",
        "result": "true"
      },
      {
        "call": "isValidZonedInterval(\"2024-12-31T23:59:59+00:00[UTC]\", \"2024-01-01T10:00:00+00:00[UTC]\")",
        "result": "false"
      },
      {
        "call": "isValidZonedInterval(\"2024-01-01T10:00:00+00:00[UTC][u-ca=hebrew]\", \"2024-12-31T23:59:59+00:00[UTC]\")",
        "result": "false (calendar annotation rejected)"
      },
      {
        "call": "isValidZonedInterval(\"invalid\", \"2024-12-31T23:59:59+00:00[UTC]\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/map/mapZonedDatesInRange",
    "fnName": "mapZonedDatesInRange",
    "examples": [
      {
        "call": "mapZonedDatesInRange(\"2024-02-28T12:00:00+00:00[UTC]\", \"2024-03-02T12:00:00+00:00[UTC]\")",
        "result": "[\"2024-02-28\", \"2024-02-29\", \"2024-03-01\", \"2024-03-02\"]"
      },
      {
        "call": "mapZonedDatesInRange(\"2024-02-28T12:00:00+00:00[UTC]\", \"2024-03-02T12:00:00+00:00[UTC]\", 2)",
        "result": "[\"2024-02-28\", \"2024-03-01\"]"
      },
      {
        "call": "mapZonedDatesInRange(\"invalid\", \"2024-03-02T12:00:00+00:00[UTC]\")",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/zoned/map/mapZonedHoursInDay",
    "fnName": "mapZonedHoursInDay",
    "examples": [
      {
        "call": "mapZonedHoursInDay(\"2024-02-29T12:34:56.789+00:00[UTC]\")",
        "result": "[\"2024-02-29T00:00:00+00:00[UTC]\", \"2024-02-29T01:00:00+00:00[UTC]\", ..., \"2024-02-29T23:00:00+00:00[UTC]\"]"
      },
      {
        "call": "mapZonedHoursInDay(\"2024-03-10T12:34:56.789-05:00[America/New_York]\")",
        "result": "[\"2024-03-10T00:00:00-05:00[America/New_York]\", ...] (skips 2 AM due to DST; unaffected by `disambiguation` since this gap is inside the loop's arithmetic, not the anchor)"
      },
      {
        "call": "mapZonedHoursInDay(\"2018-11-04T12:00:00-02:00[America/Sao_Paulo]\", { disambiguation: \"reject\" })",
        "result": "[] (midnight itself is the DST transition in this historical Brazil zone/date, so the anchor is ambiguous and \"reject\" throws)"
      },
      {
        "call": "mapZonedHoursInDay(\"2018-11-04T12:00:00-02:00[America/Sao_Paulo]\", { disambiguation: \"reject\", offset: \"prefer\" })",
        "result": "[] (the source's -02:00 offset is also invalid at midnight here, so even \"prefer\" falls through to disambiguation and \"reject\" still throws — contrast with startOfZoned's Nov 3 America/New_York example, where \"prefer\" IS valid at the target time and suppresses disambiguation)"
      },
      {
        "call": "mapZonedHoursInDay(\"invalid\")",
        "result": "[]"
      }
    ]
  },
  {
    "route": "/reference/zoned/parse/getZonedOffset",
    "fnName": "getZonedOffset",
    "examples": [
      {
        "call": "getZonedOffset(\"2024-02-29T12:34:56.789+00:00[UTC]\")",
        "result": "\"+00:00\""
      },
      {
        "call": "getZonedOffset(\"2024-07-15T12:00:00-04:00[America/New_York]\")",
        "result": "\"-04:00\""
      },
      {
        "call": "getZonedOffset(\"2024-05-15T12:00:00+05:45[Asia/Kathmandu]\")",
        "result": "\"+05:45\""
      },
      {
        "call": "getZonedOffset(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/parse/isValidZonedOffsetUnit",
    "fnName": "isValidZonedOffsetUnit",
    "examples": []
  },
  {
    "route": "/reference/zoned/parse/getZonedOffsetAs",
    "fnName": "getZonedOffsetAs",
    "examples": [
      {
        "call": "getZonedOffsetAs(\"2024-07-15T12:00:00-04:00[America/New_York]\", \"minutes\")",
        "result": "-240"
      },
      {
        "call": "getZonedOffsetAs(\"2024-05-15T12:00:00+05:45[Asia/Kathmandu]\", \"minutes\")",
        "result": "345"
      },
      {
        "call": "getZonedOffsetAs(\"2024-02-29T12:00:00+00:00[UTC]\", \"nanoseconds\")",
        "result": "0"
      },
      {
        "call": "getZonedOffsetAs(\"2024-07-15T12:00:00-04:00[America/New_York]\", \"nanoseconds\")",
        "result": "-14400000000000"
      },
      {
        "call": "getZonedOffsetAs(\"invalid\", \"minutes\")",
        "result": "null"
      },
      {
        "call": "getZonedOffsetAs(\"2024-02-29T12:00:00+00:00[UTC]\", \"fortnights\" as never)",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/zoned/parse/parseDateFromZoned",
    "fnName": "parseDateFromZoned",
    "examples": [
      {
        "call": "parseDateFromZoned(\"2024-02-29T12:34:56.789+00:00[UTC]\")",
        "result": "\"2024-02-29\""
      },
      {
        "call": "parseDateFromZoned(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/parse/parseDateTimeFromZoned",
    "fnName": "parseDateTimeFromZoned",
    "examples": []
  },
  {
    "route": "/reference/zoned/parse/parseDayFromZoned",
    "fnName": "parseDayFromZoned",
    "examples": [
      {
        "call": "parseDayFromZoned(\"2024-03-15T14:30:45+00:00[UTC]\")",
        "result": "\"15\""
      },
      {
        "call": "parseDayFromZoned(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/parse/parseDayOfWeekFromZoned",
    "fnName": "parseDayOfWeekFromZoned",
    "examples": [
      {
        "call": "parseDayOfWeekFromZoned(\"2024-03-15T14:30:45+00:00[UTC]\")",
        "result": "5 (Friday)"
      },
      {
        "call": "parseDayOfWeekFromZoned(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/zoned/parse/parseHourFromZoned",
    "fnName": "parseHourFromZoned",
    "examples": [
      {
        "call": "parseHourFromZoned(\"2024-03-15T14:30:45+00:00[UTC]\")",
        "result": "\"14\""
      },
      {
        "call": "parseHourFromZoned(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/parse/parseMicrosecondFromZoned",
    "fnName": "parseMicrosecondFromZoned",
    "examples": [
      {
        "call": "parseMicrosecondFromZoned(\"2024-03-15T14:30:45.123+00:00[UTC]\")",
        "result": "\"123\""
      },
      {
        "call": "parseMicrosecondFromZoned(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/parse/parseMillisecondFromZoned",
    "fnName": "parseMillisecondFromZoned",
    "examples": [
      {
        "call": "parseMillisecondFromZoned(\"2024-03-15T14:30:45.123+00:00[UTC]\")",
        "result": "\"123\""
      },
      {
        "call": "parseMillisecondFromZoned(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/parse/parseMinuteFromZoned",
    "fnName": "parseMinuteFromZoned",
    "examples": [
      {
        "call": "parseMinuteFromZoned(\"2024-03-15T14:30:45+00:00[UTC]\")",
        "result": "\"30\""
      },
      {
        "call": "parseMinuteFromZoned(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/parse/parseMonthFromZoned",
    "fnName": "parseMonthFromZoned",
    "examples": [
      {
        "call": "parseMonthFromZoned(\"2024-03-15T14:30:45+00:00[UTC]\")",
        "result": "\"03\""
      },
      {
        "call": "parseMonthFromZoned(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/parse/parseNanosecondFromZoned",
    "fnName": "parseNanosecondFromZoned",
    "examples": [
      {
        "call": "parseNanosecondFromZoned(\"2024-03-15T14:30:45.123+00:00[UTC]\")",
        "result": "\"123\""
      },
      {
        "call": "parseNanosecondFromZoned(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/parse/parseRfc2822",
    "fnName": "parseRfc2822",
    "examples": [
      {
        "call": "parseRfc2822(\"Fri, 15 Mar 2024 14:30:00 -0400\")",
        "result": "\"2024-03-15T14:30:00-04:00[-04:00]\""
      },
      {
        "call": "parseRfc2822(\"5 Jan 2024 09:00:00 GMT\")",
        "result": "\"2024-01-05T09:00:00+00:00[+00:00]\""
      },
      {
        "call": "parseRfc2822(\"not a date\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/parse/parseRfc3339",
    "fnName": "parseRfc3339",
    "examples": [
      {
        "call": "parseRfc3339(\"2024-03-15T14:30:00-04:00\")",
        "result": "\"2024-03-15T14:30:00-04:00[-04:00]\""
      },
      {
        "call": "parseRfc3339(\"2024-03-15T14:30:00Z\")",
        "result": "\"2024-03-15T14:30:00+00:00[+00:00]\""
      },
      {
        "call": "parseRfc3339(\"2024-03-15T14:30:00+00:00[UTC]\")",
        "result": "\"\" (bracket annotation not valid RFC 3339)"
      },
      {
        "call": "parseRfc3339(\"not a date\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/parse/parseSecondFromZoned",
    "fnName": "parseSecondFromZoned",
    "examples": [
      {
        "call": "parseSecondFromZoned(\"2024-03-15T14:30:45+00:00[UTC]\")",
        "result": "\"45\""
      },
      {
        "call": "parseSecondFromZoned(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/parse/parseTimeFromZoned",
    "fnName": "parseTimeFromZoned",
    "examples": [
      {
        "call": "parseTimeFromZoned(\"2024-02-29T12:34:56.789+00:00[UTC]\")",
        "result": "\"12:34:56.789\""
      },
      {
        "call": "parseTimeFromZoned(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/parse/parseTimeZoneFromZoned",
    "fnName": "parseTimeZoneFromZoned",
    "examples": [
      {
        "call": "parseTimeZoneFromZoned(\"2024-02-29T12:34:56.789+00:00[UTC]\")",
        "result": "\"UTC\""
      },
      {
        "call": "parseTimeZoneFromZoned(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/parse/isValidZonedUnit",
    "fnName": "isValidZonedUnit",
    "examples": []
  },
  {
    "route": "/reference/zoned/parse/parseUnitFromZoned",
    "fnName": "parseUnitFromZoned",
    "examples": [
      {
        "call": "parseUnitFromZoned(\"2024-02-29T12:34:56.789+00:00[UTC]\", \"year\")",
        "result": "\"2024\""
      },
      {
        "call": "parseUnitFromZoned(\"invalid\", \"year\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/parse/parseWeekFromZoned",
    "fnName": "parseWeekFromZoned",
    "examples": [
      {
        "call": "parseWeekFromZoned(\"2024-01-01T14:30:45.123+00:00[UTC]\")",
        "result": "1"
      },
      {
        "call": "parseWeekFromZoned(\"2024-01-08T14:30:45.123+00:00[UTC]\")",
        "result": "2"
      },
      {
        "call": "parseWeekFromZoned(\"invalid\")",
        "result": "null"
      }
    ]
  },
  {
    "route": "/reference/zoned/parse/parseYearFromZoned",
    "fnName": "parseYearFromZoned",
    "examples": [
      {
        "call": "parseYearFromZoned(\"2024-03-15T14:30:45.123+00:00[UTC]\")",
        "result": "\"2024\""
      },
      {
        "call": "parseYearFromZoned(\"invalid\")",
        "result": "\"\""
      }
    ]
  },
  {
    "route": "/reference/zoned/validate/hasDaylightSaving",
    "fnName": "hasDaylightSaving",
    "examples": [
      {
        "call": "hasDaylightSaving(\"America/New_York\")",
        "result": "true"
      },
      {
        "call": "hasDaylightSaving(\"Europe/Berlin\")",
        "result": "true"
      },
      {
        "call": "hasDaylightSaving(\"Asia/Tokyo\")",
        "result": "false"
      },
      {
        "call": "hasDaylightSaving(\"UTC\")",
        "result": "false"
      },
      {
        "call": "hasDaylightSaving(\"Invalid/Zone\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/validate/isValidCalendarZonedDateTime",
    "fnName": "isValidCalendarZonedDateTime",
    "examples": [
      {
        "call": "isValidCalendarZonedDateTime(\"2024-10-03T14:30:45-04:00[America/New_York]\")",
        "result": "true"
      },
      {
        "call": "isValidCalendarZonedDateTime(\"5784-06-15T14:30:00-05:00[u-ca=hebrew][America/New_York]\")",
        "result": "true"
      },
      {
        "call": "isValidCalendarZonedDateTime(\"0031-04-30T12:00:00+09:00[u-ca=japanese;era=heisei][Asia/Tokyo]\")",
        "result": "true"
      },
      {
        "call": "isValidCalendarZonedDateTime(\"5784-06-15T14:30:00-05:00[America/New_York][u-ca=hebrew]\")",
        "result": "false (Temporal's segment ordering)"
      },
      {
        "call": "isValidCalendarZonedDateTime(\"5785-13-15T14:30:00-05:00[u-ca=hebrew][America/New_York]\")",
        "result": "false (5785 is not a Hebrew leap year, so month 13 does not exist)"
      },
      {
        "call": "isValidCalendarZonedDateTime(\"2024-06-30T23:59:60+00:00[UTC]\")",
        "result": "false (leap second)"
      },
      {
        "call": "isValidCalendarZonedDateTime(\"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/validate/isValidTimeZone",
    "fnName": "isValidTimeZone",
    "examples": [
      {
        "call": "isValidTimeZone(\"America/New_York\")",
        "result": "true"
      },
      {
        "call": "isValidTimeZone(\"Europe/London\")",
        "result": "true"
      },
      {
        "call": "isValidTimeZone(\"Invalid/Timezone\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/validate/isValidZonedDateTime",
    "fnName": "isValidZonedDateTime",
    "examples": [
      {
        "call": "isValidZonedDateTime(\"2024-02-29T12:34:56.789+00:00[UTC]\")",
        "result": "true"
      },
      {
        "call": "isValidZonedDateTime(\"2024-06-30T23:59:60+00:00[UTC]\")",
        "result": "false (leap second)"
      },
      {
        "call": "isValidZonedDateTime(\"2024-02-10T12:00:00-05:00[America/New_York][u-ca=hebrew]\")",
        "result": "false (calendar annotation rejected)"
      },
      {
        "call": "isValidZonedDateTime(\"invalid\")",
        "result": "false"
      }
    ]
  },
  {
    "route": "/reference/zoned/validate/isValidZonedRange",
    "fnName": "isValidZonedRange",
    "examples": [
      {
        "call": "isValidZonedRange({ value1: \"2024-01-01T10:00:00+00:00[UTC]\", value2: \"2024-12-31T23:59:59+00:00[UTC]\" })",
        "result": "true"
      },
      {
        "call": "isValidZonedRange({ value1: \"2024-12-31T23:59:59+00:00[UTC]\", value2: \"2024-01-01T10:00:00+00:00[UTC]\" })",
        "result": "false"
      },
      {
        "call": "isValidZonedRange({ value1: \"2024-06-15T12:00:00-04:00[America/New_York]\", value2: \"2024-06-15T12:00:00-04:00[America/New_York]\", options: { allowEqual: true } })",
        "result": "true"
      }
    ]
  }
];
