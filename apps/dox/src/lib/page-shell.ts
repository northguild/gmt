/**
 * One client chunk for the scripts that run on every page.
 *
 * The shared layout mounts four components on every page, each with a `<script>` and its static
 * imports. Left alone, Rolldown splits those into many small chunks and a longer import chain.
 * `pageShellGroup()` merges them into `_astro/page-shell.<hash>.js`. Every module in it was already
 * on every page's initial load, so no page loads code it did not load before. Rolldown's
 * `entriesAware` merging is not used: it loads code onto pages that never used it.
 *
 * Rolldown has no tag for a named entry, so the list is kept by hand;
 * `scripts/page-shell-built.test.ts` fails when it and the every-page scripts differ, reading the
 * graph `recordClientChunks()` writes. The group goes on `vite.environments.client` only: Astro
 * spreads `vite.build` into the ssr and prerender builds too, and a merge there breaks them.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** The Rolldown group the config takes: a name and a test on the module id. */
interface PageShellGroup {
  name: string;
  test: (id: string) => boolean;
}

/** The part of a Vite plugin `recordClientChunks()` needs. */
interface ChunkRecorder {
  name: string;
  generateBundle(
    this: {
      environment: { name: string };
      getModuleInfo(id: string): { importedIds: readonly string[] } | null;
    },
    options: unknown,
    bundle: Record<string, unknown>,
  ): void;
}

/** Where the graph is written. `src/generated/` is gitignored and never deployed. */
const CLIENT_CHUNKS_PATH = fileURLToPath(
  new URL("../generated/client-chunks.json", import.meta.url),
);

/**
 * Path suffix of each component whose script runs on every page. The shared layout mounts each
 * one: `Head` (the head tags and early scripts), `SettingsControl` (the header's settings),
 * `EscLayers` (the Escape key for every open layer) and Starlight's `Search` (the search dialog).
 */
export const PAGE_SHELL_SCRIPTS: readonly string[] = [
  "/src/components/Head.astro",
  "/src/components/SettingsControl.astro",
  "/src/components/EscLayers.astro",
  "/@astrojs/starlight/components/Search.astro",
];

/** Whether a module id is the `<script>` of one of the shell's components. */
function isShellScript(id: string): boolean {
  const [path = "", query = ""] = id.replaceAll("\\", "/").split("?");
  return (
    query.startsWith("astro&type=script") &&
    PAGE_SHELL_SCRIPTS.some((suffix) => path.endsWith(suffix))
  );
}

/** The Rolldown group that merges the shell scripts and their static imports into one chunk. */
export function pageShellGroup(): PageShellGroup {
  return { name: "page-shell", test: isShellScript };
}

/** A module id as a repo-relative path, so the graph does not hold this machine's folders. */
function relativeId(id: string): string {
  const path = id.replaceAll("\\", "/");
  const at = /(apps\/dox\/|packages\/gmt\/|node_modules\/\.pnpm\/)/.exec(path);
  return at === null ? path : path.slice(at.index);
}

/** The slice of a Rolldown output chunk the graph keeps. */
interface BundleChunk {
  type: string;
  fileName: string;
  modules: Record<string, unknown>;
  imports: string[];
  dynamicImports: string[];
  isEntry: boolean;
  facadeModuleId: string | null;
}

/**
 * A Vite plugin that, in the client build only, writes each chunk's modules, their static
 * imports, the chunk's imports, dynamic imports, entry flag and facade to `path`, with no code and no sizes.
 */
export function recordClientChunks(path = CLIENT_CHUNKS_PATH): ChunkRecorder {
  return {
    name: "page-shell-record-client-chunks",
    generateBundle(_options, bundle) {
      if (this.environment.name !== "client") return;
      const graph: Record<string, unknown> = {};
      for (const item of Object.values(bundle) as BundleChunk[]) {
        if (item.type !== "chunk") continue;
        const ids = Object.keys(item.modules);
        graph[item.fileName] = {
          modules: ids.map(relativeId),
          // Each module's static imports: the edges the built-site test walks.
          moduleImports: Object.fromEntries(
            ids.map((id) => [
              relativeId(id),
              (this.getModuleInfo(id)?.importedIds ?? []).map(relativeId),
            ]),
          ),
          imports: item.imports,
          dynamicImports: item.dynamicImports,
          isEntry: item.isEntry,
          facade: item.facadeModuleId && relativeId(item.facadeModuleId),
        };
      }
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${JSON.stringify(graph, null, 2)}\n`);
    },
  };
}
