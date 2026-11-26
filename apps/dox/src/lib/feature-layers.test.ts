/**
 * Shared layers never name a feature (`context/dox/built/index.md`, Reuse, never reinvent, rule 3).
 *
 * A feature of a family — a slide deck today — keeps its content in its own folder,
 * `src/slides/<slug>/`. The shared code that serves every member of the family reaches that
 * folder only through the family's registries, the files beside the folders (`decks.ts`,
 * `deck-runtime.ts`, `deck-pages.ts`). So no file in a shared layer may import a feature's folder
 * or spell a feature's slug, comments included: a second deck must not have to edit them.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const DOX = path.resolve(import.meta.dirname, "..", "..");

/** Each family's root: one folder per feature, registries beside them. */
const FAMILIES = ["src/slides"];

/** The layers that serve every feature. */
const SHARED = [
  "src/lib",
  "src/components",
  "src/widgets",
  "src/styles",
  "src/pages",
  "src/test",
  "scripts",
];

const SOURCE = /\.(ts|tsx|mts|mjs|js|astro|css)$/;

const features = FAMILIES.flatMap((family) =>
  readdirSync(path.join(DOX, family))
    .filter((name) => statSync(path.join(DOX, family, name)).isDirectory())
    .map((slug) => ({ family, slug })),
);

const sharedFiles = SHARED.flatMap((layer) =>
  readdirSync(path.join(DOX, layer), { recursive: true, encoding: "utf8" })
    .filter((file) => SOURCE.test(file))
    .map((file) => path.join(layer, file)),
);

describe("shared layers", () => {
  it("finds the features and the shared files", () => {
    expect(features.length).toBeGreaterThan(0);
    expect(sharedFiles.length).toBeGreaterThan(100);
  });

  it.each(features)("never name the $family/$slug feature", ({ slug }) => {
    const offenders = sharedFiles.flatMap((file) =>
      readFileSync(path.join(DOX, file), "utf8")
        .split("\n")
        .flatMap((line, i) =>
          line.includes(slug) ? [`${file}:${i + 1}`] : [],
        ),
    );
    expect(offenders).toEqual([]);
  });

  it.each(FAMILIES)("never import a feature folder under %s", (family) => {
    const alias = family.replace(/^src\//, "~/");
    const into = new RegExp(
      `(from|import\\()\\s*["'](${alias}|[./]*${family.replace(/^src\//, "")})/[^/"']+/`,
    );
    const offenders = sharedFiles.flatMap((file) =>
      readFileSync(path.join(DOX, file), "utf8")
        .split("\n")
        .flatMap((line, i) => (into.test(line) ? [`${file}:${i + 1}`] : [])),
    );
    expect(offenders).toEqual([]);
  });
});
