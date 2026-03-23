import tsParser from "@typescript-eslint/parser";

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
            "Aint nobody got time for Date. Use @burglekitt/gmt getNow(), getUnixNow('milliseconds' | 'seconds'), getUtcNow(), or getZonedNow(timezone) instead.",
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "Date",
          property: "now",
          message:
            "Aint nobody got time for Date.now(). Use @burglekitt/gmt getUnixNow('milliseconds' | 'seconds') or getNow() instead.",
        },
        {
          object: "Date",
          property: "UTC",
          message:
            "Aint nobody got time for Date.UTC(). Use @burglekitt/gmt convertUtcDateTimeToUnix('YYYY-MM-DDTHH:mm:ss', 'milliseconds' | 'seconds') instead.",
        },
        {
          object: "Date",
          property: "parse",
          message:
            "Aint nobody got time for Date.parse(). Use @burglekitt/gmt convertZonedToUnix(value) instead.",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date']",
          message:
            "Aint nobody got time for new Date(). Use @burglekitt/gmt getUtcNow(), getNow(), or getZonedNow(timezone) instead.",
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='getTimezoneOffset']",
          message:
            "Aint nobody got time for date.getTimezoneOffset(). Timezone offsets change throughout the year, so use @burglekitt/gmt zoned methods instead.",
        },
      ],
    },
  },
];
