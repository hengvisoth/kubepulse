# Backend Microservices Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement these tasks. Keep file ownership separate. Do not commit, push, or deploy.

**Goal:** Run the backend as four independently deployed services while keeping the current dashboard working.

**Architecture:** A gateway routes existing API calls to component, incident, and status services. Status reads both domain services over HTTP. Each service has its own process, image, Kubernetes Service, Deployment, probes, telemetry, and chaos state.

**Tech Stack:** Express, TypeScript, Prisma, PostgreSQL, Redis, native Node.js tests, Docker Compose, Kustomize, and ArgoCD.

**Spec:** `docs/superpowers/specs/2026-11-05-backend-microservices-design.md`

## Global Constraints

- Use basic English and short sentences.
- Preserve the frontend runtime proxy and existing public API contracts.
- Keep domain database fallback stores. Status reads services over HTTP.
- Use service names `gateway`, `components`, `incidents`, and `status`.
- All container ports are 5000. Local host ports are 5000 through 5003.
- Use `SERVICE_NAME`, `COMPONENTS_SERVICE_URL`, `INCIDENTS_SERVICE_URL`, `STATUS_SERVICE_URL`, and `UPSTREAM_TIMEOUT_MS` as environment names.
- Preserve the existing schema and data. Do not add destructive database steps.
- Leave the user's existing `AGENTS.md` in place and update it for the final layout.
- Work in this checkout. Do not commit, push, publish, or apply cluster resources.

## Review Focus

- Ingress `/backend-api` paths must use the Next.js runtime proxy and reach the correct gateway route.
- Successful writes must invalidate status without turning a committed mutation into a false failure.
- Unavailable domain services must produce explicit errors, not healthy empty summaries.
- Redis fallback and concurrent invalidation must not expose stale per-pod summary caches.
- Image names, internal URLs, health probes, HPAs, and ArgoCD replica ownership must agree.

## Task 1: Backend Service Runtime

**Owner:** backend worker. **Files:** `apps/backend/**` only.

**Produces:** Four roles selected by `SERVICE_NAME`; separate image build argument with the same name; the URL and route contracts from the spec; build and test scripts.

- [x] Write native Node.js tests for routing and unavailable upstreams. Run them and observe failures before implementation.
- [x] Extract a shared service runtime and implement four role modules under `src/services/`.
- [x] Add bounded HTTP forwarding with preserved requests and responses, fixed target selection, and service health discovery.
- [x] Make status aggregate domain APIs. Add generation-aware shared Redis caching and domain-write invalidation. Test no-Redis behavior, concurrent invalidation, and failed invalidation after a successful write.
- [x] Keep probes, telemetry, metrics, build information, shutdown, and chaos local to each process. Test service-local readiness.
- [x] Add scripts for all four development roles. Make the Docker build choose a role without extra dependencies.
- [x] Run backend tests and build. Report commands and results for review.

## Task 2: Deployment and CI

**Owner:** deployment worker. **Files:** `k8s/**`, `argocd/**`, `.github/workflows/**`, and both `docker-compose*.yml` files.

**Consumes:** Task 1 environment names, container port 5000, Docker context `apps/backend`, Docker build argument `SERVICE_NAME`.

**Produces:** Images `ghcr.io/hengvisoth/kubepulse-{gateway,components,incidents,status}`, matching service names `{role}-service`, and Deployments named by role.

- [x] Replace the backend Deployment/Service with four role Deployments/Services. Add only the data-store settings needed by each role.
- [x] Update frontend gateway URL and route `/backend-api` through the frontend. Route direct diagnostic endpoints through the gateway.
- [x] Update dev/prod image overrides, three production replicas per role, four production HPAs, and ArgoCD replica ignores.
- [x] Update full and standalone Compose stacks. Keep host ports 5000, 5001, 5002, and 5003 and support in-memory mode without databases.
- [x] Publish all service images and the frontend before changing both overlays. Validate backend tests, frontend build, and overlays in CI.
- [x] Render both overlays with `kubectl kustomize`; inspect service references, selectors, images, and probes. Validate both Compose files with `docker compose ... config`.

## Task 3: Integration and Contributor Documentation

**Owner:** root. **Files:** `README.md`, `CLAUDE.md`, `AGENTS.md`, `Makefile`, `scripts/**`, and `docs/**`.

**Consumes:** Runtime and deployment contracts from Tasks 1 and 2.

- [x] Update docs and Make targets for the four processes, image builds, service-specific chaos, schema setup, and deployment flow.
- [x] Add a repeatable smoke check that runs against a live gateway and checks routing, domain writes, status aggregation, and per-service diagnostics.
- [x] Build both apps and run backend tests. Start four local backend processes without external data stores, then run smoke checks and simulate a service failure.
- [x] Validate both Compose files and Kubernetes overlays. Review the complete diff with a fresh agent; resolve important findings.
- [x] Report the final service split, checks, and any environment limits. Keep changes local for user review.
