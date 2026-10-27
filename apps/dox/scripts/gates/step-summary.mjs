/**
 * Appends the runner's screen to the GitHub Actions step summary, in a fenced `text` block so the
 * columns keep their alignment. A no-op when `GITHUB_STEP_SUMMARY` is unset, which is every local
 * run. A summary that cannot be written never fails the gates.
 */
import { appendFileSync } from "node:fs";

export function appendStepSummary(screen, env = process.env) {
  const file = env.GITHUB_STEP_SUMMARY;
  if (!file) return false;
  try {
    appendFileSync(file, `\`\`\`text\n${screen.replace(/\n+$/, "")}\n\`\`\`\n`);
    return true;
  } catch {
    return false;
  }
}
