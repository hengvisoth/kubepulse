#!/usr/bin/env bash
# KubePulse Cluster Setup Helper
set -e

echo "=================================================="
echo "☸️  KubePulse K3s / Rancher / ArgoCD Setup Guide"
echo "=================================================="

# 1. Create Namespaces
echo "1. Creating namespaces..."
kubectl apply -f k8s/overlays/dev/namespace.yaml
kubectl apply -f k8s/overlays/prod/namespace.yaml

# 2. Deploy ArgoCD Applications (if ArgoCD is installed)
if kubectl get ns argocd > /dev/null 2>&1; then
  echo "2. ArgoCD detected. Applying application manifests..."
  kubectl apply -f argocd/application-dev.yaml
  kubectl apply -f argocd/application-prod.yaml
  echo "✅ ArgoCD applications registered."
else
  echo "ℹ️  ArgoCD namespace not found. You can deploy directly with Kustomize:"
  echo "   kubectl apply -k k8s/overlays/dev"
  echo "   kubectl apply -k k8s/overlays/prod"
fi

# 3. Hosts entry reminder for local testing
echo ""
echo "=================================================="
echo "📝 Add the following to your /etc/hosts for Ingress:"
echo "127.0.0.1 dev.kubepulse.local status.kubepulse.local kubepulse.local"
echo "=================================================="
