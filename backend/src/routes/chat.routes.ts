import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BedrockAgentService } from '../services/bedrock.service.js';
import { StorageService } from '../services/storage.service.js';

interface ChatQueryParams {
  userId: string;
  message: string;
}

export async function chatRoutes(fastify: FastifyInstance) {
  const agentService = new BedrockAgentService();

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
        // Get conversation history for this user
        const conversationHistory = await StorageService.getUserConversation(userId);

        // Add user message to history
        await StorageService.addMessage(userId, 'user', message);

        // Process message with Bedrock
        const result = await agentService.processMessage(
          conversationHistory,
          message,
          onStream
        );

        // Add assistant response to history
        await StorageService.addMessage(userId, 'assistant', result.response);

        // Send completion event
        reply.raw.write(
          `data: ${JSON.stringify({
            type: 'message_complete',
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

  // Get user conversation info
  fastify.get(
    '/session/:userId',
    async (request: FastifyRequest<{ Params: { userId: string } }>) => {
      const { userId } = request.params;
      const conversationHistory = await StorageService.getUserConversation(userId);
      return {
        userId,
        messageCount: conversationHistory.length,
        hasSession: conversationHistory.length > 0,
      };
    }
  );

  // Clear user conversation (start new conversation)
  fastify.delete(
    '/session/:userId',
    async (request: FastifyRequest<{ Params: { userId: string } }>) => {
      const { userId } = request.params;
      await StorageService.clearUserSession(userId);
      return { userId, cleared: true };
    }
  );
}
