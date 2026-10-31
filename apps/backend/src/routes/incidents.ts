import { Router, Request, Response } from 'express';
import { prisma, memoryStore } from '../db';
import { clearCache } from '../redis';
import { config } from '../config';
import { IncidentStatus, IncidentImpact } from '@prisma/client';

const router = Router();
const CACHE_KEY = 'kubepulse:status-summary';

// GET all incidents
router.get('/incidents', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    try {
      const whereClause: any = {};
      if (status) {
        whereClause.status = status as IncidentStatus;
      }

      const incidents = await prisma.incident.findMany({
        where: whereClause,
        include: {
          updates: {
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.json({ incidents, servedByPod: config.podName });
    } catch {
      // Memory store fallback
      let list = memoryStore.incidents;
      if (status) {
        list = list.filter((i) => i.status === status);
      }
      return res.json({ incidents: list, servedByPod: config.podName, fallback: true });
    }
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch incidents', message: err.message });
  }
});

// GET single incident
router.get('/incidents/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    try {
      const incident = await prisma.incident.findUnique({
        where: { id },
        include: { updates: { orderBy: { createdAt: 'desc' } } },
      });
      if (!incident) return res.status(404).json({ error: 'Incident not found' });
      return res.json({ incident, servedByPod: config.podName });
    } catch {
      const incident = memoryStore.incidents.find((i) => i.id === id);
      if (!incident) return res.status(404).json({ error: 'Incident not found' });
      return res.json({ incident, servedByPod: config.podName, fallback: true });
    }
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch incident', message: err.message });
  }
});

// POST create new incident
router.post('/incidents', async (req: Request, res: Response) => {
  const { title, impact = 'MINOR', status = 'INVESTIGATING', affectedComponents = [], message } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    let newIncident: any;
    try {
      newIncident = await prisma.incident.create({
        data: {
          title,
          impact: impact as IncidentImpact,
          status: status as IncidentStatus,
          affectedComponents,
          updates: message
            ? {
                create: [
                  {
                    status: status as IncidentStatus,
                    message,
                  },
                ],
              }
            : undefined,
        },
        include: { updates: true },
      });
    } catch (dbErr) {
      // In-memory fallback
      const id = `inc-${Date.now()}`;
      newIncident = {
        id,
        title,
        impact: impact as IncidentImpact,
        status: status as IncidentStatus,
        affectedComponents,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: status === 'RESOLVED' ? new Date() : null,
        updates: message
          ? [
              {
                id: `upd-${Date.now()}`,
                incidentId: id,
                status: status as IncidentStatus,
                message,
                createdAt: new Date(),
              },
            ]
          : [],
      };
      memoryStore.incidents.unshift(newIncident);
    }

    // Invalidate Redis cache so status page reflects new incident
    await clearCache(CACHE_KEY);

    return res.status(201).json({
      success: true,
      incident: newIncident,
      servedByPod: config.podName,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create incident', message: err.message });
  }
});

// PUT update incident (add timeline update or resolve)
router.put('/incidents/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, status, impact, affectedComponents, message } = req.body;

  try {
    let updated: any;
    const isResolving = status === 'RESOLVED';

    try {
      const dataToUpdate: any = {};
      if (title) dataToUpdate.title = title;
      if (status) dataToUpdate.status = status as IncidentStatus;
      if (impact) dataToUpdate.impact = impact as IncidentImpact;
      if (affectedComponents) dataToUpdate.affectedComponents = affectedComponents;
      if (isResolving) dataToUpdate.resolvedAt = new Date();

      if (message) {
        dataToUpdate.updates = {
          create: {
            status: (status as IncidentStatus) || 'INVESTIGATING',
            message,
          },
        };
      }

      updated = await prisma.incident.update({
        where: { id },
        data: dataToUpdate,
        include: { updates: { orderBy: { createdAt: 'desc' } } },
      });
    } catch (dbErr) {
      // Memory store fallback
      const found = memoryStore.incidents.find((i) => i.id === id);
      if (!found) return res.status(404).json({ error: 'Incident not found' });

      if (title) found.title = title;
      if (status) found.status = status;
      if (impact) found.impact = impact;
      if (affectedComponents) found.affectedComponents = affectedComponents;
      if (isResolving) found.resolvedAt = new Date();
      found.updatedAt = new Date();

      if (message) {
        found.updates.unshift({
          id: `upd-${Date.now()}`,
          incidentId: id,
          status: status || found.status,
          message,
          createdAt: new Date(),
        });
      }
      updated = found;
    }

    // Invalidate Redis cache
    await clearCache(CACHE_KEY);

    return res.json({
      success: true,
      incident: updated,
      servedByPod: config.podName,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update incident', message: err.message });
  }
});

// DELETE incident
router.delete('/incidents/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    try {
      await prisma.incident.delete({ where: { id } });
    } catch {
      memoryStore.incidents = memoryStore.incidents.filter((i) => i.id !== id);
    }

    await clearCache(CACHE_KEY);
    return res.json({ success: true, message: 'Incident deleted', servedByPod: config.podName });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete incident', message: err.message });
  }
});

export default router;
