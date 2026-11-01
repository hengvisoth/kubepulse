'use client';

import React from 'react';
import { Compass, RefreshCw, BookOpen } from 'lucide-react';
import { PodTelemetry } from '../types';

interface HeaderProps {
  telemetry: PodTelemetry | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenGuide: () => void;
  autoRefresh: boolean;
  setAutoRefresh: (val: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  telemetry,
  loading,
  onRefresh,
  onOpenGuide,
  autoRefresh,
  setAutoRefresh,
}) => {
  const envName = telemetry?.envName || process.env.NEXT_PUBLIC_ENV_NAME || 'DEV';
  const appVersion = telemetry?.appVersion || process.env.NEXT_PUBLIC_APP_VERSION || 'v1.0.0';

  const isProd = envName.toUpperCase() === 'PROD' || envName.toUpperCase() === 'PRODUCTION';

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-[#10243A] flex items-center justify-center">
              <Compass className="h-6 w-6 text-[#5EEAD4]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-display text-2xl font-semibold tracking-tight text-slate-100">KubePulse</span>
                {/* Environment Badge */}
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                    isProd
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {envName}
                </span>
                {/* App Version Badge */}
                <span className="px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-slate-800 text-teal-300 border border-slate-700">
                  {appVersion}
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Incident Status & Chaos Testing Platform
              </p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center space-x-2">
            {/* Auto-Poll Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                autoRefresh
                  ? 'bg-teal-600/20 border-teal-500 text-teal-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-100'
              }`}
              title="Automatically poll backend every 2s to observe traffic distribution across replicas"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Live Stream ({autoRefresh ? 'ON' : 'OFF'})</span>
            </button>

            {/* Manual Refresh */}
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700 transition"
              title="Fetch latest status"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-teal-400' : ''}`} />
            </button>

            {/* GitOps & Chaos Architecture Guide */}
            <button
              onClick={onOpenGuide}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              <BookOpen className="h-4 w-4 text-amber-400" />
              <span className="hidden md:inline">Chaos & GitOps Lab</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
