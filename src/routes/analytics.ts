import { Router, Request, Response } from 'express';
import { analyticsService } from '../services/analytics';

const router = Router();

/**
 * GET /api/analytics/traffic/:projectId
 * Query params: from, to (ISO date strings)
 */
router.get('/traffic/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params as Record<string, string>;
    const { from, to } = req.query as Record<string, string>;

    const stats = await analyticsService.getTrafficStats({
      projectId,
      from: String(from || ""),
      to: String(to || ""),
    });

    res.json(stats);
  } catch (error: unknown) {
    console.error('Traffic analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch traffic stats' });
  }
});

/**
 * GET /api/analytics/performance/:projectId
 * Query params: from, to (ISO date strings)
 */
router.get('/performance/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params as Record<string, string>;
    const { from, to } = req.query as Record<string, string>;

    const metrics = await analyticsService.getPerformanceMetrics({
      projectId,
      from: String(from || ""),
      to: String(to || ""),
    });

    res.json(metrics);
  } catch (error: unknown) {
    console.error('Performance analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

/**
 * GET /api/analytics/errors/:projectId
 * Query params: from, to (ISO date strings)
 */
router.get('/errors/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params as Record<string, string>;
    const { from, to } = req.query as Record<string, string>;

    const errors = await analyticsService.getErrorStats({
      projectId,
      from: String(from || ""),
      to: String(to || ""),
    });

    res.json(errors);
  } catch (error: unknown) {
    console.error('Error analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch error stats' });
  }
});

export default router;
