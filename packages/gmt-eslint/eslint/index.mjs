import tsParser from "@typescript-eslint/parser";

const MIGRATE_URL = "https://northguild.dev/gmt/migrate/";

const guideFor = (name, slug) =>
  `${MIGRATE_URL}${slug}/ maps ${name} calls to their gmt replacements.`;

const MOMENT_GUIDE = guideFor("Moment.js", "moment");
const DATE_FNS_GUIDE = guideFor("date-fns", "date-fns");

// Each banned package and the migration guide its message points at.
// spacetime has no guide of its own.
const DATE_LIBRARY_GUIDES = {
  moment: MOMENT_GUIDE,
  "moment-timezone": MOMENT_GUIDE,
  dayjs: guideFor("Day.js", "dayjs"),
  luxon: guideFor("Luxon", "luxon"),
  "date-fns": DATE_FNS_GUIDE,
  "date-fns-tz": DATE_FNS_GUIDE,
  "@date-fns/tz": DATE_FNS_GUIDE,
  spacetime: `${MIGRATE_URL} lists the migration guides.`,
};

const DATE_LIBRARIES = Object.entries(DATE_LIBRARY_GUIDES).map(
  ([name, guide]) => ({
    name,
    message: `Avoid ${name}: it wraps native Date. Use @northguild/gmt instead; ${guide}`,
    // The package and its subpaths, for the esquery selectors that cover
    // require() and dynamic import(), neither of which no-restricted-imports sees.
    selectorValue: `/^${name.replaceAll("/", "\\/")}(\\/.*)?$/`,
  }),
);

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
            "Avoid Date. Use @northguild/gmt getNow(), getUnixNow({ epochUnit: 'milliseconds' | 'seconds' }), getUtcNow(), or getZonedNow(timezone) instead.",
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "Date",
          property: "now",
          message:
            "Avoid Date.now(). Use @northguild/gmt getUnixNow({ epochUnit: 'milliseconds' | 'seconds' }) or getNow() instead.",
        },
        {
          object: "Date",
          property: "UTC",
          message:
            "Avoid Date.UTC(). Use @northguild/gmt convertUtcToUnix('YYYY-MM-DDTHH:mm:ssZ', { epochUnit: 'milliseconds' | 'seconds' }) instead.",
        },
        {
          object: "Date",
          property: "parse",
          message:
            "Avoid Date.parse(). Use @northguild/gmt convertZonedToUnix(value) instead.",
        },
      ],
      // Static import forms. `paths` matches each package, and `patterns`
      // its subpaths (date-fns/format).
      //
      // @js-joda/core is deliberately absent: it has its own value types and
      // touches Date only at the boundary, so it doesn't carry the ambient
      // timezone and DST problems this ban targets.
      "no-restricted-imports": [
        "error",
        {
          paths: DATE_LIBRARIES.map(({ name, message }) => ({ name, message })),
          patterns: DATE_LIBRARIES.map(({ name, message }) => ({
            group: [`${name}/*`],
            message,
          })),
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
            "Avoid date.getTimezoneOffset(). Timezone offsets change throughout the year, so use @northguild/gmt getTimeZoneOffset(timeZone, instant) instead.",
        },
        ...DATE_LIBRARIES.flatMap(({ message, selectorValue }) => [
          {
            selector: `CallExpression[callee.name='require'] > Literal[value=${selectorValue}]`,
            message,
          },
          {
            selector: `ImportExpression > Literal[value=${selectorValue}]`,
            message,
          },
        ]),
      ],
    },
  },
];
