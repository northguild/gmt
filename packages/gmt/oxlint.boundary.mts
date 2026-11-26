/**
 * Shared `no-restricted-imports` options for the library (coding-standards § Loop cost).
 *
 * An override's options replace the earlier override's options for the same rule, so the
 * polyfill ban is repeated inside every rule object here. Two oxlint facts shape the globs:
 * `patterns[].regex` has no look-around (Rust `regex`), so exceptions are `!` negations in a
 * gitignore-style `group`; and `../*` does not reach `../validate/isValidDate`, so use `../**`.
 */
const CORE_DIRS = ["internal", "regex", "types"];
const POLYFILL_MESSAGE =
  "GMT runs on temporal-polyfill; import Temporal from internal/temporal";
const POLYFILL = { name: "@js-temporal/polyfill", message: POLYFILL_MESSAGE };
/** Either polyfill's subpaths, and `temporal-polyfill` itself: only `internal/temporal.ts` names it. */
const POLYFILL_PATTERNS = [
  { group: ["@js-temporal/polyfill/**"], message: POLYFILL_MESSAGE },
  {
    group: ["temporal-polyfill", "temporal-polyfill/**"],
    message: "Import Temporal from internal/temporal",
  },
];

/** Bans value imports under `prefixes`, except from the core directories, at any depth below `src/`. */
function coreOnly(prefixes: string[], message: string) {
  // `../**` does not match the bare specifier `..` (a barrel), so the directory itself is listed too.
  const group = prefixes.flatMap((p) => [`${p}**`, p.replace(/\/$/, "")]);
  for (const up of ["../", "../../", "../../../"]) {
    for (const dir of CORE_DIRS) group.push(`!${up}${dir}`, `!${up}${dir}/**`);
  }
  return [
    "error",
    {
      paths: [POLYFILL],
      patterns: [
        ...POLYFILL_PATTERNS,
        { group, allowTypeImports: true, message },
      ],
    },
  ] as const;
}

/** A public function never calls another public function; both call the core. */
export const PUBLIC_RULE = coreOnly(
  ["./", "../"],
  "A public function never calls another public function; both call the core (coding-standards § Loop cost).",
);

/** For files directly in `src/internal`, `src/regex` and `src/types`. */
export const CORE_RULE = coreOnly(
  ["../"],
  "An internal core never imports a public module (coding-standards § Loop cost).",
);

/** For `src/internal/temporalCompat/*` and `src/internal/zonedDifference/*`. */
export const CORE_NESTED_RULE = coreOnly(
  ["../../"],
  "An internal core never imports a public module (coding-standards § Loop cost).",
);

/** The polyfill ban alone (CORE-80). */
export const POLYFILL_RULE = [
  "error",
  { paths: [POLYFILL], patterns: POLYFILL_PATTERNS },
] as const;
