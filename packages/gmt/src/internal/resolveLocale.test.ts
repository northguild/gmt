import { resolveLocale, resolveRequiredLocale } from "./resolveLocale";

describe("resolveLocale", () => {
  // ECMA-402 CanonicalizeLocaleList: a string is a one-tag list, tags are canonicalized and
  // de-duplicated, and the first tag with available locale data wins (Intl.DateTimeFormat
  // supportedLocalesOf); a list with none available keeps its first tag, as a lone string does.
  it.each`
    locales                        | expected
    ${"fr-FR"}                     | ${"fr-FR"}
    ${"EN-us"}                     | ${"en-US"}
    ${["fr-FR"]}                   | ${"fr-FR"}
    ${["fr-FR", "en-US"]}          | ${"fr-FR"}
    ${["en-US", "fr-FR"]}          | ${"en-US"}
    ${["xx-XX", "fr-FR"]}          | ${"fr-FR"}
    ${["xx-XX"]}                   | ${"xx-XX"}
    ${"en-US-u-fw-mon"}            | ${"en-US-u-fw-mon"}
    ${["en-US-u-fw-mon", "fr-FR"]} | ${"en-US-u-fw-mon"}
  `("returns $expected for locales $locales", ({ locales, expected }) => {
    expect(resolveLocale(locales)).toBe(expected);
  });

  // An empty list, like an omitted locale, is the default locale (ECMA-402 ResolveLocale).
  it.each`
    locales
    ${undefined}
    ${[]}
  `("returns the default locale for locales $locales", ({ locales }) => {
    expect(resolveLocale(locales)).toBe(
      new Intl.DateTimeFormat().resolvedOptions().locale,
    );
  });

  // A malformed tag anywhere in the list is a RangeError in ECMA-402, so the whole argument is invalid.
  it.each`
    locales
    ${""}
    ${"not a locale!!"}
    ${["fr-FR", "not a locale!!"]}
    ${["fr-FR", 42]}
    ${42}
    ${null}
    ${{}}
    ${true}
  `("returns null for invalid locales $locales", ({ locales }) => {
    expect(resolveLocale(locales)).toBeNull();
  });
});

describe("resolveRequiredLocale", () => {
  // A required locale: omitted and an empty list both name no locale (house rule; ECMA-402 would
  // pick the host default for []), anything else resolves as resolveLocale does.
  it.each`
    locales               | expected
    ${undefined}          | ${null}
    ${[]}                 | ${null}
    ${"EN-us"}            | ${"en-US"}
    ${["xx-XX", "fr-FR"]} | ${"fr-FR"}
    ${"not a locale!!"}   | ${null}
    ${42}                 | ${null}
  `("returns $expected for locales $locales", ({ locales, expected }) => {
    expect(resolveRequiredLocale(locales)).toBe(expected);
  });
});
