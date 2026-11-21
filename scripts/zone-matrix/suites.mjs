/**
 * The nine suites. Each is pinned to a commit that is checked after the clone, so a moved tag
 * cannot change what is measured. Tests are started with `node <binary>` directly, never through
 * the suite's package scripts: a script can pin a zone or a Node version (a `.npmrc`
 * `use-node-version`, `cross-env TZ=`) and the runner must set both itself.
 *
 * - `argv({ out, workers })` gives the arguments after `node`, and the directory to run in
 *   (relative to the checkout). `out` is the report file for the JSON suites.
 * - `display` is the command as the page shows it, `ownCommand` the one the project documents.
 * - `reference` is the zone the project's own CI runs in: `{ zone, source: { file, pattern } }`
 *   and the runner confirms the pattern is in the file. No pin means UTC, source null.
 */

const jest =
  (extra = []) =>
  ({ out, workers }) => ({
    cwd: ".",
    args: [
      "node_modules/jest/bin/jest.js",
      "--json",
      `--outputFile=${out}`,
      `--maxWorkers=${workers}`,
      ...extra,
    ],
  });

export const SUITES = [
  {
    id: "moment",
    name: "Moment.js",
    version: "2.31.0",
    repository: "https://github.com/moment/moment",
    tag: "2.31.0",
    commit: "15b45d48a176312e8f34143c5a800090abf4787f",
    install: [{ cmd: "pnpm", args: ["install", "--frozen-lockfile"] }],
    // `scripts/test.js` deletes and rebuilds `build/qunit/` in the clone on every run, so two runs
    // at once break each other (measured: 194 and 909 failed tests beside a clean run).
    serial: true,
    display: "node scripts/test.js",
    ownCommand: "npm test",
    parser: "qunit",
    reference: { zone: "UTC", source: null },
    argv: () => ({ cwd: ".", args: ["scripts/test.js"] }),
  },
  {
    id: "luxon",
    name: "Luxon",
    version: "3.7.2",
    repository: "https://github.com/moment/luxon",
    tag: "3.7.2",
    commit: "4262a38ded7762e22608a9feb9f117b40d338ced",
    install: [{ cmd: "npm", args: ["ci", "--ignore-scripts"] }],
    display: "jest --json --maxWorkers=2",
    ownCommand: "npm test",
    parser: "json",
    reference: {
      zone: "America/New_York",
      source: {
        file: ".github/workflows/test.yml",
        pattern: "TZ: America/New_York",
      },
    },
    argv: jest(),
  },
  {
    id: "date-fns",
    name: "date-fns",
    version: "4.4.0",
    repository: "https://github.com/date-fns/date-fns",
    tag: "v4.4.0",
    commit: "cd53d2538cfa318404eff7ade6449b49bf34562e",
    install: [
      {
        cmd: "pnpm",
        args: ["install", "--frozen-lockfile", "--ignore-scripts"],
      },
    ],
    display: "vitest run --project main --reporter=json --maxWorkers=2",
    ownCommand: "pnpm test",
    parser: "json",
    reference: { zone: "UTC", source: null },
    argv: ({ out, workers }) => ({
      cwd: "pkgs/core",
      args: [
        "node_modules/vitest/vitest.mjs",
        "run",
        "--project",
        "main",
        "--reporter=json",
        `--outputFile=${out}`,
        `--maxWorkers=${workers}`,
      ],
    }),
  },
  {
    id: "dayjs",
    name: "Day.js",
    version: "1.11.23",
    repository: "https://github.com/iamkun/dayjs",
    tag: "v1.11.23",
    commit: "4549b8d03307891143e8a50d39fcdab1f16f77cf",
    install: [{ cmd: "npm", args: ["ci", "--ignore-scripts"] }],
    display: "jest --json --coverage=false --maxWorkers=2",
    ownCommand: "npm test",
    parser: "json",
    reference: { zone: "UTC", source: null },
    argv: jest(["--coverage=false"]),
  },
  {
    id: "spacetime",
    name: "Spacetime",
    version: "7.17.1",
    repository: "https://github.com/spencermountain/spacetime",
    tag: "7.17.1",
    commit: "35fbb59fda93f3686f6faee0f1e40e297950a5a8",
    install: [
      {
        cmd: "pnpm",
        args: ["install", "--frozen-lockfile", "--ignore-scripts"],
      },
    ],
    display: "node --import tsx tests/_lib/run.ts tests",
    ownCommand: "npm test",
    parser: "tap",
    reference: { zone: "UTC", source: null },
    argv: () => ({
      cwd: ".",
      args: ["--import", "tsx", "tests/_lib/run.ts", "tests"],
    }),
  },
  {
    id: "internationalized-date",
    name: "@internationalized/date",
    version: "3.12.4",
    repository: "https://github.com/adobe/react-spectrum",
    tag: "@internationalized/date@3.12.4",
    commit: "f56660b234bd588751c9f35b85d6fe6e17e45ccf",
    install: [
      {
        cmd: "node",
        args: [".yarn/releases/yarn-4.18.0.cjs", "install", "--immutable"],
      },
    ],
    display:
      "jest packages/@internationalized/date/tests/ --json --maxWorkers=2",
    ownCommand: "yarn jest packages/@internationalized/date",
    parser: "json",
    reference: { zone: "UTC", source: null },
    argv: ({ out, workers }) => ({
      cwd: ".",
      args: [
        "node_modules/jest/bin/jest.js",
        "packages/@internationalized/date/tests/",
        "--json",
        `--outputFile=${out}`,
        `--maxWorkers=${workers}`,
      ],
    }),
  },
  {
    id: "js-temporal",
    name: "@js-temporal/polyfill",
    version: "0.5.1",
    repository: "https://github.com/js-temporal/temporal-polyfill",
    tag: "v0.5.1",
    commit: "f3c07e503632ddf7ff918066f2eb30a9dcfa06ff",
    install: [
      { cmd: "npm", args: ["ci", "--ignore-scripts", "--no-optional"] },
      { cmd: "npm", args: ["run", "build"] },
    ],
    display:
      "node --no-warnings --loader ./test/resolve.source.mjs ./test/all.mjs",
    ownCommand: "npm test",
    parser: "demitasse",
    reference: { zone: "UTC", source: null },
    argv: () => ({
      cwd: ".",
      args: [
        "--no-warnings",
        "--loader",
        "./test/resolve.source.mjs",
        "./test/all.mjs",
      ],
    }),
  },
  {
    id: "temporal-polyfill",
    name: "temporal-polyfill",
    version: "1.0.8",
    repository: "https://github.com/fullcalendar/temporal-polyfill",
    // The repository has no tag for 1.0.8; this is the commit that bumps it.
    tag: null,
    commit: "cc7bffcc6c5d6b447210588630226ceef8e704e2",
    install: [
      // As the project's CI does (.github/workflows/ci.yml): check out the submodules, install, then
      // build every package, so the tests that load the built polyfill find it. Only the two
      // submodules the build reads are fetched; the others hold test262 and locale sources.
      {
        cmd: "git",
        args: [
          "submodule",
          "update",
          "--init",
          "--depth=1",
          "misc/terser",
          "misc/export-size",
        ],
      },
      {
        cmd: "pnpm",
        args: ["install", "--frozen-lockfile"],
        pnpm: "10.26.0",
      },
      { cmd: "pnpm", args: ["run", "build"], pnpm: "10.26.0" },
    ],
    display: "vitest run --reporter=json (polyfill/)",
    ownCommand: "pnpm test",
    parser: "json",
    reference: {
      zone: "America/New_York",
      source: {
        file: ".github/workflows/ci.yml",
        pattern: 'TZ: "America/New_York"',
      },
    },
    // Vitest 1.x rejects --maxWorkers; it takes the pool options.
    argv: ({ out, workers }) => ({
      cwd: "polyfill",
      args: [
        "node_modules/vitest/vitest.mjs",
        "run",
        "--reporter=json",
        `--outputFile=${out}`,
        `--poolOptions.threads.maxThreads=${workers}`,
        "--poolOptions.threads.minThreads=1",
      ],
    }),
  },
  {
    // The control. Run from this working tree, not a clone; the commit is read at run time.
    id: "gmt",
    name: "GMT",
    version: null,
    repository: "https://github.com/northguild/gmt",
    tag: null,
    commit: null,
    local: true,
    install: [],
    display:
      "vitest run --config packages/gmt/vitest.config.ts --reporter=json",
    ownCommand:
      "pnpm -w exec vitest run --config packages/gmt/vitest.config.ts",
    parser: "json",
    reference: { zone: "UTC", source: null },
    argv: ({ out, workers }) => ({
      cwd: ".",
      args: [
        "node_modules/vitest/vitest.mjs",
        "run",
        "--config",
        "packages/gmt/vitest.config.ts",
        "--reporter=json",
        `--outputFile=${out}`,
        `--maxWorkers=${workers}`,
      ],
    }),
  },
];
