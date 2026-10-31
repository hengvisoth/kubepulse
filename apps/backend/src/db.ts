import { PrismaClient, ComponentStatus, IncidentStatus, IncidentImpact } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// In-memory fallback store to ensure zero-downtime resilience if Postgres is starting up
class MemoryStore {
  components = [
    {
      id: 'comp-1',
      name: 'Traefik Ingress Gateway',
      description: 'Layer 7 load balancing & SSL termination',
      status: ComponentStatus.OPERATIONAL,
      group: 'Edge & Network',
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'comp-2',
      name: 'Auth & Identity API',
      description: 'OIDC and token validation services',
      status: ComponentStatus.OPERATIONAL,
      group: 'Core Services',
      order: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'comp-3',
      name: 'PostgreSQL Database Cluster',
      description: 'Stateful persistence with replication & PVC',
      status: ComponentStatus.OPERATIONAL,
      group: 'Data Layer',
      order: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'comp-4',
      name: 'Redis Cache (redis-service:6379)',
      description: 'High performance 30s status summary cache',
      status: ComponentStatus.OPERATIONAL,
      group: 'Data Layer',
      order: 4,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'comp-5',
      name: 'ArgoCD GitOps Sync Engine',
      description: 'Continuous reconciliation of cluster manifests',
      status: ComponentStatus.OPERATIONAL,
      group: 'Infrastructure',
      order: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'comp-6',
      name: 'K3s Node Metrics & HPA Agent',
      description: 'Prometheus metrics scraping and auto-scaler',
      status: ComponentStatus.OPERATIONAL,
      group: 'Infrastructure',
      order: 6,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  incidents: Array<{
    id: string;
    title: string;
    status: IncidentStatus;
    impact: IncidentImpact;
    affectedComponents: string[];
    createdAt: Date;
    updatedAt: Date;
    resolvedAt?: Date | null;
    updates: Array<{
      id: string;
      incidentId: string;
      status: IncidentStatus;
      message: string;
      createdAt: Date;
    }>;
  }> = [
    {
      id: 'inc-1',
      title: 'Kubernetes Rolling Update Verification',
      status: IncidentStatus.RESOLVED,
      impact: IncidentImpact.MINOR,
      affectedComponents: ['Traefik Ingress Gateway', 'Auth & Identity API'],
      createdAt: new Date(Date.now() - 7200000),
      updatedAt: new Date(),
      resolvedAt: new Date(),
      updates: [
        {
          id: 'upd-1',
          incidentId: 'inc-1',
          status: IncidentStatus.INVESTIGATING,
          message: 'Canary rollout initiated across pods.',
          createdAt: new Date(Date.now() - 7200000),
        },
        {
          id: 'upd-2',
          incidentId: 'inc-1',
          status: IncidentStatus.RESOLVED,
          message: 'Rolling update finished. Pod traffic distributed evenly.',
          createdAt: new Date(),
        },
      ],
    },
  ];
}

export const memoryStore = new MemoryStore();

export async function checkDatabaseHealth(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      message: 'PostgreSQL connection active',
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err.message || 'Database connection error',
      latencyMs: Date.now() - start,
    };
  }
}
