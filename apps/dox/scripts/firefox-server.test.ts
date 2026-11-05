import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  dockerRunArgs,
  dockerStopArgs,
  playwrightVersion,
} from "./firefox-server.mjs";

describe("firefox-server", () => {
  it("builds the docker run command exactly", () => {
    expect(dockerRunArgs("1.63.0")).toEqual([
      "run",
      "-d",
      "--rm",
      "--name",
      "gmt-pw-fx",
      "-p",
      "127.0.0.1:3555:3555",
      "--init",
      "--ipc=host",
      "mcr.microsoft.com/playwright:v1.63.0-noble",
      "/bin/sh",
      "-c",
      "cd /tmp && npx -y playwright@1.63.0 run-server --port 3555 --host 0.0.0.0",
    ]);
  });

  it("takes the image tag, the npx version and the port from its arguments", () => {
    const args = dockerRunArgs("2.1.9", 4000);
    expect(args).toContain("mcr.microsoft.com/playwright:v2.1.9-noble");
    expect(args).toContain("127.0.0.1:4000:4000");
    expect(args.at(-1)).toBe(
      "cd /tmp && npx -y playwright@2.1.9 run-server --port 4000 --host 0.0.0.0",
    );
  });

  it("stops the named container", () => {
    expect(dockerStopArgs()).toEqual(["stop", "gmt-pw-fx"]);
  });

  it("reads the installed Playwright version", () => {
    const version = playwrightVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    const require = createRequire(import.meta.url);
    const pkg = JSON.parse(
      readFileSync(require.resolve("@playwright/test/package.json"), "utf8"),
    );
    expect(version).toBe(pkg.version);
  });
});
