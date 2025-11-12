import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  awsRegion: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
  bedrockModelId:
    process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  port: parseInt(process.env.PORT || '8000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  dataDir: process.env.DATA_DIR || path.join(process.cwd(), 'data'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
} as const;

console.log(`🔧 AWS Region: ${config.awsRegion}`);
console.log(`🤖 Bedrock Model: ${config.bedrockModelId}`);
console.log(`📡 Frontend URL: ${config.frontendUrl}`);
