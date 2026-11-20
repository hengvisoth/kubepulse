'use client';

import React, { useState, useEffect } from 'react';
import { Skull, Flame, ShieldAlert, Droplets, Timer, RotateCcw, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { ServiceName } from '../types';

interface ChaosControlsProps {
  selectedService: ServiceName;
  onSelectService: (service: ServiceName) => void;
  onTriggerCrash: () => Promise<any>;
  onTriggerCpuSpike: (durationSeconds?: number) => Promise<any>;
  onToggleReadiness: () => Promise<any>;
  onTriggerMemoryLeak: (megabytes?: number) => Promise<any>;
  onSetLatency: (ms: number) => Promise<any>;
  onResetChaos: () => Promise<any>;
  onResetAllServices: () => Promise<any>;
  isCpuSpiking: boolean;
  isReadinessFailing: boolean;
  artificialLatencyMs: number;
  leakedMemoryMb: number;
}

const SERVICES: ServiceName[] = ['gateway', 'components', 'incidents', 'status'];

export const ChaosControls: React.FC<ChaosControlsProps> = ({
  selectedService,
  onSelectService,
  onTriggerCrash,
  onTriggerCpuSpike,
  onToggleReadiness,
  onTriggerMemoryLeak,
  onSetLatency,
  onResetChaos,
  onResetAllServices,
  isCpuSpiking,
  isReadinessFailing,
  artificialLatencyMs,
  leakedMemoryMb,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [latencyInput, setLatencyInput] = useState<number>(artificialLatencyMs || 0);

  useEffect(() => {
    setLatencyInput(artificialLatencyMs || 0);
  }, [selectedService, artificialLatencyMs]);

  const routePrefix = selectedService === 'gateway' ? '' : `/services/${selectedService}`;

  const executeAction = async (name: string, fn: () => Promise<any>) => {
    try {
      setLoadingAction(name);
      setActionFeedback(null);
      const res = await fn();
      setActionFeedback({
        type: 'success',
        message: res?.message || `Action ${name} executed on ${selectedService}.`,
      });
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || `Failed to execute ${name} on ${selectedService}.`,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
      {/* Title, Service Target Selector & Reset Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 flex flex-wrap items-center gap-2">
              <span>Chaos Engineering Control Center</span>
              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[11px] font-mono font-semibold">
                Target: {selectedService}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Trigger isolated failure scenarios on <span className="font-mono text-slate-200">{selectedService}</span> to observe Kubernetes, Rancher, and HPA self-heal.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Service Target Switcher */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-lg border border-slate-800">
            {SERVICES.map((svc) => (
              <button
                key={svc}
                type="button"
                onClick={() => onSelectService(svc)}
                aria-pressed={selectedService === svc}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition ${
                  selectedService === svc
                    ? 'bg-teal-600/30 text-teal-200 border border-teal-500/50 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {svc}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => executeAction(`Reset ${selectedService}`, onResetChaos)}
            disabled={loadingAction !== null}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700 text-xs font-medium transition"
          >
            <RotateCcw className="h-3.5 w-3.5 text-teal-400" />
            <span>Reset {selectedService}</span>
          </button>

          <button
            type="button"
            onClick={() => executeAction('Reset All Services', onResetAllServices)}
            disabled={loadingAction !== null}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/50 text-rose-200 border border-rose-500/30 text-xs font-medium transition"
          >
            <RotateCcw className="h-3.5 w-3.5 text-rose-400" />
            <span>Reset All Services</span>
          </button>
        </div>
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
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wide flex items-center space-x-1.5">
                <Skull className="h-4 w-4 shrink-0" />
                <span>Crash {selectedService} Pod</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500 truncate">POST {routePrefix}/chaos/crash</span>
            </div>
            <p className="text-xs text-slate-300">
              Forces <code className="text-rose-300 bg-slate-900 px-1 py-0.5 rounded">process.exit(1)</code> on the serving{' '}
              <code className="text-slate-200">{selectedService}</code> replica.
            </p>
            <div className="text-[11px] text-slate-500 bg-slate-900/60 p-2 rounded border border-slate-800/80">
              💡 <strong>Observe:</strong> In Rancher UI, watch the <code className="text-rose-300">{selectedService}</code> pod restart counter increment (+1).
            </div>
          </div>

          <button
            type="button"
            onClick={() => executeAction('Crash Pod', onTriggerCrash)}
            disabled={loadingAction !== null}
            className="w-full py-2 px-3 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-semibold flex items-center justify-center space-x-1.5 transition active:scale-95"
          >
            <Skull className="h-3.5 w-3.5" />
            <span>{loadingAction === 'Crash Pod' ? 'Crashing...' : `Crash ${selectedService} Pod`}</span>
          </button>
        </div>

        {/* 2. CPU Spike (HPA Testing) */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-amber-500/50 transition flex flex-col justify-between space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wide flex items-center space-x-1.5">
                <Flame className="h-4 w-4 shrink-0" />
                <span>CPU Spike (HPA Test)</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500 truncate">POST {routePrefix}/chaos/cpu-spike</span>
            </div>
            <p className="text-xs text-slate-300">
              Spikes CPU utilization to 100% for 30s on <code className="text-slate-200">{selectedService}</code>. Tests its dedicated Horizontal Pod Autoscaler.
            </p>
            <div className="text-[11px] text-slate-500 bg-slate-900/60 p-2 rounded border border-slate-800/80">
              💡 <strong>Observe:</strong> <code className="text-cyan-400">kubectl get hpa</code> scales <code className="text-amber-300">{selectedService}</code> replicas independently.
            </div>
          </div>

          <button
            type="button"
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
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wide flex items-center space-x-1.5">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>Readiness Failure</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500 truncate">GET {routePrefix}/readyz → 503</span>
            </div>
            <p className="text-xs text-slate-300">
              Forces <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded">/readyz</code> on <code className="text-slate-200">{selectedService}</code> to return 503 while other services stay ready.
            </p>
            <div className="text-[11px] text-slate-500 bg-slate-900/60 p-2 rounded border border-slate-800/80">
              💡 <strong>Observe:</strong> Topology marks <code className="text-cyan-300">{selectedService}</code> as <code className="text-amber-300">UNREADY 503</code>.
            </div>
          </div>

          <button
            type="button"
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
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-teal-400 uppercase tracking-wide flex items-center space-x-1.5">
                <Droplets className="h-4 w-4 shrink-0" />
                <span>Memory Pressure Leak</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500 truncate">POST {routePrefix}/chaos/memory-leak</span>
            </div>
            <p className="text-xs text-slate-300">
              Allocates 50MB of memory buffers in <code className="text-slate-200">{selectedService}</code> to simulate memory growth and test container limits.
            </p>
            <div className="text-[11px] text-slate-500 font-mono">
              Leaked on {selectedService}: <span className="text-teal-300 font-semibold">{leakedMemoryMb}MB</span>
            </div>
          </div>

          <button
            type="button"
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
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wide flex items-center space-x-1.5">
                <Timer className="h-4 w-4 shrink-0" />
                <span>Artificial Latency</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500 truncate">POST {routePrefix}/chaos/latency</span>
            </div>
            <p className="text-xs text-slate-300">
              Injects HTTP delay on <code className="text-slate-200">{selectedService}</code>. Use <code className="text-rose-300">3500ms</code> to exceed the 3000ms gateway timeout (504).
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[0, 200, 500, 1500, 3500].map((ms) => (
                <button
                  key={ms}
                  type="button"
                  onClick={() => {
                    setLatencyInput(ms);
                    executeAction(`Latency ${ms}ms`, () => onSetLatency(ms));
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-mono border transition ${
                    latencyInput === ms
                      ? ms >= 3000
                        ? 'bg-rose-600/30 border-rose-500 text-rose-200 font-semibold'
                        : 'bg-purple-600/30 border-purple-500 text-purple-200 font-semibold'
                      : ms >= 3000
                      ? 'bg-slate-900 border-rose-900/60 text-rose-300 hover:text-rose-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {ms === 0 ? '0ms' : ms === 3500 ? '3500ms (504)' : `${ms}ms`}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-slate-500 font-mono">
            Active on {selectedService}:{' '}
            <span className={latencyInput >= 3000 ? 'text-rose-300 font-semibold' : 'text-purple-300 font-semibold'}>
              {latencyInput}ms
            </span>
          </div>
        </div>

        {/* 6. Prometheus Metrics Scrape Link */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-emerald-500/50 transition flex flex-col justify-between space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center space-x-1.5">
                <Info className="h-4 w-4 shrink-0" />
                <span>Prometheus Telemetry</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500 truncate">GET {routePrefix}/metrics</span>
            </div>
            <p className="text-xs text-slate-300">
              Exposes <code className="text-emerald-300">kubepulse_http_requests_total</code> and{' '}
              <code className="text-emerald-300">kubepulse_chaos_events_total</code> for <code className="text-slate-200">{selectedService}</code>.
            </p>
          </div>

          <a
            href={`/backend-api${routePrefix}/metrics`}
            target="_blank"
            rel="noreferrer"
            className="w-full py-2 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
          >
            <span>Inspect {selectedService} /metrics ↗</span>
          </a>
        </div>
      </div>
    </div>
  );
};
