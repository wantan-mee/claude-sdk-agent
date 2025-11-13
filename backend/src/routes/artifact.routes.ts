import express, { Router, Request, Response } from 'express';
import { ArtifactService } from '../services/artifact.service.js';

const router: Router = Router();

// Get all artifacts
router.get('/artifacts', async (_req: Request, res: Response) => {
  const artifacts = await ArtifactService.getArtifacts();
  res.json({ artifacts });
});

// Get specific artifact content
router.get('/artifacts/:path(*)', async (req: Request, res: Response) => {
  const { path } = req.params;

  try {
    const content = await ArtifactService.readArtifact(path);
    res.json({ path, content });
  } catch (error) {
    res.status(404).json({ error: 'File not found or cannot be read' });
  }
});

// Clear all artifacts
router.delete('/artifacts', async (_req: Request, res: Response) => {
  try {
    await ArtifactService.clearArtifacts();
    res.json({ success: true, message: 'All artifacts cleared' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to clear artifacts' });
  }
});

export const artifactRoutes: express.Router = router;
