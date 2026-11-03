/**
 * The changelog writer `.changeset/config.json` points at. It is `@changesets/changelog-git`,
 * which `@changesets/cli/changelog` re-exports, with one change: a blank line inside a
 * multi-paragraph changeset stays blank.
 *
 * Upstream puts two spaces in front of every line after the first, so the paragraphs sit under
 * the bullet. It does that to blank lines too, so every paragraph break reached `CHANGELOG.md` as
 * a whitespace-only line, and `git diff --check` flagged dozens of them on every release PR
 * (#450). Indenting only the lines that have text renders the same.
 */

const getReleaseLine = async (changeset) => {
  const [firstLine, ...futureLines] = changeset.summary
    .split("\n")
    .map((line) => line.trimEnd());
  const commit = changeset.commit ? `${changeset.commit.slice(0, 7)}: ` : "";
  const releaseLine = `- ${commit}${firstLine}`;
  if (futureLines.length === 0) return releaseLine;
  const body = futureLines.map((line) => (line ? `  ${line}` : "")).join("\n");
  return `${releaseLine}\n${body}`;
};

const getDependencyReleaseLine = async (changesets, dependenciesUpdated) => {
  if (dependenciesUpdated.length === 0) return "";
  const changesetLinks = changesets.map(
    (changeset) =>
      `- Updated dependencies${changeset.commit ? ` [${changeset.commit.slice(0, 7)}]` : ""}`,
  );
  const updatedDependencies = dependenciesUpdated.map(
    (dependency) => `  - ${dependency.name}@${dependency.newVersion}`,
  );
  return [...changesetLinks, ...updatedDependencies].join("\n");
};

export default { getReleaseLine, getDependencyReleaseLine };
