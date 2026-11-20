'use client';

import React from 'react';
import { Network, CheckCircle2, AlertTriangle, XCircle, Flame, Timer, Droplets, ShieldAlert, Radio } from 'lucide-react';
import { ServiceName, ServiceNodeStatus } from '../types';

interface ServiceTopologyCardProps {
  services: ServiceNodeStatus[];
  selectedService: ServiceName;
  onSelectService: (service: ServiceName) => void;
  servedByGatewayPod?: string;
}

const SERVICE_META: Record<
  ServiceName,
  {
    label: string;
    k8sService: string;
    role: string;
  }
> = {
  gateway: {
    label: 'Gateway Service',
    k8sService: 'gateway-service:5000',
    role: 'Public API routing and gateway telemetry',
  },
  components: {
    label: 'Components Service',
    k8sService: 'components-service:5000',
    role: 'Component status reads and updates (PostgreSQL)',
  },
  incidents: {
    label: 'Incidents Service',
    k8sService: 'incidents-service:5000',
    role: 'Incidents and timeline updates (PostgreSQL)',
  },
  status: {
    label: 'Status Service',
    k8sService: 'status-service:5000',
    role: 'Summary HTTP fan-out and 30s Redis cache',
  },
};

const SERVICE_ORDER: ServiceName[] = ['gateway', 'components', 'incidents', 'status'];

export const ServiceTopologyCard: React.FC<ServiceTopologyCardProps> = ({
  services,
  selectedService,
  onSelectService,
  servedByGatewayPod,
}) => {
  const byName = new Map(services.map((svc) => [svc.name, svc]));

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <span>Live Microservice Topology</span>
              <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 text-[11px] font-mono font-semibold">
                GET /api/services
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Select a service below to inspect its pod telemetry, replica traffic, and chaos controls.
            </p>
          </div>
        </div>

        {servedByGatewayPod && (
          <div className="text-xs font-mono text-slate-400 bg-slate-950/70 px-3 py-1.5 rounded-lg border border-slate-800 self-start sm:self-auto">
            Discovery via: <span className="text-cyan-300 font-semibold">{servedByGatewayPod}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {SERVICE_ORDER.map((name) => {
          const meta = SERVICE_META[name];
          const node = byName.get(name);
          const isSelected = selectedService === name;
          const isReady = node ? node.ok && node.status !== 'unready' : false;
          const isUnready = node ? node.status === 'unready' || Boolean(node.chaos?.isReadinessFailing) : false;
          const isUnreachable = node ? !node.ok && !isUnready : false;

          const chaos = node?.chaos;
          const hasCpu = Boolean(chaos?.isCpuSpiking);
          const latencyMs = chaos?.artificialLatencyMs || 0;
          const leakedMb = chaos?.leakedMemoryMb || 0;

          return (
            <button
              key={name}
              type="button"
              onClick={() => onSelectService(name)}
              aria-pressed={isSelected}
              className={`text-left p-4 rounded-xl border transition flex flex-col justify-between space-y-3 ${
                isSelected
                  ? 'bg-teal-950/40 border-teal-500 ring-1 ring-teal-500/50'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-2 w-full">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-slate-100 flex items-center space-x-1.5">
                      <span>{meta.label}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">{meta.k8sService}</div>
                  </div>

                  {!node ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-400">
                      LOADING
                    </span>
                  ) : isReady ? (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>READY 200</span>
                    </span>
                  ) : isUnready ? (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      <AlertTriangle className="h-3 w-3" />
                      <span>UNREADY 503</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      <XCircle className="h-3 w-3" />
                      <span>UNREACHABLE</span>
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">{meta.role}</p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800/80 w-full">
                <div className="text-[11px] font-mono truncate">
                  {isUnreachable ? (
                    <span className="text-rose-400" title={node?.error}>
                      Error: {node?.error || 'Connection failed'}
                    </span>
                  ) : (
                    <>
                      <span className="text-slate-500">Pod: </span>
                      <span className="text-cyan-300 font-semibold">{node?.pod || 'waiting...'}</span>
                    </>
                  )}
                </div>

                {(isUnready || hasCpu || latencyMs > 0 || leakedMb > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {isUnready && (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        <ShieldAlert className="h-2.5 w-2.5" />
                        <span>503 Probe</span>
                      </span>
                    )}
                    {hasCpu && (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                        <Flame className="h-2.5 w-2.5" />
                        <span>CPU 100%</span>
                      </span>
                    )}
                    {latencyMs > 0 && (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        <Timer className="h-2.5 w-2.5" />
                        <span>+{latencyMs}ms</span>
                      </span>
                    )}
                    {leakedMb > 0 && (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        <Droplets className="h-2.5 w-2.5" />
                        <span>+{leakedMb}MB</span>
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] font-mono pt-0.5">
                  <span className={isSelected ? 'text-teal-300 font-semibold flex items-center space-x-1' : 'text-slate-500'}>
                    <Radio className={`h-3 w-3 ${isSelected ? 'text-teal-400 animate-pulse' : 'text-slate-600'}`} />
                    <span>{isSelected ? 'Selected Target' : 'Click to inspect'}</span>
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
