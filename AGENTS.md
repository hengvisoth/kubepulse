# Repository Guidelines

## Project Structure & Module Organization

KubePulse is a Kubernetes status and chaos testing demo. Each app has its own `package.json`.

- `apps/backend/src/services/`: gateway, components, incidents, and status service modules. They share a TypeScript package but run as separate processes and deployments.
- `apps/backend/src/`: shared runtime, routes, telemetry, and chaos support. Prisma schema and seeds are in `apps/backend/prisma/`. Backend tests are in `apps/backend/test/`.
- `apps/frontend/src/`: Next.js pages, components, and types. Static assets are in `apps/frontend/public/`.
- `k8s/`: shared resources in `base/`; environment settings in `overlays/dev/` and `overlays/prod/`.
- `argocd/`: application manifests. `scripts/`: cluster setup, smoke checks, and chaos commands.

## Build, Test, and Development Commands

Run from the repository root:

- `make up` / `make down`: start or stop the full Compose stack.
- `make standalone`: start all services with in-memory demo data.
- `make dev-gateway`, `make dev-components`, `make dev-incidents`, `make dev-status`: run local services in separate terminals.
- `make test`: build and test backend services.
- `make smoke`: check a running demo stack; creates and removes test data.
- `make k8s-validate`: render both overlays without deploying.

Run `npm install` inside each app first. Use `npm run build` in either app for a production build. Run `npm run dev` in the frontend for port 3000. Backend host ports are 5000–5003; containers use 5000.

## Coding Style & Naming Conventions

Use two spaces, single quotes, and semicolons in TypeScript. Use PascalCase for React component files, camelCase for functions and variables, and lowercase route filenames. Match nearby code. TypeScript strict mode is enabled. No formatter or ESLint configuration is checked in.

## Testing Guidelines

Backend tests use native `node:test` and `*.test.cjs` filenames under `apps/backend/test/`. Add tests for routing, service failures, timeouts, and cache invalidation. No coverage threshold is set. Build the frontend and render both overlays. Run chaos checks only in an intended demo environment.

## Commit & Pull Request Guidelines

Use scoped messages such as `feat(backend): split services` or `fix(k8s): correct routing`. PRs should describe behavior, link relevant issues, list validation, and include screenshots for UI changes.

## Architecture & Configuration

Keep the runtime frontend proxy. Status reads domain APIs; domains own their tables. Keep credentials outside Git. A push to `main` publishes images and deploys both overlays through ArgoCD.

Write documentation and agent replies in basic English. Keep sentences short.
