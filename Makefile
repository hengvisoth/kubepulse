.PHONY: up down build logs k8s-dev k8s-prod chaos-crash chaos-cpu test help

help:
	@echo "KubePulse — Incident Status & Chaos Testing Board"
	@echo ""
	@echo "Local Docker Stack:"
	@echo "  make up          - Start Frontend, Backend, Postgres, and Redis via Docker Compose"
	@echo "  make down        - Stop all containers"
	@echo "  make build       - Rebuild local docker images"
	@echo "  make logs        - Tail container logs"
	@echo ""
	@echo "Kubernetes & GitOps:"
	@echo "  make k8s-dev     - Deploy DEV overlay (1 replica, kubepulse-dev namespace)"
	@echo "  make k8s-prod    - Deploy PROD overlay (3 replicas, HPA, kubepulse-prod namespace)"
	@echo "  make k8s-diff    - Review differences between Dev and Prod overlays"
	@echo ""
	@echo "Chaos Experiments:"
	@echo "  make chaos-crash - Force process.exit(1) on serving pod"
	@echo "  make chaos-cpu   - Trigger 30-second CPU spike to test HPA"
	@echo "  make chaos-ready - Toggle readiness probe failure (/readyz -> 503)"
	@echo "  make chaos-reset - Reset all chaos states"

up:
	docker compose up -d --build

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

k8s-dev:
	kubectl apply -k k8s/overlays/dev

k8s-prod:
	kubectl apply -k k8s/overlays/prod

k8s-diff:
	diff -u <(kubectl kustomize k8s/overlays/dev) <(kubectl kustomize k8s/overlays/prod) || true

chaos-crash:
	./scripts/chaos-test.sh crash

chaos-cpu:
	./scripts/chaos-test.sh cpu 30

chaos-ready:
	./scripts/chaos-test.sh readiness

chaos-reset:
	./scripts/chaos-test.sh reset
