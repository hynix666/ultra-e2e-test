# Contributing

## The loop

1. Branch from `main`.
2. Make the change, with a test for any behaviour it adds or fixes.
3. Run `node scripts/verify.mjs`. It runs the same checks as CI, so red here means red there.
4. Open a pull request whose **title** follows [Conventional Commits](https://www.conventionalcommits.org/): `feat: add task search`, `fix(api-go): reject empty titles`. Pull requests are squash-merged, so the title becomes the commit message on `main`.
<!-- ultra:begin release -->
5. The title's type sets the next version: `fix` makes a patch release, `feat` a minor release, and `!` or a `BREAKING CHANGE:` footer a major release.
<!-- ultra:end release -->

Allowed types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`.

## What the build enforces

- **`verify` must pass.** It is the only required check; see [ADR-0002](docs/adr/0002-one-required-check.md).
- **Third-party actions are pinned to a commit SHA**, and every workflow declares its permissions and job timeouts.
- **Nothing that does not belong gets tracked:** no `.env` files, no dependency directories, no invalid JSON, no file over 4 MB.
- **Architecture boundaries hold.** Each service checks its own import rules; see [ADR-0005](docs/adr/0005-layered-services-with-enforced-boundaries.md).

## Architecture decisions

A change to structure, a dependency direction, or a tool that other code relies on gets an ADR in [`docs/adr/`](docs/adr/). Copy [`0000-template.md`](docs/adr/0000-template.md). ADRs are amended, not rewritten: a later ADR supersedes an earlier one, and the earlier one's status points to it.

## Reporting problems

Use the issue forms. Security problems go through the private process in [SECURITY.md](SECURITY.md), never a public issue.
