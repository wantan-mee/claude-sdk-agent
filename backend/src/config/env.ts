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

  // Confluence Integration (optional)
  confluenceHost: process.env.CONFLUENCE_HOST || '',
  confluenceEmail: process.env.CONFLUENCE_EMAIL || '',
  confluenceApiToken: process.env.CONFLUENCE_API_TOKEN || '',

  // AWS Bedrock Knowledge Base Integration (optional)
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  awsRegion: process.env.AWS_REGION || '',
  awsKnowledgeBaseId: process.env.AWS_KNOWLEDGE_BASE_ID || '',
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

// Optional Confluence configuration validation
if (config.confluenceHost && (!config.confluenceEmail || !config.confluenceApiToken)) {
  console.warn('⚠️  CONFLUENCE_HOST is set but CONFLUENCE_EMAIL or CONFLUENCE_API_TOKEN is missing. Confluence tools will not work properly.');
} else if (config.confluenceHost && config.confluenceEmail && config.confluenceApiToken) {
  console.log('✅ Confluence integration configured');
}

// Optional AWS Bedrock Knowledge Base configuration validation
if (config.awsKnowledgeBaseId && (!config.awsAccessKeyId || !config.awsSecretAccessKey || !config.awsRegion)) {
  console.warn('⚠️  AWS_KNOWLEDGE_BASE_ID is set but AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION) are missing. Bedrock KB tools will not work properly.');
} else if (config.awsKnowledgeBaseId && config.awsAccessKeyId && config.awsSecretAccessKey && config.awsRegion) {
  console.log('✅ AWS Bedrock Knowledge Base integration configured');
}
