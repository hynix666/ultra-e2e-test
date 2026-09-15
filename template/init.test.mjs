import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { MODULES } from "../scripts/modules.mjs";
import {
  applyMarkers, InitError, loadManifest, MARKER_RE, removedPaths, replaceIdentity, resolveSelection, ROOT, validateIdentity, validateManifest,
} from "./init.mjs";

// Built by concatenation so this file never contains a marker line of its own.
const begin = (id) => `# ultra:${"begin"} ${id}`;
const end = (id) => `# ultra:${"end"} ${id}`;
const known = new Set(["go-service", "web"]);

test("selected blocks keep their content and lose their marker lines; the rest disappears", () => {
  const text = ["a", begin("go-service"), "go", end("go-service"), begin("web"), "web", end("web"), "z"].join("\n");
  assert.equal(applyMarkers(text, new Set(["web"]), known), "a\nweb\nz");
});

test("removing blocks between blank lines leaves a single blank line", () => {
  const text = ["a", "", begin("web"), "web", end("web"), "", begin("go-service"), "go", end("go-service"), "", "b"].join("\n");
  assert.equal(applyMarkers(text, new Set(), known), "a\n\nb");
  assert.equal(applyMarkers(text, new Set(["web"]), known), "a\n\nweb\n\nb");
});

test("template blocks are always removed", () => {
  assert.equal(applyMarkers(["a", begin("template"), "only here", end("template")].join("\n"), new Set(["web"]), known), "a");
});

test("malformed markers throw instead of deleting the rest of the file", () => {
  const cases = {
    unknown: [begin("nope"), end("nope")],
    nested: [begin("web"), begin("go-service"), end("go-service"), end("web")],
    unclosed: [begin("web"), "x"],
    mismatched: [begin("web"), end("go-service")],
  };
  for (const [name, lines] of Object.entries(cases)) {
    assert.throws(() => applyMarkers(lines.join("\n"), known, known, name), InitError, name);
  }
});

test("identity replacement never rewrites its own output", () => {
  const from = { owner: "hynix666", repo: "ULTRA-TEMPLATE", name: "ultra-template" };
  const to = { owner: "octo", repo: "hynix666-app", name: "ultra-template-x" };
  const text = "github.com/hynix666/ULTRA-TEMPLATE module github.com/hynix666/ultra-template @hynix666";
  assert.equal(replaceIdentity(text, from, to), "github.com/octo/hynix666-app module github.com/octo/ultra-template-x @octo");
});

test("identity placeholders cannot collide with ordinary text such as a digest", () => {
  const from = { owner: "hynix666", repo: "ULTRA-TEMPLATE", name: "ultra-template" };
  const to = { owner: "octo", repo: "demo-app", name: "demo-app" };
  const text = "FROM node@sha256:00000000000000001230000 # hynix666";
  assert.equal(replaceIdentity(text, from, to), "FROM node@sha256:00000000000000001230000 # octo");
});

test("selection takes exactly one of preset or features and rejects unknown names", () => {
  const manifest = loadManifest();
  assert.deepEqual([...resolveSelection(manifest, { features: "web, release" })], ["web", "release"]);
  assert.equal(resolveSelection(manifest, { preset: "minimal" }).size, 0);
  assert.throws(() => resolveSelection(manifest, {}), /exactly one/);
  assert.throws(() => resolveSelection(manifest, { preset: "all", features: "web" }), /exactly one/);
  assert.throws(() => resolveSelection(manifest, { features: "web,kubernetes" }), /Unknown feature\(s\): kubernetes/);
});

test("identity input is validated at the boundary", () => {
  assert.deepEqual(validateIdentity({ name: "my-app", owner: "my-org" }), { name: "my-app", owner: "my-org", repo: "my-app" });
  for (const bad of [{ name: "My App", owner: "o" }, { name: "../x", owner: "o" }, { name: "ok-name", owner: "bad/owner" }, { name: "ok-name" }]) {
    assert.throws(() => validateIdentity(bad), InitError, JSON.stringify(bad));
  }
});

test("the real manifest is consistent and every marker in the tree is well formed", () => {
  const manifest = loadManifest();
  assert.deepEqual(validateManifest(manifest, (p) => existsSync(join(ROOT, p))), []);
  const ids = new Set(Object.keys(manifest.features));
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean);
  let markers = 0;
  for (const file of tracked.filter((f) => !f.startsWith("template/") && existsSync(join(ROOT, f)))) {
    const text = readFileSync(join(ROOT, file), "utf8");
    markers += text.split("\n").filter((l) => MARKER_RE.test(l)).length;
    assert.doesNotThrow(() => applyMarkers(text, ids, ids, file));
  }
  assert.ok(markers > 0, "expected marker lines in the tree");
});

test("every module directory scripts/modules.mjs knows is owned by exactly one feature", () => {
  const manifest = loadManifest();
  for (const module of MODULES) {
    const owners = Object.entries(manifest.features).filter(([, f]) => f.paths.includes(module.dir)).map(([id]) => id);
    assert.deepEqual(owners, [module.id], module.dir);
  }
});

test("removed paths cover unselected features and template-only files", () => {
  const removed = removedPaths(loadManifest(), new Set(["web"]));
  assert.ok(removed.includes("template") && removed.includes("services/api-go"));
  assert.ok(!removed.includes("apps/web"));
});

test("in-place init removes an unselected module whole, ignored files included", (t) => {
  const copy = mkdtempSync(join(tmpdir(), "init-inplace-"));
  t.after(() => rmSync(copy, { recursive: true, force: true }));
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean);
  for (const file of tracked.filter((f) => existsSync(join(ROOT, f)))) {
    mkdirSync(dirname(join(copy, file)), { recursive: true });
    copyFileSync(join(ROOT, file), join(copy, file));
  }
  const git = (...args) => execFileSync("git", args, { cwd: copy, stdio: "ignore" });
  git("init", "-q");
  git("add", "-A");
  git("-c", "user.name=test", "-c", "user.email=test@example.invalid", "commit", "-q", "-m", "copy");
  // What the Dev Container's postCreateCommand leaves behind before init runs.
  mkdirSync(join(copy, "services/api-ts/node_modules/pkg"), { recursive: true });
  writeFileSync(join(copy, "services/api-ts/node_modules/pkg/index.js"), "");

  execFileSync("node", ["template/init.mjs", "--name", "demo-app", "--owner", "octo", "--preset", "go-api"], { cwd: copy, stdio: "pipe" });

  assert.equal(existsSync(join(copy, "services/api-ts")), false);
  assert.equal(existsSync(join(copy, "template")), false);
  assert.equal(existsSync(join(copy, "services/api-go/go.mod")), true);
});

test("init --out writes a project with no template residue", (t) => {
  const out = mkdtempSync(join(tmpdir(), "init-"));
  t.after(() => rmSync(out, { recursive: true, force: true }));
  rmSync(out, { recursive: true });
  execFileSync("node", ["template/init.mjs", "--name", "demo-app", "--owner", "octo", "--preset", "minimal", "--out", out], { cwd: ROOT, stdio: "pipe" });
  for (const gone of ["template", "services", "apps", "architecture", ".devcontainer", ".github/workflows/template-test.yml"]) {
    assert.equal(existsSync(join(out, gone)), false, gone);
  }
  assert.match(readFileSync(join(out, "LICENSE"), "utf8"), /octo/);
  assert.match(readFileSync(join(out, "README.md"), "utf8"), /^# demo-app/);
  assert.doesNotMatch(readFileSync(join(out, ".github/workflows/verify.yml"), "utf8"), /ultra:|go-service/);
});
