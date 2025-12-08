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

  // Jira Integration (optional)
  jiraHost: process.env.JIRA_HOST || '',
  jiraEmail: process.env.JIRA_EMAIL || '',
  jiraApiToken: process.env.JIRA_API_TOKEN || '',
} as const;

// Validate required config
if (!config.anthropicApiKey) {
  console.warn('⚠️  ANTHROPIC_API_KEY not set. Please set it in your .env file');
}

// Optional Jira configuration validation
if (config.jiraHost && (!config.jiraEmail || !config.jiraApiToken)) {
  console.warn('⚠️  JIRA_HOST is set but JIRA_EMAIL or JIRA_API_TOKEN is missing. Jira tools will not work properly.');
} else if (config.jiraHost && config.jiraEmail && config.jiraApiToken) {
  console.log('✅ Jira integration configured');
}
