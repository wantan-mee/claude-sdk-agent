import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { chatRoutes } from './routes/chat.routes.js';
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

// Initialize artifact service (conditionally based on config)
if (config.enableArtifactsStorage) {
  Logger.info('SERVER', 'Initializing artifact service', { outputDir: config.agentOutputDir });
  const { ArtifactService } = await import('./services/artifact.service.js');
  const { artifactRoutes } = await import('./routes/artifact.routes.js');
  await ArtifactService.initialize();
  app.use('/api', artifactRoutes);
  Logger.info('SERVER', 'Artifacts storage: ENABLED');
} else {
  Logger.info('SERVER', 'Artifacts storage: DISABLED');
}

// Initialize RAG service (conditionally based on config)
if (config.enableRag) {
  Logger.info('SERVER', 'Initializing RAG service', {
    kbId: config.ragBedrockKbId,
    region: config.ragAwsRegion,
  });
  const { RAGService } = await import('./services/rag.service.js');
  const { ragRoutes } = await import('./routes/rag.routes.js');
  await RAGService.initialize();
  app.use('/api', ragRoutes);
  Logger.info('SERVER', 'RAG service: ENABLED');
} else {
  Logger.info('SERVER', 'RAG service: DISABLED');
}

// Register routes
app.use('/api', chatRoutes);

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
      Logger.info('SERVER', `Artifacts storage: ${config.enableArtifactsStorage ? 'enabled' : 'disabled'}`);
      Logger.info('SERVER', `RAG service: ${config.enableRag ? 'enabled' : 'disabled'}`);
      if (config.enableRag) {
        Logger.info('SERVER', `  Mode: ${config.ragMode} (EXCLUSIVE - only this mode is active)`);
        Logger.info('SERVER', `    mcp: ${config.ragMode === 'mcp' ? 'ACTIVE' : 'disabled'}`);
        Logger.info('SERVER', `    custom_tool: ${config.ragMode === 'custom_tool' ? 'ACTIVE' : 'disabled'}`);
        Logger.info('SERVER', `    pre_retrieval: ${config.ragMode === 'pre_retrieval' ? 'ACTIVE' : 'disabled'}`);
        Logger.info('SERVER', `  KB ID: ${config.ragBedrockKbId || 'NOT CONFIGURED'}`);
        Logger.info('SERVER', `  AWS Region: ${config.ragAwsRegion}`);
        Logger.info('SERVER', `  Max Results: ${config.ragMaxResults}`);
      }

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
