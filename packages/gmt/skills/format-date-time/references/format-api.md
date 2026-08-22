# Format API Reference

## Locale Matrix

Supported locales for formatting:

| Locale | Date Format | Time Format |
|--------|------------|-------------|
| en-US | 3/15/2024 | 2:30:45 PM |
| en-GB | 15/03/2024 | 14:30:45 |
| de-DE | 15.3.2024 | 14:30:45 |
| fr-FR | 15/03/2024 | 14:30:45 |
| es-ES | 15/3/2024 | 14:30:45 |
| it-IT | 15/03/2024 | 14:30:45 |
| pt-PT | 15/03/2024 | 14:30:45 |
| sv-SE | 2024-03-15 | 14:30:45 |
| is-IS | 15.3.2024 | 14:30:45 |
| zh-CN | 2024/3/15 | 下午2:30:45 |
| zh-TW | 2024/3/15 | 下午2:30:45 |
| ja-JP | 2024/3/15 | 14:30:45 |
| ko-KR | 2024. 3. 15. | 오후 2:30:45 |
| ar-SA | ١٥‏/٣‏/٢٠٢٤ | ٢:٣٠:٤٥ م |
| he-IL | 15/03/2024 | 14:30:45 |
| ru-RU | 15.03.2024 | 14:30:45 |
| tr-TR | 15.03.2024 | 14:30:45 |

## Runtime ICU data

These formatters delegate locale rendering to the host runtime's `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat`. Output therefore depends on the ICU data shipped with the running Node (or browser):

- **Full ICU** runtimes (official Node binaries from nodejs.org, all modern browsers) return fully localized strings — e.g. `formatTime("14:30:00", "ko-KR", { timeStyle: "short" })` returns `"오후 2:30"`.
- **Small/partial ICU** runtimes (some Node builds compiled with `--with-intl=small-icu` or repackaged distributions) fall back to English day periods and other locale data — the same call may return `"PM 2:30"`.

This is a property of the runtime, not gmt. For consistent non-English output, deploy on a full-ICU Node build or polyfill `Intl` with a package that bundles locale data.
