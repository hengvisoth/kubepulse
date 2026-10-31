# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

KubePulse is a status page and incident tracker built to practice Kubernetes, Rancher, and ArgoCD. The app is small on purpose. The point is the chaos endpoints and the GitOps setup around it. Many "odd" behaviors below are intentional.

Monorepo, no workspace tooling. Each app has its own `package.json`:
- `apps/backend`: Express + TypeScript + Prisma (PostgreSQL) + ioredis + prom-client
- `apps/frontend`: Next.js 14 App Router + Tailwind (one client page, `src/app/page.tsx`, holds all state)
- `k8s/`: Kustomize `base/` + `overlays/{dev,prod}`
- `argocd/`: two ArgoCD `Application` manifests

There are **no tests and no lint config**. Do not invent test commands.

## Commands

Run from the repo root unless noted.

```bash
make up            # docker compose up -d --build (frontend :3000, backend :5000, postgres, redis)
make down
make logs
docker compose -f docker-compose.standalone.yml up -d --build   # backend + frontend only, ENABLE_REDIS=false

make chaos-crash | chaos-cpu | chaos-ready | chaos-reset        # wraps scripts/chaos-test.sh (needs curl + jq)
API_URL=https://host ./scripts/chaos-test.sh memory 100         # also: latency, status-summary, purge-cache, watch-rollout

kustomize build k8s/overlays/dev > /dev/null    # this is what CI runs to validate; same for prod
make k8s-diff                                   # diff rendered dev vs prod
```

Backend (`cd apps/backend`): `npm run dev` (tsx watch), `npm run build` (tsc), `npm start`, `npm run prisma:generate`, `npm run prisma:seed`.
Frontend (`cd apps/frontend`): `npm run dev` (port 3000), `npm run build`.

## Architecture

**Request path.** The browser only calls `/backend-api/*`. Next.js `rewrites()` in `next.config.js` strips that prefix and proxies to `INTERNAL_BACKEND_URL` (`http://backend:5000` in compose, `http://backend-service:5000` in k8s, `localhost:5000` by default). Backend routes are `/api/*`, `/chaos/*`, `/metrics`, `/healthz`, `/readyz`. In k8s the Ingress also sends `/backend-api`, `/chaos`, `/metrics`, `/healthz`, `/readyz` straight to `backend-service`. No strip-prefix middleware exists in this repo.

**Graceful fallbacks (intentional, do not "fix").**
- Redis down or `ENABLE_REDIS=false` → `redis.ts` uses an in-process TTL `Map`. Cache writes always go to the Map too.
- Postgres down → routes catch the Prisma error and serve `memoryStore` from `db.ts` (responses may carry `fallback: true`).
- `/readyz` returns 200 even when the DB is down (`dbHealth.ok || true`). It returns 503 only when chaos readiness failure is on.

**Postgres schema is never applied automatically.** There is no `prisma/migrations/` directory, no init container, and the Dockerfile CMD does not migrate. `prisma:migrate` (`migrate deploy`) does nothing useful. Because of the fallback above, the app still looks healthy with empty tables. To create tables, run `npx prisma db push` and then `npm run prisma:seed` against the DB.

**Chaos state is per pod, in memory** (`chaos.ts`, singleton `ChaosManager`). With several replicas, a request lands on a random pod. That is the demo. A latency middleware in `index.ts` delays all requests except `/chaos/*`. Pod identity comes from `HOSTNAME`/`POD_NAME`, set via the Downward API in `backend-deployment.yaml`.

**Frontend env.** `NEXT_PUBLIC_*` values are inlined at build time (Dockerfile `ARG`s and `next.config.js` `env`). The runtime ConfigMap does not change the client bundle. The header prefers `envName`/`appVersion` from the backend `/api/telemetry` response.

## GitOps and deploy flow

- ArgoCD apps (`argocd/application-*.yaml`) track `main` of `github.com/hengvisoth/kubepulse` with `automated: prune + selfHeal`. Pushing to `main` deploys. Manual `kubectl` edits get reverted.
- `base/` pins images as `ghcr.io/hengvisoth/kubepulse-{backend,frontend}:v1.0.0`. That tag is **never pushed** to GHCR. Only `<short-sha>` and `latest` exist, so each overlay must override it in its `images:` block. On push to `main`, CI builds both images tagged with the short SHA, runs `kustomize edit set image` in **both `dev` and `prod` overlays**, and commits back with `[skip ci]`. Use `${{ }}` or an `env:` var for values in the workflow shell. `${steps.x.outputs.y}` is a bash "bad substitution" error.
- `application-prod.yaml` ignores `/spec/replicas` on the `backend` Deployment, because the HPA owns it. Without that, `selfHeal` fights the HPA. Argo apps are not self-managed: after editing `argocd/*.yaml`, run `kubectl apply -f` on them.
- The HPA exists **only in `overlays/prod/hpa.yaml`**, not in base. README's file tree still lists `base/hpa.yaml` and `hpa-patch.yaml`. Those are stale.
- Prod overlay sets 3 replicas for both deployments. Both use `RollingUpdate` with `maxSurge: 1, maxUnavailable: 0`.
- Ingress hosts: `dev.kubepulse.local`, `status.kubepulse.local` (base uses `kubepulse.local`). `scripts/setup-cluster.sh` creates namespaces, registers the ArgoCD apps, and prints the `/etc/hosts` line.
