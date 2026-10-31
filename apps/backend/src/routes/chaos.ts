import { Router, Request, Response } from 'express';
import { chaos } from '../chaos';
import { config } from '../config';

const router = Router();

// POST /chaos/crash - Forces process.exit(1) on Node.js container
router.post('/crash', (req: Request, res: Response) => {
  const delayMs = parseInt((req.body && req.body.delayMs) || '200', 10);
  const result = chaos.triggerCrash(delayMs);
  return res.status(200).json(result);
});

// POST /chaos/cpu-spike - Simulates high CPU load to test HPA and alerts
router.post('/cpu-spike', (req: Request, res: Response) => {
  const durationSeconds = parseInt((req.body && req.body.durationSeconds) || '30', 10);
  const result = chaos.triggerCpuSpike(durationSeconds);
  const statusCode = result.success ? 200 : 409;
  return res.status(statusCode).json(result);
});

// POST /chaos/toggle-readiness - Toggles simulated readiness probe failure
router.post('/toggle-readiness', (req: Request, res: Response) => {
  const forceState = req.body && typeof req.body.ready === 'boolean' ? req.body.ready : undefined;
  const result = chaos.toggleReadiness(forceState);
  return res.status(200).json(result);
});

// POST /chaos/memory-leak - Simulates memory leak
router.post('/memory-leak', (req: Request, res: Response) => {
  const megabytes = parseInt((req.body && req.body.megabytes) || '50', 10);
  const result = chaos.triggerMemoryLeak(megabytes);
  return res.status(result.success ? 200 : 500).json(result);
});

// POST /chaos/latency - Injects artificial latency
router.post('/latency', (req: Request, res: Response) => {
  const ms = parseInt((req.body && req.body.latencyMs) || '0', 10);
  const result = chaos.setLatency(ms);
  return res.status(200).json(result);
});

// GET /chaos/status - Current status
router.get('/status', (req: Request, res: Response) => {
  return res.json({
    pod: config.podName,
    status: chaos.getStatus(),
  });
});

// POST /chaos/reset - Reset all chaos
router.post('/reset', (req: Request, res: Response) => {
  const result = chaos.reset();
  return res.json(result);
});

export default router;
