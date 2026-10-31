import { Router, Request, Response } from 'express';
import { prisma, memoryStore } from '../db';
import { clearCache } from '../redis';
import { config } from '../config';
import { ComponentStatus } from '@prisma/client';

const router = Router();
const CACHE_KEY = 'kubepulse:status-summary';

// GET all components
router.get('/components', async (req: Request, res: Response) => {
  try {
    try {
      const components = await prisma.component.findMany({
        orderBy: { order: 'asc' },
      });
      return res.json({ components, servedByPod: config.podName });
    } catch {
      return res.json({ components: memoryStore.components, servedByPod: config.podName, fallback: true });
    }
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch components', message: err.message });
  }
});

// PUT update component status
router.put('/components/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, name, description } = req.body;

  try {
    let updated: any;
    try {
      const dataToUpdate: any = {};
      if (status) dataToUpdate.status = status as ComponentStatus;
      if (name) dataToUpdate.name = name;
      if (description !== undefined) dataToUpdate.description = description;

      updated = await prisma.component.update({
        where: { id },
        data: dataToUpdate,
      });
    } catch {
      const found = memoryStore.components.find((c) => c.id === id);
      if (!found) return res.status(404).json({ error: 'Component not found' });
      if (status) found.status = status;
      if (name) found.name = name;
      if (description !== undefined) found.description = description;
      found.updatedAt = new Date();
      updated = found;
    }

    await clearCache(CACHE_KEY);

    return res.json({
      success: true,
      component: updated,
      servedByPod: config.podName,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update component', message: err.message });
  }
});

export default router;
