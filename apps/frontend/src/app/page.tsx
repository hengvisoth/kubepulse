'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Header } from '../components/Header';
import { ServingHero } from '../components/ServingHero';
import { SystemStatusBanner } from '../components/SystemStatusBanner';
import { ServiceTopologyCard } from '../components/ServiceTopologyCard';
import { LoadBalancerCard } from '../components/LoadBalancerCard';
import { PodTelemetryCard } from '../components/PodTelemetryCard';
import { ChaosControls } from '../components/ChaosControls';
import { ComponentsGrid } from '../components/ComponentsGrid';
import { IncidentsList } from '../components/IncidentsList';
import { GitOpsGuideModal } from '../components/GitOpsGuideModal';
import {
  PodTelemetry,
  StatusSummary,
  Incident,
  ComponentItem,
  ComponentStatusType,
  IncidentStatusType,
  IncidentImpactType,
  ServiceName,
  ServiceNodeStatus,
  ServicesDiscoveryResponse,
} from '../types';

const ALL_SERVICES: ServiceName[] = ['gateway', 'components', 'incidents', 'status'];

export default function Dashboard() {
  const [selectedService, setSelectedService] = useState<ServiceName>('gateway');
  const [telemetryByService, setTelemetryByService] = useState<Partial<Record<ServiceName, PodTelemetry>>>({});
  const [servicesTopology, setServicesTopology] = useState<ServiceNodeStatus[]>([]);
  const [gatewayDiscoveryPod, setGatewayDiscoveryPod] = useState<string | undefined>(undefined);
  const [summary, setSummary] = useState<StatusSummary | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [purgingCache, setPurgingCache] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [upstreamErrors, setUpstreamErrors] = useState<Record<string, string>>({});

  // Per-service pod hit counters for tracking traffic distribution across replicas
  const [podHitsByService, setPodHitsByService] = useState<Record<ServiceName, Record<string, number>>>({
    gateway: {},
    components: {},
    incidents: {},
    status: {},
  });
  const [totalRequestsByService, setTotalRequestsByService] = useState<Record<ServiceName, number>>({
    gateway: 0,
    components: 0,
    incidents: 0,
    status: 0,
  });

  const apiBase = '/backend-api';
  const serviceApiPrefix = useCallback(
    (service: ServiceName) => (service === 'gateway' ? apiBase : `${apiBase}/services/${service}`),
    [apiBase]
  );

  const setEndpointError = useCallback((key: string, message: string | null) => {
    setUpstreamErrors((prev) => {
      if (message === null) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      if (prev[key] === message) return prev;
      return { ...prev, [key]: message };
    });
  }, []);

  // Fetch live microservice topology (/api/services)
  const fetchServicesTopology = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/services`, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Services discovery HTTP ${res.status}`);
      }
      const data: ServicesDiscoveryResponse = await res.json();
      if (Array.isArray(data.services)) {
        setServicesTopology(data.services);
      }
      if (data.servedByPod) {
        setGatewayDiscoveryPod(data.servedByPod);
      }
      setEndpointError('services', null);
    } catch (err: any) {
      setEndpointError('services', `Service discovery (/api/services): ${err.message || 'Upstream unavailable'}`);
    }
  }, [apiBase, setEndpointError]);

  // Fetch telemetry for the target service
  const fetchTelemetry = useCallback(
    async (service: ServiceName = selectedService) => {
      const prefix = serviceApiPrefix(service);
      try {
        const res = await fetch(`${prefix}/api/telemetry`, { cache: 'no-store' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(`${res.status} ${body.error || body.message || res.statusText}`);
        }
        const data: PodTelemetry = await res.json();
        setTelemetryByService((prev) => ({ ...prev, [service]: data }));
        setEndpointError('telemetry', null);

        if (data.podName) {
          setPodHitsByService((prev) => ({
            ...prev,
            [service]: {
              ...prev[service],
              [data.podName]: (prev[service]?.[data.podName] || 0) + 1,
            },
          }));
          setTotalRequestsByService((prev) => ({
            ...prev,
            [service]: (prev[service] || 0) + 1,
          }));
        }
      } catch (err: any) {
        setEndpointError('telemetry', `${service} telemetry: ${err.message || 'Service unavailable'}`);
        // Even if telemetry timed out (504 due to high artificial latency), /chaos/status bypasses latency.
        try {
          const chaosRes = await fetch(`${prefix}/chaos/status`, { cache: 'no-store' });
          if (chaosRes.ok) {
            const chaosData = await chaosRes.json();
            if (chaosData?.status) {
              setTelemetryByService((prev) => {
                const existing = prev[service];
                if (!existing) return prev;
                return {
                  ...prev,
                  [service]: {
                    ...existing,
                    chaos: chaosData.status,
                  },
                };
              });
            }
          }
        } catch {}
      }
    },
    [selectedService, serviceApiPrefix, setEndpointError]
  );

  // Fetch status summary & components
  const fetchStatusSummary = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/status-summary`, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`${res.status} ${body.error || body.message || res.statusText}`);
      }
      const data: StatusSummary = await res.json();
      setSummary(data);
      if (data.components) {
        setComponents(data.components);
      }
      setEndpointError('statusSummary', null);
    } catch (err: any) {
      setEndpointError('statusSummary', `Status summary (/api/status-summary): ${err.message || 'Upstream failed'}`);
    }
  }, [apiBase, setEndpointError]);

  // Fetch incidents list
  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/incidents`, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`${res.status} ${body.error || body.message || res.statusText}`);
      }
      const data = await res.json();
      if (data.incidents) {
        setIncidents(data.incidents);
      }
      setEndpointError('incidents', null);
    } catch (err: any) {
      setEndpointError('incidents', `Incidents (/api/incidents): ${err.message || 'Upstream failed'}`);
    }
  }, [apiBase, setEndpointError]);

  // Combined refresh
  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.allSettled([
      fetchServicesTopology(),
      fetchTelemetry(selectedService),
      fetchStatusSummary(),
      fetchIncidents(),
    ]);
    setLoading(false);
  }, [fetchServicesTopology, fetchTelemetry, selectedService, fetchStatusSummary, fetchIncidents]);

  // Initial load & when switching selectedService
  useEffect(() => {
    setEndpointError('telemetry', null);
    fetchTelemetry(selectedService);
    fetchServicesTopology();
  }, [selectedService, fetchTelemetry, fetchServicesTopology, setEndpointError]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Auto-poll interval for continuous traffic distribution sampling
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchServicesTopology();
      fetchTelemetry(selectedService);
      fetchStatusSummary();
    }, 2500);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchServicesTopology, fetchTelemetry, selectedService, fetchStatusSummary]);

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

  // Chaos Actions targeting selectedService
  const targetPrefix = serviceApiPrefix(selectedService);

  const handleTriggerCrash = async () => {
    const res = await fetch(`${targetPrefix}/chaos/crash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delayMs: 200 }),
    });
    const data = await res.json();
    setTimeout(() => {
      fetchServicesTopology();
      fetchTelemetry(selectedService);
    }, 400);
    return data;
  };

  const handleTriggerCpuSpike = async (durationSeconds = 30) => {
    const res = await fetch(`${targetPrefix}/chaos/cpu-spike`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationSeconds }),
    });
    const data = await res.json();
    await Promise.allSettled([fetchTelemetry(selectedService), fetchServicesTopology()]);
    return data;
  };

  const handleToggleReadiness = async () => {
    const res = await fetch(`${targetPrefix}/chaos/toggle-readiness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    await Promise.allSettled([fetchTelemetry(selectedService), fetchServicesTopology()]);
    return data;
  };

  const handleTriggerMemoryLeak = async (megabytes = 50) => {
    const res = await fetch(`${targetPrefix}/chaos/memory-leak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ megabytes }),
    });
    const data = await res.json();
    await Promise.allSettled([fetchTelemetry(selectedService), fetchServicesTopology()]);
    return data;
  };

  const handleSetLatency = async (ms: number) => {
    const res = await fetch(`${targetPrefix}/chaos/latency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latencyMs: ms }),
    });
    const data = await res.json();
    await Promise.allSettled([fetchTelemetry(selectedService), fetchServicesTopology(), fetchStatusSummary()]);
    return data;
  };

  const handleResetChaos = async () => {
    const res = await fetch(`${targetPrefix}/chaos/reset`, { method: 'POST' });
    const data = await res.json();
    await Promise.allSettled([fetchTelemetry(selectedService), fetchServicesTopology(), fetchStatusSummary(), fetchIncidents()]);
    return data;
  };

  const handleResetAllServices = async () => {
    await Promise.allSettled(
      ALL_SERVICES.map((svc) => fetch(`${serviceApiPrefix(svc)}/chaos/reset`, { method: 'POST' }))
    );
    await Promise.allSettled([
      fetchServicesTopology(),
      fetchTelemetry(selectedService),
      fetchStatusSummary(),
      fetchIncidents(),
    ]);
    return { message: 'Reset chaos state across gateway, components, incidents, and status services.' };
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

  const activeTelemetry = telemetryByService[selectedService] || null;
  const activeServiceNode = servicesTopology.find((s) => s.name === selectedService);
  const activeChaos = activeTelemetry?.chaos || activeServiceNode?.chaos;
  const activePodHits = podHitsByService[selectedService] || {};
  const activeTotalRequests = totalRequestsByService[selectedService] || 0;
  const errorMessages = Object.values(upstreamErrors);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation & Live Telemetry Banner */}
      <Header
        telemetry={activeTelemetry}
        loading={loading}
        onRefresh={refreshAll}
        onOpenGuide={() => setShowGuide(true)}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
      />

      {/* Shows which replica answered for the selected service */}
      <ServingHero
        selectedService={selectedService}
        telemetry={activeTelemetry}
        podHits={activePodHits}
        totalRequests={activeTotalRequests}
      />

      {/* Main Dashboard Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Upstream 502 / 504 Warning Banner */}
        {errorMessages.length > 0 && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/40 text-rose-200 flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs flex-1">
              <div className="font-bold text-rose-300 uppercase tracking-wider">
                Upstream Service Degradation Detected (Showing Last Known State)
              </div>
              <ul className="font-mono space-y-0.5 text-rose-200/90 list-disc pl-4">
                {errorMessages.map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* System Overall Status Banner */}
        <SystemStatusBanner summary={summary} loading={loading} />

        {/* Live 4-Service Topology & Target Selector */}
        <ServiceTopologyCard
          services={servicesTopology}
          selectedService={selectedService}
          onSelectService={setSelectedService}
          servedByGatewayPod={gatewayDiscoveryPod}
        />

        {/* Load Balancer Simulation & Distribution */}
        <LoadBalancerCard
          selectedService={selectedService}
          onRefreshTelemetry={refreshAll}
          serviceApiPrefix={serviceApiPrefix}
        />

        {/* Live Kubernetes Pod Telemetry & Rolling Update Visualizer */}
        <PodTelemetryCard
          selectedService={selectedService}
          telemetry={activeTelemetry}
          summary={summary}
          podHits={activePodHits}
          totalRequests={activeTotalRequests}
          onPurgeCache={handlePurgeCache}
          purgingCache={purgingCache}
        />

        {/* Chaos Engineering Control Panel */}
        <ChaosControls
          selectedService={selectedService}
          onSelectService={setSelectedService}
          onTriggerCrash={handleTriggerCrash}
          onTriggerCpuSpike={handleTriggerCpuSpike}
          onToggleReadiness={handleToggleReadiness}
          onTriggerMemoryLeak={handleTriggerMemoryLeak}
          onSetLatency={handleSetLatency}
          onResetChaos={handleResetChaos}
          onResetAllServices={handleResetAllServices}
          isCpuSpiking={activeChaos?.isCpuSpiking || false}
          isReadinessFailing={activeChaos?.isReadinessFailing || false}
          artificialLatencyMs={activeChaos?.artificialLatencyMs || 0}
          leakedMemoryMb={activeChaos?.leakedMemoryMb || 0}
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
          <p className="text-emerald-700">Rollout test #2: chart room theme</p>
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
