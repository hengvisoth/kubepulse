# Agent Guide

Read `AGENTS.md` for contributor rules. Use basic English and short sentences.

## Architecture

The backend has four roles in one TypeScript package. `SERVICE_NAME` selects gateway, components, incidents, or status. Each role runs in its own process, image, Deployment, and Service. Do not merge them back into one server.

- Gateway routes public API requests. It owns the default dashboard telemetry and chaos target.
- Components owns `Component` data and its database fallback store.
- Incidents owns `Incident` and `IncidentUpdate` data and their fallback store.
- Status reads the two domain APIs over HTTP and owns Redis summary caching. It must not query their tables.

The existing Prisma schema and PostgreSQL instance remain shared. Keep service table ownership. Do not drop data when changing service boundaries.

## Important Behavior

The frontend calls `/backend-api/*`. Its route handler strips the prefix and reads `INTERNAL_BACKEND_URL` at request time. Keep this proxy. Build-time Next.js rewrites cannot read runtime container settings. Ingress sends `/backend-api` to the frontend.

Chaos state, telemetry, probes, and metrics are process-local. `/readyz` intentionally permits database fallback and fails when readiness chaos is active. A healthy probe does not prove database persistence. In-memory domain data differs between replicas and is lost on restart.

Status invalidation uses shared Redis generations. When Redis is unavailable, summaries read domain services each time. Do not add per-replica local summary caches. Failed invalidation must not turn an already committed mutation into a failed response.

PostgreSQL tables are not created at startup. Run `npx prisma db push` and `npm run prisma:seed` in `apps/backend` with the correct `DATABASE_URL`.

## Validation and Delivery

Run `make test`, the frontend production build, `make k8s-validate`, and the live `make smoke` check. See README for local process commands and configuration. There is no configured ESLint or formatter workflow.

Keep OpenSSL in both backend Docker stages. Copy the generated Prisma client from the builder. Do not invoke an unpinned Prisma CLI in the production stage.

CI publishes all four backend images and the frontend before updating both overlays. Pushing to `main` deploys through ArgoCD. Each backend service has a production HPA. ArgoCD must ignore its replica count. Apply changes to ArgoCD Application manifests separately.

For the first migration, pause existing ArgoCD auto-sync before merging. Resume only after CI publishes all role images and commits immutable overlay tags. Follow the README migration steps. New clusters should register the applications after that first publication.
