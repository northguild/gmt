/**
 * Test files that still break a `dox-test` or Testing Library rule.
 *
 * Each path is listed by name, never by glob. The list may only shrink: a widget's test
 * leaves it when it moves onto the test kit. `lint/dox-test-rules.test.ts` fails if an entry is a glob.
 */
export const LEGACY_TEST_FILES = [];
