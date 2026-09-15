# How the template works

Everything in `template/` is deleted when a project is initialized. This file is for whoever maintains ULTRA-TEMPLATE itself.

## Why initialization is a local script

GitHub's *Use this template* copies every file and accepts no parameters, so feature selection has to happen after the copy. It cannot run as a GitHub Actions job in the new repository: a push made with `GITHUB_TOKEN` may not create, change or delete anything under `.github/workflows/`, and initialization does all three. So `template/init.mjs` runs once, on the developer's machine, and the result is committed as one reviewable change.

It has no dependencies beyond Node 24, validates every argument before touching a file, builds the whole result in memory before writing any of it, and refuses to run in place on a dirty working tree, so `git checkout -- . && git clean -fd` always undoes it.

## The three mechanisms

**Feature paths.** `features.json` lists, for each feature, the paths it owns. Paths of unselected features are deleted, and so is every `templateOnly` path.

**Marker blocks.** Content inside shared files — workflows, Dependabot, the README, the architecture model — is selected with a pair of marker lines. A marker is the text `ultra:begin` or `ultra:end` followed by a feature id, written inside whatever comment syntax the file uses:

```text
# ultra:begin FEATURE          (YAML, .gitignore)
<!-- ultra:begin FEATURE -->   (Markdown)
// ultra:begin FEATURE         (JSONC, LikeC4, TypeScript)
```

(`FEATURE` is written in capitals here so this page contains no real marker.) When the feature is selected, the marker lines are deleted and the content between them is kept; otherwise both go. The id `template` is reserved and always removed. Blocks cannot nest, and an unknown id, an unclosed block or a mismatched end stops init before any file is written. After initialization `scripts/check-hygiene.mjs` fails if a marker line survives.

Strict JSON has no comments, so JSON files carry no markers; a feature that needs a JSON file owns the whole file as a path. A block can depend on one feature only; content that should appear only when two features are both selected cannot be expressed, and is avoided by design (the architecture model links each service to the user rather than to the web app).

**Identity.** The template is a working project under a real identity — owner `hynix666`, repository `ULTRA-TEMPLATE`, name `ultra-template` — so it verifies green before anyone initializes it, the way CleanArchitecture's `sourceName` does. Init replaces those three strings in every text file, through placeholders so no replacement can rewrite another's output. Never write them in a form that should survive initialization.

## Adding a feature

1. Create the module directory, self-contained: its own manifest and lockfile, tests, a `verify` script (or the Go toolchain's checks), and a README.
2. Add the feature to `features.json` with the paths it owns, and to the presets it belongs in.
3. If `setup` and `verify` must run it, add it to `scripts/modules.mjs`. The template tests fail if a module there is not owned by exactly one feature.
4. In `.github/workflows/verify.yml`, add its job inside a marker block, and list the job under `verify.needs` inside another. `check-hygiene` fails if the job is missing from the gate.
5. Add its Dependabot entries, and its lines in `README.md`, `AGENTS.md` and wherever else it belongs, each inside markers.
6. Verify, as described below. Add a preset to the matrix in `template-test.yml` if you created one.

## Verifying a change to the template

```bash
node scripts/verify.mjs                          # the template as a project, every feature present
node template/init.mjs --preset minimal --name demo-app --owner octo-org --out ../demo-minimal
cd ../demo-minimal && git init -q && git add -A && node scripts/setup.mjs && node scripts/verify.mjs
```

`template/init.test.mjs` checks the marker grammar, identity replacement, argument validation, that the manifest matches the tree, and that an initialized project has no template residue. `.github/workflows/template-test.yml` generates every preset in CI and runs each project's own `setup`, `verify` and actionlint.
