export type ComponentStatusType = 'OPERATIONAL' | 'DEGRADED_PERFORMANCE' | 'PARTIAL_OUTAGE' | 'MAJOR_OUTAGE';

export type IncidentStatusType = 'INVESTIGATING' | 'IDENTIFIED' | 'MONITORING' | 'RESOLVED';

export type IncidentImpactType = 'NONE' | 'MINOR' | 'MAJOR' | 'CRITICAL';

export interface ComponentItem {
  id: string;
  name: string;
  description?: string;
  status: ComponentStatusType;
  group: string;
  order: number;
  updatedAt: string;
}

export interface IncidentUpdate {
  id: string;
  incidentId: string;
  status: IncidentStatusType;
  message: string;
  createdAt: string;
}

export interface Incident {
  id: string;
  title: string;
  status: IncidentStatusType;
  impact: IncidentImpactType;
  affectedComponents: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  updates: IncidentUpdate[];
}

export interface PodTelemetry {
  podName: string;
  appVersion: string;
  envName: 'DEV' | 'PROD' | string;
  podIp: string;
  nodeName: string;
  uptimeSeconds: number;
  processUptime: number;
  nodeVersion: string;
  platform: string;
  systemLoadAvg: number[];
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
  redis: {
    host: string;
    port: number;
    connected: boolean;
  };
  chaos: {
    pod: string;
    env: string;
    version: string;
    isReadinessFailing: boolean;
    artificialLatencyMs: number;
    isCpuSpiking: boolean;
    leakedMemoryMb: number;
  };
  timestamp: string;
}

export interface StatusSummary {
  overallStatus: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE';
  totalComponents: number;
  operationalComponents: number;
  activeIncidentsCount: number;
  components: ComponentItem[];
  activeIncidents: Incident[];
  generatedAt: string;
  cacheStatus: 'HIT' | 'MISS';
  cacheSource: string;
  ttlSecondsRemaining: number;
  servedByPod: string;
  responseTimeMs: number;
}
