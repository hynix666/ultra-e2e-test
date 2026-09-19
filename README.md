# ultra-e2e-test

[![verify](https://github.com/hynix666/ultra-e2e-test/actions/workflows/verify.yml/badge.svg)](https://github.com/hynix666/ultra-e2e-test/actions/workflows/verify.yml) [![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

The end-to-end test for [TEMPLATE1](https://github.com/hynix666/TEMPLATE1): a project generated with every feature, then released and updated through each template release, so that init, `template-update`, releases and MCP publishing are proven on a real repository rather than only in the template's own CI.

## Getting started

You need:

- Node 24 (`.node-version`), for the scripts and every Node module.
- Go 1.26 (`services/api-go/go.mod`), and golangci-lint for the complete local check; without it, `verify.mjs` reports golangci-lint as skipped, and CI still runs it.
- Python 3.13 or newer and [uv](https://docs.astral.sh/uv/) (`services/api-py/.python-version`), which installs the rest.
- The GitHub CLI, only to apply repository settings with `configure-github.mjs`.

Each toolchain version is pinned once, in the file named beside it above, so there is no `.tool-versions` to keep in step; mise and asdf can read those files directly.

1. Install the dependencies of every module present:

   ```bash
   node scripts/setup.mjs
   ```

2. Run the checks every CI job runs on the code:

   ```bash
   node scripts/verify.mjs             # everything
   node scripts/verify.mjs <module>    # the chassis plus the named modules only
   ```

   It runs each module's own checks and tests, and the API contract against every task service present. A check it cannot run is reported as skipped, never as passed. A few checks run only in CI, because they need a container engine, a network service or a CI-only tool: actionlint and zizmor on the workflows, `npm audit signatures`, building and starting each container image, and the report-only scans in `security.yml`.

3. Start what you are working on. Each module's entry under *What's here* names the command that starts it.

## What's here

- `scripts/` — `setup.mjs` installs every module, `verify.mjs` runs every module's checks, `check-hygiene.mjs` guards the repository's shape, `check-docs.mjs` its documentation, `check-contract.mjs` holds every task service to the one API contract in `scripts/contract/`, and `configure-github.mjs` applies the repository settings (squash merging, the required `verify` check, security features).
- `services/api-go/` — Go task API in Clean Architecture layers. `go run ./cmd/api` there serves it on port 8080. [README](services/api-go/README.md)
- `services/api-ts/` — TypeScript task API with a pure domain core. `npm start` there serves it on port 8080. [README](services/api-ts/README.md)
- `services/api-py/` — Python task API, same routes and layers. `uv run --directory src python -m api_py.main` there serves it on port 8080. [README](services/api-py/README.md)
- `services/mcp-server/` — MCP server exposing the task API to an AI assistant. `npm start` there serves it over stdio, calling the task API at `TASK_API_URL`; the README shows how to register it with a client. [README](services/mcp-server/README.md)
- `apps/web/` — React single-page app, organised by feature. `npm run dev` there serves it at http://localhost:5173, with `/api` passed to a task service on port 8080. [README](apps/web/README.md)
- `packages/ts-library/` — TypeScript library published to npm. `npm run verify` there builds it and checks the package consumers would install. [README](packages/ts-library/README.md)
- `architecture/` — LikeC4 model of the system. `npm run dev` there previews every view. [README](architecture/README.md)
- `docs/` — [the documentation index](docs/README.md) and the rules for keeping it true; `docs/adr/` holds the architecture decision records.
- `.claude/skills/` — step-by-step procedures coding agents follow for recurring tasks. `.github/prompts/` holds Copilot prompt files that wrap one of them; `AGENTS.md` holds the rules all of them follow.
- `.github/` — workflows, issue forms, pull request template, Dependabot and code owners.

## Working with a coding agent

[AGENTS.md](AGENTS.md) holds the rules every coding agent follows here; `CLAUDE.md`, `GEMINI.md` and Copilot's instructions point to it rather than repeating it. For a recurring task, such as recording a decision or taking a template update, the matching procedure in `.claude/skills/` is the one to follow. Ask the agent to run `node scripts/verify.mjs` and to say what it ran before it reports a change as done.

## Continuous integration

- **`verify.yml`** — on every pull request, every push to `main`, and in a merge queue: repository hygiene, chassis tests, actionlint, a security audit of the workflows with [zizmor](https://docs.zizmor.sh), and one job per module — each service job also runs the API contract and starts the service's container image to prove it answers — all feeding the aggregate **`verify`** job, which is the only required check ([ADR-0002](docs/adr/0002-one-required-check.md)).
- **`pr-title.yml`** — pull request titles follow Conventional Commits.
- **`copilot-setup-steps.yml`** — the environment GitHub's Copilot coding agent prepares before it works here: every toolchain the selected features need, then `node scripts/setup.mjs`. It runs on its own only when it changes.
- **`security.yml`** — report-only scans that fail only when a scan could not run: gitleaks over new commits and weekly over history, `npm audit` for every npm lockfile, and a Trivy scan of every container image the repository builds, for fixable high and critical vulnerabilities in its operating-system and language packages.
- **`security.yml`, Go** — govulncheck, reporting only vulnerabilities in code the Go service actually calls.
- **`security.yml`, Python** — pip-audit over the Python service's lockfile.
- **`codeql.yml`** — CodeQL analysis; enable it by setting the repository variable `CODEQL_ENABLED=true` (needs a public repository or GitHub Advanced Security).
- **`scorecard.yml`** — [OpenSSF Scorecard](https://scorecard.dev): an outside measurement of the practices this repository claims, published and uploaded to code scanning; enable it with `SCORECARD_ENABLED=true` on a public repository. Some checks measure the project rather than the workflows, and a new or single-maintainer repository scores low on them: Code-Review and Branch-Protection while pull requests merge without a second person's review, Maintained for its first 90 days, SAST until CodeQL has run on recent pull requests, and CII-Best-Practices until the project registers for the badge.
- **`mcp-publish.yml`** — after a release, pushes the MCP server's image, built for amd64 and arm64, to GitHub Container Registry and its `server.json` to the MCP Registry, tokenlessly; enable it with `MCP_PUBLISH_ENABLED=true` ([how](services/mcp-server/README.md#publish)).
- **`release.yml`** — release-please on `main`, off until `RELEASE_ENABLED=true`, which `configure-github.mjs` sets. Releases start at `0.1.0`. GitHub holds the checks of a pull request opened by `github-actions[bot]` until someone approves them, so releasing is: open the release pull request, *Approve workflows to run*, wait for `verify`, merge. A `RELEASE_PLEASE_TOKEN` secret holding a GitHub App or personal token removes that step.
- **Library publishing** — with `release` selected, each release publishes `packages/ts-library` to npm with provenance once `NPM_PUBLISH_ENABLED=true` is set and npm trusts the workflow ([how](packages/ts-library/README.md#publish)).
- **`architecture.yml`** — publishes the architecture model to GitHub Pages once `PAGES_ENABLED=true` is set.

Dependabot proposes grouped updates weekly for every ecosystem present, SHA-pinned actions included.

## Taking template updates

This project was generated from ultra-e2e-test, and `CHANGELOG.md` records the release it came from. When a later release fixes something you want, `scripts/template-update.mjs` brings the change in: it regenerates the project as the old and the new release would have made it, with this project's name and features, and applies the difference as a three-way merge. What you changed yourself is kept, and a conflict is left to resolve like any merge conflict.

```bash
node scripts/template-update.mjs --to vX.Y.Z --dry-run   # what would change
node scripts/template-update.mjs --to vX.Y.Z             # apply, then review, verify and commit
```

Updates only move forward: a release older than the one the project is on is refused.

The `update-from-template` skill walks an agent through the whole procedure.

## Contributing and security

[CONTRIBUTING.md](CONTRIBUTING.md) describes the workflow, [SECURITY.md](SECURITY.md) how to report a vulnerability privately, and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) the expected conduct. Guidance for coding agents is in [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)
