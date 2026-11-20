# Load Balancing in KubePulse

This guide explains how load balancing works in KubePulse. It covers both Kubernetes and local Docker Compose environments.

## 1. What is a Load Balancer?

A load balancer distributes network traffic across multiple running instances (replicas) of an application.

In KubePulse, load balancing provides three key benefits:
1. **High Availability**: If one replica crashes, traffic moves to healthy replicas without downtime.
2. **Horizontal Scaling**: Traffic spreads evenly across multiple pod replicas.
3. **Zero-Downtime Deployments**: Rolling updates add new pods before draining old ones.

---

## 2. Load Balancer Types

KubePulse uses both L4 and L7 load balancing.

| Level | Type | In KubePulse | What it Does |
| --- | --- | --- | --- |
| **L4** | Transport (TCP/IP) | Kubernetes `ClusterIP` & `LoadBalancer` | Routes raw TCP connections based on IP and port. High throughput, low overhead. Handled by `kube-proxy` via iptables or IPVS. |
| **L7** | Application (HTTP/S) | Traefik Ingress & Nginx | Inspects HTTP paths, headers, and hostnames. Routes `/backend-api` to the frontend and `/services/*` to the gateway. |

---

## 3. Traffic Flow in KubePulse

### North-South (External to Internal)
1. User requests reach the external Load Balancer (Port 80 for web, Port 5000 for API).
2. In Kubernetes `prod`, `frontend-loadbalancer` receives web traffic and balances across 3 frontend pods.
3. In Docker Compose, the `kubepulse-lb` Nginx container balances requests across `gateway-1`, `gateway-2`, `gateway-3` and frontend replicas.

### East-West (Service to Service)
1. The frontend proxy sends API requests to the gateway.
2. The gateway forwards requests to internal microservices (`components-service`, `incidents-service`, `status-service`).
3. Each service is a Kubernetes `ClusterIP`. Kubernetes automatically balances calls across the 3 replicas of each service.

Every backend response includes an `X-Served-By` header containing the pod name that processed the request.

---

## 4. Active Health Checks and Failover

Load balancers must know when a replica is unhealthy.

KubePulse uses Kubernetes readiness probes:
- Endpoint: `/readyz`
- **Healthy (HTTP 200)**: The pod receives traffic from the load balancer.
- **Unready (HTTP 503)**: The load balancer stops sending traffic to this pod immediately.

You can test this behavior using chaos injection:
```bash
make chaos-ready SERVICE=gateway
```
When readiness fails, the load balancer removes the pod from the active pool. The remaining pods handle 100% of the traffic.

To restore the pod:
```bash
make chaos-reset SERVICE=gateway
```

---

## 5. How to Run the Load Balancer Demo

### Option A: Local Docker Compose Stack

Run the multi-replica load balancer stack locally:

```bash
make lb-up        # Starts Nginx LB + 3 gateways + 2 frontends + services
make lb-logs      # Follow load balancer logs
make lb-test      # Run automated traffic distribution test
make lb-down      # Stop all containers
```

Open [http://localhost](http://localhost) in your browser.

Use the dashboard's **Load Balancer & Traffic Distribution** card to:
1. Click **Simulate Traffic** to send a burst of requests.
2. Observe the traffic distribution bar chart across replicas.
3. Click **Test Failover** to watch an unready pod get removed from the pool in real-time.

### Option B: Kubernetes Production Overlay

Deploy the production overlay with 3 replicas per service, HPAs, and LoadBalancer services:

```bash
make k8s-prod
kubectl get svc -n kubepulse-prod
```

You will see:
- `frontend-loadbalancer`: Service of `type: LoadBalancer` exposing port 80.
- `gateway-loadbalancer`: Service of `type: LoadBalancer` exposing port 5000.
- `kubepulse-ingress`: Traefik Ingress controller rules.

Run the test script against your cluster:
```bash
API_URL=http://status.kubepulse.local make lb-test
```

---

## 6. Cloud Provider Annotations

In cloud environments, adding annotations to `frontend-loadbalancer.yaml` configures cloud provider load balancers:

### AWS (Network Load Balancer - NLB)
```yaml
metadata:
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "external"
    service.beta.kubernetes.io/aws-load-balancer-nlb-target-type: "ip"
    service.beta.kubernetes.io/aws-load-balancer-scheme: "internet-facing"
```

### Google Cloud (GCP Network Load Balancer)
```yaml
metadata:
  annotations:
    cloud.google.com/load-balancer-type: "External"
```

### Azure Standard Load Balancer
```yaml
metadata:
  annotations:
    service.beta.kubernetes.io/azure-load-balancer-internal: "false"
```

### Bare-Metal (MetalLB / K3s Klipper)
K3s includes Klipper ServiceLB by default. A Service with `type: LoadBalancer` automatically binds to the host ports across nodes without extra configuration.
