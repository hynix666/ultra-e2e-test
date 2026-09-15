# AGENTS.md

Instructions for coding agents working in this repository. `CLAUDE.md` imports this file, so keep every instruction here.

## Verify, then report exactly what ran

- `node scripts/verify.mjs` is the whole check and runs what CI runs. For a change confined to one module, `node scripts/verify.mjs <module>` runs the chassis and that module.
- Say which commands you ran and what they showed. Never imply verification you did not perform.
- A check that could not run is a failure to report, not a pass.

## Invariants the build enforces

Each of these fails `scripts/check-hygiene.mjs` or a module's own checks. Do not work around one; if it is wrong, change it deliberately and say why.

- **One required check.** The ruleset `scripts/configure-github.mjs` creates requires only the `verify` job in `.github/workflows/verify.yml`. A new CI job must also be listed under `verify.needs`.
- **Pinned supply chain.** Every third-party `uses:` is a 40-character commit SHA followed by `# vX.Y.Z`. Resolve the SHA from the release tag (`gh api repos/OWNER/REPO/commits/TAG --jq .sha`); never copy one from memory. Binaries downloaded in CI are checksum-verified, and container base images carry a digest. See [ADR-0003](docs/adr/0003-pin-third-party-code.md).
- **Least privilege in workflows.** Top-level `permissions: contents: read`, widened per job only where needed. Every job has `timeout-minutes`. Event values such as branch names reach shell scripts through `env:`, never as `${{ }}` inside `run:`.
- **Repository shape.** No `.env` files, no dependency directories, no file over 4 MB, no invalid JSON, nothing both tracked and ignored.
- **Independent modules.** Every module has its own manifest, lockfile and CI job. Never import across module directories ([ADR-0004](docs/adr/0004-independent-modules.md)).

## Architecture

Services keep domain, use cases, adapters and a composition root, with dependencies pointing inward ([ADR-0005](docs/adr/0005-layered-services-with-enforced-boundaries.md)). Clocks and id sources are injected; nothing below the composition root reads the wall clock, randomness or the environment.

<!-- ultra:begin go-service -->
### services/api-go

`internal/entity` ← `internal/usecase` ← `internal/repo/*` and `internal/controller/*`, wired only in `internal/app`. `internal/architecture_test.go` enforces the rule. Domain errors are sentinel values in `entity`; the HTTP controller maps them to status codes. Run `gofmt`, `go vet`, `go test -race` and `golangci-lint run` inside the module.
<!-- ultra:end go-service -->

<!-- ultra:begin ts-service -->
### services/api-ts

`src/domain` is pure: no `node:` imports and no packages. `src/application` depends on the domain and its own ports, `src/adapters` implement them, and `src/main.ts` is the composition root. `scripts/check-boundaries.mjs` enforces it. Node runs the sources directly, so use only erasable TypeScript syntax: no `enum`, `namespace` or constructor parameter properties.
<!-- ultra:end ts-service -->

<!-- ultra:begin web -->
### apps/web

API responses are validated in `src/lib/tasks.ts` before components use them. The dev server proxies `/api` to port 8080.
<!-- ultra:end web -->

<!-- ultra:begin architecture -->
### architecture

The LikeC4 model in `architecture/model/` describes the system. Update it in the same pull request as a structural change. Rules it must satisfy live in `architecture/rules.mjs`, each with a test showing it can fail.
<!-- ultra:end architecture -->

When both services exist, keep them behaviourally identical: the same routes, status codes and configuration variables.

## Conventions

- Pull request titles follow Conventional Commits; pull requests are squash-merged.
- A structural decision gets an ADR in `docs/adr/`, copied from `0000-template.md`. Accepted ADRs are superseded, never rewritten.
- A new check gets a test that makes it fail, not only one that makes it pass.
- Validate input at system boundaries and fail loudly inside them.
- Comments explain why — a constraint, an incident, a trade-off — not what the next line does.
- Make the smallest change that solves the problem. No speculative abstraction.

<!-- ultra:begin template -->
## Maintaining the template

This checkout is the template itself. [template/README.md](template/README.md) explains features, marker blocks and identity replacement. After changing a marker, a feature path or a workflow, run `node --test "template/*.test.mjs"` and generate at least one preset with `node template/init.mjs --preset <preset> --name demo-app --owner octo-org --out <dir>`, then run `setup` and `verify` inside it.
<!-- ultra:end template -->
