# web

A React single-page app on Vite that lists tasks and moves them through their lifecycle.

```bash
npm install
npm run dev        # http://localhost:5173, with /api proxied to :8080
npm run verify     # typecheck, Vitest, production build
```

Start either service (`services/api-go` or `services/api-ts`) on port 8080 for the page to have data.

`src/lib/tasks.ts` is the boundary with the API: responses are validated there before any component sees them, and the transition rules mirror the services' so the interface offers only moves the API accepts. `npm run build` writes a static site to `dist/`, which any static host can serve.
