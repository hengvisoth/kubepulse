# Backend Microservices

## Intent

Split the single backend into services that can run, fail, scale, and roll out separately in Kubernetes. Keep the current dashboard and API working. The user asked us to choose the split and start.

## Services

| Service | Owns | HTTP dependencies |
| --- | --- | --- |
| gateway | Public routing, gateway telemetry, build information | components, incidents, status |
| components | Component reads and updates; Component table | status cache invalidation |
| incidents | Incident CRUD and timeline; Incident and IncidentUpdate tables | status cache invalidation |
| status | Status summary and Redis cache | components and incidents |

Keep one PostgreSQL instance and the existing schema to preserve data. Services must not read another service's tables. Status must not query Prisma. Each process gets local health probes, telemetry, metrics, and chaos controls. Chaos stays local to the process being tested.

## Runtime Contract

- Use the current backend TypeScript package, with service entry modules under `apps/backend/src/services/` and shared runtime code. A shared package does not mean a shared process.
- `SERVICE_NAME` selects `gateway`, `components`, `incidents`, or `status`. Docker builds set it for each separate image. Unknown names fail startup.
- All container ports are 5000. Host development ports are gateway 5000, components 5001, incidents 5002, and status 5003.
- Configure internal HTTP URLs with `COMPONENTS_SERVICE_URL`, `INCIDENTS_SERVICE_URL`, and `STATUS_SERVICE_URL`. HTTP calls have a bounded timeout via `UPSTREAM_TIMEOUT_MS`.
- Keep `/api/components`, `/api/incidents`, `/api/status-summary`, `/api/telemetry`, `/api/build`, `/healthz`, `/readyz`, `/metrics`, and `/chaos/*` at the gateway.
- Add `/api/services` for service discovery/health and `/services/:service/*` for diagnostics against a fixed set of internal services. Do not accept arbitrary proxy targets.
- Preserve downstream response codes, JSON bodies, query strings, and useful response headers. Return an explicit 502/503/504 on a missing or timed-out service.
- Keep the frontend runtime `/backend-api/*` proxy. Ingress must send that prefix to the frontend, which strips it once and forwards to the gateway.
- Keep existing database fallback stores in their owning services. A missing service must not become an invented healthy status summary.

## Cache Correctness

Status owns caching and invalidation. Component and incident mutations request invalidation after a successful write. Do not turn an already committed mutation into a failed response if invalidation is temporarily unavailable; log the failure and document the 30-second Redis TTL bound. Shared Redis cache generations must prevent an older in-flight summary from being cached as current after invalidation. Do not serve per-replica local summary caches when Redis is unavailable; read the owning services each time instead.

## Deployment

Provide four backend images, four Deployments, and four ClusterIP Services. Update both Kustomize overlays, production HPAs, ArgoCD replica ownership, Compose files, and CI image publishing/tag updates. Development uses one replica per service. Production uses three minimum replicas per service and preserves rolling updates. Keep the existing frontend and data stores.

## Verification

Add native Node.js tests for routing, query/body/header forwarding, unavailable services, timeouts, summary aggregation, invalidation, and service-local readiness. Build both apps. Render both Kubernetes overlays and validate both Compose configurations. Smoke-test four real local backend processes, including CRUD, summary updates, and a service failure.

## Scope

Prepare code and deployment files locally. Do not push images or deploy into the existing unrelated cluster. Separate database servers, message brokers, authentication, and a UI redesign are outside this change.
