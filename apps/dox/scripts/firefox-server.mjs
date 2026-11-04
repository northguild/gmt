#!/usr/bin/env node
/**
 * Starts, stops and checks the Docker container that gives the gates a Firefox on a Mac where
 * Playwright's own Firefox does not launch (macOS 27).
 *
 *   node scripts/firefox-server.mjs start   # docker run, then wait for the port
 *   node scripts/firefox-server.mjs check   # needs GMT_PW_FIREFOX_WS and a built dist
 *   node scripts/firefox-server.mjs stop
 *
 * `pnpm --filter dox firefox-server <command>` runs the same. The runbook is
 * `context/dox/built.md` § Runbooks, "Firefox on macOS 27 (Docker route)".
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./lib/browser-launch.mjs";
import { serveStatic } from "./lib/static-server.mjs";

const NAME = "gmt-pw-fx";
const PORT = 3555;
const READY_MS = 60_000;
const POLL_MS = 250;

/** The version of the installed `@playwright/test`; the server must match it. */
export function playwrightVersion() {
  const require = createRequire(import.meta.url);
  return JSON.parse(
    readFileSync(require.resolve("@playwright/test/package.json"), "utf8"),
  ).version;
}

export function dockerRunArgs(version, port = PORT) {
  return [
    "run",
    "-d",
    "--rm",
    "--name",
    NAME,
    "-p",
    `127.0.0.1:${port}:${port}`,
    "--init",
    "--ipc=host",
    `mcr.microsoft.com/playwright:v${version}-noble`,
    "/bin/sh",
    "-c",
    `cd /tmp && npx -y playwright@${version} run-server --port ${port} --host 0.0.0.0`,
  ];
}

export function dockerStopArgs() {
  return ["stop", NAME];
}

function docker(args) {
  return spawnSync("docker", args, { encoding: "utf8" });
}

/** Resolves true when the port accepts a TCP connection. */
function canConnect(port) {
  return new Promise((done) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      done(true);
    });
    socket.once("error", () => done(false));
  });
}

/** Resolves true when the port accepts a WebSocket upgrade. */
async function acceptsWebSocket(port) {
  return new Promise((done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/`);
    ws.addEventListener("open", () => {
      ws.close();
      done(true);
    });
    ws.addEventListener("error", () => done(false));
  });
}

async function start() {
  const probe = docker(["version", "--format", "{{.Server.Version}}"]);
  if (probe.error || probe.status !== 0) {
    console.error(
      "firefox-server: docker is missing or its daemon is not running.",
    );
    return 1;
  }
  const running = docker(["ps", "-q", "--filter", `name=^${NAME}$`]);
  if (running.stdout.trim() !== "") {
    console.log(`firefox-server: ${NAME} is already running.`);
    return 0;
  }
  const run = docker(dockerRunArgs(playwrightVersion()));
  if (run.status !== 0) {
    console.error(`firefox-server: docker run failed: ${run.stderr.trim()}`);
    return 1;
  }
  for (let attempt = 0; attempt < READY_MS / POLL_MS; attempt++) {
    if ((await canConnect(PORT)) && (await acceptsWebSocket(PORT))) {
      console.log(`firefox-server: ${NAME} ready on ws://127.0.0.1:${PORT}/`);
      return 0;
    }
    await new Promise((done) => setTimeout(done, POLL_MS));
  }
  console.error(
    `firefox-server: ${NAME} did not accept a connection within ${READY_MS / 1000} s.`,
  );
  return 1;
}

function stop() {
  const result = docker(dockerStopArgs());
  if (result.error) {
    console.error("firefox-server: docker is missing.");
    return 1;
  }
  console.log(`firefox-server: ${NAME} stopped.`);
  return 0;
}

async function check() {
  if (!process.env.GMT_PW_FIREFOX_WS?.trim()) {
    console.error(
      "firefox-server: set GMT_PW_FIREFOX_WS=ws://127.0.0.1:3555/ first.",
    );
    return 1;
  }
  const dist = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "dist",
  );
  if (!existsSync(path.join(dist, "gmt", "index.html"))) {
    console.error(
      "firefox-server: dist/gmt/index.html is missing; build first.",
    );
    return 1;
  }
  let server;
  let browser;
  let page;
  try {
    server = await serveStatic(dist, 0);
    const url = `http://127.0.0.1:${server.address().port}/gmt/`;
    browser = await launchBrowser("firefox");
    page = await browser.newPage();
    const response = await page.goto(url);
    const title = await page.title();
    if (response?.status() !== 200 || title === "") {
      console.error(
        `firefox-server: ${url} answered ${response?.status()} with title "${title}".`,
      );
      return 1;
    }
    console.log(`Firefox ${browser.version()} (Linux) reached ${url}`);
    return 0;
  } finally {
    await page?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await new Promise((done) => (server ? server.close(done) : done()));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  const commands = { start, stop, check };
  if (!commands[command]) {
    console.error("usage: firefox-server.mjs start|stop|check");
    process.exit(1);
  }
  process.exitCode = await commands[command]();
}
