# api-ts

The task HTTP service in TypeScript, with the same API, status codes and configuration as `api-go`. Node 24 runs the `.ts` sources directly, so there is no build step and no runtime dependency.

```text
src/domain/        pure rules over plain data — no I/O, clock, randomness or packages
src/application/   use cases, and the ports they need (TaskRepository, Clock, IdGenerator)
src/adapters/      HTTP transport and the in-memory repository
src/config.ts      environment configuration, validated at startup
src/main.ts        composition root: the only place concrete adapters are chosen
```

`scripts/check-boundaries.mjs` enforces the direction of those dependencies over every file with an allowlist per layer, and its tests prove each rule can fire.

## Run

```bash
npm install
npm start
curl -s localhost:8080/api/tasks -d '{"title":"ship it"}'
```

`PORT` (default `8080`) and `SHUTDOWN_TIMEOUT` (default `10s`; Go duration syntax, such as `1m30s`, `.5s` or `500ms`) configure it, with the same rules as `api-go`. The API table is in [`../api-go/README.md`](../api-go/README.md); both services answer it identically.

## Check

```bash
npm run verify        # boundaries, typecheck, tests
docker build -t api-ts .
```

`tsc` only type-checks. Keep to syntax Node can strip (`erasableSyntaxOnly` enforces it): no `enum`, no `namespace`, no constructor parameter properties.
