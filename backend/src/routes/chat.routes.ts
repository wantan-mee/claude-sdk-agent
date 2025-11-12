import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ClaudeAgentService } from '../services/agent.service.js';
import { StorageService } from '../services/storage.service.js';

interface ChatQueryParams {
  userId: string;
  message: string;
}

export async function chatRoutes(fastify: FastifyInstance) {
  const agentService = new ClaudeAgentService();

  // SSE streaming endpoint
  fastify.get(
    '/chat/stream',
    async (request: FastifyRequest<{ Querystring: ChatQueryParams }>, reply: FastifyReply) => {
      const { userId, message } = request.query;

      if (!userId || !message) {
        return reply.status(400).send({ error: 'userId and message are required' });
      }

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const onStream = (delta: string) => {
        reply.raw.write(
          `data: ${JSON.stringify({
            type: 'content_delta',
            delta,
          })}\n\n`
        );
      };

      try {
        // Get existing session ID for this user (if any)
        const existingSessionId = await StorageService.getUserSession(userId);

        // Process message - SDK handles history via session ID
        const result = await agentService.processMessage(existingSessionId, message, onStream);

        // Save new/updated session ID
        if (result.sessionId) {
          await StorageService.saveUserSession(userId, result.sessionId);
        }

        // Send completion event
        reply.raw.write(
          `data: ${JSON.stringify({
            type: 'message_complete',
            sessionId: result.sessionId,
            message: { role: 'assistant', content: result.response },
          })}\n\n`
        );

        reply.raw.end();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        reply.raw.write(
          `data: ${JSON.stringify({
            type: 'error',
            error: errorMessage,
          })}\n\n`
        );
        reply.raw.end();
      }
    }
  );

  // Get user session info
  fastify.get('/session/:userId', async (request: FastifyRequest<{ Params: { userId: string } }>) => {
    const { userId } = request.params;
    const sessionId = await StorageService.getUserSession(userId);
    return { userId, sessionId, hasSession: !!sessionId };
  });

  // Clear user session (start new conversation)
  fastify.delete('/session/:userId', async (request: FastifyRequest<{ Params: { userId: string } }>) => {
    const { userId } = request.params;
    await StorageService.clearUserSession(userId);
    return { userId, cleared: true };
  });
}
