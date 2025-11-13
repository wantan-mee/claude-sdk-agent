import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  // AWS Credentials (primary authentication method)
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  awsRegion: process.env.AWS_REGION || 'us-east-1',

  // Anthropic API Key (fallback or direct API access)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',

  port: parseInt(process.env.PORT || '8000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  dataDir: process.env.DATA_DIR || path.join(process.cwd(), 'data'),
  agentOutputDir: process.env.AGENT_OUTPUT_DIR || path.join(process.cwd(), 'agent-output'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
} as const;

// Validate required config
if (!config.awsAccessKeyId || !config.awsSecretAccessKey) {
  console.warn('⚠️  AWS credentials not set. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables');
  console.warn('   Falling back to ANTHROPIC_API_KEY if available');

  if (!config.anthropicApiKey) {
    console.error('❌ No authentication credentials found. Please set either:');
    console.error('   - AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (for AWS Bedrock)');
    console.error('   - ANTHROPIC_API_KEY (for direct Anthropic API access)');
  }
}
