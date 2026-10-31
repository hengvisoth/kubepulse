'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon, Zap } from 'lucide-react';
import { StatusSummary } from '../types';

interface SystemStatusBannerProps {
  summary: StatusSummary | null;
  loading: boolean;
}

export const SystemStatusBanner: React.FC<SystemStatusBannerProps> = ({ summary, loading }) => {
  const overall = summary?.overallStatus || 'OPERATIONAL';
  const total = summary?.totalComponents || 0;
  const operational = summary?.operationalComponents || 0;
  const activeCount = summary?.activeIncidentsCount || 0;

  if (overall === 'OUTAGE') {
    return (
      <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl shadow-rose-950/20">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-rose-500/20 text-rose-400">
            <AlertOctagon className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-rose-300">Active System Outage Detected</h2>
            <p className="text-sm text-rose-200/80 mt-0.5">
              {activeCount} incident(s) currently ongoing. Core services are impacted.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3 text-xs font-mono text-rose-300">
          <span className="px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 font-semibold">
            {operational} / {total} Services Operational
          </span>
        </div>
      </div>
    );
  }

  if (overall === 'DEGRADED') {
    return (
      <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl shadow-amber-950/20">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-amber-300">Degraded System Performance</h2>
            <p className="text-sm text-amber-200/80 mt-0.5">
              Some services are experiencing latency or partial outages. Monitoring in progress.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3 text-xs font-mono text-amber-300">
          <span className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 font-semibold">
            {operational} / {total} Services Operational
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl shadow-emerald-950/20">
      <div className="flex items-center space-x-4">
        <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-emerald-300">All Systems Operational</h2>
          <p className="text-sm text-emerald-200/80 mt-0.5">
            Every cluster service is passing health probes and serving requests normally.
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-3 text-xs font-mono text-emerald-300">
        <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 font-semibold flex items-center space-x-1.5">
          <Zap className="h-3.5 w-3.5 text-emerald-400" />
          <span>{operational} / {total} Services Online</span>
        </span>
      </div>
    </div>
  );
};
