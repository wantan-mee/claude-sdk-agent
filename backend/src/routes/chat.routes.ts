import express, { Router, Request, Response } from 'express';
import { ClaudeAgentService, StreamEvent } from '../services/agent.service.js';
import { StorageService } from '../services/storage.service.js';
import { Logger } from '../services/logger.service.js';

const router: Router = Router();
const agentService = new ClaudeAgentService();

// SSE streaming endpoint with enhanced transparency
router.get('/chat/stream', async (req: Request, res: Response) => {
  const requestTimer = Logger.startTimer();
  const { userId, message } = req.query as { userId?: string; message?: string };

  Logger.httpRequest('GET', '/api/chat/stream', userId);

  if (!userId || !message) {
    Logger.warn('HTTP', 'Missing required parameters', { userId, hasMessage: !!message });
    Logger.httpResponse('GET', '/api/chat/stream', 400, requestTimer());
    return res.status(400).json({ error: 'userId and message are required' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Flush headers to establish SSE connection

  Logger.info('SSE', 'Connection established', { userId, messageLength: message.length });

  // Stream ALL events to frontend for transparency
  const onStream = (event: StreamEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    // Get existing session ID for this user (if any)
    const existingSessionId = await StorageService.getUserSession(userId);

    Logger.debug('STORAGE', 'Retrieved user session', {
      userId,
      hasSession: !!existingSessionId,
      sessionId: existingSessionId
    });

    // Send initial status
    onStream({
      type: 'status',
      status: existingSessionId ? 'Resuming conversation...' : 'Starting new conversation...',
    });

    // Process message - SDK handles history via session ID
    const result = await agentService.processMessage(existingSessionId, message, onStream, userId);

    // Save new/updated session ID
    if (result.sessionId) {
      await StorageService.saveUserSession(userId, result.sessionId);
      Logger.info('STORAGE', 'Saved user session', { userId, sessionId: result.sessionId });
    }

    // Send completion event
    res.write(
      `data: ${JSON.stringify({
        type: 'message_complete',
        sessionId: result.sessionId,
        message: { role: 'assistant', content: result.response },
      })}\n\n`
    );

    Logger.httpResponse('GET', '/api/chat/stream', 200, requestTimer());
    res.end();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    Logger.agentError(undefined, error as Error, 'Chat stream error');

    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        error: errorMessage,
      })}\n\n`
    );

    Logger.httpResponse('GET', '/api/chat/stream', 500, requestTimer());
    res.end();
  }
});

// Get user session info
router.get('/session/:userId', async (req: Request, res: Response) => {
  const requestTimer = Logger.startTimer();
  const { userId } = req.params;

  Logger.httpRequest('GET', `/api/session/${userId}`, userId);

  try {
    const sessionId = await StorageService.getUserSession(userId);
    Logger.info('STORAGE', 'Retrieved session info', { userId, hasSession: !!sessionId });

    Logger.httpResponse('GET', `/api/session/${userId}`, 200, requestTimer());
    res.json({ userId, sessionId, hasSession: !!sessionId });
  } catch (error) {
    Logger.error('STORAGE', 'Failed to retrieve session', error, { userId });
    Logger.httpResponse('GET', `/api/session/${userId}`, 500, requestTimer());
    res.status(500).json({ error: 'Failed to retrieve session' });
  }
});

// Clear user session (start new conversation)
router.delete('/session/:userId', async (req: Request, res: Response) => {
  const requestTimer = Logger.startTimer();
  const { userId } = req.params;

  Logger.httpRequest('DELETE', `/api/session/${userId}`, userId);

  try {
    await StorageService.clearUserSession(userId);
    Logger.info('STORAGE', 'Cleared user session', { userId });

    Logger.httpResponse('DELETE', `/api/session/${userId}`, 200, requestTimer());
    res.json({ userId, cleared: true });
  } catch (error) {
    Logger.error('STORAGE', 'Failed to clear session', error, { userId });
    Logger.httpResponse('DELETE', `/api/session/${userId}`, 500, requestTimer());
    res.status(500).json({ error: 'Failed to clear session' });
  }
});

export const chatRoutes: express.Router = router;
