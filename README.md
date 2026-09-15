# ultra-e2e-test

## Layout

- `scripts/` — `setup.mjs` installs every module, `verify.mjs` runs the whole check, `check-hygiene.mjs` guards the repository's shape.
- `services/api-go/` — Go task API in Clean Architecture layers. [README](services/api-go/README.md)
- `services/api-ts/` — TypeScript task API with a pure domain core. [README](services/api-ts/README.md)
- `apps/web/` — React single-page app. [README](apps/web/README.md)
- `architecture/` — LikeC4 model of the system. [README](architecture/README.md)
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
- **`release.yml`** — release-please on `main`, off until `RELEASE_ENABLED=true`, which `configure-github.mjs` sets; its header explains the token it also needs.
- **`architecture.yml`** — publishes the architecture model to GitHub Pages once `PAGES_ENABLED=true` is set.

Dependabot proposes grouped updates weekly for every ecosystem present, SHA-pinned actions included.

## Contributing and security

[CONTRIBUTING.md](CONTRIBUTING.md) describes the workflow, [SECURITY.md](SECURITY.md) how to report a vulnerability privately, and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) the expected conduct. Guidance for coding agents is in [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)
