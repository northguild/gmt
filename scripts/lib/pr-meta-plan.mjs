/**
 * The labels, milestone and reviewer a pull request gets, from facts `scripts/pr-meta.mjs`
 * gathers: the branch, its commit subjects, its changed paths, the issues it closes, the trackers,
 * the viewer and the repo's collaborators.
 *
 * Pure: no file system, no git, no process.
 */

/**
 * Path rules: a changed path adds every label whose test it matches. Status and workflow labels
 * (`parked`, `ready to build`, `waiting: *`, `canary`, `dox-gate`, `craig-review`) are a person's
 * call or a workflow's, so no rule adds them.
 *
 * Every tracked path matches at least one rule (`plan.test.ts` checks `git ls-files`), except a
 * changeset entry (`.changeset/<name>.md`): it rides with the package change that labels the PR.
 * @type {ReadonlyArray<{ label: string, test: RegExp }>}
 */
export const PATH_RULES = [
  { label: "gmt", test: /^packages\/gmt\/(?!skills\/)/ },
  { label: "skills", test: /^packages\/gmt\/skills\// },
  { label: "gmt-biome", test: /^packages\/gmt-biome\// },
  { label: "gmt-eslint", test: /^packages\/gmt-eslint\// },
  { label: "gmt-oxlint", test: /^packages\/gmt-oxlint\// },
  { label: "pipes", test: /^\.github\/workflows\// },
  {
    label: "ai skills",
    test: /^(?:\.agents\/|\.claude\/|AGENTS\.md$|CLAUDE\.md$|context\/skills\.md$)/,
  },
  {
    /* Every root file that is not a document or an agent file is tooling. */
    label: "gmt monorepo",
    test: /^(?:scripts\/|apps\/dox\/scripts\/|\.github\/(?!workflows\/)|\.vscode\/|\.changeset\/(?:config\.json|README\.md)$|(?!(?:AGENTS|CLAUDE|CONTRIBUTING|PUBLISHING|README|SECURITY)\.md$|LICENSE$)[^/]+$)/,
  },
  {
    label: "documentation",
    test: /^(?:context\/(?!skills\.md$)|apps\/dox\/(?!scripts\/)|docs\/|README\.md$|CONTRIBUTING\.md$|PUBLISHING\.md$|SECURITY\.md$|(?:[^/]+\/)*LICENSE$|packages\/[\w-]+\/README\.md$)/,
  },
];

/** Conventional-commit type → label. Other types (chore, ci, test, build) add none. */
export const TYPE_LABELS = /** @type {const} */ ({
  feat: "enhancement",
  fix: "bug",
  refactor: "refactor",
  docs: "documentation",
});

/** Tracker file → the milestone its stories belong to. */
export const TRACKER_MILESTONES = /** @type {const} */ ({
  "context/dox/tracker.md": "Dox",
  "context/domination/tracker.md": "Domination",
});

/**
 * The story id a branch name carries: `448-dox-g6-research…` → `DOX-G6`,
 * `feature/227-spa-46-tai64…` → `SPA-46`. Null when it carries none.
 * @param {string} branch
 */
export function storyIdOf(branch) {
  const name = branch.slice(branch.lastIndexOf("/") + 1).replace(/^\d+-/, "");
  const match = /^([a-z]+)-([a-z]?\d+[a-z0-9]*)(?:-|$)/.exec(name);
  return match ? `${match[1]}-${match[2]}`.toUpperCase() : null;
}

/**
 * @typedef {{
 *   branch: string,
 *   subjects: string[],
 *   paths: string[],
 *   closingIssues: Array<{ number: number, milestone: string | null }>,
 *   trackers: Record<string, string>,
 *   milestones: string[],
 *   viewer: string,
 *   author: string | null,
 *   collaborators: string[],
 * }} Facts
 * `trackers` maps a tracker path to its text; `milestones` lists the repo's open milestones;
 * `author` is the open PR's author, or null before the PR exists (the viewer opens it then).
 */

/**
 * @param {Facts} facts
 * @returns {{ labels: string[], milestone: string | null, milestoneFrom: string, reviewers: string[], storyId: string | null }}
 */
export function planMeta(facts) {
  const storyId = storyIdOf(facts.branch);
  const labels = new Set();

  if (facts.branch.startsWith("release/")) {
    labels.add("release");
  } else {
    for (const subject of facts.subjects) {
      const type = /^(\w+)(?:\([^)]*\))?!?:/.exec(subject)?.[1];
      if (type && type in TYPE_LABELS)
        labels.add(TYPE_LABELS[/** @type {keyof typeof TYPE_LABELS} */ (type)]);
    }
    for (const path of facts.paths) {
      for (const rule of PATH_RULES)
        if (rule.test.test(path)) labels.add(rule.label);
    }
  }

  let milestone = null;
  let milestoneFrom = "none";
  const fromIssue = facts.closingIssues.find((issue) => issue.milestone);
  if (fromIssue?.milestone) {
    milestone = fromIssue.milestone;
    milestoneFrom = `#${fromIssue.number}`;
  } else if (storyId) {
    const row = new RegExp(`^\\|[^\\n]*\\b${storyId}\\b`, "m");
    for (const [path, title] of Object.entries(TRACKER_MILESTONES)) {
      if (row.test(facts.trackers[path] ?? "")) {
        milestone = title;
        milestoneFrom = path;
        break;
      }
    }
  }
  if (milestone && !facts.milestones.includes(milestone)) {
    milestoneFrom = `${milestoneFrom} (not an open milestone, left off)`;
    milestone = null;
  }

  const author = facts.author ?? facts.viewer;
  const reviewers = facts.collaborators.filter((login) => login !== author);

  return {
    labels: [...labels].sort(),
    milestone,
    milestoneFrom,
    reviewers,
    storyId,
  };
}
