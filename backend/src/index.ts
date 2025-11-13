import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { chatRoutes } from './routes/chat.routes.js';
import { artifactRoutes } from './routes/artifact.routes.js';
import { ArtifactService } from './services/artifact.service.js';
import { Logger } from './services/logger.service.js';

const app = express();

// Initialize logger first
await Logger.initialize();
Logger.info('SERVER', 'Logger initialized', { logsDir: `${config.dataDir}/logs` });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);

// Request logging middleware (all environments)
app.use((req, res, next) => {
  const timer = Logger.startTimer();

  // Log request
  Logger.debug('HTTP', `${req.method} ${req.url}`, {
    headers: req.headers,
    query: req.query,
    body: req.body,
  });

  // Capture response finish
  res.on('finish', () => {
    const duration = timer();
    const level = res.statusCode >= 400 ? 'warn' : 'debug';

    if (level === 'warn') {
      Logger.warn('HTTP', `${req.method} ${req.url} ${res.statusCode}`, undefined, { duration });
    } else {
      Logger.debug('HTTP', `${req.method} ${req.url} ${res.statusCode}`, undefined, { duration });
    }
  });

  next();
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: process.version,
  });
});

// Initialize artifact service
Logger.info('SERVER', 'Initializing artifact service', { outputDir: config.agentOutputDir });
await ArtifactService.initialize();

// Register routes
app.use('/api', chatRoutes);
app.use('/api', artifactRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  Logger.error('SERVER', 'Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
  });

  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
const start = async () => {
  try {
    app.listen(config.port, '0.0.0.0', () => {
      Logger.info('SERVER', '='.repeat(80));
      Logger.info('SERVER', '🚀 Backend server started successfully');
      Logger.info('SERVER', '='.repeat(80));
      Logger.info('SERVER', `Server URL: http://localhost:${config.port}`);
      Logger.info('SERVER', `Frontend URL: ${config.frontendUrl}`);
      Logger.info('SERVER', `Environment: ${config.nodeEnv}`);
      Logger.info('SERVER', `Node version: ${process.version}`);
      Logger.info('SERVER', `Agent output: ${config.agentOutputDir}`);
      Logger.info('SERVER', `Data directory: ${config.dataDir}`);

      if (config.anthropicApiKey) {
        Logger.info('SERVER', '🔑 Anthropic API key: configured');
      } else {
        Logger.warn('SERVER', '⚠️  No ANTHROPIC_API_KEY configured!');
      }

      Logger.info('SERVER', '='.repeat(80));
      Logger.info('SERVER', 'Ready to process requests');
      Logger.info('SERVER', '='.repeat(80));
    });
  } catch (err) {
    Logger.error('SERVER', 'Failed to start server', err);
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGTERM', () => {
  Logger.info('SERVER', 'SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  Logger.info('SERVER', 'SIGINT signal received: closing HTTP server');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  Logger.error('SERVER', 'Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  Logger.error('SERVER', 'Unhandled rejection', reason);
  process.exit(1);
});

start();
