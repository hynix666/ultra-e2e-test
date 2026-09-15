# ULTRA-TEMPLATE

<!-- ultra:begin template -->
**A GitHub repository template that starts a project with the verification, supply-chain and architecture discipline most projects only add after their first incident — and lets you choose the stack.**

It combines the strongest ideas of eight templates, including NexusPrompt's own workflow. [template/ANALYSIS.md](template/ANALYSIS.md) records what was taken from each and what was left out, and why.

- **One gate.** `node scripts/verify.mjs` runs what CI runs, and CI reports a single required check, `verify`.
- **A pinned supply chain the build enforces.** Actions pinned to commit SHAs, checksum-verified binaries, digest-pinned images.
- **Repository hygiene checks.** A tracked `.env`, a vendored `node_modules`, a truncated `.gitignore`, a 50 MB blob, or a CI job left out of the gate each fail the build.
- **Clean Architecture services whose layer rules are tests**, in Go and TypeScript, with identical APIs.
- **Architecture as code.** A LikeC4 model with rules checked in CI.
- **Selectable features, tested.** CI generates a project from every preset and runs that project's own checks.

## Start a project

1. On GitHub: **Use this template → Create a new repository**. Clone it.
2. List the features and presets:

   ```bash
   node template/init.mjs --list
   ```

3. Initialize. This needs Node 24 and a clean working tree; add `--dry-run` to see the plan first.

   ```bash
   node template/init.mjs --name my-app --owner my-org --preset fullstack-ts
   ```

   Or pick features individually: `--features go-service,release`.

4. Install, verify and commit:

   ```bash
   node scripts/setup.mjs && node scripts/verify.mjs
   git add -A && git commit -m "chore: initialize project"
   ```

5. Push, then apply the settings GitHub does not copy from a template: squash-only merging, a ruleset on `main` requiring a pull request and the **`verify`** check, Dependabot security updates, private vulnerability reporting and secret scanning. Preview with `--dry-run`; it needs the GitHub CLI signed in as a repository admin.

   ```bash
   git push && node scripts/configure-github.mjs
   ```

| Feature | What you get |
|---|---|
| `go-service` | Go HTTP service in Clean Architecture layers, standard library only; a test enforces the layer rules; golangci-lint; distroless image |
| `ts-service` | TypeScript HTTP service run directly by Node 24; pure domain core; import boundaries checked on every file; no runtime dependencies |
| `web` | React + Vite single-page app with Vitest, validating API responses at its boundary |
| `architecture` | LikeC4 model of the system, with model rules as tests and an opt-in GitHub Pages site |
| `release` | release-please: release pull requests, tags and `CHANGELOG.md` from Conventional Commits |
| `devcontainer` | Dev Container with the toolchains of the features you selected |

| Preset | Features |
|---|---|
| `minimal` | none: the chassis only (hygiene, CI, security, community files, ADRs) |
| `go-api` | `go-service`, `architecture`, `release`, `devcontainer` |
| `fullstack-ts` | `ts-service`, `web`, `architecture`, `release`, `devcontainer` |
| `all` | every feature |

Init deletes the features you did not select, keeps or removes the marked blocks in shared files such as workflows and this README, replaces the template's name and owner with yours, and deletes itself. [template/README.md](template/README.md) explains the mechanism and how to add a feature.

---
<!-- ultra:end template -->

## Layout

- `scripts/` — `setup.mjs` installs every module, `verify.mjs` runs the whole check, `check-hygiene.mjs` guards the repository's shape.
<!-- ultra:begin go-service -->
- `services/api-go/` — Go task API in Clean Architecture layers. [README](services/api-go/README.md)
<!-- ultra:end go-service -->
<!-- ultra:begin ts-service -->
- `services/api-ts/` — TypeScript task API with a pure domain core. [README](services/api-ts/README.md)
<!-- ultra:end ts-service -->
<!-- ultra:begin web -->
- `apps/web/` — React single-page app. [README](apps/web/README.md)
<!-- ultra:end web -->
<!-- ultra:begin architecture -->
- `architecture/` — LikeC4 model of the system. [README](architecture/README.md)
<!-- ultra:end architecture -->
- `docs/adr/` — architecture decision records.
- `.github/` — workflows, issue forms, pull request template, Dependabot and code owners.

## Commands

Everything needs Node 24 (`.node-version`).

```bash
node scripts/setup.mjs              # install the dependencies of every module present
node scripts/verify.mjs             # the whole check, as CI runs it
node scripts/verify.mjs <module>    # the chassis plus the named modules only
node scripts/check-hygiene.mjs      # repository-shape rules only
node scripts/configure-github.mjs   # apply repository settings: merging, required check, security
```

## Continuous integration

- **`verify.yml`** — on every push and pull request: repository hygiene, chassis tests, actionlint, and one job per module, all feeding the aggregate **`verify`** job, which is the only required check ([ADR-0002](docs/adr/0002-one-required-check.md)).
- **`pr-title.yml`** — pull request titles follow Conventional Commits.
- **`security.yml`** — gitleaks over new commits and weekly over history; report-only.
- **`codeql.yml`** — CodeQL analysis; enable it by setting the repository variable `CODEQL_ENABLED=true` (needs a public repository or GitHub Advanced Security).
<!-- ultra:begin release -->
- **`release.yml`** — release-please on `main`, off until `RELEASE_ENABLED=true`, which `configure-github.mjs` sets; its header explains the token it also needs.
<!-- ultra:end release -->
<!-- ultra:begin architecture -->
- **`architecture.yml`** — publishes the architecture model to GitHub Pages once `PAGES_ENABLED=true` is set.
<!-- ultra:end architecture -->
<!-- ultra:begin template -->
- **`template-test.yml`** — template only: generates a project from every preset and runs its setup, verify and actionlint.
<!-- ultra:end template -->

Dependabot proposes grouped updates weekly for every ecosystem present, SHA-pinned actions included.

## Contributing and security

[CONTRIBUTING.md](CONTRIBUTING.md) describes the workflow, [SECURITY.md](SECURITY.md) how to report a vulnerability privately, and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) the expected conduct. Guidance for coding agents is in [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)
