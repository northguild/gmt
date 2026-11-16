/**
 * The note a tool adds when the call left out arguments the page seeds from its first example.
 * One sentence, so the model sees which values it did not choose.
 */
export const seedNote = (names: readonly string[]): string =>
  `${names.join(", ")} ${names.length === 1 ? "was" : "were"} not given, so the page's starting ${names.length === 1 ? "value was" : "values were"} used.`;
