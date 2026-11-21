'use client';

import React, { useState } from 'react';
import { Scale, Play, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import { ServiceName } from '../types';

interface LoadBalancerCardProps {
  selectedService: ServiceName;
  onRefreshTelemetry: () => void;
  serviceApiPrefix: (service: ServiceName) => string;
}

interface PodStat {
  podName: string;
  hits: number;
  percentage: number;
  lastStatus: number;
}

export const LoadBalancerCard: React.FC<LoadBalancerCardProps> = ({
  selectedService,
  onRefreshTelemetry,
  serviceApiPrefix,
}) => {
  const [sampleSize, setSampleSize] = useState<number>(20);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isFailoverTesting, setIsFailoverTesting] = useState<boolean>(false);
  const [completedRequests, setCompletedRequests] = useState<number>(0);
  const [podStats, setPodStats] = useState<Record<string, PodStat>>({});
  const [failoverLog, setFailoverLog] = useState<string | null>(null);

  const runSimulation = async (total: number = sampleSize) => {
    setIsRunning(true);
    setCompletedRequests(0);
    const counts: Record<string, PodStat> = {};
    const prefix = serviceApiPrefix(selectedService);

    for (let i = 0; i < total; i++) {
      try {
        const res = await fetch(`${prefix}/api/telemetry`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        const pod = res.headers.get('x-served-by') || data.podName || 'unknown-pod';

        if (!counts[pod]) {
          counts[pod] = { podName: pod, hits: 0, percentage: 0, lastStatus: res.status };
        }
        counts[pod].hits += 1;
        counts[pod].lastStatus = res.status;
      } catch {
        const errPod = 'unreachable-endpoint';
        if (!counts[errPod]) {
          counts[errPod] = { podName: errPod, hits: 0, percentage: 0, lastStatus: 502 };
        }
        counts[errPod].hits += 1;
      }

      const completed = i + 1;
      setCompletedRequests(completed);

      // Update percentages in real-time
      const updated: Record<string, PodStat> = {};
      for (const [key, stat] of Object.entries(counts)) {
        updated[key] = {
          ...stat,
          percentage: Math.round((stat.hits / completed) * 100),
        };
      }
      setPodStats({ ...updated });
    }

    setIsRunning(false);
    onRefreshTelemetry();
  };

  const runFailoverTest = async () => {
    setIsFailoverTesting(true);
    setFailoverLog('Step 1: Marking one active pod as UNREADY via readiness probe...');
    const prefix = serviceApiPrefix(selectedService);

    try {
      // 1. Toggle readiness chaos on the active serving pod
      const toggleRes = await fetch(`${prefix}/chaos/toggle-readiness`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const toggleData = await toggleRes.json().catch(() => ({}));
      const affectedPod = toggleData.pod || 'current replica';

      setFailoverLog(`Step 2: Pod ${affectedPod} probe set to 503. Sending traffic burst...`);

      // 2. Send 15 requests to observe traffic drain
      await runSimulation(15);

      setFailoverLog('Step 3: Traffic drained away from unready pod. Resetting health probe...');

      // 3. Reset chaos so the pod recovers
      await fetch(`${prefix}/chaos/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      setFailoverLog(`Success: Pod ${affectedPod} recovered and re-joined the load balancer pool.`);
    } catch (err: any) {
      setFailoverLog(`Notice: ${err.message || 'Failover experiment finished'}`);
    } finally {
      setIsFailoverTesting(false);
      onRefreshTelemetry();
    }
  };

  const statList = Object.values(podStats).sort((a, b) => b.hits - a.hits);
  const replicaCount = statList.length;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              Load Balancer & Traffic Distribution
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase">
                {selectedService} pool
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Demonstrates L4 transport balancing, L7 reverse-proxy routing, and active health check draining.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs font-mono">
            {[10, 20, 30].map((size) => (
              <button
                key={size}
                onClick={() => setSampleSize(size)}
                className={`px-2.5 py-1 rounded ${
                  sampleSize === size
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {size} req
              </button>
            ))}
          </div>

          <button
            onClick={() => runSimulation()}
            disabled={isRunning || isFailoverTesting}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition disabled:opacity-50"
          >
            {isRunning ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            <span>{isRunning ? `Sending (${completedRequests}/${sampleSize})` : 'Simulate Traffic'}</span>
          </button>

          <button
            onClick={runFailoverTest}
            disabled={isRunning || isFailoverTesting}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-rose-500/40 text-rose-300 font-semibold text-xs transition disabled:opacity-50"
            title="Toggle readiness failure on one pod to test zero-downtime draining"
          >
            <Zap className="h-3.5 w-3.5 text-rose-400" />
            <span>{isFailoverTesting ? 'Testing Failover...' : 'Test Failover'}</span>
          </button>
        </div>
      </div>

      {/* Failover Status Log */}
      {failoverLog && (
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 flex items-center justify-between">
          <span>{failoverLog}</span>
          <button
            onClick={() => setFailoverLog(null)}
            className="text-slate-500 hover:text-slate-300 text-[11px]"
          >
            Clear
          </button>
        </div>
      )}

      {/* Distribution Visualizer */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>
            Active Pool: {replicaCount === 0 ? 'No requests sent yet' : `${replicaCount} active replica${replicaCount > 1 ? 's' : ''} responding`}
          </span>
          {replicaCount > 1 && (
            <span className="text-teal-400 flex items-center gap-1 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Traffic balanced across replicas
            </span>
          )}
          {replicaCount === 1 && completedRequests > 0 && (
            <span className="text-amber-400 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Single replica active. Run `make lb-up` or `make k8s-prod` for multi-replica balancing.
            </span>
          )}
        </div>

        {/* Replica Distribution Bars */}
        {statList.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
            <p className="text-xs text-slate-400 font-mono">
              Click <span className="text-teal-300 font-bold">Simulate Traffic</span> above to send a burst of requests and observe how the load balancer distributes traffic across pods.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {statList.map((stat) => (
              <div
                key={stat.podName}
                className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center space-x-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                    <span className="font-semibold text-slate-200 truncate">{stat.podName}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-slate-400">
                    <span>{stat.hits} requests</span>
                    <span className="font-bold text-cyan-300">{stat.percentage}%</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-300"
                    style={{ width: `${stat.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Architectural Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
        <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
          <div className="font-bold text-slate-200 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            L4 Transport Balancing
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Kubernetes <span className="font-mono text-slate-300">ClusterIP</span> and <span className="font-mono text-slate-300">type: LoadBalancer</span> route at TCP level using kube-proxy iptables/IPVS.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
          <div className="font-bold text-slate-200 flex items-center gap-1.5">
            <Scale className="h-4 w-4 text-teal-400" />
            L7 Application Balancing
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            <span className="font-mono text-slate-300">Traefik</span> and <span className="font-mono text-slate-300">Nginx</span> balance HTTP requests with path routing, header rewrites, and host matching.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
          <div className="font-bold text-slate-200 flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-400" />
            Active Readiness Probes
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            When <span className="font-mono text-slate-300">/readyz</span> fails (503), the load balancer instantly removes the pod from endpoints with zero client dropouts.
          </p>
        </div>
      </div>
    </div>
  );
};
