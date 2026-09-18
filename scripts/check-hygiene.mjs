/**
 * Repository hygiene: the SHAPE of the repository, which no test of its content can see.
 *
 * Adapted from NexusPrompt's check:hygiene, written after its .gitignore was emptied by automated
 * commits three times and one of them tracked 3,677 dependency files in a single change. Every rule
 * here is one an ordinary build walks straight past:
 *
 *   1. .gitignore still carries the rules whose absence is expensive, and has not been truncated.
 *   2. Nothing under a dependency directory is tracked, at any depth: every module has its own.
 *   3. No tracked file exceeds MAX_TRACKED_BYTES. Git keeps every blob forever.
 *   4. Every tracked .json parses. A truncated lockfile stops `npm ci` in CI, while `npm install`
 *      repairs it silently on every laptop.
 *   5. No tracked file is also ignored: it stays tracked today and cannot be re-added tomorrow.
 *   6. No environment file is tracked. Real credentials live outside the repository.
 *   7. Once template/ is gone, no template marker line survives.
 *   8. Workflows and local actions pin every third-party action to a full commit SHA; every
 *      workflow declares `permissions:` and every job a `timeout-minutes`.
 *   9. Every job in verify.yml is listed under the aggregate `verify` job's `needs`. A job left out
 *      still runs and still shows red, but no longer blocks a merge — and nothing says so.
 *  10. No tracked source or config file contains a raw control character. A raw NUL makes git treat
 *      the whole file as binary: its diffs collapse to "Bin", so the change is never reviewed.
 *
 *   node scripts/check-hygiene.mjs
 *
 * Exit 0 clean · 1 a rule is broken · 2 the repository cannot be inspected.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const REQUIRED_IGNORES = ["node_modules/", "dist/", "coverage/", ".env", ".env.*"];
/** Below this the file was truncated, not edited. */
export const MIN_RULES = 10;
export const FORBIDDEN_TRACKED_DIRS = ["node_modules", ".venv", "venv", "__pycache__", ".mypy_cache", ".pytest_cache", ".ruff_cache"];
export const MAX_TRACKED_BYTES = 4 * 1024 * 1024;
/** Read by tools that accept comments; every other .json must be strict JSON. */
export const JSONC = /(^|\/)(tsconfig(\.[\w-]+)?\.json|devcontainer\.json)$|(^|\/)\.vscode\//;
export const MARKER = /ultra:(?:begin|end)\s+[a-z0-9-]+/;

const TEXT_SOURCE = /\.(mjs|cjs|js|jsx|ts|tsx|mts|go|ya?ml|json|md|c4|css|html)$/;
// Tab, LF and CR are the only C0 characters text needs; anything else belongs in an escape.
const CONTROL_CHAR = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;
const ENV_FILE = /(^|\/)\.env(\.[^/]*)?$/;
const ENV_EXAMPLE = /(^|\/)\.env\.example$/;
const WORKFLOW = /^\.github\/(workflows\/[^/]+|actions\/.+\/action)\.ya?ml$/;
const USES = /^\s*(?:-\s*)?uses:\s*["']?([^\s"'#]+)/;
const PINNED = /^[^@\s]+@[0-9a-f]{40}$/;

export const containsDir = (path, dir) => path === dir || path.startsWith(`${dir}/`) || path.includes(`/${dir}/`);
export const ignoreRules = (text) => text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "" && !l.startsWith("#"));

const git = (root, args, input) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", input, maxBuffer: 64 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });

function trackedAndIgnored(root, paths) {
  if (paths.length === 0) return [];
  try {
    // --no-index is load-bearing: without it git reports a tracked path as not ignored even when a
    // pattern matches it, which is exactly the case this rule exists to find.
    return git(root, ["check-ignore", "--no-index", "--stdin", "-z"], `${paths.join("\0")}\0`).split("\0").filter(Boolean);
  } catch (err) {
    if (err.status === 1) return []; // exit 1: no path matched, the clean case
    throw err;
  }
}

/** Rule 8 for one file. Reads the two-space layout this repository writes, not arbitrary YAML. */
export function checkWorkflow(path, text) {
  const problems = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const ref = USES.exec(line)?.[1];
    if (ref === undefined || ref.startsWith("./") || ref.startsWith("docker://")) return;
    if (!PINNED.test(ref)) problems.push(`${path}:${i + 1} uses \`${ref}\`, which is not pinned to a 40-character commit SHA.`);
  });
  if (!path.includes("/workflows/")) return problems;

  if (!lines.some((l) => l.startsWith("permissions:"))) {
    problems.push(`${path} has no top-level \`permissions:\`, so every job gets the repository's default token scope.`);
  }
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  let job = null;
  const close = () => {
    if (job !== null && !job.timeout && !job.reusable) {
      problems.push(`${path}:${job.line} job \`${job.id}\` has no \`timeout-minutes\`; the default is six hours.`);
    }
  };
  for (let i = start + 1; start !== -1 && i < lines.length; i++) {
    const line = lines[i];
    if (/^[^\s#]/.test(line)) break;
    const opened = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (opened) {
      close();
      job = { id: opened[1], line: i + 1, timeout: false, reusable: false };
    } else if (job !== null) {
      if (/^ {4}timeout-minutes:/.test(line)) job.timeout = true;
      if (/^ {4}uses:/.test(line)) job.reusable = true;
    }
  }
  close();
  return problems;
}

/** Rule 9. Same layout assumption as checkWorkflow: jobs at two spaces, `needs` as a block list. */
export function checkGate(path, text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  const jobs = [];
  const needs = [];
  let inGate = false;
  let inNeeds = false;
  for (let i = start + 1; start !== -1 && i < lines.length; i++) {
    const line = lines[i];
    if (/^[^\s#]/.test(line)) break;
    const opened = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (opened) {
      jobs.push(opened[1]);
      inGate = opened[1] === "verify";
      inNeeds = false;
    } else if (inGate && /^ {4}needs:\s*$/.test(line)) {
      inNeeds = true;
    } else if (inGate && /^ {4}\S/.test(line)) {
      inNeeds = false;
    } else if (inNeeds) {
      const item = /^ {6}- ([A-Za-z0-9_-]+)\s*$/.exec(line);
      if (item) needs.push(item[1]);
    }
  }
  if (!jobs.includes("verify")) return [`${path} has no aggregate \`verify\` job, which branch protection requires.`];
  const outside = jobs.filter((job) => job !== "verify" && !needs.includes(job));
  return outside.length === 0
    ? []
    : [`${path}: job(s) ${outside.join(", ")} are missing from \`verify.needs\`, so they run but do not gate a merge.`];
}

export function checkRepoHygiene(root = process.cwd()) {
  if (!existsSync(join(root, ".gitignore"))) return { ok: false, fatal: ".gitignore is missing. Restore it from the last good revision." };
  let tracked;
  try {
    tracked = git(root, ["ls-files", "-z"]).split("\0").filter(Boolean);
  } catch (err) {
    return { ok: false, fatal: `cannot list tracked files; is this a git repository? ${String(err.message).split("\n")[0]}` };
  }
  if (tracked.length === 0) {
    return { ok: false, fatal: "nothing is tracked yet, so every rule would pass without checking anything. Run `git add -A` first." };
  }
  const read = (path) => readFileSync(join(root, path), "utf8");
  const present = tracked.filter((p) => existsSync(join(root, p)));
  const failures = [];

  const rules = ignoreRules(read(".gitignore"));
  for (const rule of REQUIRED_IGNORES) {
    if (!rules.includes(rule)) failures.push(`.gitignore no longer carries \`${rule}\`. Removing it is a decision, not a cleanup.`);
  }
  if (rules.length < MIN_RULES) {
    failures.push(`.gitignore holds ${rules.length} rule(s), below the floor of ${MIN_RULES}: it was truncated, not edited.`);
  }

  for (const dir of FORBIDDEN_TRACKED_DIRS) {
    const hits = tracked.filter((p) => containsDir(p, dir));
    if (hits.length > 0) failures.push(`${hits.length} tracked file(s) under a \`${dir}\` directory, e.g. ${hits[0]}. Untrack with \`git rm -r --cached\`.`);
  }

  for (const path of present) {
    const bytes = statSync(join(root, path)).size;
    if (bytes > MAX_TRACKED_BYTES) {
      failures.push(`\`${path}\` is ${(bytes / 1048576).toFixed(1)} MB, over the ${MAX_TRACKED_BYTES / 1048576} MB bound. Git keeps the blob even after a later commit removes it.`);
    }
  }

  for (const path of present.filter((p) => p.endsWith(".json") && !JSONC.test(p))) {
    try {
      JSON.parse(read(path));
    } catch (err) {
      failures.push(`\`${path}\` is not valid JSON: ${err.message}`);
    }
  }

  const ignored = trackedAndIgnored(root, tracked);
  if (ignored.length > 0) {
    failures.push(`${ignored.length} tracked file(s) are also ignored, e.g. ${ignored[0]}. Narrow the rule, or anchor it with a leading slash.`);
  }

  const envFiles = tracked.filter((p) => ENV_FILE.test(p) && !ENV_EXAMPLE.test(p));
  if (envFiles.length > 0) {
    failures.push(`environment file(s) tracked: ${envFiles.join(", ")}. Revoke any secret they held, then untrack them.`);
  }

  if (!existsSync(join(root, "template"))) {
    const leftovers = [];
    for (const path of present) {
      const bytes = readFileSync(join(root, path));
      if (bytes.includes(0)) continue;
      const line = bytes.toString("utf8").split("\n").findIndex((l) => MARKER.test(l));
      if (line !== -1) leftovers.push(`${path}:${line + 1}`);
    }
    if (leftovers.length > 0) failures.push(`template marker line(s) survived initialization: ${leftovers.join(", ")}.`);
  }

  for (const path of present.filter((p) => WORKFLOW.test(p))) failures.push(...checkWorkflow(path, read(path)));
  const gate = ".github/workflows/verify.yml";
  if (present.includes(gate)) failures.push(...checkGate(gate, read(gate)));

  const withControl = [];
  for (const path of present.filter((p) => TEXT_SOURCE.test(p))) {
    const line = read(path).split("\n").findIndex((l) => CONTROL_CHAR.test(l));
    if (line !== -1) withControl.push(`${path}:${line + 1}`);
  }
  if (withControl.length > 0) {
    failures.push(`raw control character(s) in ${withControl.join(", ")}. Write them as escapes such as \\u0000: the value is the same, and the file stays text to git, grep and review.`);
  }

  return { ok: failures.length === 0, failures, trackedCount: tracked.length, ruleCount: rules.length };
}

function main() {
  const result = checkRepoHygiene(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
  if (result.fatal) {
    console.error(`check-hygiene: ${result.fatal}`);
    return 2;
  }
  if (!result.ok) {
    console.error(`check-hygiene: ${result.failures.length} problem(s)\n`);
    for (const failure of result.failures) console.error(`  ${failure}\n`);
    return 1;
  }
  console.log(`check-hygiene: OK. ${result.ruleCount} ignore rules, ${result.trackedCount} tracked files.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
