# ultra-e2e-test

[![verify](https://github.com/hynix666/ultra-e2e-test/actions/workflows/verify.yml/badge.svg)](https://github.com/hynix666/ultra-e2e-test/actions/workflows/verify.yml) [![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Layout

- `scripts/` — `setup.mjs` installs every module, `verify.mjs` runs the whole check, `check-hygiene.mjs` guards the repository's shape, `check-docs.mjs` its documentation, and `check-contract.mjs` holds every task service to the one API contract in `scripts/contract/`.
- `services/api-go/` — Go task API in Clean Architecture layers. [README](services/api-go/README.md)
- `services/api-ts/` — TypeScript task API with a pure domain core. [README](services/api-ts/README.md)
- `services/api-py/` — Python task API, same routes and layers. [README](services/api-py/README.md)
- `services/mcp-server/` — MCP server exposing the task API to an AI assistant. [README](services/mcp-server/README.md)
- `apps/web/` — React single-page app, organised by feature. [README](apps/web/README.md)
- `packages/ts-library/` — TypeScript library published to npm. [README](packages/ts-library/README.md)
- `architecture/` — LikeC4 model of the system. [README](architecture/README.md)
- `docs/` — [the documentation index](docs/README.md) and the rules for keeping it true; `docs/adr/` holds the architecture decision records.
- `.claude/skills/` — step-by-step procedures coding agents follow for recurring tasks. `.github/prompts/` holds Copilot prompt files that wrap one of them; `AGENTS.md` holds the rules all of them follow.
- `.github/` — workflows, issue forms, pull request template, Dependabot and code owners.

## Getting started

Prerequisites:

- Node 24 (`.node-version`), for the scripts and every Node module.
- Go 1.26 (`services/api-go/go.mod`), and golangci-lint for the complete local check.
- Python 3.13 or newer and [uv](https://docs.astral.sh/uv/) (`services/api-py/.python-version`), which installs the rest.
- The GitHub CLI, only for `configure-github.mjs`.

Each toolchain version is pinned once, in the file that toolchain reads: `.node-version`, `go.mod`, `.python-version`. Version managers such as mise and asdf can be configured to read those files directly, so there is no `.tool-versions` to keep in step with them.

```bash
node scripts/setup.mjs              # install the dependencies of every module present
node scripts/verify.mjs             # the whole check, as CI runs it
node scripts/verify.mjs <module>    # the chassis plus the named modules only
node scripts/check-hygiene.mjs      # repository-shape rules only
node scripts/check-docs.mjs         # agent instructions and the docs index
node scripts/configure-github.mjs   # apply repository settings: merging, required check, security
```

## Continuous integration

- **`verify.yml`** — on every push and pull request: repository hygiene, chassis tests, actionlint, and one job per module — each service job also runs the API contract and starts the service's container image to prove it answers — all feeding the aggregate **`verify`** job, which is the only required check ([ADR-0002](docs/adr/0002-one-required-check.md)).
- **`pr-title.yml`** — pull request titles follow Conventional Commits.
- **`copilot-setup-steps.yml`** — the environment GitHub's Copilot coding agent prepares before it works here: every toolchain the selected features need, then `node scripts/setup.mjs`. It runs on its own only when it changes.
- **`security.yml`** — report-only scans that fail only when a scan could not run: gitleaks over new commits and weekly over history, `npm audit` for every npm lockfile, and pip-audit for the Python lockfile when that service is present.
- **`security.yml`, Go** — govulncheck, reporting only vulnerabilities in code the Go service actually calls.
- **`codeql.yml`** — CodeQL analysis; enable it by setting the repository variable `CODEQL_ENABLED=true` (needs a public repository or GitHub Advanced Security).
- **`scorecard.yml`** — [OpenSSF Scorecard](https://scorecard.dev): an outside measurement of the practices this repository claims, published and uploaded to code scanning; enable it with `SCORECARD_ENABLED=true` on a public repository. Some checks measure the project rather than the workflows, and a new or single-maintainer repository scores low on them: Code-Review and Branch-Protection while pull requests merge without a second person's review, Maintained for its first 90 days, SAST until CodeQL has run on recent pull requests, and CII-Best-Practices until the project registers for the badge.
- **`mcp-publish.yml`** — after a release, pushes the MCP server's image to GitHub Container Registry and its `server.json` to the MCP Registry, tokenlessly; enable it with `MCP_PUBLISH_ENABLED=true` ([how](services/mcp-server/README.md#publish)).
- **`release.yml`** — release-please on `main`, off until `RELEASE_ENABLED=true`, which `configure-github.mjs` sets. Releases start at `0.1.0`. GitHub holds the checks of a pull request opened by `github-actions[bot]` until someone approves them, so releasing is: open the release pull request, *Approve workflows to run*, wait for `verify`, merge. A `RELEASE_PLEASE_TOKEN` secret holding a GitHub App or personal token removes that step.
- **Library publishing** — with `release` selected, each release publishes `packages/ts-library` to npm with provenance once `NPM_PUBLISH_ENABLED=true` is set and npm trusts the workflow ([how](packages/ts-library/README.md#publish)).
- **`architecture.yml`** — publishes the architecture model to GitHub Pages once `PAGES_ENABLED=true` is set.

Dependabot proposes grouped updates weekly for every ecosystem present, SHA-pinned actions included.

## Taking template updates

This project was generated from ultra-e2e-test, and `CHANGELOG.md` records the release it came from. When a later release fixes something you want, `scripts/template-update.mjs` brings the change in: it regenerates the project as the old and the new release would have made it, with this project's name and features, and applies the difference as a three-way merge. What you changed yourself is kept, and a conflict is left to resolve like any merge conflict.

```bash
node scripts/template-update.mjs --to v1.4.0 --dry-run   # what would change
node scripts/template-update.mjs --to v1.4.0             # apply, then review, verify and commit
```

A project generated before v1.4.0 does not have the script yet. Run it once from a clone of the template, with the project as the working directory — `node ../ultra-e2e-test/scripts/template-update.mjs --to v1.4.0` — and the update brings the script in with everything else.

The `update-from-template` skill walks an agent through the whole procedure.

## Contributing and security

[CONTRIBUTING.md](CONTRIBUTING.md) describes the workflow, [SECURITY.md](SECURITY.md) how to report a vulnerability privately, and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) the expected conduct. Guidance for coding agents is in [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)
