'use client';

import React, { useState } from 'react';
import { Layers, CheckCircle2, AlertTriangle, AlertOctagon, HelpCircle, Edit3 } from 'lucide-react';
import { ComponentItem, ComponentStatusType } from '../types';

interface ComponentsGridProps {
  components: ComponentItem[];
  onUpdateComponentStatus: (id: string, status: ComponentStatusType) => Promise<void>;
}

export const ComponentsGrid: React.FC<ComponentsGridProps> = ({
  components,
  onUpdateComponentStatus,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const getStatusBadge = (status: ComponentStatusType) => {
    switch (status) {
      case 'OPERATIONAL':
        return (
          <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>Operational</span>
          </span>
        );
      case 'DEGRADED_PERFORMANCE':
        return (
          <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span>Degraded</span>
          </span>
        );
      case 'PARTIAL_OUTAGE':
        return (
          <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/30">
            <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
            <span>Partial Outage</span>
          </span>
        );
      case 'MAJOR_OUTAGE':
        return (
          <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <AlertOctagon className="h-3.5 w-3.5 text-rose-400" />
            <span>Major Outage</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Unknown</span>
          </span>
        );
    }
  };

  const handleStatusChange = async (id: string, status: ComponentStatusType) => {
    try {
      setUpdating(true);
      await onUpdateComponentStatus(id, status);
      setEditingId(null);
    } finally {
      setUpdating(false);
    }
  };

  // Group components by group
  const groups = Array.from(new Set(components.map((c) => c.group || 'Core Services')));

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Cluster Infrastructure & Services</h3>
            <p className="text-xs text-slate-400">
              Live status across Kubernetes workloads, StatefulSets, Ingress, and GitOps operators.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {groups.map((group) => {
          const groupComponents = components.filter((c) => (c.group || 'Core Services') === group);

          return (
            <div key={group} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-1">
                {group}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groupComponents.map((comp) => {
                  const isEditing = editingId === comp.id;

                  return (
                    <div
                      key={comp.id}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <span className="text-sm font-semibold text-slate-200">{comp.name}</span>
                          {comp.description && (
                            <p className="text-xs text-slate-400">{comp.description}</p>
                          )}
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          {getStatusBadge(comp.status)}
                          <button
                            onClick={() => setEditingId(isEditing ? null : comp.id)}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                            title="Edit Component Status"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Status Override Selector */}
                      {isEditing && (
                        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-slate-400 mr-1">Simulate Status:</span>
                          {(['OPERATIONAL', 'DEGRADED_PERFORMANCE', 'PARTIAL_OUTAGE', 'MAJOR_OUTAGE'] as ComponentStatusType[]).map(
                            (st) => (
                              <button
                                key={st}
                                disabled={updating}
                                onClick={() => handleStatusChange(comp.id, st)}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border transition ${
                                  comp.status === st
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                {st.replace('_', ' ')}
                              </button>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
