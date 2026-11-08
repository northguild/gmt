import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  lastUpdatedLine,
  loadCommitDates,
  newestCommit,
  withLastUpdated,
} from "./commit-dates.mjs";

let repo = "";

/**
 * `newestCommit` honours these on purpose (a scratch tree reads history through them). The fixture
 * is its own repository, so they are removed while this file runs and restored after.
 */
const GIT_LOCATION = ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"] as const;
const saved: Partial<Record<(typeof GIT_LOCATION)[number], string>> = {};

/** Runs git in the fixture with a pinned identity, so no user config is read or written. */
function git(args: string[], date?: string) {
  execFileSync("git", args, {
    cwd: repo,
    stdio: "ignore",
    env: {
      PATH: process.env.PATH,
      HOME: repo,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@example.com",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@example.com",
      ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}),
    },
  });
}

function commit(files: Record<string, string>, date: string) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(repo, path, ".."), { recursive: true });
    writeFileSync(join(repo, path), text);
    git(["add", path]);
  }
  git(["commit", "-m", "c"], date);
}

beforeAll(() => {
  for (const name of GIT_LOCATION) {
    saved[name] = process.env[name];
    delete process.env[name];
  }
  repo = mkdtempSync(join(tmpdir(), "commit-dates-"));
  git(["init", "-q", "-b", "main"]);
  commit({ "a/one.ts": "1", "a/two.ts": "1" }, "2026-01-01T10:00:00Z");
  commit({ "a/one.ts": "2" }, "2026-02-03T04:05:06Z");
  writeFileSync(join(repo, "untracked.ts"), "x");
});

afterAll(() => {
  for (const name of GIT_LOCATION) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
  rmSync(repo, { recursive: true, force: true });
});

describe("newestCommit", () => {
  it("gives the newest commit of a path as a UTC instant", () => {
    expect(newestCommit(["a/one.ts"], { cwd: repo })).toBe(
      "2026-02-03T04:05:06.000Z",
    );
    expect(newestCommit(["a/two.ts"], { cwd: repo })).toBe(
      "2026-01-01T10:00:00.000Z",
    );
  });

  it("gives the newest of several paths", () => {
    expect(newestCommit(["a/two.ts", "a/one.ts"], { cwd: repo })).toBe(
      "2026-02-03T04:05:06.000Z",
    );
  });

  it("gives undefined for a path with no commit", () => {
    expect(newestCommit(["untracked.ts"], { cwd: repo })).toBeUndefined();
    expect(newestCommit(["nowhere.ts"], { cwd: repo })).toBeUndefined();
    expect(newestCommit([], { cwd: repo })).toBeUndefined();
  });

  it("ignores a path with no commit beside one that has", () => {
    expect(newestCommit(["untracked.ts", "a/two.ts"], { cwd: repo })).toBe(
      "2026-01-01T10:00:00.000Z",
    );
  });

  it("reads a path once it is loaded", () => {
    loadCommitDates(["a/one.ts", "a/two.ts"], { cwd: repo });
    expect(newestCommit(["a/one.ts"], { cwd: repo })).toBe(
      "2026-02-03T04:05:06.000Z",
    );
  });

  it("gives undefined outside a repository", () => {
    const bare = mkdtempSync(join(tmpdir(), "commit-dates-bare-"));
    try {
      expect(newestCommit(["a/one.ts"], { cwd: bare })).toBeUndefined();
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});

describe("frontmatter line", () => {
  it("writes the instant, or false", () => {
    expect(lastUpdatedLine("2026-01-01T10:00:00.000Z")).toBe(
      "lastUpdated: 2026-01-01T10:00:00.000Z",
    );
    expect(lastUpdatedLine(undefined)).toBe("lastUpdated: false");
  });

  it("goes at the end of the frontmatter", () => {
    expect(
      withLastUpdated(
        '---\ntitle: "x"\n---\n\nbody\n',
        "2026-01-01T00:00:00.000Z",
      ),
    ).toBe(
      '---\ntitle: "x"\nlastUpdated: 2026-01-01T00:00:00.000Z\n---\n\nbody\n',
    );
  });

  it("refuses a page without frontmatter", () => {
    expect(() => withLastUpdated("body", undefined)).toThrow(/frontmatter/);
  });
});
