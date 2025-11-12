import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  port: parseInt(process.env.PORT || '8000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  dataDir: process.env.DATA_DIR || path.join(process.cwd(), 'data'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
} as const;

// Validate required config
if (!config.anthropicApiKey) {
  console.warn('⚠️  ANTHROPIC_API_KEY not set in environment variables');
}
