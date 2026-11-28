/**
 * The crawl policy of https://northguild.dev/robots.txt, as data and a check.
 *
 * The file has two groups. `*` (with Applebot) leaves everything open except the API paths, so AI
 * agents read the `.md` twins and `llms*.txt`. `Googlebot` and `Bingbot` have a group of their own
 * that also skips the `.md` twins and every page URL with a query, which are crawls that never
 * reach the index. A crawler with its own group ignores `*` entirely (RFC 9309 §2.2.1; Google,
 * "Order of precedence for user agents"), so that group repeats every `*` rule and the
 * `Content-Signal` line. Applebot follows the `Googlebot` group when no group names it (Apple,
 * "About Applebot"), so the `*` group names it.
 *
 * Used by `deploy-smoke.mjs` (the live file) and `robots-policy.test.ts` (fixtures).
 * Matching is `robots-parser`'s: groups, `*`, `$` and the longest match (RFC 9309 §2.2.2-2.2.3).
 */
import robotsParser from "robots-parser";

const ORIGIN = "https://northguild.dev";

const SEARCH = ["Googlebot", "Bingbot"];
const OPEN = [
  "*",
  "ClaudeBot",
  "GPTBot",
  "OAI-SearchBot",
  "PerplexityBot",
  "Applebot",
];

/** One `{ agent, path, allowed }` row per agent and path; `path` is under https://northguild.dev. */
function rows(agents, paths, allowed) {
  return agents.flatMap((agent) =>
    paths.map((path) => ({ agent, path, allowed })),
  );
}

const blockedForSearch = [
  "/gmt/install.md",
  "/gmt/reference/plain/calculate/addDays.md",
  "/gmt/tools/zone-planner/?w=planner&wa=x",
  "/gmt/tools/zone-planner/?tz=a,b&t=1",
  "/gmt/?w=x",
];
const allowedEverywhere = [
  "/gmt/llms.txt",
  "/gmt/llms-full.txt",
  "/gmt/",
  "/gmt/reference/",
  "/gmt/reference/plain/calculate/addDays/",
  "/gmt/reference/gnss",
  "/gmt/_astro/x.js",
  "/gmt/og/x.png?v=1",
  "/",
  "/worktree/",
];
const blockedEverywhere = ["/gmt/api/chat", "/api/x", "/mcp/x"];

export const ROBOTS_POLICY = [
  ...rows(SEARCH, blockedForSearch, false),
  ...rows(OPEN, blockedForSearch, true),
  ...rows([...SEARCH, ...OPEN], allowedEverywhere, true),
  ...rows([...SEARCH, ...OPEN], blockedEverywhere, false),
];

/** The groups of a robots.txt: `{ agents, lines }`, where `lines` are the non-agent records. */
function groupsOf(text) {
  const groups = [];
  let group;
  let ruled = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === "user-agent") {
      // Consecutive User-agent lines share a group; one after a rule opens the next (§2.2.1).
      if (!group || ruled) {
        group = { agents: [], lines: [] };
        groups.push(group);
        ruled = false;
      }
      group.agents.push(value);
    } else if (field === "sitemap") {
      continue;
    } else if (group) {
      group.lines.push({ field, value });
      // A `Content-Signal` sits inside a group without ending it (§2.2.4).
      if (field === "allow" || field === "disallow") ruled = true;
    }
  }
  return groups;
}

const named = (groups, agent) =>
  groups.some((g) =>
    g.agents.some((a) => a.toLowerCase() === agent.toLowerCase()),
  );

/**
 * Check a robots.txt body against the policy. Returns `{ value, where }` failures, empty when it
 * holds: `value` is the offending row, line or group, `where` the reason.
 */
export function checkRobots(text) {
  const failures = [];
  const robots = robotsParser(`${ORIGIN}/robots.txt`, text);
  const groups = groupsOf(text);
  // Apple reads the `Googlebot` group when nothing names Applebot.
  const appleFallsBack = !named(groups, "Applebot");

  for (const { agent, path, allowed } of ROBOTS_POLICY) {
    const asked = agent === "Applebot" && appleFallsBack ? "Googlebot" : agent;
    const got = robots.isAllowed(`${ORIGIN}${path}`, asked);
    if (got !== allowed) {
      failures.push({
        value: `${agent} ${path}`,
        where: `policy row does not hold: expected ${allowed ? "allowed" : "blocked"}, got ${got ? "allowed" : "blocked"}`,
      });
    }
  }

  const star = groups.find((g) => g.agents.includes("*"));
  const signals = (g) =>
    g.lines.filter((l) => l.field === "content-signal").map((l) => l.value);
  const disallows = (g) =>
    g.lines.filter((l) => l.field === "disallow").map((l) => l.value);

  if (!star) {
    failures.push({ value: "*", where: "no `*` group" });
    return failures;
  }
  for (const g of groups) {
    if (g === star) continue;
    const label = g.agents.join(", ");
    for (const signal of signals(star)) {
      if (!signals(g).includes(signal)) {
        failures.push({
          value: label,
          where: `group lacks the \`*\` group's Content-Signal line: ${signal}`,
        });
      }
    }
    for (const rule of disallows(star)) {
      if (!disallows(g).includes(rule)) {
        failures.push({
          value: label,
          where: `group lacks the \`*\` group's Disallow: ${rule}`,
        });
      }
    }
  }
  for (const g of groups) {
    for (const signal of signals(g)) {
      if (!/\bai-train=yes\b/.test(signal)) {
        failures.push({
          value: signal,
          where: "Content-Signal without ai-train=yes",
        });
      }
    }
  }
  return failures;
}
