#!/usr/bin/env node
/**
 * Turns ULTRA-TEMPLATE into a project that contains only the features you select.
 *
 * GitHub's "Use this template" copies every file and takes no parameters, so selection happens
 * here, once, on your machine. It cannot happen in a GitHub Actions run on the new repository: a
 * push made with GITHUB_TOKEN may not add, change or delete files under .github/workflows/, and
 * init does all three.
 *
 *   node template/init.mjs --list
 *   node template/init.mjs --name my-app --owner my-org --preset fullstack-ts --dry-run
 *   node template/init.mjs --name my-app --owner my-org --features go-service,release
 *   node template/init.mjs --name my-app --owner my-org --preset all --out ../my-app
 *
 * In order, and with every input validated before the first file is touched:
 *   1. Deletes the paths of each feature you did not select, and everything template-only.
 *   2. In every file that remains, keeps or deletes each block between a begin and an end marker
 *      line, then deletes the marker lines themselves.
 *   3. Replaces the template's identity (owner, repository, project name) with yours.
 *
 * Only files git tracks are read. Without --out the checkout is rewritten in place, and init
 * refuses to start on uncommitted changes, so `git checkout -- . && git clean -fd` is always a
 * complete undo. With --out a new directory is written and this checkout is left alone; that is
 * how template-test.yml exercises every preset.
 *
 * Exit 0 done · 1 invalid arguments or inconsistent template · 2 environment (git, dirty tree, --out).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Reserved marker id: its blocks are deleted on every init, like the `templateOnly` paths. */
export const TEMPLATE_ONLY_ID = "template";

/** A marker is one directive on its own line; the comment syntax around it belongs to the file type. */
export const MARKER_RE = /ultra:(begin|end)\s+([a-z0-9-]+)/;

const NAME_RE = /^[a-z][a-z0-9-]{0,62}[a-z0-9]$/;
const OWNER_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

export class InitError extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

export function loadManifest(root = ROOT) {
  return JSON.parse(readFileSync(join(root, "template", "features.json"), "utf8"));
}

/** Every inconsistency in the manifest, as messages. Empty means usable. */
export function validateManifest(manifest, exists) {
  const problems = [];
  for (const [id, feature] of Object.entries(manifest.features)) {
    if (id === TEMPLATE_ONLY_ID || !/^[a-z0-9-]+$/.test(id)) problems.push(`"${id}" is not a usable feature id.`);
    for (const path of feature.paths) {
      if (!exists(path)) problems.push(`feature "${id}" owns "${path}", which does not exist.`);
    }
  }
  for (const path of manifest.templateOnly) {
    if (!exists(path)) problems.push(`template-only path "${path}" does not exist.`);
  }
  for (const [preset, ids] of Object.entries(manifest.presets)) {
    for (const id of ids) {
      if (!Object.hasOwn(manifest.features, id)) problems.push(`preset "${preset}" names unknown feature "${id}".`);
    }
  }
  return problems;
}

export function resolveSelection(manifest, { preset, features }) {
  if ((preset === undefined) === (features === undefined)) {
    throw new InitError("Pass exactly one of --preset or --features (use --preset minimal for no features).");
  }
  let ids;
  if (preset !== undefined) {
    if (!Object.hasOwn(manifest.presets, preset)) {
      throw new InitError(`Unknown preset "${preset}". Known: ${Object.keys(manifest.presets).join(", ")}.`);
    }
    ids = manifest.presets[preset];
  } else {
    ids = features.split(",").map((s) => s.trim()).filter(Boolean);
  }
  const unknown = ids.filter((id) => !Object.hasOwn(manifest.features, id));
  if (unknown.length > 0) {
    throw new InitError(`Unknown feature(s): ${unknown.join(", ")}. Known: ${Object.keys(manifest.features).join(", ")}.`);
  }
  return new Set(ids);
}

export function validateIdentity({ name, owner, repo }) {
  const problems = [];
  if (name === undefined || !NAME_RE.test(name)) {
    problems.push("--name must be 2-64 characters of lowercase letters, digits and hyphens, starting with a letter.");
  }
  if (owner === undefined || !OWNER_RE.test(owner)) {
    problems.push("--owner must be a GitHub user or organization name.");
  }
  if (repo !== undefined && !REPO_RE.test(repo)) {
    problems.push("--repo may contain only letters, digits, '.', '_' and '-'.");
  }
  if (problems.length > 0) throw new InitError(problems.join("\n"));
  return { name, owner, repo: repo ?? name };
}

/** Deleted for this selection: each unselected feature's paths, plus everything template-only. */
export function removedPaths(manifest, selected) {
  const unselected = Object.entries(manifest.features).filter(([id]) => !selected.has(id));
  return [...manifest.templateOnly, ...unselected.flatMap(([, feature]) => feature.paths)];
}

export const isUnder = (file, path) => file === path || file.startsWith(`${path}/`);

/**
 * Keeps the blocks of selected features and deletes the rest, marker lines included. Throws on an
 * unknown id, a nested begin, an end without its begin, or a block never closed — a malformed
 * marker would otherwise delete the rest of the file silently.
 */
export function applyMarkers(text, selected, known, file = "<text>") {
  const lines = text.split("\n");
  const out = [];
  let open = null;
  // A removed block usually sits between blank lines; dropping the second keeps the gap single.
  let justRemoved = false;
  for (let i = 0; i < lines.length; i++) {
    const match = MARKER_RE.exec(lines[i]);
    if (!match) {
      if (open !== null && !open.keep) continue;
      const doubledBlank = justRemoved && lines[i].trim() === "" && (out.length === 0 || out.at(-1).trim() === "");
      justRemoved = false;
      if (!doubledBlank) out.push(lines[i]);
      continue;
    }
    const [, kind, id] = match;
    const where = `${file}:${i + 1}`;
    if (id !== TEMPLATE_ONLY_ID && !known.has(id)) {
      throw new InitError(`${where}: marker names unknown feature "${id}".`);
    }
    if (kind === "begin") {
      if (open !== null) {
        throw new InitError(`${where}: "${id}" block opens inside the "${open.id}" block from line ${open.line}; blocks do not nest.`);
      }
      open = { id, line: i + 1, keep: id !== TEMPLATE_ONLY_ID && selected.has(id) };
    } else {
      if (open === null || open.id !== id) {
        throw new InitError(`${where}: end of "${id}" block that was never opened.`);
      }
      justRemoved = !open.keep;
      open = null;
    }
  }
  if (open !== null) throw new InitError(`${file}:${open.line}: "${open.id}" block is never closed.`);
  return out.join("\n");
}

/**
 * Two passes through placeholders, so no replacement can rewrite the output of another — a project
 * named after the template's owner would otherwise be renamed a second time. The owner/repo pair
 * goes first, so a URL keeps the owner and repository it names even when the two are equal.
 */
export function replaceIdentity(text, from, to) {
  const pairs = [
    [`${from.owner}/${from.repo}`, `${to.owner}/${to.repo}`],
    [from.repo, to.repo],
    [from.name, to.name],
    [from.owner, to.owner],
  ];
  let result = text;
  pairs.forEach(([before], i) => {
    result = result.split(before).join(`\u0000${i}\u0000`);
  });
  pairs.forEach(([, after], i) => {
    result = result.split(`\u0000${i}\u0000`).join(after);
  });
  return result;
}

function gitTracked(root) {
  try {
    return execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
      .split("\0")
      .filter(Boolean);
  } catch {
    throw new InitError("This is not a git checkout. Clone the repository created from the template and run init there.", 2);
  }
}

function assertClean(root) {
  const status = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
  if (status.trim() !== "") {
    throw new InitError("The working tree has uncommitted changes. Commit or stash them first, so the result of init is one reviewable diff.", 2);
  }
}

/** Builds the complete result in memory. Nothing is written until every file has been processed. */
export function plan(root, manifest, selected, identity) {
  const removed = removedPaths(manifest, selected);
  const known = new Set(Object.keys(manifest.features));
  const result = { deleted: [], files: [] };
  for (const file of gitTracked(root)) {
    if (removed.some((path) => isUnder(file, path))) {
      result.deleted.push(file);
      continue;
    }
    if (!existsSync(join(root, file))) continue;
    const bytes = readFileSync(join(root, file));
    if (bytes.includes(0)) {
      result.files.push({ file, data: bytes, changed: false });
      continue;
    }
    const text = bytes.toString("utf8");
    const next = replaceIdentity(applyMarkers(text, selected, known, file), manifest.identity, identity);
    result.files.push({ file, data: next, changed: next !== text });
  }
  return result;
}

function pruneEmptyParents(root, file) {
  for (let dir = dirname(join(root, file)); dir !== root && dir.startsWith(root); dir = dirname(dir)) {
    if (!existsSync(dir) || readdirSync(dir).length > 0) return;
    rmdirSync(dir);
  }
}

const USAGE = `Usage:
  node template/init.mjs --list
  node template/init.mjs --name <project> --owner <github-owner> (--preset <preset> | --features <a,b>)
                         [--repo <repository>] [--out <directory>] [--dry-run]`;

export function main(argv = process.argv.slice(2), root = ROOT) {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      name: { type: "string" },
      owner: { type: "string" },
      repo: { type: "string" },
      preset: { type: "string" },
      features: { type: "string" },
      out: { type: "string" },
      list: { type: "boolean" },
      "dry-run": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  const manifest = loadManifest(root);
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  if (values.list) {
    console.log("Features:");
    for (const [id, feature] of Object.entries(manifest.features)) console.log(`  ${id.padEnd(14)} ${feature.summary}`);
    console.log("\nPresets:");
    for (const [id, ids] of Object.entries(manifest.presets)) console.log(`  ${id.padEnd(14)} ${ids.join(", ") || "(chassis only)"}`);
    return 0;
  }

  const problems = validateManifest(manifest, (path) => existsSync(join(root, path)));
  if (problems.length > 0) throw new InitError(`The template is inconsistent:\n  ${problems.join("\n  ")}`);
  const selected = resolveSelection(manifest, values);
  const identity = validateIdentity(values);

  const out = values.out === undefined ? null : resolve(values.out);
  if (out === null) assertClean(root);
  else if (existsSync(out) && readdirSync(out).length > 0) throw new InitError(`--out ${out} exists and is not empty.`, 2);

  const result = plan(root, manifest, selected, identity);
  const rewritten = result.files.filter((f) => f.changed).length;
  const summary = `${identity.name} (${identity.owner}/${identity.repo}) with ${[...selected].join(", ") || "no features"}: ` +
    `${result.deleted.length} file(s) deleted, ${rewritten} rewritten.`;

  if (values["dry-run"]) {
    console.log(`Dry run — nothing written.\n${summary}\nDeleted:\n  ${result.deleted.join("\n  ")}`);
    return 0;
  }
  if (out !== null) {
    for (const { file, data } of result.files) {
      mkdirSync(dirname(join(out, file)), { recursive: true });
      writeFileSync(join(out, file), data);
    }
  } else {
    // Whole paths, not only their tracked files: an ignored node_modules or dist left behind (the Dev
    // Container runs setup before anyone runs init) would keep a removed module's directory — and so
    // the module, as far as setup and verify can tell — alive.
    for (const path of removedPaths(manifest, selected)) {
      rmSync(join(root, path), { recursive: true, force: true });
      pruneEmptyParents(root, path);
    }
    for (const { file, data, changed } of result.files) if (changed) writeFileSync(join(root, file), data);
  }

  console.log(`Initialized ${summary}${out === null ? "" : `\nWritten to ${out}`}

Next:
  ${out === null ? "git status                      # review the result" : `cd ${out} && git init -b main && git add -A    # hygiene checks tracked files`}
  node scripts/setup.mjs && node scripts/verify.mjs
  git add -A && git commit -m "chore: initialize project"
  git push && node scripts/configure-github.mjs   # squash-only merges, required verify check, security settings`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main();
  } catch (err) {
    console.error(`init: ${err.message}`);
    if (!(err instanceof InitError)) console.error(USAGE);
    process.exitCode = err instanceof InitError ? err.code : 1;
  }
}
