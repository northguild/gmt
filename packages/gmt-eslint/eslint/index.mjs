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
      ],
    },
  },
];
