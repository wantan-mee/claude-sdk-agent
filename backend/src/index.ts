import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config/env.js';
import { chatRoutes } from './routes/chat.routes.js';

const fastify = Fastify({
  logger: {
    level: config.nodeEnv === 'development' ? 'info' : 'warn',
  },
});

// Register CORS
await fastify.register(cors, {
  origin: config.frontendUrl,
  credentials: true,
});

// Health check endpoint
fastify.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register routes
await fastify.register(chatRoutes, { prefix: '/api' });

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`🚀 Backend server running at http://localhost:${config.port}`);
    console.log(`📡 Frontend URL: ${config.frontendUrl}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
