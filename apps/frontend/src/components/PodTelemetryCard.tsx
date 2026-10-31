'use client';

import React from 'react';
import { Box, Database, Cpu, HardDrive, Clock, Radio, Trash2, ArrowRightLeft } from 'lucide-react';
import { PodTelemetry, StatusSummary } from '../types';

interface PodTelemetryCardProps {
  telemetry: PodTelemetry | null;
  summary: StatusSummary | null;
  podHits: Record<string, number>;
  totalRequests: number;
  onPurgeCache: () => void;
  purgingCache: boolean;
}

export const PodTelemetryCard: React.FC<PodTelemetryCardProps> = ({
  telemetry,
  summary,
  podHits,
  totalRequests,
  onPurgeCache,
  purgingCache,
}) => {
  const currentPod = telemetry?.podName || summary?.servedByPod || 'unknown-pod';
  const isRedisHit = summary?.cacheStatus === 'HIT';
  const ttlRemaining = summary?.ttlSecondsRemaining ?? 30;
  const ttlPercentage = Math.min(100, Math.max(0, (ttlRemaining / 30) * 100));

  const uniquePods = Object.keys(podHits);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
      {/* Top Banner: Core Telemetry */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Box className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Serving Node.js Container (HOSTNAME)
              </span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <p className="text-base sm:text-lg font-mono font-bold text-cyan-300 truncate max-w-sm sm:max-w-md">
              {currentPod}
            </p>
          </div>
        </div>

        {/* Badges for Environment, Version & Latency */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <div className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
            Node: <span className="text-white font-semibold">{telemetry?.nodeName || 'k3s-node-1'}</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
            IP: <span className="text-cyan-300">{telemetry?.podIp || '10.42.0.x'}</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
            Uptime: <span className="text-emerald-300">{telemetry?.uptimeSeconds || 0}s</span>
          </div>
          {summary?.responseTimeMs !== undefined && (
            <div className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
              API RT: <span className="font-semibold">{summary.responseTimeMs}ms</span>
            </div>
          )}
        </div>
      </div>

      {/* Middle Grid: Redis Multi-Service Internal DNS & Pod Resources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Redis Internal DNS Caching Card */}
        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4 text-rose-400" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {telemetry?.redis?.connected ? 'Redis DNS Cache (redis-service:6379)' : 'Status Cache (In-Memory 30s TTL)'}
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase ${
                isRedisHit
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              Cache {summary?.cacheStatus || 'MISS'}
            </span>
          </div>

          <p className="text-xs text-slate-400">
            Status summary is cached for 30s to demonstrate cluster-internal Kubernetes DNS resolution
            across microservices.
          </p>

          {/* 30-second TTL Progress Bar */}
          <div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>TTL Remaining</span>
              <span className="text-cyan-300 font-semibold">{ttlRemaining}s / 30s</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-500"
                style={{ width: `${ttlPercentage}%` }}
              ></div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500 font-mono">
              Source: {summary?.cacheSource || 'PostgreSQL Database'}
            </span>
            <button
              onClick={onPurgeCache}
              disabled={purgingCache}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 hover:text-white transition"
              title="Invalidate Redis cache and force next request to query PostgreSQL"
            >
              <Trash2 className="h-3 w-3 text-rose-400" />
              <span>{purgingCache ? 'Purging...' : 'Purge Cache'}</span>
            </button>
          </div>
        </div>

        {/* Pod System & Memory Metrics */}
        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 space-y-3">
          <div className="flex items-center space-x-2">
            <Cpu className="h-4 w-4 text-indigo-400" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Container Resources & Probes
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="text-slate-400 text-[11px]">Heap Memory Used</div>
              <div className="text-sm font-mono font-bold text-slate-200 mt-0.5">
                {telemetry?.memory?.heapUsedMb || 28} MB{' '}
                <span className="text-slate-500 text-[10px]">/ {telemetry?.memory?.rssMb || 54} MB RSS</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="text-slate-400 text-[11px]">Kubernetes Readiness</div>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    telemetry?.chaos?.isReadinessFailing ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'
                  }`}
                ></span>
                <span
                  className={`text-sm font-mono font-bold ${
                    telemetry?.chaos?.isReadinessFailing ? 'text-rose-400' : 'text-emerald-300'
                  }`}
                >
                  {telemetry?.chaos?.isReadinessFailing ? 'UNREADY (503)' : 'PASSING (200)'}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="text-slate-400 text-[11px]">CPU Stress Status</div>
              <div className="text-sm font-mono font-bold mt-0.5">
                {telemetry?.chaos?.isCpuSpiking ? (
                  <span className="text-rose-400 animate-pulse">🔥 High Spike Active</span>
                ) : (
                  <span className="text-slate-300">Idle / Normal</span>
                )}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="text-slate-400 text-[11px]">Database Connectivity</div>
              <div className="text-sm font-mono font-bold text-emerald-300 mt-0.5">
                Active (PostgreSQL)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Visualizer: Zero-Downtime Rolling Update & Pod Traffic Distribution */}
      <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
            <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-400" />
            <span>Zero-Downtime Traffic Distribution Across Replicas</span>
            <span className="text-[11px] font-mono text-slate-500">
              ({totalRequests} total requests sampled)
            </span>
          </div>
          <span className="text-[11px] font-mono text-cyan-400">
            {uniquePods.length} Active Replica{uniquePods.length > 1 ? 's' : ''} Seen
          </span>
        </div>

        {/* Replica chips */}
        <div className="flex flex-wrap gap-2">
          {uniquePods.length === 0 ? (
            <div className="text-xs text-slate-500 font-mono py-1">
              Sample requests to see pod distribution...
            </div>
          ) : (
            uniquePods.map((pod) => {
              const count = podHits[pod] || 0;
              const pct = totalRequests > 0 ? Math.round((count / totalRequests) * 100) : 0;
              const isCurrent = pod === currentPod;

              return (
                <div
                  key={pod}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition ${
                    isCurrent
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500/50'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'}`}></span>
                  <span className="font-semibold">{pod}</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 text-[10px]">
                    {pct}% ({count})
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
