'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '../components/Header';
import { SystemStatusBanner } from '../components/SystemStatusBanner';
import { PodTelemetryCard } from '../components/PodTelemetryCard';
import { ChaosControls } from '../components/ChaosControls';
import { ComponentsGrid } from '../components/ComponentsGrid';
import { IncidentsList } from '../components/IncidentsList';
import { GitOpsGuideModal } from '../components/GitOpsGuideModal';
import { PodTelemetry, StatusSummary, Incident, ComponentItem, ComponentStatusType, IncidentStatusType, IncidentImpactType } from '../types';

export default function Dashboard() {
  const [telemetry, setTelemetry] = useState<PodTelemetry | null>(null);
  const [summary, setSummary] = useState<StatusSummary | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [purgingCache, setPurgingCache] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  // Pod hit counter for tracking traffic distribution across replicas
  const [podHits, setPodHits] = useState<Record<string, number>>({});
  const [totalRequests, setTotalRequests] = useState<number>(0);

  const apiBase = '/backend-api';

  // Fetch telemetry
  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/telemetry`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Telemetry HTTP ${res.status}`);
      const data: PodTelemetry = await res.json();
      setTelemetry(data);

      if (data.podName) {
        setPodHits((prev) => ({
          ...prev,
          [data.podName]: (prev[data.podName] || 0) + 1,
        }));
        setTotalRequests((prev) => prev + 1);
      }
    } catch (err) {
      console.warn('Failed to fetch pod telemetry:', err);
    }
  }, [apiBase]);

  // Fetch status summary & components
  const fetchStatusSummary = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/status-summary`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Status summary HTTP ${res.status}`);
      const data: StatusSummary = await res.json();
      setSummary(data);
      if (data.components) {
        setComponents(data.components);
      }
    } catch (err) {
      console.warn('Failed to fetch status summary:', err);
    }
  }, [apiBase]);

  // Fetch incidents list
  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/incidents`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Incidents HTTP ${res.status}`);
      const data = await res.json();
      if (data.incidents) {
        setIncidents(data.incidents);
      }
    } catch (err) {
      console.warn('Failed to fetch incidents:', err);
    }
  }, [apiBase]);

  // Combined refresh
  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.allSettled([fetchTelemetry(), fetchStatusSummary(), fetchIncidents()]);
    setLoading(false);
  }, [fetchTelemetry, fetchStatusSummary, fetchIncidents]);

  // Initial load
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Auto-poll interval for continuous traffic distribution sampling
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchTelemetry();
      fetchStatusSummary();
    }, 2500);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchTelemetry, fetchStatusSummary]);

  // Redis cache purge handler
  const handlePurgeCache = async () => {
    try {
      setPurgingCache(true);
      await fetch(`${apiBase}/api/status-summary/cache-purge`, { method: 'POST' });
      await fetchStatusSummary();
    } catch (err) {
      console.error('Failed to purge Redis cache:', err);
    } finally {
      setPurgingCache(false);
    }
  };

  // Chaos Actions
  const handleTriggerCrash = async () => {
    const res = await fetch(`${apiBase}/chaos/crash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delayMs: 200 }),
    });
    return res.json();
  };

  const handleTriggerCpuSpike = async (durationSeconds = 30) => {
    const res = await fetch(`${apiBase}/chaos/cpu-spike`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationSeconds }),
    });
    const data = await res.json();
    await fetchTelemetry();
    return data;
  };

  const handleToggleReadiness = async () => {
    const res = await fetch(`${apiBase}/chaos/toggle-readiness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    await fetchTelemetry();
    return data;
  };

  const handleTriggerMemoryLeak = async (megabytes = 50) => {
    const res = await fetch(`${apiBase}/chaos/memory-leak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ megabytes }),
    });
    const data = await res.json();
    await fetchTelemetry();
    return data;
  };

  const handleSetLatency = async (ms: number) => {
    const res = await fetch(`${apiBase}/chaos/latency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latencyMs: ms }),
    });
    return res.json();
  };

  const handleResetChaos = async () => {
    const res = await fetch(`${apiBase}/chaos/reset`, { method: 'POST' });
    const data = await res.json();
    await fetchTelemetry();
    return data;
  };

  // Component Status Update
  const handleUpdateComponentStatus = async (id: string, status: ComponentStatusType) => {
    await fetch(`${apiBase}/api/components/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await fetchStatusSummary();
  };

  // Incident CRUD
  const handleCreateIncident = async (data: {
    title: string;
    impact: IncidentImpactType;
    status: IncidentStatusType;
    affectedComponents: string[];
    message: string;
  }) => {
    await fetch(`${apiBase}/api/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await Promise.all([fetchIncidents(), fetchStatusSummary()]);
  };

  const handleUpdateIncident = async (id: string, data: {
    status?: IncidentStatusType;
    impact?: IncidentImpactType;
    message?: string;
  }) => {
    await fetch(`${apiBase}/api/incidents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await Promise.all([fetchIncidents(), fetchStatusSummary()]);
  };

  const handleDeleteIncident = async (id: string) => {
    await fetch(`${apiBase}/api/incidents/${id}`, {
      method: 'DELETE',
    });
    await Promise.all([fetchIncidents(), fetchStatusSummary()]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation & Live Telemetry Banner */}
      <Header
        telemetry={telemetry}
        loading={loading}
        onRefresh={refreshAll}
        onOpenGuide={() => setShowGuide(true)}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
      />

      {/* Main Dashboard Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* System Overall Status Banner */}
        <SystemStatusBanner summary={summary} loading={loading} />

        {/* Live Kubernetes Pod Telemetry & Rolling Update Visualizer */}
        <PodTelemetryCard
          telemetry={telemetry}
          summary={summary}
          podHits={podHits}
          totalRequests={totalRequests}
          onPurgeCache={handlePurgeCache}
          purgingCache={purgingCache}
        />

        {/* Chaos Engineering Control Panel */}
        <ChaosControls
          onTriggerCrash={handleTriggerCrash}
          onTriggerCpuSpike={handleTriggerCpuSpike}
          onToggleReadiness={handleToggleReadiness}
          onTriggerMemoryLeak={handleTriggerMemoryLeak}
          onSetLatency={handleSetLatency}
          onResetChaos={handleResetChaos}
          isCpuSpiking={telemetry?.chaos?.isCpuSpiking || false}
          isReadinessFailing={telemetry?.chaos?.isReadinessFailing || false}
        />

        {/* Services & Components Grid */}
        <ComponentsGrid
          components={components}
          onUpdateComponentStatus={handleUpdateComponentStatus}
        />

        {/* Incident Management & Timeline Feed */}
        <IncidentsList
          incidents={incidents}
          components={components}
          onCreateIncident={handleCreateIncident}
          onUpdateIncident={handleUpdateIncident}
          onDeleteIncident={handleDeleteIncident}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 mt-12 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p>KubePulse v1.0.0 — Kubernetes, Rancher, and ArgoCD Chaos Testing Board</p>
          <p className="text-slate-600">
            Powered by Next.js 14 Standalone · Node.js Express · PostgreSQL · Redis · Prometheus
          </p>
        </div>
      </footer>

      {/* Interactive GitOps & Chaos Testing Lab Modal */}
      <GitOpsGuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
}
