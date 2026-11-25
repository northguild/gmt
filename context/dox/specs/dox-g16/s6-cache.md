# Slice 6 · Hashed names for the large site files

Part of [DOX-G16](./index.md). The owner chose it after a load measurement of `/` at 1440×900.
- **Live site, first visit:** 139 requests, 594 KB compressed.
- **Second visit:** only the 28 KB page downloads again.
- **The one gap:** seven large files in `public/` have no content hash. They are served with `Cache-Control: public, max-age=0, must-revalidate`, so each visit pays a server round trip to check every one of them.
- **This slice:** gives them hashed names under `/gmt/_astro/`, where `src/assets-root/_headers` already serves `public, max-age=31536000, immutable`.
- **Not this story:** merging the 119 small script chunks.

## The files

| File (now in `public/`) | Size | Read by |
| --- | --- | --- |
| `earth-blue-marble.webp` | 529 KB | `src/lib/globe.ts` (`IMAGERY_URL`), `src/components/slides/Deck.astro` |
| `timezone-boundaries-globe.json` | 629 KB | `src/lib/globe.ts` (`BOUNDARIES_URL`) |
| `timezone-boundaries.json` | 159 KB | `src/lib/timezone-map.ts` |
| `timezone-boundaries-canada.json` | 354 KB | `src/lib/canada-map.ts` |
| `timezone-boundaries-morocco.json` | 187 KB | `src/lib/morocco-map.ts` |
| `timezone-boundaries-us.json` | 404 KB | `src/lib/sunshine-protection-act-mount.ts` (twice) |
| `state-boundaries-us.json` | 328 KB | `src/lib/sunshine-protection-act-mount.ts` |

## The change

- **Move the files.** Each one moves from `public/` to `src/assets/` under the same name, and each reader imports it with Vite's `?url`:
  `import imagery from "../assets/earth-blue-marble.webp?url";`
  That is the same mechanism `HeroSpace.astro` uses for the sky files.
  - The built name is `/gmt/_astro/<name>.<hash>.<ext>`.
  - Every file is over Vite's 4 kB inline limit, so none becomes a `data:` URI. Do not add `&no-inline`.
  - Drop the `withBase(...)` wrapper for these URLs; Vite's URL already includes the base. Confirm this in the built page and do not double the `/gmt`.
- **Writers.** These write to the new paths: `scripts/prepare-globe-imagery.py`, `prepare-globe-boundaries.py`, `prepare-timezone-boundaries.py`, `prepare-region-boundaries.py` and `build-og-earth.ts` (which reads the imagery). Their docstrings and help text name the new paths.
- **Gates and smoke.** No fixed URL is left for any of the seven files.
  - `scripts/globe-smoke.mjs` `IMAGERY_PATH` becomes a pattern on `/_astro/earth-blue-marble.` and the `.webp` ending. The reference-page row already matches the name by regex; keep it.
  - The three `scripts/deploy-smoke.mjs` rows for `timezone-boundaries-morocco.json`, `timezone-boundaries-us.json` and `state-boundaries-us.json` keep their body checks (licence, shape). Each finds the hashed URL the deployed tool page actually requests. The way it finds the URL lives once in the script and is shared by the three rows. Its `DOX_SMOKE_LOCAL` mode works the same way.
  - Any other test or script naming a public path is updated the same way. Find them with the grep below.
- **Docs.** Update `context/dox/built/` wherever these files are named by their `public/` path or URL (tier-4 globe, the boundary tools' tiers, tier-6 ops and runbooks), and add one line to tier-6 ops: "large site data lives in `src/assets/` and loads by `?url`, so it gets a hashed, immutable URL; `public/` is for files that need a fixed URL."
- **No other change.**
  - No preload is added.
  - Fetch timing is unchanged: the globe still fetches its imagery only on the WebGPU renderer.
  - The data does not change; each file's sha256 is the same before and after the move.

## Done when

- `rg -n "earth-blue-marble|timezone-boundaries|state-boundaries-us" apps/dox --glob '!node_modules' --glob '!dist'` shows no `public/` path, no `withBase("/…json")` and no fixed `/gmt/<file>` URL. The sha256 of each moved file matches its `public/` original (`git show HEAD:apps/dox/public/<file> | shasum -a 256`).
- `ls apps/dox/public` no longer lists the seven files.
- **Built site.** Serve `dist` with `npx serve@14.2.4` on a spare port, never 4321. Then:
  - `/gmt/`, `/gmt/tools/zoned-earth/` and each boundary tool page request their files from `/gmt/_astro/…` and get 200;
  - the globe draws its imagery (in WebGPU Chromium);
  - a tool's map draws.
- **The page weight, measured by dox-tester.** Use the CDP request count on `/gmt/` at 1440×900, cold and on a second visit in the same persistent profile, before and after this slice. On the second visit, none of the seven files goes to the network.
- Tests: `globe`, `timezone-map`, `canada-map`, `morocco-map`, `sunshine-protection-act` and `deploy-smoke`. The globe-smoke script passes `node --check`, dox `lint` and `check` pass, and the `globe-smoke` gate passes locally.
- dox-tester's duplication pass: the hashed-URL lookup in `deploy-smoke.mjs` exists once.
