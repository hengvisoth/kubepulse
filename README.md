# KubePulse — Status and Chaos Testing

KubePulse is a status dashboard and incident tracker for learning Kubernetes, Rancher, and ArgoCD. The backend runs as four services. Each service can scale, restart, and roll out on its own.

| Service | Responsibility | Local port | Kubernetes Service |
| --- | --- | --- | --- |
| Gateway | Public API routing and gateway telemetry | 5000 | `gateway-service:5000` |
| Components | Component reads and updates | 5001 | `components-service:5000` |
| Incidents | Incidents and timeline updates | 5002 | `incidents-service:5000` |
| Status | Summary aggregation and Redis caching | 5003 | `status-service:5000` |
| Frontend | Next.js dashboard and runtime API proxy | 3000 | `frontend-service:3000` |

The browser calls `/backend-api/*` on the frontend. Its route handler forwards the request to the gateway. The gateway routes domain requests to their owning service. The status service reads components and incidents through HTTP. It never queries their tables.

Components and incidents use the existing PostgreSQL instance and schema. Each owns its tables. They fall back to process-local demo data when PostgreSQL is unavailable. This fallback is temporary and differs between replicas. Use PostgreSQL for persistent data and multi-replica tests.

## Project Layout

- `apps/backend/src/services/`: service entry modules.
- `apps/backend/src/`: shared HTTP runtime, routes, telemetry, metrics, and chaos support.
- `apps/backend/prisma/`: existing schema and seed data.
- `apps/frontend/src/`: Next.js pages and components.
- `k8s/base/`: shared Deployments, Services, data stores, and Ingress.
- `k8s/overlays/dev/` and `prod/`: environment configuration and image tags.
- `argocd/`: ArgoCD applications.
- `scripts/`: cluster setup, smoke checks, and chaos commands.

## Run with Docker Compose

```bash
make up          # Frontend, four services, PostgreSQL, and Redis
make logs
make down
```

Open [the dashboard](http://localhost:3000). The gateway is at [localhost:5000](http://localhost:5000).

For an in-memory demo without PostgreSQL or Redis:

```bash
make standalone
# Stop this stack with:
docker compose -f docker-compose.standalone.yml down
```

### Create Database Tables

Schema setup is explicit. Starting the stack does not create tables. From a host shell, use the backend development dependencies:

```bash
cd apps/backend
npm install
export DATABASE_URL='postgresql://postgres:postgres@localhost:5432/kubepulse?schema=public'
npm run prisma:generate
npx prisma db push
npm run prisma:seed
```

The schema is shared for this first split. `Component` belongs to components. `Incident` and `IncidentUpdate` belong to incidents. No destructive migration is needed.

## Run Services Locally

Install dependencies once in `apps/backend` and `apps/frontend`. Run each command in a separate terminal from the repository root:

```bash
make dev-components
make dev-incidents
ENABLE_REDIS=false make dev-status
make dev-gateway
npm --prefix apps/frontend run dev
```

Set `DATABASE_URL` on components and incidents for persistent data. Without a database, their existing demo stores remain available. Native local defaults use ports 5000 through 5003. Containers all listen on port 5000.

| Variable | Purpose |
| --- | --- |
| `SERVICE_NAME` | Select `gateway`, `components`, `incidents`, or `status` |
| `PORT` | Override the service's listening port |
| `COMPONENTS_SERVICE_URL` | Component service base URL |
| `INCIDENTS_SERVICE_URL` | Incident service base URL |
| `STATUS_SERVICE_URL` | Status service base URL |
| `UPSTREAM_TIMEOUT_MS` | Limit internal HTTP request duration |
| `INTERNAL_BACKEND_URL` | Frontend runtime URL for the gateway |
| `DATABASE_URL` | PostgreSQL connection for domain services |
| `ENABLE_REDIS`, `REDIS_HOST`, `REDIS_PORT` | Status cache configuration |

Compose and Kubernetes set internal service URLs. Host development defaults use `localhost`.

## Tests and Smoke Checks

```bash
make test
npm --prefix apps/frontend run build
make k8s-validate
make smoke       # Requires a running stack and at least one component
```

Backend tests use Node.js's built-in test runner. They check service routing, failures, timeouts, summary composition, and cache behavior. The smoke check creates a temporary incident and changes a component status. It removes the incident and restores the component before exit. Run it against a demo environment with one replica per service, or with persistent PostgreSQL data.

Inspect the service topology and individual processes:

```bash
curl http://localhost:5000/api/services
curl http://localhost:5000/services/components/api/telemetry
curl http://localhost:5000/services/incidents/readyz
curl http://localhost:5000/services/status/metrics
```

## Chaos Tests

Every service has its own chaos state. Dashboard buttons target gateway replicas. Choose another service from the command line:

```bash
make chaos-ready SERVICE=components
make chaos-reset SERVICE=components
make chaos-cpu SERVICE=incidents
SERVICE=status ./scripts/chaos-test.sh telemetry
```

The shell script needs `curl` and `jq`. Set `API_URL` to change the gateway URL. A command affects the one replica that receives it. To restore a specific unready pod in Kubernetes, port-forward directly to that pod and run the reset command against its forwarded port with `SERVICE=gateway`.

Health endpoints are local to each process. `/healthz` shows that the process responds. `/readyz` reports simulated readiness failure. Database failure still permits the intended in-memory demo fallback. A healthy probe does not prove data is persistent.

## Status Cache

Only status owns the Redis summary cache. Successful component and incident writes request cache invalidation. Cache generations keep an older in-flight read from restoring an invalidated summary. Without Redis, status reads both domain services on every request. It does not cache separate summaries in each replica's memory.

If Redis is available but an invalidation request fails, the successful domain write stays successful. The error is logged. Existing cached data can remain for its configured TTL, normally 30 seconds. If a domain service is unavailable and no cache is usable, summary requests return an error.

## Kubernetes and GitOps

Development runs one replica per service. Production starts with three replicas per service. Each backend service has its own HPA targeting 70% CPU, with three to ten replicas. Rolling updates use `maxSurge: 1` and `maxUnavailable: 0`.

```bash
make k8s-validate       # Render both overlays without deploying
make k8s-diff
# Apply only to your intended cluster:
make k8s-dev
make k8s-prod
kubectl get deployments,services,pods -n kubepulse-dev
kubectl get hpa -n kubepulse-prod
```

Ingress hosts are `dev.kubepulse.local` and `status.kubepulse.local`. The `/backend-api` path goes to the frontend runtime proxy. Direct `/chaos`, `/services`, `/metrics`, `/healthz`, and `/readyz` paths go to the gateway.

CI validates tests, builds, and overlays. A push to `main` publishes five images: gateway, components, incidents, status, and frontend. Once all images are published, CI writes their short-SHA tags to both overlays. ArgoCD then syncs those changes. The new service images must be published before the new manifests can run in a cluster. You can later update one service image tag to roll out just that service.

### First Migration from the Single Backend

Pause auto-sync for both existing ArgoCD applications **before the first merge to `main`**. Otherwise, ArgoCD can replace the old backend before the new images exist. Run these commands only against your intended cluster:

```bash
kubectl -n argocd patch application kubepulse-dev --type merge -p '{"spec":{"syncPolicy":{"automated":null}}}'
kubectl -n argocd patch application kubepulse-prod --type merge -p '{"spec":{"syncPolicy":{"automated":null}}}'
```

Merge the code and wait for CI to publish all five images and commit immutable short-SHA tags to both overlays. Do not manually sync the initial `latest` placeholders. Pull the resulting commit and re-enable auto-sync by applying the updated applications:

```bash
git pull --ff-only
kubectl apply -f argocd/application-dev.yaml
kubectl apply -f argocd/application-prod.yaml
```

For a new cluster, register the ArgoCD applications only after that first successful image publication and tag-update commit. Later releases already reference published images until CI writes the next tags.

ArgoCD leaves backend replica counts to their HPAs. Changes to `argocd/*.yaml` must be applied separately; the applications do not manage themselves. Manual edits to Argo-managed workloads are replaced by Git state.

Keep real credentials outside Git. The included database credentials are for this demo. Review `k8s/base/secrets.yaml` before use outside a local lab.
