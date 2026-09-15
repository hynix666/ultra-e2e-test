// Every rule gets a case that must fire and the clean fixture that must not. A checker with only
// the passing case proves nothing: it passes just as well when the rule is broken.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { checkGate, checkRepoHygiene, checkWorkflow, MAX_TRACKED_BYTES, REQUIRED_IGNORES } from "../scripts/check-hygiene.mjs";

const IGNORE = [...REQUIRED_IGNORES, "!.env.example", "build/", "*.tsbuildinfo", ".DS_Store", ".idea/", "*.local"].join("\n");
const SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1";

function fixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), "hygiene-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries({ ".gitignore": `${IGNORE}\n`, ...files })) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  execFileSync("git", ["init", "-q"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["add", "-A", "--force"], { cwd: root, stdio: "ignore" });
  return root;
}

const failures = (root) => checkRepoHygiene(root).failures.join("\n");

test("a clean repository passes", (t) => {
  const result = checkRepoHygiene(fixture(t, { "README.md": "# ok\n", "package.json": "{}\n", ".env.example": "PORT=8080\n" }));
  assert.equal(result.ok, true, result.failures?.join("\n"));
});

test("a truncated .gitignore fails", (t) => {
  assert.match(failures(fixture(t, { ".gitignore": "node_modules/\n" })), /below the floor/);
});

test("a dependency directory tracked below the root fails", (t) => {
  assert.match(failures(fixture(t, { "apps/web/node_modules/pkg/index.js": "" })), /under a `node_modules` directory/);
});

test("an oversized file fails", (t) => {
  assert.match(failures(fixture(t, { "blob.bin": Buffer.alloc(MAX_TRACKED_BYTES + 1) })), /blob\.bin` is 4\.0 MB/);
});

test("invalid JSON fails while tsconfig comments pass", (t) => {
  const found = failures(fixture(t, { "broken.json": "{", "tsconfig.json": "{ // comments are fine here\n}\n" }));
  assert.match(found, /broken\.json` is not valid JSON/);
  assert.doesNotMatch(found, /tsconfig/);
});

test("a tracked .env fails and .env.example does not", (t) => {
  const found = failures(fixture(t, { ".env": "TOKEN=x\n", ".env.example": "TOKEN=\n" }));
  assert.match(found, /environment file\(s\) tracked: \.env\./);
  assert.doesNotMatch(found, /tracked: .*\.env\.example/);
});

test("a template marker fails after initialization but not while template/ exists", (t) => {
  const marker = `# ultra:${"begin"} web\n`;
  assert.match(failures(fixture(t, { "ci.yml": marker })), /survived initialization: ci\.yml:1/);
  assert.equal(checkRepoHygiene(fixture(t, { "ci.yml": marker, "template/features.json": "{}\n" })).ok, true);
});

test("workflow rules fire on an unpinned action, missing permissions and a missing timeout", () => {
  const found = checkWorkflow(".github/workflows/ci.yml", "on: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n").join("\n");
  assert.match(found, /not pinned/);
  assert.match(found, /no top-level `permissions:`/);
  assert.match(found, /job `build` has no `timeout-minutes`/);
});

test("a pinned workflow with permissions and timeouts passes, and a reusable call needs no timeout", () => {
  const text = [
    "on: push", "permissions:", "  contents: read", "jobs:",
    "  build:", "    runs-on: ubuntu-latest", "    timeout-minutes: 5", "    steps:",
    `      - uses: actions/checkout@${SHA} # v7.0.1`, "      - uses: ./.github/actions/local",
    "  deploy:", "    uses: ./.github/workflows/deploy.yml",
  ].join("\n");
  assert.deepEqual(checkWorkflow(".github/workflows/ci.yml", text), []);
});

test("a verify.yml job missing from the gate's needs fails", () => {
  const workflow = (needs) => [
    "permissions:", "  contents: read", "jobs:",
    "  lint:", "    timeout-minutes: 5", "  test:", "    timeout-minutes: 5",
    "  verify:", "    needs:", ...needs.map((n) => `      - ${n}`), "      # a comment line is not a job", "    timeout-minutes: 5",
  ].join("\n");
  assert.match(checkGate("verify.yml", workflow(["lint"])).join(""), /job\(s\) test are missing/);
  assert.deepEqual(checkGate("verify.yml", workflow(["lint", "test"])), []);
  assert.match(checkGate("verify.yml", "jobs:\n  lint:\n    timeout-minutes: 5\n").join(""), /no aggregate `verify` job/);
});

test("a raw control character in a source file fails, and an escape does not", (t) => {
  const found = failures(fixture(t, { "src/raw.mjs": "const sep = \"\u0000\";\n", "src/escaped.mjs": "const sep = \"\\u0000\";\n" }));
  assert.match(found, /raw control character\(s\) in src\/raw\.mjs:1\./);
  assert.doesNotMatch(found, /escaped\.mjs/);
});

test("a repository with nothing tracked is fatal, not vacuously clean", (t) => {
  const root = mkdtempSync(join(tmpdir(), "hygiene-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, ".gitignore"), IGNORE);
  execFileSync("git", ["init", "-q"], { cwd: root, stdio: "ignore" });
  assert.match(checkRepoHygiene(root).fatal ?? "", /nothing is tracked/);
});

test("a directory that is not a git repository is fatal", (t) => {
  const root = mkdtempSync(join(tmpdir(), "hygiene-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, ".gitignore"), IGNORE);
  assert.match(checkRepoHygiene(root).fatal ?? "", /git repository/);
});
