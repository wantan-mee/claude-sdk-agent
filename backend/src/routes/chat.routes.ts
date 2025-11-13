import express, { Router, Request, Response } from 'express';
import { ClaudeAgentService, StreamEvent } from '../services/agent.service.js';
import { StorageService } from '../services/storage.service.js';

const router: Router = Router();
const agentService = new ClaudeAgentService();

// SSE streaming endpoint with enhanced transparency
router.get('/chat/stream', async (req: Request, res: Response) => {
  const { userId, message } = req.query as { userId?: string; message?: string };

  if (!userId || !message) {
    return res.status(400).json({ error: 'userId and message are required' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Flush headers to establish SSE connection

  // Stream ALL events to frontend for transparency
  const onStream = (event: StreamEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    // Get existing session ID for this user (if any)
    const existingSessionId = await StorageService.getUserSession(userId);

    // Send initial status
    onStream({
      type: 'status',
      status: existingSessionId ? 'Resuming conversation...' : 'Starting new conversation...',
    });

    // Process message - SDK handles history via session ID
    const result = await agentService.processMessage(existingSessionId, message, onStream);

    // Save new/updated session ID
    if (result.sessionId) {
      await StorageService.saveUserSession(userId, result.sessionId);
    }

    // Send completion event
    res.write(
      `data: ${JSON.stringify({
        type: 'message_complete',
        sessionId: result.sessionId,
        message: { role: 'assistant', content: result.response },
      })}\n\n`
    );

    res.end();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        error: errorMessage,
      })}\n\n`
    );
    res.end();
  }
});

// Get user session info
router.get('/session/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const sessionId = await StorageService.getUserSession(userId);
  res.json({ userId, sessionId, hasSession: !!sessionId });
});

// Clear user session (start new conversation)
router.delete('/session/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  await StorageService.clearUserSession(userId);
  res.json({ userId, cleared: true });
});

export const chatRoutes: express.Router = router;
