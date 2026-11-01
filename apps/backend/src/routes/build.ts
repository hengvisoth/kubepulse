import { Router, Request, Response } from 'express';
import { config } from '../config';

const router = Router();
const startedAt = new Date().toISOString();

// Lets a rollout test confirm which backend build answered, without reading logs.
router.get('/build', (req: Request, res: Response) => {
  res.json({
    rolloutTest: 3,
    message: 'Backend update for rollout testing',
    servedByPod: config.podName,
    appVersion: config.appVersion,
    startedAt,
  });
});

export default router;
