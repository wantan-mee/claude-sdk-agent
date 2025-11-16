import express, { Router, Request, Response } from 'express';
import { config } from '../config/env.js';

const router: Router = Router();

// Get RAG status and configuration
router.get('/rag/status', (_req: Request, res: Response) => {
  res.json({
    enabled: config.enableRag,
    configured: !!config.ragBedrockKbId,
    config: {
      region: config.ragAwsRegion,
      maxResults: config.ragMaxResults,
      maxDecompositionQueries: config.ragMaxDecompositionQueries,
      minRelevanceScore: config.ragMinRelevanceScore,
    },
  });
});

// Test RAG retrieval (useful for debugging)
router.post('/rag/test', async (req: Request, res: Response) => {
  if (!config.enableRag) {
    res.status(400).json({ error: 'RAG is not enabled' });
    return;
  }

  const { query } = req.body;
  if (!query) {
    res.status(400).json({ error: 'Query is required' });
    return;
  }

  try {
    const { RAGService } = await import('../services/rag.service.js');
    await RAGService.initialize();

    const context = await RAGService.retrieveContext(query);
    res.json(context);
  } catch (error) {
    res.status(500).json({
      error: 'RAG retrieval failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Test query decomposition
router.post('/rag/decompose', async (req: Request, res: Response) => {
  if (!config.enableRag) {
    res.status(400).json({ error: 'RAG is not enabled' });
    return;
  }

  const { query } = req.body;
  if (!query) {
    res.status(400).json({ error: 'Query is required' });
    return;
  }

  try {
    const { QueryDecompositionService } = await import('../services/query-decomposition.service.js');
    QueryDecompositionService.initialize();

    const decomposed = await QueryDecompositionService.decomposeQuery(query);
    res.json(decomposed);
  } catch (error) {
    res.status(500).json({
      error: 'Query decomposition failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export const ragRoutes: express.Router = router;
