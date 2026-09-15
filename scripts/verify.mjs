/**
 * The whole check, locally, running what CI runs.
 *
 *   node scripts/verify.mjs                  # the chassis and every module present
 *   node scripts/verify.mjs go-service web   # the chassis and only the modules named
 *
 * A step that cannot run FAILS. A check that quietly does not run reads exactly like one that
 * passed, so a missing toolchain or missing dependencies is a red line with the fix in it. The one
 * exception is golangci-lint, a linter many machines lack: it is reported as SKIPPED by name, and
 * the go-service CI job always runs it.
 *
 * Exit 0 everything passed · 1 something failed · 2 a module name that is unknown or not present.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { available, MODULES, presentModules, ROOT, run } from "./modules.mjs";

const results = [];
const record = (name, status, note = "") => results.push({ name, status, note });

function step(name, command, args, cwd = ROOT) {
  console.log(`\n▶ ${name}`);
  const { status } = run(command, args, { cwd });
  record(name, status === 0 ? "pass" : "fail", status === 0 ? "" : `exit ${status}`);
}

function chassis() {
  step("chassis: hygiene", "node", ["scripts/check-hygiene.mjs"]);
  const suites = ["test/*.test.mjs"];
  if (existsSync(join(ROOT, "template"))) suites.push("template/*.test.mjs");
  step("chassis: tests", "node", ["--test", ...suites]);
}

function nodeModule(module) {
  const cwd = join(ROOT, module.dir);
  if (!existsSync(join(cwd, "node_modules"))) {
    record(`${module.id}: dependencies`, "fail", "not installed; run node scripts/setup.mjs");
    return;
  }
  step(`${module.id}: npm run verify`, "npm", ["run", "verify"], cwd);
}

function goModule(module) {
  const cwd = join(ROOT, module.dir);
  if (!available("go")) {
    record(`${module.id}: toolchain`, "fail", "go is not on PATH; install Go or remove the module");
    return;
  }
  const fmt = run("gofmt", ["-l", "."], { cwd, capture: true });
  const unformatted = fmt.stdout.trim().split(/\r?\n/).filter(Boolean);
  record(`${module.id}: gofmt`, fmt.status === 0 && unformatted.length === 0 ? "pass" : "fail", unformatted.join(", "));
  step(`${module.id}: go mod tidy -diff`, "go", ["mod", "tidy", "-diff"], cwd);
  step(`${module.id}: go vet`, "go", ["vet", "./..."], cwd);
  step(`${module.id}: go test`, "go", ["test", "./..."], cwd);
  if (available("golangci-lint")) step(`${module.id}: golangci-lint`, "golangci-lint", ["run"], cwd);
  else record(`${module.id}: golangci-lint`, "skipped", "not on PATH; the go-service CI job runs it");
}

const requested = process.argv.slice(2);
const unknown = requested.filter((id) => !MODULES.some((m) => m.id === id));
if (unknown.length > 0) {
  console.error(`verify: unknown module(s) ${unknown.join(", ")}. Known: ${MODULES.map((m) => m.id).join(", ")}.`);
  process.exit(2);
}

const present = presentModules();
const absent = requested.filter((id) => !present.some((m) => m.id === id));
if (absent.length > 0) {
  // Naming a module that is not here must not print OK after checking only the chassis.
  console.error(`verify: module(s) ${absent.join(", ")} are not present in this repository.`);
  process.exit(2);
}

chassis();
for (const module of present) {
  if (requested.length > 0 && !requested.includes(module.id)) continue;
  if (module.toolchain === "go") goModule(module);
  else nodeModule(module);
}

const icon = { pass: "✔", fail: "✘", skipped: "–" };
console.log("\nverify summary");
for (const { name, status, note } of results) console.log(`  ${icon[status]} ${name}${note ? `  (${note})` : ""}`);
const failed = results.filter((r) => r.status === "fail").length;
console.log(failed === 0 ? "\nverify: OK" : `\nverify: ${failed} step(s) failed`);
process.exitCode = failed === 0 ? 0 : 1;
