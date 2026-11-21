import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  overrideOf,
  parseProbeLine,
  sameZone,
  scanPins,
  zoneOfPin,
} from "./pins.mjs";

test("scanPins finds script, CI and code pins with file, line and text", () => {
  const pins = scanPins([
    {
      file: "package.json",
      text: '{\n "test": "cross-env TZ=Pacific/Auckland jest",\n "x": "TZ=UTC node a"\n}',
    },
    {
      file: ".github/workflows/test.yml",
      text: "env:\n  TZ: America/New_York\n",
    },
    { file: "test/a.js", text: "const a = 1\nprocess.env.TZ = 'Asia/Tokyo'\n" },
    { file: "test/b.js", text: "const TZone = process.env.TZ\n" },
  ]);
  assert.deepEqual(
    pins.map((p) => [p.file, p.line, p.level]),
    [
      ["package.json", 2, "script"],
      ["package.json", 3, "script"],
      [".github/workflows/test.yml", 2, "script"],
      ["test/a.js", 2, "code"],
    ],
  );
  assert.equal(pins[0].text, '"test": "cross-env TZ=Pacific/Auckland jest",');
});

test("zoneOfPin reads the zone a pin names", () => {
  assert.equal(zoneOfPin("TZ: America/New_York"), "America/New_York");
  assert.equal(
    zoneOfPin("cross-env TZ=Pacific/Auckland jest"),
    "Pacific/Auckland",
  );
  assert.equal(zoneOfPin("no pin here"), null);
});

test("sameZone compares canonical names", () => {
  assert.ok(sameZone("Asia/Kolkata", "Asia/Calcutta"));
  assert.ok(!sameZone("UTC", "Europe/London"));
});

const line = (start, end = start) => JSON.stringify({ start, end });

test("overrideOf is null when every process kept the zone it started in", () => {
  assert.equal(
    overrideOf(
      "Pacific/Apia",
      [line("Pacific/Apia"), line("Pacific/Apia")],
      [],
    ),
    null,
  );
  // ICU may name the zone by an alias.
  assert.equal(overrideOf("Asia/Kolkata", [line("Asia/Calcutta")], []), null);
});

test("overrideOf: fixture children a test starts with their own TZ are not an override", () => {
  // Spacetime's tests/integration/host-timezone.test.ts starts child processes with an explicit
  // TZ; the test process itself keeps the requested zone.
  const seen = [
    line("UTC"),
    line("America/Toronto"),
    line("Europe/Berlin"),
    line("Australia/Lord_Howe"),
    line("Asia/Katmandu"),
    line("Asia/Calcutta"),
  ];
  assert.equal(overrideOf("Asia/Kolkata", seen, []), null);
});

test("overrideOf names the zone a process switched to, and the pin", () => {
  assert.deepEqual(
    overrideOf(
      "Pacific/Apia",
      [line("Pacific/Apia"), line("Pacific/Apia", "Asia/Tokyo")],
      [{ file: "a.js", line: 4 }],
    ),
    { file: "a.js", line: 4, zone: "Asia/Tokyo" },
  );
});

test("overrideOf: a run where no process started in the requested zone is an override", () => {
  assert.deepEqual(overrideOf("UTC", [line("Asia/Tokyo")], []), {
    file: null,
    line: null,
    zone: "Asia/Tokyo",
  });
});

test("parseProbeLine rejects a line the probe did not write", () => {
  assert.deepEqual(parseProbeLine(line("UTC", "Asia/Tokyo")), {
    start: "UTC",
    end: "Asia/Tokyo",
  });
  assert.throws(() => parseProbeLine("UTC"));
});

/** Runs `code` under the real probe and returns its lines. */
function probe(code, tz) {
  const dir = mkdtempSync(join(tmpdir(), "zm-probe-"));
  const out = join(dir, "zones.txt");
  const probeUrl = new URL("./probe.mjs", import.meta.url).href;
  try {
    execFileSync(process.execPath, ["-e", code], {
      env: {
        ...process.env,
        TZ: tz,
        ZONE_PROBE_FILE: out,
        NODE_OPTIONS: `--import=${probeUrl}`,
      },
    });
    return readFileSync(out, "utf8").split("\n").filter(Boolean);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("the probe: a child started with its own TZ is not an override", () => {
  const seen = probe(
    `require("node:child_process").execFileSync(process.execPath, ["-e", "1"], { env: { ...process.env, TZ: "America/Toronto" } })`,
    "Asia/Kolkata",
  );
  assert.equal(seen.length, 2);
  assert.equal(overrideOf("Asia/Kolkata", seen, []), null);
});

test("the probe: process.env.TZ set in the test process is an override", () => {
  const seen = probe(`process.env.TZ = "Asia/Tokyo"`, "Asia/Kolkata");
  assert.deepEqual(overrideOf("Asia/Kolkata", seen, []), {
    file: null,
    line: null,
    zone: "Asia/Tokyo",
  });
});
