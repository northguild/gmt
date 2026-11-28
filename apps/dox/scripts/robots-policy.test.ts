import { checkRobots, ROBOTS_POLICY } from "./robots-policy.mjs";

const SIGNAL = "Content-Signal: search=yes, ai-input=yes, ai-train=yes";
const API = ["Disallow: /api/", "Disallow: /mcp/", "Disallow: /gmt/api/"];

const GOOD = `User-agent: *
User-agent: Applebot
${SIGNAL}
Allow: /
${API.join("\n")}

User-agent: Googlebot
User-agent: Bingbot
${SIGNAL}
Allow: /
${API.join("\n")}
Disallow: /gmt/*.md$
Disallow: /gmt/?
Disallow: /gmt/*/?

Sitemap: https://northguild.dev/sitemap-index.xml
Sitemap: https://northguild.dev/gmt/sitemap-index.xml
Sitemap: https://northguild.dev/worktree/sitemap-index.xml
`;

const wheres = (text: string) =>
  checkRobots(text).map((f: { where: string }) => f.where);

describe("checkRobots", () => {
  it("passes the served file", () => {
    expect(checkRobots(GOOD)).toEqual([]);
  });

  it("covers every agent and path of the policy", () => {
    expect(ROBOTS_POLICY.length).toBeGreaterThan(100);
  });

  it("fails `.md` rules in `*`, which cuts off AI agents", () => {
    const bad = GOOD.replace(
      "Disallow: /gmt/api/\n\nUser-agent: Googlebot",
      "Disallow: /gmt/api/\nDisallow: /gmt/*.md$\n\nUser-agent: Googlebot",
    );
    const reasons = wheres(bad);
    expect(reasons).toContain(
      "policy row does not hold: expected allowed, got blocked",
    );
  });

  it("fails a Googlebot group without `Disallow: /api/`", () => {
    const [star, rest] = GOOD.split("User-agent: Googlebot");
    const bad = `${star}User-agent: Googlebot${rest.replace("Disallow: /api/\n", "")}`;
    expect(wheres(bad)).toContain(
      "group lacks the `*` group's Disallow: /api/",
    );
  });

  it("fails a Googlebot group without `Content-Signal`", () => {
    const [star, rest] = GOOD.split("User-agent: Googlebot");
    const bad = `${star}User-agent: Googlebot${rest.replace(`${SIGNAL}\n`, "")}`;
    expect(wheres(bad)).toContain(
      `group lacks the \`*\` group's Content-Signal line: ${SIGNAL.slice("Content-Signal: ".length)}`,
    );
  });

  it("fails `ai-train=no`", () => {
    const bad = GOOD.replaceAll("ai-train=yes", "ai-train=no");
    expect(wheres(bad)).toContain("Content-Signal without ai-train=yes");
  });

  it("fails when Applebot is not named, because it then follows the Googlebot group", () => {
    const bad = GOOD.replace("User-agent: Applebot\n", "");
    const failures = checkRobots(bad);
    expect(failures.map((f: { value: string }) => f.value)).toContain(
      "Applebot /gmt/install.md",
    );
  });

  it("fails `Disallow: /gmt/*?`, which blocks the `?v=` png", () => {
    const bad = GOOD.replace("Disallow: /gmt/*/?", "Disallow: /gmt/*?");
    const failures = checkRobots(bad);
    expect(failures.map((f: { value: string }) => f.value)).toContain(
      "Googlebot /gmt/og/x.png?v=1",
    );
  });
});
