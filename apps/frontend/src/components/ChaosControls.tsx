'use client';

import React, { useState } from 'react';
import { Skull, Flame, ShieldAlert, Droplets, Timer, RotateCcw, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface ChaosControlsProps {
  onTriggerCrash: () => Promise<any>;
  onTriggerCpuSpike: (durationSeconds?: number) => Promise<any>;
  onToggleReadiness: () => Promise<any>;
  onTriggerMemoryLeak: (megabytes?: number) => Promise<any>;
  onSetLatency: (ms: number) => Promise<any>;
  onResetChaos: () => Promise<any>;
  isCpuSpiking: boolean;
  isReadinessFailing: boolean;
}

export const ChaosControls: React.FC<ChaosControlsProps> = ({
  onTriggerCrash,
  onTriggerCpuSpike,
  onToggleReadiness,
  onTriggerMemoryLeak,
  onSetLatency,
  onResetChaos,
  isCpuSpiking,
  isReadinessFailing,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [latencyInput, setLatencyInput] = useState<number>(500);

  const executeAction = async (name: string, fn: () => Promise<any>) => {
    try {
      setLoadingAction(name);
      setActionFeedback(null);
      const res = await fn();
      setActionFeedback({
        type: 'success',
        message: res?.message || `Action ${name} executed successfully.`,
      });
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || `Failed to execute ${name}.`,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
      {/* Title & Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <span>Chaos Engineering Control Center</span>
              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[11px] font-mono font-semibold">
                Rancher & ArgoCD Testing
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Trigger simulated failure scenarios to watch Kubernetes, Rancher, and HPA self-heal in real time.
            </p>
          </div>
        </div>

        <button
          onClick={() => executeAction('Reset', onResetChaos)}
          disabled={loadingAction !== null}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700 text-xs font-medium transition self-start sm:self-auto"
        >
          <RotateCcw className="h-3.5 w-3.5 text-teal-400" />
          <span>Reset All Chaos</span>
        </button>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-3 rounded-xl text-xs flex items-start space-x-2.5 border ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : actionFeedback.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-teal-500/10 border-teal-500/30 text-teal-300'
          }`}
        >
          {actionFeedback.type === 'success' ? (
            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
          )}
          <div className="flex-1 font-mono">{actionFeedback.message}</div>
        </div>
      )}

      {/* Grid of Chaos Triggers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* 1. Crash Pod */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-rose-500/50 transition flex flex-col justify-between space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wide flex items-center space-x-1.5">
                <Skull className="h-4 w-4" />
                <span>Crash Node.js Pod</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">POST /chaos/crash</span>
            </div>
            <p className="text-xs text-slate-300">
              Forces <code className="text-rose-300 bg-slate-900 px-1 py-0.5 rounded">process.exit(1)</code>.
              Kubernetes kubelet detects the exit code and restarts the container.
            </p>
            <div className="text-[11px] text-slate-500 bg-slate-900/60 p-2 rounded border border-slate-800/80">
              💡 <strong>Observe:</strong> In Rancher UI, watch the pod restart counter increment (+1).
            </div>
          </div>

          <button
            onClick={() => executeAction('Crash Pod', onTriggerCrash)}
            disabled={loadingAction !== null}
            className="w-full py-2 px-3 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-semibold flex items-center justify-center space-x-1.5 transition active:scale-95"
          >
            <Skull className="h-3.5 w-3.5" />
            <span>{loadingAction === 'Crash Pod' ? 'Crashing...' : 'Trigger Pod Crash'}</span>
          </button>
        </div>

        {/* 2. CPU Spike (HPA Testing) */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-amber-500/50 transition flex flex-col justify-between space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wide flex items-center space-x-1.5">
                <Flame className="h-4 w-4" />
                <span>CPU Spike (HPA Test)</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">POST /chaos/cpu-spike</span>
            </div>
            <p className="text-xs text-slate-300">
              Spikes CPU utilization to 100% for 30s. Tests the Horizontal Pod Autoscaler (HPA) metric target.
            </p>
            <div className="text-[11px] text-slate-500 bg-slate-900/60 p-2 rounded border border-slate-800/80">
              💡 <strong>Observe:</strong> <code className="text-cyan-400">kubectl get hpa</code> triggers replica scaling (1 → 3+).
            </div>
          </div>

          <button
            onClick={() => executeAction('CPU Spike', () => onTriggerCpuSpike(30))}
            disabled={loadingAction !== null || isCpuSpiking}
            className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition active:scale-95 border ${
              isCpuSpiking
                ? 'bg-amber-500/30 border-amber-500 text-amber-200 animate-pulse'
                : 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border-amber-500/40'
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            <span>{isCpuSpiking ? '🔥 CPU Spike Active (30s)' : 'Trigger 30s CPU Spike'}</span>
          </button>
        </div>

        {/* 3. Toggle Readiness Probe */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-cyan-500/50 transition flex flex-col justify-between space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wide flex items-center space-x-1.5">
                <ShieldAlert className="h-4 w-4" />
                <span>Readiness Failure</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">GET /readyz → 503</span>
            </div>
            <p className="text-xs text-slate-300">
              Forces <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded">/readyz</code> to return 503.
              Kubernetes removes pod IP from the Service Endpoints slice without killing the container.
            </p>
            <div className="text-[11px] text-slate-500 bg-slate-900/60 p-2 rounded border border-slate-800/80">
              💡 <strong>Observe:</strong> Rancher shows pod "Unready". Zero new traffic routed here.
            </div>
          </div>

          <button
            onClick={() => executeAction('Toggle Readiness', onToggleReadiness)}
            disabled={loadingAction !== null}
            className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition active:scale-95 border ${
              isReadinessFailing
                ? 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border-rose-500/40'
                : 'bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border-cyan-500/40'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>{isReadinessFailing ? 'Restore Readiness (Make 200)' : 'Fail Readiness Probe (503)'}</span>
          </button>
        </div>

        {/* 4. Memory Pressure */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-teal-500/50 transition flex flex-col justify-between space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-400 uppercase tracking-wide flex items-center space-x-1.5">
                <Droplets className="h-4 w-4" />
                <span>Memory Pressure Leak</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">POST /chaos/memory-leak</span>
            </div>
            <p className="text-xs text-slate-300">
              Allocates 50MB of memory buffers to simulate memory growth and verify k8s container resource limits.
            </p>
          </div>

          <button
            onClick={() => executeAction('Memory Leak', () => onTriggerMemoryLeak(50))}
            disabled={loadingAction !== null}
            className="w-full py-2 px-3 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 text-xs font-semibold flex items-center justify-center space-x-1.5 transition active:scale-95"
          >
            <Droplets className="h-3.5 w-3.5" />
            <span>Leak +50MB Heap</span>
          </button>
        </div>

        {/* 5. Latency Injection */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-purple-500/50 transition flex flex-col justify-between space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wide flex items-center space-x-1.5">
                <Timer className="h-4 w-4" />
                <span>Artificial Latency</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">Delay (ms)</span>
            </div>
            <p className="text-xs text-slate-300">
              Injects artificial delay into HTTP responses to test timeout handling and slow upstream services.
            </p>
            <div className="flex items-center space-x-2 pt-1">
              {[0, 200, 500, 1500].map((ms) => (
                <button
                  key={ms}
                  onClick={() => {
                    setLatencyInput(ms);
                    executeAction(`Latency ${ms}ms`, () => onSetLatency(ms));
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-mono border transition ${
                    latencyInput === ms
                      ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {ms === 0 ? '0ms' : `${ms}ms`}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-slate-500 font-mono">
            Active Latency: <span className="text-purple-300">{latencyInput}ms</span>
          </div>
        </div>

        {/* 6. Prometheus Metrics Scrape Link */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-emerald-500/50 transition flex flex-col justify-between space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center space-x-1.5">
                <Info className="h-4 w-4" />
                <span>Prometheus Telemetry</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">GET /metrics</span>
            </div>
            <p className="text-xs text-slate-300">
              Exposes standard metrics (<code className="text-emerald-300">kubepulse_http_requests_total</code>,{' '}
              <code className="text-emerald-300">kubepulse_chaos_events_total</code>) scraped by Prometheus / Rancher.
            </p>
          </div>

          <a
            href="/backend-api/metrics"
            target="_blank"
            rel="noreferrer"
            className="w-full py-2 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
          >
            <span>Inspect /metrics Output ↗</span>
          </a>
        </div>
      </div>
    </div>
  );
};
