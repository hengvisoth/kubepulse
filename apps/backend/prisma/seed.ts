import { PrismaClient, ComponentStatus, IncidentStatus, IncidentImpact } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial KubePulse data...');

  // Upsert default components
  const components = [
    {
      name: 'Traefik Ingress Gateway',
      description: 'Layer 7 load balancing & SSL termination',
      status: ComponentStatus.OPERATIONAL,
      group: 'Edge & Network',
      order: 1,
    },
    {
      name: 'Auth & Identity API',
      description: 'OIDC and token validation services',
      status: ComponentStatus.OPERATIONAL,
      group: 'Core Services',
      order: 2,
    },
    {
      name: 'PostgreSQL Database Cluster',
      description: 'Stateful persistence with replication & PVC',
      status: ComponentStatus.OPERATIONAL,
      group: 'Data Layer',
      order: 3,
    },
    {
      name: 'Redis Cache (redis-service:6379)',
      description: 'High performance 30s status summary cache',
      status: ComponentStatus.OPERATIONAL,
      group: 'Data Layer',
      order: 4,
    },
    {
      name: 'ArgoCD GitOps Sync Engine',
      description: 'Continuous reconciliation of cluster manifests',
      status: ComponentStatus.OPERATIONAL,
      group: 'Infrastructure',
      order: 5,
    },
    {
      name: 'K3s Node Metrics & HPA Agent',
      description: 'Prometheus metrics scraping and auto-scaler',
      status: ComponentStatus.OPERATIONAL,
      group: 'Infrastructure',
      order: 6,
    },
  ];

  for (const comp of components) {
    await prisma.component.upsert({
      where: { name: comp.name },
      update: {},
      create: comp,
    });
  }

  // Create an initial sample resolved incident if none exist
  const existingIncidents = await prisma.incident.count();
  if (existingIncidents === 0) {
    const incident = await prisma.incident.create({
      data: {
        title: 'Kubernetes Rolling Update Verification',
        status: IncidentStatus.RESOLVED,
        impact: IncidentImpact.MINOR,
        affectedComponents: ['Traefik Ingress Gateway', 'Auth & Identity API'],
        resolvedAt: new Date(),
        updates: {
          create: [
            {
              status: IncidentStatus.INVESTIGATING,
              message: 'Observing canary traffic shift for KubePulse v1.0 deployment.',
              createdAt: new Date(Date.now() - 3600000 * 2),
            },
            {
              status: IncidentStatus.MONITORING,
              message: 'Traffic successfully routed to new pods with zero dropped connections.',
              createdAt: new Date(Date.now() - 3600000),
            },
            {
              status: IncidentStatus.RESOLVED,
              message: 'Rolling update completed. All pods healthy and passing readiness probes.',
              createdAt: new Date(),
            },
          ],
        },
      },
    });
    console.log(`Created sample incident: ${incident.title}`);
  }

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
