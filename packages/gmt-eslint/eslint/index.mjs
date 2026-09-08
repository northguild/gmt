import tsParser from "@typescript-eslint/parser";

const MSG_DATE_LIBRARY =
  "Avoid date libraries that wrap native Date (moment, dayjs, luxon, date-fns, spacetime). Use @northguild/gmt instead.";

// Bare package names plus their subpaths, for the esquery selectors that cover
// require() and dynamic import() — neither of which no-restricted-imports sees.
const DATE_LIBRARIES = [
  "moment",
  "moment-timezone",
  "dayjs",
  "luxon",
  "date-fns",
  "date-fns-tz",
  "spacetime",
];

const DATE_LIBRARY_SELECTOR_VALUES = `/^(${DATE_LIBRARIES.join("|")})(\\/.*)?$/`;

export default [
  {
    files: ["**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"],
    languageOptions: {
      parser: tsParser,
      sourceType: "module",
      ecmaVersion: "latest",
    },
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "Date",
          message:
            "Avoid Date. Use @northguild/gmt getNow(), getUnixNow('milliseconds' | 'seconds'), getUtcNow(), or getZonedNow(timezone) instead.",
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "Date",
          property: "now",
          message:
            "Avoid Date.now(). Use @northguild/gmt getUnixNow('milliseconds' | 'seconds') or getNow() instead.",
        },
        {
          object: "Date",
          property: "UTC",
          message:
            "Avoid Date.UTC(). Use @northguild/gmt convertUtcDateTimeToUnix('YYYY-MM-DDTHH:mm:ss', 'milliseconds' | 'seconds') instead.",
        },
        {
          object: "Date",
          property: "parse",
          message:
            "Avoid Date.parse(). Use @northguild/gmt convertZonedToUnix(value) instead.",
        },
      ],
      // Static import forms. `patterns` catches subpaths (date-fns/format) and
      // the -tz/-timezone companions in one entry.
      //
      // @js-joda/core is deliberately absent: it has its own value types and
      // touches Date only at the boundary, so it doesn't carry the ambient
      // timezone and DST problems this ban targets.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "moment", message: MSG_DATE_LIBRARY },
            { name: "moment-timezone", message: MSG_DATE_LIBRARY },
            { name: "dayjs", message: MSG_DATE_LIBRARY },
            { name: "luxon", message: MSG_DATE_LIBRARY },
            { name: "date-fns", message: MSG_DATE_LIBRARY },
            { name: "date-fns-tz", message: MSG_DATE_LIBRARY },
            { name: "spacetime", message: MSG_DATE_LIBRARY },
          ],
          patterns: [
            {
              group: [
                "moment/*",
                "moment-timezone/*",
                "dayjs/*",
                "luxon/*",
                "date-fns/*",
                "date-fns-tz/*",
                "spacetime/*",
              ],
              message: MSG_DATE_LIBRARY,
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date']",
          message:
            "Avoid new Date(). Use @northguild/gmt getUtcNow(), getNow(), or getZonedNow(timezone) instead.",
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='getTimezoneOffset']",
          message:
            "Avoid date.getTimezoneOffset(). Timezone offsets change throughout the year, so use @northguild/gmt zoned methods instead.",
        },
        {
          selector: `CallExpression[callee.name='require'] > Literal[value=${DATE_LIBRARY_SELECTOR_VALUES}]`,
          message: MSG_DATE_LIBRARY,
        },
        {
          selector: `ImportExpression > Literal[value=${DATE_LIBRARY_SELECTOR_VALUES}]`,
          message: MSG_DATE_LIBRARY,
        },
      ],
    },
  },
];
