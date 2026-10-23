/**
 * The "Upgrade to at least" card on the Morocco 2026 clock-change checker: the first release of
 * each runtime and package that carries tz data 2026c, the first with the Morocco change.
 *
 * Every row names a primary source: the project's own changelog, advisory, package index or
 * commit. A runtime whose first 2026c release could not be found in its own source has no row
 * (Chrome). The minimums are facts about releases, so none carries a date of its own and there is
 * no "not fixed yet" row. Operating-system rows name the tz release, not a distro build.
 */
import {
  minimumsMarkdown as markdownOf,
  minimumsItemsHtml as itemsHtmlOf,
  type MinimumsCard,
  type RuntimeMinimum,
} from "../lib/clock-check/minimums";

export const MOROCCO_MINIMUMS_HEADING = "Upgrade to at least";
export const MOROCCO_MINIMUMS_INTRO =
  "These releases carry tz data 2026c or later, the first with the Morocco change. Older releases keep Casablanca and El Aaiun on +01:00 after 20 September 2026.";
export const MOROCCO_MINIMUMS_FOOTER =
  "Anything else (Chrome, Firefox, Safari, Deno, Go, databases, Docker images): run the command in Test your own servers. It shows what that runtime really does.";
/** The note under the card: why the device matters, with no function names. */
export const MOROCCO_MINIMUMS_NOTE =
  "gmt uses the time-zone rules of the device it runs on. A device without the 2026c time zone update gets these two zones wrong after 20 September 2026, so do the time maths on your server when it has to be right.";

const NODE_CHANGELOG =
  "https://github.com/nodejs/node/blob/main/doc/changelogs";
const OPENJDK = "https://github.com/openjdk";

export const MOROCCO_RUNTIME_MINIMUMS: RuntimeMinimum[] = [
  {
    name: "Node.js",
    parts: [
      { code: "26.6.0" },
      " · ",
      { code: "24.20.0" },
      " · ",
      { code: "22.23.3" },
      ". Node 20 and 25 are end-of-life and never got it.",
    ],
    sources: [
      { label: "26.6.0", href: `${NODE_CHANGELOG}/CHANGELOG_V26.md#26.6.0` },
      { label: "24.20.0", href: `${NODE_CHANGELOG}/CHANGELOG_V24.md#24.20.0` },
      { label: "22.23.3", href: `${NODE_CHANGELOG}/CHANGELOG_V22.md#22.23.3` },
      {
        label: "nodejs/node#64588",
        href: "https://github.com/nodejs/node/pull/64588",
      },
    ],
  },
  {
    name: "OpenJDK",
    parts: [
      { code: "25.0.5" },
      " · ",
      { code: "21.0.13" },
      " · ",
      { code: "17.0.21" },
    ],
    sources: [
      {
        label: "25u",
        href: `${OPENJDK}/jdk25u/commit/fdb5738795ae2563f62d07951356d0ab8ee16c8c`,
      },
      {
        label: "21u",
        href: `${OPENJDK}/jdk21u/commit/46e88acbebe4ae2558e3582c6de3e6bb5775ff42`,
      },
      {
        label: "17u",
        href: `${OPENJDK}/jdk17u/commit/4a9414bc836e519e0c87ce2a27770627b660728f`,
      },
    ],
  },
  {
    name: "Python",
    parts: [
      { code: "tzdata" },
      " ",
      { code: "2026.3" },
      " (needed on Windows, which has no system tz files) · ",
      { code: "pytz" },
      " ",
      { code: "2026.3" },
    ],
    sources: [
      {
        label: "tzdata 2026.3",
        href: "https://pypi.org/project/tzdata/2026.3/",
      },
      { label: "pytz 2026.3", href: "https://pypi.org/project/pytz/2026.3/" },
    ],
  },
  {
    name: "Ubuntu 26.04, 24.04, 22.04",
    parts: [{ code: "tzdata 2026c" }, " or later"],
    sources: [
      {
        label: "Launchpad",
        href: "https://launchpad.net/ubuntu/+source/tzdata",
      },
    ],
  },
  {
    name: "Alpine 3.21 and later",
    parts: [{ code: "tzdata 2026c" }, " or later"],
    sources: [
      {
        label: "Alpine packages",
        href: "https://pkgs.alpinelinux.org/packages?name=tzdata",
      },
    ],
  },
  {
    name: "RHEL 8 to 10",
    parts: [
      { code: "tzdata 2026c" },
      " or later (",
      { code: "RHBA-2026:51069" },
      ")",
    ],
    sources: [
      { label: "Red Hat", href: "https://access.redhat.com/articles/1187353" },
    ],
  },
  {
    name: "Fedora",
    parts: [{ code: "tzdata 2026c" }, " or later"],
    sources: [
      {
        label: "Bodhi",
        href: "https://bodhi.fedoraproject.org/updates/?packages=tzdata",
      },
    ],
  },
  {
    name: "Amazon Linux 2023",
    parts: [
      { code: "tzdata 2026c" },
      " or later (",
      { code: "2023.12.20260720" },
      ")",
    ],
    sources: [
      {
        label: "Release notes",
        href: "https://docs.aws.amazon.com/linux/al2023/release-notes/relnotes-2023.12.20260720.html",
      },
    ],
  },
];

/** Morocco's card: the words above and `MOROCCO_RUNTIME_MINIMUMS`, for the shared renderers. */
export const MOROCCO_MINIMUMS: MinimumsCard = {
  heading: MOROCCO_MINIMUMS_HEADING,
  intro: MOROCCO_MINIMUMS_INTRO,
  footer: MOROCCO_MINIMUMS_FOOTER,
  note: MOROCCO_MINIMUMS_NOTE,
  rows: MOROCCO_RUNTIME_MINIMUMS,
};

/** The rows as list items: name, the versions, then a link to each source. */
export const moroccoMinimumsItemsHtml = (): string =>
  itemsHtmlOf(MOROCCO_RUNTIME_MINIMUMS);

/** The card as Markdown for the `.md` twin and the llms files. */
export const moroccoMinimumsMarkdown = (): string =>
  markdownOf(MOROCCO_MINIMUMS);
