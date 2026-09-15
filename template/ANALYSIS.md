# Template analysis: what ULTRA-TEMPLATE takes from each source, and why

*Written 15 September 2026, from the extracted archives and the NexusPrompt repository at commit `4ada481`.*

## Method

Each template was read in full where it mattered: repository layout, build entry points, every workflow, dependency-update configuration, agent guidance, architecture documents and, where one existed, its feature-selection mechanism. NexusPrompt was treated as the reference for verification discipline, since it is the workflow this template must at least match.

Nine criteria, each asking whether a property is **enforced by the build**, merely **documented**, or **absent**:

| Criterion | NexusPrompt | go-clean-template | golang-repo-template | Josee9988 project-template | CleanArchitecture (.NET) | react-starter-kit | AstroWind | LikeC4 template |
|---|---|---|---|---|---|---|---|---|
| Feature selection | absent | absent | absent | personalization only | **enforced**: `dotnet new` symbols, matrix-tested | absent (upstream merge skill) | runtime flags | absent |
| Single verification gate | **enforced**: `npm run verify`, same in CI | Makefile targets; CI jobs differ | `rules.mk`; CI stale | script tests only | build and test | **enforced**: one CI job runs all checks | `check` + `build` | model tests |
| Supply chain pinning | **enforced**: SHA pins, checksummed binaries | absent: tags, `@main`, `curl \| bash` | absent: `@v3`, `@master` | absent | tags only | SHA pins by convention, not checked | tags only | `likec4@latest` |
| Least-privilege workflows | **enforced** by review, reasoned per job | absent | absent | absent | `contents: read` | strong: environment-scoped secrets, main-only guards | `contents: read` | partial |
| Architecture enforcement | **enforced**: boundary script, purity harness, callback guard | convention only | none | n/a | project references | conventions, ADRs | none | model rules as tests |
| Decisions and docs | 23 ADRs, amended not rewritten; generated docs with drift checks | README in three languages | README | script docs | ADR index and template | ADR template, VitePress docs | task recipes | README |
| Community health | SECURITY.md only | none | full set | full set, 8 issue templates, labels | issue templates, CoC | CoC, CONTRIBUTING, SECURITY | none | none |
| Agent guidance | long, invariant-driven CLAUDE.md | AGENTS→CLAUDE | none | none | none | **AGENTS.md canonical**, CLAUDE.md imports it, nested per workspace | AGENTS.md and task skills | none |
| Freshness | current | current (Go 1.26) | stale (Go 1.20, `set-output`) | stale (`checkout@v2`, retired bots) | current (.NET 10) | current | current | current |

## What each source contributed

### NexusPrompt (the reference workflow)

**Adopted.** One command that is the whole check, run identically by CI. Repository-shape hygiene (`check-repo-hygiene.mjs`), rewritten as a smaller generic chassis: pinned `.gitignore` rules with a truncation floor, no vendored directories at any depth, a size bound, strict JSON, nothing both tracked and ignored. Import-boundary checking over every file, with must-fire tests beside must-not-fire ones. SHA-pinned actions and a checksum-verified gitleaks binary. Report-only security that fails only when it *could not look*. ADRs that are superseded rather than rewritten. A security policy with a secret-rotation table. Least-privilege workflow tokens.

**Improved.** NexusPrompt documents SHA pinning in comments; here `check-hygiene` fails on an unpinned `uses:`, a workflow without `permissions:`, a job without a timeout, and a CI job missing from the required gate — rules a person would otherwise have to remember.

**Left out.** The domain-specific checks (differential oracle, anchor sizing, source freeze, truth boundary), the 30-step verify chain, and the single shared npm workspace, whose lockfile couples every package.

### go-clean-template (evrone)

**Adopted.** The layer vocabulary — `entity`, `usecase`, `repo`, `controller`, `app` — with interfaces declared by the consumer, configuration from the environment validated at startup, graceful shutdown, a multi-stage image with a minimal runtime, and a strict `golangci-lint` v2 configuration.

**Improved.** The layering there is convention. Here `internal/architecture_test.go` parses every production file and fails `go test` on a forbidden import, and its matcher has its own failing cases.

**Left out.** Four transports (REST, gRPC, AMQP, NATS), three domains, Postgres, RabbitMQ, NATS, Jaeger and generated mocks. One transport and one domain show the pattern; each addition is a controller or a repository behind an existing port. Also left out: unpinned actions, `nancy@main`, and `curl | bash` coverage upload.

### golang-repo-template (moul)

**Adopted.** The idea of a complete community-health set — code of conduct, contributing guide, code owners, issue and pull request templates, security policy — and grouped, scheduled dependency updates.

**Left out.** `rules.mk` (no `make` on Windows), goreleaser and semantic-release (release-please covers versioning for any language; goreleaser remains the right addition for a project that ships binaries), `repoman-action`, Gitpod, all-contributors, badges for retired services, and dual licensing. The workflows are stale enough — Go 1.20, `actions/checkout@v3`, deprecated `set-output` — that nothing was copied verbatim.

### Josee9988 project-template

**Adopted.** Post-copy initialization that personalizes the repository and removes itself, and issue templates that separate bugs, features and security reports.

**Improved.** Its script replaces strings with `sed` across `.github/`, prompts interactively, and offers no stack selection. `template/init.mjs` is non-interactive and scriptable, validates input, selects features, plans in memory before writing, and refuses a dirty tree. Markdown issue templates became GitHub issue forms, and the security "issue template" became a link to private vulnerability reporting — a public issue is the wrong channel for a vulnerability.

**Left out.** Probot configuration (`settings.yml`, `issue_label_bot.yaml`, welcome bots), which depends on apps that are retired or must be installed separately, and 20 opinionated labels.

### CleanArchitecture (Jason Taylor)

**Adopted — the most important idea.** A template must stay a working project under a real default identity, and CI must *generate every option combination and build and test the output*, not only the template. `template-test.yml` does this for every preset. Also adopted: an ADR index with a template, and warnings treated as errors (strict TypeScript, golangci-lint).

**Left out.** The .NET solution itself. It is best consumed as it is published, through `dotnet new ca-sln`; copying it would create a fork that ages. Its `dotnet new` engine does not apply outside .NET, which is why selection here uses a zero-dependency Node script with a simpler marker grammar.

### react-starter-kit (Kriasoft)

**Adopted.** `AGENTS.md` as the canonical agent guidance with `CLAUDE.md` importing it. Workflow craft: SHA pins with version comments, `persist-credentials: false`, per-job timeouts, concurrency that cancels only superseded pull request runs, `pull_request_target` used only where it never checks out untrusted code. The pull-request-title check against Conventional Commits, with Dependabot commit prefixes chosen to pass it. Grouped weekly updates. Opt-in deployment through a repository variable, reused here for CodeQL and Pages.

**Left out.** Bun, Cloudflare Workers, Terraform, Better Auth, Stripe, tRPC and Drizzle — a product stack, not a template concern — and the shared workspace lockfile.

### AstroWind

**Adopted.** Short task-oriented agent instructions and a verification checklist. Its runtime feature flags (`apps.blog.isEnabled`) informed the decision *not* to select features at runtime: disabled features still ship as dead code and dependencies.

**Left out.** The Astro site and its widget library. A marketing or content site is a product choice; it can be added as a feature by following `template/README.md`.

### LikeC4 template

**Adopted.** Architecture as code, with model rules as tests and a Pages deployment. Here the rules are plain functions over the model API, so each is tested against a hand-built model that breaks it, and the model's contents follow the selected features.

**Improved.** `likec4: latest` became a locked dependency, and the deployment is opt-in and SHA-pinned.

## Decisions for the synthesis

1. **Selection by a local, zero-dependency initializer** — feature paths, marker blocks and identity replacement. *Rejected:* Cookiecutter or Copier (a Python runtime, and a template that is no longer a runnable repository), `dotnet new` (.NET only), a GitHub Actions initializer (`GITHUB_TOKEN` cannot write workflow files), runtime flags (dead code ships).
2. **A generated project must pass its own gate.** Every preset is generated and verified in CI, so a template change that breaks one combination fails before a repository is created from it.
3. **One required check** aggregating per-module jobs, mirrored by `scripts/verify.mjs` ([ADR-0002](../docs/adr/0002-one-required-check.md)).
4. **Pins enforced, not documented** ([ADR-0003](../docs/adr/0003-pin-third-party-code.md)).
5. **Independent modules** with their own lockfiles, so a feature can be removed by deleting a directory ([ADR-0004](../docs/adr/0004-independent-modules.md)).
6. **Layer rules as tests** in each service's own toolchain ([ADR-0005](../docs/adr/0005-layered-services-with-enforced-boundaries.md)).
7. **The same service twice**, in Go and TypeScript, with identical routes, status codes and configuration: the architecture is the point, and parity shows it is language-independent.
8. **Only what has no product opinion.** Deployment targets, databases, authentication and UI frameworks beyond a minimal React app are left to the project.

## Known limitations

- Initialization is one-way. Later template improvements must be merged into a project by hand; an upstream-merge procedure like react-starter-kit's `merge-seed` skill would be the next thing to add.
- A marker block depends on exactly one feature (see `template/README.md`).
- CodeQL and the Pages deployment are opt-in, so the template's own CI does not exercise them while the repository is private.
- The workflow checks in `check-hygiene` read the two-space YAML layout this repository uses, not arbitrary YAML.
- `release.yml` needs a token secret for its pull requests to trigger the required check; the workflow header says how.
