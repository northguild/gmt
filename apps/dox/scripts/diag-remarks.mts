import { join, relative, resolve } from "node:path";
import { readdirSync } from "node:fs";
import ts from "typescript";

const repoRoot = resolve(process.cwd(), "..", "..");
const gmtSrc = join(repoRoot, "packages", "gmt", "src");

const SKIP_DIRS = ["test", "internal"];
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.includes(entry.name)) continue;
      out.push(...walk(full));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !/\.(test|spec)\.ts$/.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(gmtSrc).sort();
const program = ts.createProgram(files, {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  noEmit: true,
  skipLibCheck: true,
  strict: false,
});
const checker = program.getTypeChecker();

const want = new Set([
  "RelativeUnit",
  "ZonedNowUnit",
  "UtcNowUnit",
  "UtcUnit",
  "UnixNowUnit",
  "TimeZoneNameStyle",
  "FormatUtcOptions",
  "FormatCalendarUnixOptions",
  "DstTransition",
]);
let found = 0;
for (const file of files) {
  const sf = program.getSourceFile(file);
  if (!sf) continue;
  for (const stmt of sf.statements) {
    const isType = ts.isTypeAliasDeclaration(stmt);
    const isInterface = ts.isInterfaceDeclaration(stmt);
    if (!(isType || isInterface)) continue;
    const name = stmt.name.text;
    if (!want.has(name)) continue;
    found++;
    const rel = relative(gmtSrc, file);
    console.log(
      `\n=== ${rel} :: ${name} (${isInterface ? "interface" : "type"}) ===`,
    );

    const symNode = checker.getSymbolAtLocation(stmt);
    const symName = stmt.name
      ? checker.getSymbolAtLocation(stmt.name)
      : undefined;
    const symDeclared = (stmt as any).symbol;
    const candidates: Array<[string, ts.Symbol | undefined]> = [
      ["getSymbolAtLocation(node)", symNode],
      ["getSymbolAtLocation(node.name)", symName],
      ["node.symbol", symDeclared],
    ];
    for (const [label, sym] of candidates) {
      if (!sym) {
        console.log(`  ${label}: (no symbol)`);
        continue;
      }
      const doc = sym.getDocumentationComment(checker);
      const raw = doc ? ts.displayPartsToString(doc) : "(none)";
      const tags = sym.getJsDocTags() ?? [];
      console.log(`  ${label}:`);
      console.log(
        "    description:\n" +
          raw
            .split("\n")
            .map((l: string) => "      | " + l)
            .join("\n"),
      );
      if (tags.length) {
        for (const t of tags) {
          const text = t.text ? ts.displayPartsToString(t.text) : "(no text)";
          console.log(
            `    @${t.name}:\n` +
              text
                .split("\n")
                .map((l: string) => "      | " + l)
                .join("\n"),
          );
        }
      } else {
        console.log("    tags: (empty)");
      }
    }
  }
}
console.log(`\n[found ${found} of ${want.size} target types across files]`);
