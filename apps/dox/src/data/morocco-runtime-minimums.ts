/**
 * The "Upgrade to at least" card on the Morocco 2026 clock-change checker: the first release of
 * each runtime and package that carries tz data 2026c or later. 2026c is the first release with
 * Morocco and Western Sahara on permanent +00 from 20 September 2026.
 *
 * Every row names its source. The minimums are facts about releases, so none carries a date of
 * its own, and there is no "not fixed yet" row: that kind of row goes stale. A line that has no
 * release with the data is left out; one that is end-of-life gets a plain clause. Mac and iPhone
 * have no row because no Apple page names the update.
 *
 * Here rather than in the mount so the text surfaces (`.md`, `llms-full.txt`, retrieval chunks)
 * render the same words as the page. The types and the renderers are shared:
 * `clock-change-minimums.ts`.
 */

import type { MinimumsText, RuntimeMinimum } from "./clock-change-minimums";

const NODE_CHANGELOG =
  "https://github.com/nodejs/node/blob/main/doc/changelogs";
const CHROMIUM_DEPS =
  "https://chromium.googlesource.com/chromium/src/+/refs/tags";
const LAUNCHPAD = "https://launchpad.net/ubuntu/+source/tzdata";
const ALPINE_COMMIT = "https://gitlab.alpinelinux.org/alpine/aports/-/commit";
const BODHI = "https://bodhi.fedoraproject.org/updates";
const WINDOWS_11 =
  "https://support.microsoft.com/en-us/servicing/os/windows-11/2026/09";
const WINDOWS_10 =
  "https://support.microsoft.com/en-us/servicing/os/windows-10/2026/09";
const WINDOWS_SERVER =
  "https://support.microsoft.com/en-us/servicing/os/windows-server/2026/09";

const MOROCCO_ROWS: RuntimeMinimum[] = [
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
    ],
  },
  {
    name: "Chrome",
    parts: [
      { code: "154.0.8037.17" },
      " (on Linux, ",
      { code: "154.0.8037.57" },
      "). Extended Stable: ",
      { code: "156.0.8078.13" },
      ". Extended Stable 152 does not have it.",
    ],
    sources: [
      {
        label: "Chrome 154",
        href: `${CHROMIUM_DEPS}/154.0.8037.17/DEPS`,
      },
      {
        label: "Extended Stable 156",
        href: `${CHROMIUM_DEPS}/156.0.8078.13/DEPS`,
      },
    ],
  },
  {
    name: "OpenJDK",
    parts: [
      { code: "27.0.1" },
      " · ",
      { code: "25.0.5" },
      " · ",
      { code: "21.0.13" },
      " · ",
      { code: "17.0.21" },
    ],
    sources: [
      {
        label: "27.0.1",
        href: "https://github.com/openjdk/jdk27u/commit/7a221d6ee8c475501c2f3de23c4d9111331400e9",
      },
      {
        label: "25.0.5",
        href: "https://github.com/openjdk/jdk25u/commit/fdb5738795ae2563f62d07951356d0ab8ee16c8c",
      },
      {
        label: "21.0.13",
        href: "https://github.com/openjdk/jdk21u/commit/46e88acbebe4ae2558e3582c6de3e6bb5775ff42",
      },
      {
        label: "17.0.21",
        href: "https://github.com/openjdk/jdk17u/commit/4a9414bc836e519e0c87ce2a27770627b660728f",
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
    parts: [{ code: "2026c-0ubuntu0.*" }],
    sources: [
      {
        label: "26.04",
        href: `${LAUNCHPAD}/2026c-0ubuntu0.26.04.1`,
      },
      {
        label: "24.04",
        href: `${LAUNCHPAD}/2026c-0ubuntu0.24.04.1`,
      },
      {
        label: "22.04",
        href: `${LAUNCHPAD}/2026c-0ubuntu0.22.04.1`,
      },
    ],
  },
  {
    name: "Alpine 3.21 and later",
    parts: [{ code: "2026c-r0" }],
    sources: [
      {
        label: "3.24",
        href: `${ALPINE_COMMIT}/abde3c23ae79b9d3b7bf1a089076703ccda73875`,
      },
      {
        label: "3.23",
        href: `${ALPINE_COMMIT}/9c9f3b4ae9ed543ebcc6701d130545c19597178b`,
      },
      {
        label: "3.22",
        href: `${ALPINE_COMMIT}/edb89a5feaab59f73eb287587ba7fc005d46ee48`,
      },
      {
        label: "3.21",
        href: `${ALPINE_COMMIT}/79289ecf86434f4b05c53fea4f7ae2677b50d3fb`,
      },
    ],
  },
  {
    name: "RHEL 8 to 10",
    parts: [{ code: "RHBA-2026:51069" }],
    sources: [
      {
        label: "Red Hat advisory",
        href: "https://access.redhat.com/errata/RHBA-2026:51069",
      },
      { label: "Red Hat", href: "https://access.redhat.com/articles/1187353" },
    ],
  },
  {
    name: "Fedora 43 and 44",
    parts: [
      { code: "tzdata-2026c-1" },
      ". Fedora 42 is end-of-life and never got it.",
    ],
    sources: [
      { label: "Fedora 44", href: `${BODHI}/FEDORA-2026-92e492d5eb` },
      { label: "Fedora 43", href: `${BODHI}/FEDORA-2026-acf3ba9947` },
    ],
  },
  {
    name: "Amazon Linux 2023",
    parts: [{ code: "2023.12.20260720" }],
    sources: [
      {
        label: "Release notes",
        href: "https://docs.aws.amazon.com/linux/al2023/release-notes/relnotes-2023.12.20260720.html",
      },
    ],
  },
  {
    name: "Windows",
    parts: [
      "Windows keeps its own time-zone data, so there is no tz version. These updates, or a later one, name the change. Windows 11 24H2 and 25H2: ",
      { code: "KB5124008" },
      " · 26H1: ",
      { code: "KB5124012" },
      " · Windows 10 21H2 and 22H2: ",
      { code: "KB5122878" },
      " · Windows 10 1809: ",
      { code: "KB5122876" },
      " · Server 2022: ",
      { code: "KB5122882" },
      " · Server 2025: ",
      { code: "KB5122871" },
    ],
    sources: [
      {
        label: "KB5124008",
        href: `${WINDOWS_11}/kb5124008-windows-11-24h2-25h2-security-update`,
      },
      {
        label: "KB5124012",
        href: `${WINDOWS_11}/kb5124012-windows-11-26h1-security-update`,
      },
      {
        label: "KB5122878",
        href: `${WINDOWS_10}/kb5122878-windows-10-21h2-22h2-security-update`,
      },
      {
        label: "KB5122876",
        href: `${WINDOWS_10}/kb5122876-windows-10-1809-security-update`,
      },
      {
        label: "KB5122882",
        href: `${WINDOWS_SERVER}/kb5122882-windows-server-2022-security-update`,
      },
      {
        label: "KB5122871",
        href: `${WINDOWS_SERVER}/kb5122871-windows-server-2025-security-update`,
      },
    ],
  },
];

export const MOROCCO_MINIMUMS: MinimumsText = {
  heading: "Upgrade to at least",
  intro:
    "These releases carry tz data 2026c or later, which records the change in Morocco and Western Sahara. Older releases show both an hour ahead after 20 September 2026, except in the weeks around Ramadan.",
  footer:
    "Anything else (Firefox, Safari, Deno, Go, databases, Docker images, Mac and iPhone): run the command in Test your own servers. It shows what that runtime really does.",
  note: "gmt uses the time-zone rules of the device it runs on. A device without tz data 2026c shows Morocco and Western Sahara an hour ahead for most of the year after 20 September 2026, so do the time maths on your server when it has to be right.",
  rows: MOROCCO_ROWS,
};
