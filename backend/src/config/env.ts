import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  // Anthropic API Key
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',

  port: parseInt(process.env.PORT || '8000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  dataDir: process.env.DATA_DIR || path.join(process.cwd(), 'data'),
  agentOutputDir: process.env.AGENT_OUTPUT_DIR || path.join(process.cwd(), 'agent-output'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Feature Flags
  enableArtifactsStorage: process.env.ENABLE_ARTIFACTS_STORAGE !== 'false', // default true
  enableRag: process.env.ENABLE_RAG === 'true', // default false

  // RAG Configuration
  ragBedrockKbId: process.env.RAG_BEDROCK_KB_ID || '',
  ragAwsRegion: process.env.RAG_AWS_REGION || 'us-east-1',
  ragMaxResults: parseInt(process.env.RAG_MAX_RESULTS || '10', 10),
  ragMaxDecompositionQueries: parseInt(process.env.RAG_MAX_DECOMPOSITION_QUERIES || '5', 10),
  ragMinRelevanceScore: parseFloat(process.env.RAG_MIN_RELEVANCE_SCORE || '0.5'),
  ragMode: (process.env.RAG_MODE || 'mcp') as 'mcp' | 'custom_tool' | 'pre_retrieval',
} as const;

// Validate required config
if (!config.anthropicApiKey) {
  console.warn('⚠️  ANTHROPIC_API_KEY not set. Please set it in your .env file');
}
