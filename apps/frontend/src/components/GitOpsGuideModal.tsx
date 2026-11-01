'use client';

import React from 'react';
import { X, CheckCircle, Terminal, Layers, RefreshCw, Shield, Cpu, ExternalLink } from 'lucide-react';

interface GitOpsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GitOpsGuideModal: React.FC<GitOpsGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-teal-600/20 text-teal-400 border border-teal-500/30">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">KubePulse — GitOps & Chaos Testing Lab Guide</h2>
              <p className="text-xs text-slate-400">
                Architecture, Rancher setup, ArgoCD sync, and hands-on Chaos walkthrough
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section 1: Architecture Overview */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-teal-400 flex items-center space-x-2">
            <Terminal className="h-4 w-4" />
            <span>1. Architecture & Multi-Service DNS</span>
          </h3>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 space-y-2">
            <div>[User / Browser] → [Traefik Ingress Controller (HTTPS / cert-manager)]</div>
            <div className="pl-4">└── [Next.js Frontend Pods (App Router, Standalone Image ~120MB)]</div>
            <div className="pl-8">└── [Node.js Express Backend Service:5000]</div>
            <div className="pl-12">├── [Redis Cache (Internal DNS: redis-service:6379, 30s TTL)]</div>
            <div className="pl-12">└── [PostgreSQL StatefulSet (DATABASE_URL Secret, PVC Persistence)]</div>
          </div>
        </div>

        {/* Section 2: Zero-Downtime Rolling Update Verification */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-2">
            <RefreshCw className="h-4 w-4" />
            <span>2. Zero-Downtime Rolling Updates (ArgoCD Sync)</span>
          </h3>
          <div className="text-xs text-slate-300 space-y-2 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <p>
              When you commit a new image tag (e.g. <code>v1.1.0</code>) to your Git repository:
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 text-slate-400">
              <li>
                <strong>ArgoCD Auto-Sync:</strong> ArgoCD detects the change in <code>k8s/overlays/prod/</code> and triggers a rolling update.
              </li>
              <li>
                <strong>Traffic Shifting:</strong> With <code>maxSurge: 1</code> and <code>maxUnavailable: 0</code>, Kubernetes brings up a new pod, waits for <code>/readyz</code> (Readiness Probe) to succeed, then routes traffic.
              </li>
              <li>
                <strong>Live UI Verification:</strong> Keep the <strong>Live Stream (ON)</strong> toggle active in KubePulse. You will see new pod hostnames seamlessly answer requests while old pods gracefully terminate without a single dropped connection!
              </li>
            </ol>
          </div>
        </div>

        {/* Section 3: Chaos Experiments */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-rose-400 flex items-center space-x-2">
            <Shield className="h-4 w-4" />
            <span>3. Chaos Experiments to Run in Rancher</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="font-bold text-rose-300 flex items-center space-x-1.5">
                <span>💥 Pod Crash Test</span>
              </div>
              <p className="text-slate-400">
                Click <strong>Trigger Pod Crash</strong>. KubePulse forces <code>process.exit(1)</code>.
              </p>
              <div className="text-[11px] text-slate-500 font-mono">
                Observe in Rancher: Workload status turns yellow/red momentarily, restart count increments by 1, and pod self-heals.
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="font-bold text-amber-300 flex items-center space-x-1.5">
                <span>🔥 CPU Spike & HPA</span>
              </div>
              <p className="text-slate-400">
                Click <strong>Trigger 30s CPU Spike</strong>. The pod runs non-blocking math loops burning 100% CPU.
              </p>
              <div className="text-[11px] text-slate-500 font-mono">
                Observe: Run <code>kubectl get hpa -n kubepulse-prod -w</code>. Target CPU &gt; 70% triggers horizontal scale-out.
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="font-bold text-cyan-300 flex items-center space-x-1.5">
                <span>🛑 Readiness Probe Failure</span>
              </div>
              <p className="text-slate-400">
                Click <strong>Fail Readiness Probe</strong>. <code>/readyz</code> starts returning 503.
              </p>
              <div className="text-[11px] text-slate-500 font-mono">
                Observe: Kubernetes removes the pod IP from EndpointSlice. No user requests hit this degraded pod!
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Environment Isolation (Dev vs Prod) */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center space-x-2">
            <Cpu className="h-4 w-4" />
            <span>4. Environment Isolation & Rancher Projects</span>
          </h3>
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2 text-slate-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="font-bold text-emerald-400 mb-1">kubepulse-dev (Dev Namespace)</div>
                <ul className="list-disc pl-4 space-y-1 text-slate-400">
                  <li>1 Backend Replica / 1 Frontend Replica</li>
                  <li>ConfigMap: <code>ENV_NAME=DEV</code></li>
                  <li>Ingress: <code>dev.kubepulse.local</code></li>
                  <li>Rancher Project: Development (Resource Quota: 1 CPU, 2Gi RAM)</li>
                </ul>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="font-bold text-rose-400 mb-1">kubepulse-prod (Prod Namespace)</div>
                <ul className="list-disc pl-4 space-y-1 text-slate-400">
                  <li>3 Replicas with RollingUpdate (maxSurge: 1, maxUnavailable: 0)</li>
                  <li>ConfigMap: <code>ENV_NAME=PROD</code></li>
                  <li>HPA: Min 3, Max 10 Replicas targeting 70% CPU</li>
                  <li>Ingress: <code>kubepulse.local</code> with Let's Encrypt TLS</li>
                  <li>Rancher Project: Production (Resource Quota: 4 CPU, 8Gi RAM)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold"
          >
            Got it, Let's Test!
          </button>
        </div>
      </div>
    </div>
  );
};
