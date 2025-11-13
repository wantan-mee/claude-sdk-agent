import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { chatRoutes } from './routes/chat.routes.js';
import { artifactRoutes } from './routes/artifact.routes.js';
import { ArtifactService } from './services/artifact.service.js';

const app = express();

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

// Request logging middleware (development only)
if (config.nodeEnv === 'development') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize artifact service
await ArtifactService.initialize();

// Set AWS credentials in environment for Claude SDK (if available)
if (config.awsAccessKeyId && config.awsSecretAccessKey) {
  process.env.AWS_ACCESS_KEY_ID = config.awsAccessKeyId;
  process.env.AWS_SECRET_ACCESS_KEY = config.awsSecretAccessKey;
  process.env.AWS_REGION = config.awsRegion;
  console.log(`🔐 AWS credentials configured for region: ${config.awsRegion}`);
}

// Register routes
app.use('/api', chatRoutes);
app.use('/api', artifactRoutes);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
const start = async () => {
  try {
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`🚀 Backend server running at http://localhost:${config.port}`);
      console.log(`📡 Frontend URL: ${config.frontendUrl}`);
      console.log(`📁 Agent output directory: ${config.agentOutputDir}`);

      // Log authentication method
      if (config.awsAccessKeyId && config.awsSecretAccessKey) {
        console.log(`🔑 Authentication: AWS Bedrock (${config.awsRegion})`);
      } else if (config.anthropicApiKey) {
        console.log(`🔑 Authentication: Anthropic API (direct)`);
      } else {
        console.warn(`⚠️  No authentication credentials configured!`);
      }
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();
