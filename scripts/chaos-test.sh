#!/usr/bin/env bash
# KubePulse Chaos Testing Script
set -e

API_URL="${API_URL:-http://localhost:5000}"

echo "=================================================="
echo "⚡ KubePulse Chaos Engineering Test Runner"
echo "Target API: ${API_URL}"
echo "=================================================="

usage() {
  echo "Usage: $0 [command]"
  echo ""
  echo "Commands:"
  echo "  telemetry         Fetch serving pod telemetry"
  echo "  crash             Crash serving pod (forces process.exit(1))"
  echo "  cpu [seconds]     Simulate high CPU spike (default: 30s) for HPA"
  echo "  readiness         Toggle Kubernetes readiness probe failure (/readyz)"
  echo "  memory [mb]       Simulate memory leak (default: 50MB)"
  echo "  latency [ms]      Inject artificial latency (default: 500ms)"
  echo "  reset             Reset all simulated chaos"
  echo "  status-summary    Fetch cached status summary (Redis 30s TTL)"
  echo "  purge-cache       Purge Redis status summary cache"
  echo "  watch-rollout     Watch Kubernetes rolling update in real-time"
  exit 1
}

case "$1" in
  telemetry)
    curl -s "${API_URL}/api/telemetry" | jq .
    ;;
  crash)
    echo "💥 Sending crash command to ${API_URL}/chaos/crash..."
    curl -s -X POST "${API_URL}/chaos/crash" \
      -H "Content-Type: application/json" \
      -d '{"delayMs": 200}' | jq .
    echo "Observe Rancher or kubectl to watch the pod restart counter increment!"
    ;;
  cpu)
    DURATION="${2:-30}"
    echo "🔥 Triggering CPU spike for ${DURATION}s on ${API_URL}/chaos/cpu-spike..."
    curl -s -X POST "${API_URL}/chaos/cpu-spike" \
      -H "Content-Type: application/json" \
      -d "{\"durationSeconds\": ${DURATION}}" | jq .
    echo "Watch HPA with: kubectl get hpa -n kubepulse-prod -w"
    ;;
  readiness)
    echo "🛑 Toggling readiness probe on ${API_URL}/chaos/toggle-readiness..."
    curl -s -X POST "${API_URL}/chaos/toggle-readiness" | jq .
    echo "Check probe status with: curl -i ${API_URL}/readyz"
    ;;
  memory)
    MB="${2:-50}"
    echo "💧 Leaking ${MB}MB memory on ${API_URL}/chaos/memory-leak..."
    curl -s -X POST "${API_URL}/chaos/memory-leak" \
      -H "Content-Type: application/json" \
      -d "{\"megabytes\": ${MB}}" | jq .
    ;;
  latency)
    MS="${2:-500}"
    echo "⏱️ Setting artificial latency to ${MS}ms..."
    curl -s -X POST "${API_URL}/chaos/latency" \
      -H "Content-Type: application/json" \
      -d "{\"latencyMs\": ${MS}}" | jq .
    ;;
  reset)
    echo "🧹 Resetting all chaos states..."
    curl -s -X POST "${API_URL}/chaos/reset" | jq .
    ;;
  status-summary)
    curl -s -i "${API_URL}/api/status-summary"
    ;;
  purge-cache)
    echo "🗑️ Purging Redis status summary cache..."
    curl -s -X POST "${API_URL}/api/status-summary/cache-purge" | jq .
    ;;
  watch-rollout)
    echo "Watching pod rolling update traffic shifts (Ctrl+C to stop)..."
    while true; do
      curl -s "${API_URL}/api/telemetry" | jq -r '"Serving Pod: \(.podName) | Version: \(.appVersion) | Env: \(.envName)"' || echo "Connecting..."
      sleep 1
    done
    ;;
  *)
    usage
    ;;
esac
