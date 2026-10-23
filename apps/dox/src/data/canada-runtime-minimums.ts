/**
 * The "Upgrade to at least" card on the Canada 2026 clock-change checker: the first release of each
 * runtime and package that carries tz data 2026e, the first with all four changes.
 *
 * Every row names its source. The minimums are facts about releases, so none carries a date of
 * its own, and there is no "not fixed yet" row: that kind of row goes stale. Windows has no row
 * because Inuvik is unconfirmed there.
 *
 * Here rather than in the mount so the text surfaces (`.md`, `llms-full.txt`, retrieval chunks)
 * render the same words as the page. The types and the renderers are shared:
 * `clock-change-minimums.ts`.
 */

import type { MinimumsText, RuntimeMinimum } from "./clock-change-minimums";

const MINIMUMS_HEADING = "Upgrade to at least";
const MINIMUMS_INTRO =
  "These releases carry tz data 2026e, the first with all four changes. Older releases get some of these places wrong from 1 November 2026.";
const MINIMUMS_FOOTER =
  "Anything else (Firefox, Safari, Deno, Go, databases, Docker images): run the command in Test your own servers. It shows what that runtime really does.";
/** The note under the card: why the device matters, with no function names. */
const MINIMUMS_NOTE =
  "gmt uses the time-zone rules of the device it runs on. A device without the October 2026 time zone update gets these four zones wrong from 1 November 2026, so do the time maths on your server when it has to be right.";

const NODE_CHANGELOG =
  "https://github.com/nodejs/node/blob/main/doc/changelogs";

export const RUNTIME_MINIMUMS: RuntimeMinimum[] = [
  {
    name: "Node.js",
    parts: [
      { code: "26.11.0" },
      " · ",
      { code: "24.22.1" },
      " · ",
      { code: "22.23.4" },
      ". Node 20 and 25 are end-of-life and never got it.",
    ],
    sources: [
      { label: "26.11.0", href: `${NODE_CHANGELOG}/CHANGELOG_V26.md#26.11.0` },
      { label: "24.22.1", href: `${NODE_CHANGELOG}/CHANGELOG_V24.md#24.22.1` },
      { label: "22.23.4", href: `${NODE_CHANGELOG}/CHANGELOG_V22.md#22.23.4` },
    ],
  },
  {
    name: "Chrome",
    parts: [
      { code: "156.0.8078.35" },
      ". Extended Stable 152 does not have it.",
    ],
    sources: [
      {
        label: "Chromium releases",
        href: "https://chromiumdash.appspot.com/releases",
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
        label: "OpenJDK 25 updates",
        href: "https://github.com/openjdk/jdk25u",
      },
    ],
  },
  {
    name: "Python",
    parts: [
      { code: "tzdata" },
      " ",
      { code: "2026.5" },
      " (needed on Windows, which has no system tz files) · ",
      { code: "pytz" },
      " ",
      { code: "2026.5" },
    ],
    sources: [
      {
        label: "tzdata 2026.5",
        href: "https://pypi.org/project/tzdata/2026.5/",
      },
      { label: "pytz 2026.5", href: "https://pypi.org/project/pytz/2026.5/" },
    ],
  },
  {
    name: "Ubuntu 26.04, 24.04, 22.04",
    parts: [{ code: "2026e-0ubuntu0.*" }],
    sources: [
      {
        label: "Launchpad",
        href: "https://launchpad.net/ubuntu/+source/tzdata",
      },
    ],
  },
  {
    name: "Alpine 3.21 and later",
    parts: [{ code: "2026e-r0" }],
    sources: [
      {
        label: "Alpine packages",
        href: "https://pkgs.alpinelinux.org/packages?name=tzdata",
      },
    ],
  },
  {
    name: "RHEL 8 to 10",
    parts: [{ code: "RHBA-2026:77613" }],
    sources: [
      { label: "Red Hat", href: "https://access.redhat.com/articles/1187353" },
    ],
  },
  {
    name: "Fedora",
    parts: [{ code: "tzdata-2026e-1" }],
    sources: [
      {
        label: "Bodhi",
        href: "https://bodhi.fedoraproject.org/updates/?packages=tzdata",
      },
    ],
  },
  {
    name: "Amazon Linux 2023",
    parts: [{ code: "2023.12.20261013" }],
    sources: [
      {
        label: "Release notes",
        href: "https://docs.aws.amazon.com/linux/al2023/release-notes/relnotes-2023.12.20261013.html",
      },
    ],
  },
  {
    name: "Mac and iPhone",
    parts: [
      "Keep the system updated and restart. The new tz data arrives on its own but takes effect only after a restart.",
    ],
    sources: [],
  },
];

export const CANADA_MINIMUMS: MinimumsText = {
  heading: MINIMUMS_HEADING,
  intro: MINIMUMS_INTRO,
  footer: MINIMUMS_FOOTER,
  note: MINIMUMS_NOTE,
  rows: RUNTIME_MINIMUMS,
};
