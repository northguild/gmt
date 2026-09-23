/**
 * `JSON.stringify(…, 2)` laid out the way oxfmt lays it out (`printWidth` 80): an array of
 * primitives that fits on its line is written inline. Writing plain `JSON.stringify` output
 * left `validate` green and the CI format check red after every generator run that changed a
 * value. Shared by `scripts/stats.mjs` and `scripts/upstream.mjs`, which both write committed
 * JSON the formatter checks.
 */
export function formatJson(value) {
  const text = JSON.stringify(value, null, 2).replace(
    /^( *)("[^"\n]+": )\[\n((?: *(?:"[^"\n]*"|[-\d.]+|true|false|null),?\n)+) *\]/gm,
    (whole, indent, key, body) => {
      const items = body
        .split("\n")
        .filter(Boolean)
        .map((line) => line.trim().replace(/,$/, ""));
      const inline = `${indent}${key}[${items.join(", ")}]`;
      return inline.length + 1 <= 80 ? inline : whole;
    },
  );
  return `${text}\n`;
}
