# ☸️ KubePulse — Incident Status & Chaos Testing Board

> **A real-time status page and incident tracker with built-in Chaos Controls designed specifically to test Rancher, Kubernetes, and ArgoCD.**

Instead of a passive CRUD app, **KubePulse** displays which Kubernetes Pod answered your request, verifies internal multi-service DNS, and lets you trigger simulated cluster failures to watch Rancher and ArgoCD react and self-heal in real time.

---

## 🌟 Key Features

1. **Live Pod Telemetry Banner**:
   - Displays the serving Node.js container's `HOSTNAME` (Pod name), app version (`v1.0.0`), and environment badge (`DEV` or `PROD`) fetched live from the backend.
   - **Zero-Downtime Traffic Visualizer**: Auto-polls the backend and samples incoming requests across all replica pods to visualize traffic shifting in real-time.
2. **Incident CRUD**:
   - Create, update, and resolve cluster incidents with timeline notes (stored in PostgreSQL).
   - Component status grid (Traefik Ingress, Auth API, Postgres DB, Redis Cache, ArgoCD, K3s HPA).
3. **Redis Caching Layer (`redis-service:6379`)**:
   - Caches active status summary in Redis for 30 seconds to practice Kubernetes multi-service internal DNS resolution.
   - Live Cache `HIT` / `MISS` indicator, remaining TTL progress bar, and instant cache purge trigger.
4. **Health & Chaos Endpoints**:
   - `GET /healthz`: Kubernetes Liveness Probe.
   - `GET /readyz`: Kubernetes Readiness Probe (checks DB & Redis, supports simulated failure).
   - `POST /chaos/crash`: Forces `process.exit(1)` on the serving pod to observe Kubernetes container restart counters and `CrashLoopBackOff` in Rancher.
   - `POST /chaos/cpu-spike`: Simulates high CPU load to test Kubernetes Horizontal Pod Autoscaler (HPA) and Rancher alerts.
   - `POST /chaos/toggle-readiness`: Makes `/readyz` return 503 so Kubernetes removes the pod from EndpointSlices without killing the process.
   - `POST /chaos/memory-leak`: Simulates memory pressure to test container memory limits and OOMKilled events.
   - `GET /metrics`: Prometheus telemetry exporter (`prom-client`).

---

## 🏗️ Architecture

```mermaid
flowchart TD
    User["🌐 User / Browser"] --> Ingress["Traefik Ingress Gateway (HTTPS / cert-manager)"]
    
    subgraph K8s_Cluster["Kubernetes Cluster (K3s / Rancher Managed)"]
        Ingress -->|Routes /| Frontend["Next.js Frontend Replicas<br/>(Standalone Image ~120MB)"]
        Ingress -->|Routes /backend-api| Backend["Node.js Express Backend Replicas<br/>(TypeScript + Prometheus /metrics)"]
        
        Frontend -.->|Internal DNS<br/>backend-service:5000| Backend
        
        Backend -->|Internal DNS<br/>redis-service:6379 (30s TTL)| Redis["Redis Cache Pod"]
        Backend -->|Internal DNS<br/>DATABASE_URL Secret| Postgres[("PostgreSQL StatefulSet<br/>(PersistentVolumeClaim)")]
        
        HPA["Horizontal Pod Autoscaler (HPA)<br/>Target: 70% CPU"] -.->|Scales Replicas 3 to 10| Backend
    end
    
    ArgoCD["🐙 ArgoCD GitOps Engine"] -->|Syncs overlays/dev & overlays/prod| K8s_Cluster
```

---

## 🚀 Quick Start (Local Docker Compose)

To test the entire full-stack application locally with PostgreSQL and Redis:

```bash
# Clone the repository
git clone https://github.com/visoth/KubePulse.git
cd KubePulse

# Start all services (Frontend, Backend, Postgres, Redis)
make up
# Or: docker compose up -d --build
```

Access the application:
- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **Prometheus Metrics**: [http://localhost:5000/metrics](http://localhost:5000/metrics)
- **Health Probes**: [http://localhost:5000/healthz](http://localhost:5000/healthz) and [http://localhost:5000/readyz](http://localhost:5000/readyz)

To stop the containers:
```bash
make down
```

---

## 📦 Tech Stack

| Layer | Technology | Key Details |
|---|---|---|
| **Frontend** | Next.js 14 (App Router, Tailwind CSS, Lucide) | Packaged with `output: 'standalone'` (~120MB image) |
| **Backend** | Node.js (Express, TypeScript, Prisma ORM) | Prometheus `/metrics`, Health probes, Chaos API |
| **Cache Layer** | Redis 7 | Internal DNS `redis-service:6379`, 30s status summary TTL |
| **Database** | PostgreSQL 16 | StatefulSet with PersistentVolumeClaim (`PVC`) |
| **GitOps** | Kustomize + ArgoCD | `base/` + `overlays/dev/` + `overlays/prod/` |
| **Cluster & Ingress**| K3s + Rancher + Traefik + cert-manager | Production RollingUpdates, HPA, Let's Encrypt TLS |

---

## ☸️ Kubernetes & GitOps Structure

The manifests are organized using **Kustomize** to enforce strict environment isolation:

```
k8s/
├── base/
│   ├── backend-deployment.yaml     # RollingUpdate (maxSurge: 1, maxUnavailable: 0)
│   ├── backend-service.yaml        # ClusterIP port 5000
│   ├── frontend-deployment.yaml    # Standalone Next.js
│   ├── frontend-service.yaml       # ClusterIP port 3000
│   ├── postgres-statefulset.yaml   # StatefulSet + PVC
│   ├── postgres-service.yaml       # Headless / ClusterIP port 5432
│   ├── redis-deployment.yaml       # Redis server
│   ├── redis-service.yaml          # ClusterIP redis-service:6379
│   ├── ingress.yaml                # Traefik Ingress + TLS annotations
│   ├── hpa.yaml                    # HorizontalPodAutoscaler
│   └── secrets.yaml                # DATABASE_URL Secret
└── overlays/
    ├── dev/
    │   ├── namespace.yaml          # kubepulse-dev (Rancher Project: p-dev)
    │   ├── configmap.yaml          # ENV_NAME: DEV
    │   └── ingress-patch.yaml      # Host: dev.kubepulse.local
    └── prod/
        ├── namespace.yaml          # kubepulse-prod (Rancher Project: p-prod)
        ├── configmap.yaml          # ENV_NAME: PROD
        ├── replica-patch.yaml      # 3 Replicas for HA
        ├── hpa-patch.yaml          # Min 3, Max 10 Replicas
        └── ingress-patch.yaml      # Host: status.kubepulse.local
```

### Deploying Overlays Directly

```bash
# Deploy DEV (1 replica)
kubectl apply -k k8s/overlays/dev

# Deploy PROD (3 replicas + HPA)
kubectl apply -k k8s/overlays/prod
```

---

## 🎯 Hands-On Learning Experiments

### Experiment 1: Zero-Downtime Rolling Updates via ArgoCD

1. Ensure the **Live Stream (ON)** toggle is active in the KubePulse dashboard.
2. In `k8s/overlays/prod/configmap.yaml`, change `APP_VERSION` to `v1.1.0` (or update image tag).
3. Commit and push the change to your Git repository:
   ```bash
   git add .
   git commit -m "feat: release v1.1.0"
   git push
   ```
4. In **ArgoCD**, observe the sync status trigger.
5. Watch the KubePulse UI banner:
   - Traffic shifts smoothly from old pod hostnames to new pod hostnames.
   - Because `maxSurge: 1` and `maxUnavailable: 0` are configured, no connections are dropped!

---

### Experiment 2: Pod Crash & Self-Healing in Rancher

1. In the KubePulse Chaos Control Center, click **Trigger Pod Crash** (or run `make chaos-crash`).
2. The backend pod executes `process.exit(1)`.
3. **What to Observe in Rancher:**
   - Go to Rancher UI → Cluster Explorer → **Workloads** → **Pods**.
   - Notice the pod status briefly switch to `Error`, then restart.
   - The **Restarts** count increments by `+1`.
   - If triggered repeatedly within a short window, Kubernetes will apply exponential backoff (`CrashLoopBackOff`).

---

### Experiment 3: High CPU Stress & Horizontal Pod Autoscaling (HPA)

1. Watch the HPA status in your terminal:
   ```bash
   kubectl get hpa -n kubepulse-prod -w
   ```
2. In the KubePulse dashboard, click **Trigger 30s CPU Spike** (or run `make chaos-cpu`).
3. The serving pod runs non-blocking calculations driving CPU utilization to 100%.
4. **What to Observe:**
   - The CPU metric will spike past the 70% target.
   - Kubernetes HPA will automatically scale the backend deployment from 3 replicas up to 4, 5, or more replicas!
   - In the KubePulse Pod Traffic Distribution bar, you will see new pod hostnames start answering requests.

---

### Experiment 4: Readiness Probe Failure & Traffic Ejection

1. Click **Fail Readiness Probe (503)** (or run `make chaos-ready`).
2. The endpoint `/readyz` now returns `503 Service Unavailable`.
3. **What to Observe:**
   - Kubernetes runs the readiness probe every 5 seconds.
   - After 2 failed probes, the pod is marked `Unready`.
   - Kubernetes removes the pod from the `EndpointSlice`.
   - Refresh the dashboard: **Zero user traffic is routed to this pod**, while other healthy replicas seamlessly handle 100% of the traffic!
   - Click **Restore Readiness** to bring it back into the active pool.

---

## 🔒 Secrets & ConfigMaps Setup

- **ConfigMaps**:
  - `ENV_NAME`: Injected into backend and frontend (`DEV` vs `PROD`).
  - `APP_VERSION`: Current deployment version tag.
  - `REDIS_HOST`: Set to `redis-service` for internal cluster resolution.
- **Secrets**:
  - `DATABASE_URL`: Injected into the backend container from `kubepulse-secret`.
  - Passwords are never committed directly into deployments.

---

## 🛠️ CI/CD Pipeline

The included GitHub Actions workflow (`.github/workflows/ci-cd.yaml`):
1. **Validates K8s Manifests**: Runs `kustomize build` on `dev` and `prod` overlays to prevent syntax errors.
2. **Builds & Publishes Docker Images**: Pushes multi-stage images to GitHub Container Registry (`ghcr.io`).
3. **Automates GitOps Bumps**: Automatically updates image tags in `k8s/overlays/dev/` and commits back to Git, triggering automated reconciliation in ArgoCD!
