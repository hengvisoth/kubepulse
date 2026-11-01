'use client';

import React, { useState } from 'react';
import { AlertCircle, PlusCircle, CheckCircle2, Clock, Check, ChevronDown, ChevronUp, MessageSquare, Trash2 } from 'lucide-react';
import { Incident, IncidentStatusType, IncidentImpactType, ComponentItem } from '../types';

interface IncidentsListProps {
  incidents: Incident[];
  components: ComponentItem[];
  onCreateIncident: (data: {
    title: string;
    impact: IncidentImpactType;
    status: IncidentStatusType;
    affectedComponents: string[];
    message: string;
  }) => Promise<void>;
  onUpdateIncident: (id: string, data: {
    status?: IncidentStatusType;
    impact?: IncidentImpactType;
    message?: string;
  }) => Promise<void>;
  onDeleteIncident: (id: string) => Promise<void>;
}

export const IncidentsList: React.FC<IncidentsListProps> = ({
  incidents,
  components,
  onCreateIncident,
  onUpdateIncident,
  onDeleteIncident,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [updateModalIncident, setUpdateModalIncident] = useState<Incident | null>(null);
  const [showPastIncidents, setShowPastIncidents] = useState(true);

  // Form states for creating incident
  const [newTitle, setNewTitle] = useState('');
  const [newImpact, setNewImpact] = useState<IncidentImpactType>('MINOR');
  const [newStatus, setNewStatus] = useState<IncidentStatusType>('INVESTIGATING');
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form states for updating incident
  const [updateStatus, setUpdateStatus] = useState<IncidentStatusType>('MONITORING');
  const [updateMessage, setUpdateMessage] = useState('');

  const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED');
  const resolvedIncidents = incidents.filter((i) => i.status === 'RESOLVED');

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setSubmitting(true);
      await onCreateIncident({
        title: newTitle,
        impact: newImpact,
        status: newStatus,
        affectedComponents: selectedComponents,
        message: newMessage,
      });
      // Reset form
      setNewTitle('');
      setNewImpact('MINOR');
      setNewStatus('INVESTIGATING');
      setSelectedComponents([]);
      setNewMessage('');
      setShowCreateModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateModalIncident) return;

    try {
      setSubmitting(true);
      await onUpdateIncident(updateModalIncident.id, {
        status: updateStatus,
        message: updateMessage,
      });
      setUpdateModalIncident(null);
      setUpdateMessage('');
    } finally {
      setSubmitting(false);
    }
  };

  const getImpactBadge = (impact: IncidentImpactType) => {
    switch (impact) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">CRITICAL</span>;
      case 'MAJOR':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/40">MAJOR</span>;
      case 'MINOR':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">MINOR</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">NONE</span>;
    }
  };

  const getStatusBadge = (status: IncidentStatusType) => {
    switch (status) {
      case 'INVESTIGATING':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">INVESTIGATING</span>;
      case 'IDENTIFIED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30">IDENTIFIED</span>;
      case 'MONITORING':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">MONITORING</span>;
      case 'RESOLVED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">RESOLVED</span>;
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-5">
      {/* Header & Create Button */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Incident Feed & PostgreSQL Logs</h3>
            <p className="text-xs text-slate-400">
              Real-time incident tracking stored in PostgreSQL with 30s Redis cache invalidation.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-lg shadow-teal-600/20 transition active:scale-95"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Report Incident</span>
        </button>
      </div>

      {/* Active Incidents List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
          <span>Active Incidents ({activeIncidents.length})</span>
        </div>

        {activeIncidents.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-400 font-mono">
            🎉 No active incidents reported. All pods and services healthy.
          </div>
        ) : (
          activeIncidents.map((incident) => (
            <div
              key={incident.id}
              className="p-4 rounded-xl bg-slate-950/80 border border-rose-500/30 space-y-3 shadow-lg shadow-rose-950/10"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-bold text-slate-100">{incident.title}</h4>
                    {getImpactBadge(incident.impact)}
                    {getStatusBadge(incident.status)}
                  </div>
                  {incident.affectedComponents && incident.affectedComponents.length > 0 && (
                    <div className="flex flex-wrap gap-1 text-[11px] text-slate-400">
                      <span>Affected:</span>
                      {incident.affectedComponents.map((comp) => (
                        <span key={comp} className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">
                          {comp}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setUpdateModalIncident(incident);
                      setUpdateStatus('MONITORING');
                    }}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-teal-400" />
                    <span>Post Update / Resolve</span>
                  </button>

                  <button
                    onClick={() => onDeleteIncident(incident.id)}
                    className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition"
                    title="Delete Incident"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Timeline Updates */}
              {incident.updates && incident.updates.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                    Timeline Updates:
                  </div>
                  <div className="space-y-2 border-l-2 border-slate-800 pl-3 ml-1">
                    {incident.updates.map((update) => (
                      <div key={update.id} className="text-xs space-y-0.5">
                        <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400">
                          {getStatusBadge(update.status)}
                          <span>{new Date(update.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-slate-300 font-sans">{update.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Past / Resolved Incidents Collapsible */}
      <div className="space-y-3 pt-2">
        <button
          onClick={() => setShowPastIncidents(!showPastIncidents)}
          className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider text-slate-400 px-1 hover:text-slate-200 transition"
        >
          <span>Past Resolved Incidents ({resolvedIncidents.length})</span>
          {showPastIncidents ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showPastIncidents && (
          <div className="space-y-2">
            {resolvedIncidents.length === 0 ? (
              <div className="text-xs text-slate-500 font-mono py-2 px-1">No past incidents.</div>
            ) : (
              resolvedIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span className="text-sm font-semibold text-slate-300">{incident.title}</span>
                      {getImpactBadge(incident.impact)}
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      Resolved {incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleDateString() : ''}
                    </span>
                  </div>

                  {incident.updates && incident.updates.length > 0 && (
                    <p className="text-xs text-slate-400 pl-6">
                      {incident.updates[0].message}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal: Report New Incident */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-teal-400" />
              <span>Report New Cluster Incident</span>
            </h3>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Incident Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Postgres Connection Spike During Canary Rollout"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Initial Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as IncidentStatusType)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
                  >
                    <option value="INVESTIGATING">INVESTIGATING</option>
                    <option value="IDENTIFIED">IDENTIFIED</option>
                    <option value="MONITORING">MONITORING</option>
                    <option value="RESOLVED">RESOLVED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Impact Severity
                  </label>
                  <select
                    value={newImpact}
                    onChange={(e) => setNewImpact(e.target.value as IncidentImpactType)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
                  >
                    <option value="MINOR">MINOR</option>
                    <option value="MAJOR">MAJOR</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Affected Components
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-950 border border-slate-700 rounded-lg">
                  {components.map((c) => {
                    const isSelected = selectedComponents.includes(c.name);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedComponents(selectedComponents.filter((n) => n !== c.name));
                          } else {
                            setSelectedComponents([...selectedComponents, c.name]);
                          }
                        }}
                        className={`px-2 py-1 rounded text-xs font-mono transition ${
                          isSelected
                            ? 'bg-teal-600 text-white font-semibold'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-100'
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Initial Message / Diagnosis
                </label>
                <textarea
                  rows={3}
                  placeholder="Detail the failure observations or Rancher alerts observed..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-lg shadow-teal-600/20"
                >
                  {submitting ? 'Creating...' : 'Create Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Update / Resolve Incident */}
      {updateModalIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <MessageSquare className="h-5 w-5 text-teal-400" />
              <span>Update Incident Timeline</span>
            </h3>
            <p className="text-xs text-slate-400 font-semibold">{updateModalIncident.title}</p>

            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Update Status
                </label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value as IncidentStatusType)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
                >
                  <option value="INVESTIGATING">INVESTIGATING</option>
                  <option value="IDENTIFIED">IDENTIFIED</option>
                  <option value="MONITORING">MONITORING</option>
                  <option value="RESOLVED">RESOLVED (Close Incident)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Timeline Note / Resolution Details *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe recent actions taken, mitigation, or resolution verification..."
                  value={updateMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUpdateModalIncident(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-lg shadow-teal-600/20"
                >
                  {submitting ? 'Updating...' : 'Post Timeline Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
