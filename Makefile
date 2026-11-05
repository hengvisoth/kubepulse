.PHONY: up standalone down build logs test smoke dev-gateway dev-components dev-incidents dev-status k8s-dev k8s-prod k8s-validate k8s-diff chaos-crash chaos-cpu chaos-ready chaos-reset help

SERVICE ?= gateway

help:
	@echo "KubePulse — Incident Status & Chaos Testing Board"
	@echo ""
	@echo "Local Docker Stack:"
	@echo "  make up          - Start frontend, four backend services, Postgres, and Redis"
	@echo "  make standalone  - Start frontend and four services with in-memory data"
	@echo "  make down        - Stop all containers"
	@echo "  make build       - Rebuild local docker images"
	@echo "  make logs        - Tail container logs"
	@echo "  make test        - Run backend service tests"
	@echo "  make smoke       - Check the running stack (creates and removes a test incident)"
	@echo "  make dev-gateway - Run gateway locally; also dev-components, dev-incidents, dev-status"
	@echo ""
	@echo "Kubernetes & GitOps:"
	@echo "  make k8s-dev     - Deploy DEV overlay (one replica per service)"
	@echo "  make k8s-prod    - Deploy PROD overlay (three replicas per service and separate HPAs)"
	@echo "  make k8s-validate - Render both overlays without deploying"
	@echo "  make k8s-diff    - Review differences between Dev and Prod overlays"
	@echo ""
	@echo "Chaos Experiments:"
	@echo "  make chaos-crash - Force process.exit(1) on serving pod"
	@echo "  make chaos-cpu   - Trigger 30-second CPU spike to test HPA"
	@echo "  make chaos-ready - Toggle readiness probe failure (/readyz -> 503)"
	@echo "  make chaos-reset - Reset all chaos states"
	@echo "  Add SERVICE=components, incidents, or status to target one service"

up:
	docker compose up -d --build

standalone:
	docker compose -f docker-compose.standalone.yml up -d --build

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

test:
	npm --prefix apps/backend test

smoke:
	node scripts/smoke-test.mjs

dev-gateway:
	npm --prefix apps/backend run dev:gateway

dev-components:
	npm --prefix apps/backend run dev:components

dev-incidents:
	npm --prefix apps/backend run dev:incidents

dev-status:
	npm --prefix apps/backend run dev:status

k8s-dev:
	kubectl apply -k k8s/overlays/dev

k8s-prod:
	kubectl apply -k k8s/overlays/prod

k8s-validate:
	kubectl kustomize k8s/overlays/dev > /dev/null
	kubectl kustomize k8s/overlays/prod > /dev/null

k8s-diff:
	@bash -c 'diff -u <(kubectl kustomize k8s/overlays/dev) <(kubectl kustomize k8s/overlays/prod); result=$$?; if [ $$result -gt 1 ]; then exit $$result; fi'

chaos-crash:
	SERVICE=$(SERVICE) ./scripts/chaos-test.sh crash

chaos-cpu:
	SERVICE=$(SERVICE) ./scripts/chaos-test.sh cpu 30

chaos-ready:
	SERVICE=$(SERVICE) ./scripts/chaos-test.sh readiness

chaos-reset:
	SERVICE=$(SERVICE) ./scripts/chaos-test.sh reset
