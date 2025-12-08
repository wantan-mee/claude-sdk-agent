import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { Logger } from './logger.service.js';
import { config } from '../config/env.js';

/**
 * Jira Tools - Custom tools for searching and interacting with Jira
 *
 * These tools allow the Claude agent to search Jira issues using JQL,
 * get issue details, and create new issues.
 */

// Jira API base URL
const getJiraBaseUrl = () => {
  const host = config.jiraHost;
  if (!host) {
    throw new Error('JIRA_HOST environment variable is not configured');
  }
  return host.endsWith('/') ? host.slice(0, -1) : host;
};

// Get Jira authentication headers
const getJiraHeaders = () => {
  const email = config.jiraEmail;
  const apiToken = config.jiraApiToken;

  if (!email || !apiToken) {
    throw new Error('JIRA_EMAIL and JIRA_API_TOKEN environment variables are required');
  }

  // Jira uses Basic Auth with email and API token
  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

  return {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
};

/**
 * Tool: jira_search
 *
 * Search for Jira issues using JQL (Jira Query Language)
 *
 * Example JQL queries:
 * - "project = PROJ AND status = Open"
 * - "assignee = currentUser() AND status != Done"
 * - "text ~ 'bug' AND created >= -7d"
 */
const jiraSearchTool = tool(
  'jira_search',
  'Search for Jira issues using JQL (Jira Query Language). Returns a list of issues with their key, summary, status, assignee, priority, and description.',
  {
    jql: z.string()
      .describe('JQL query to search issues. Examples: "project = PROJ AND status = Open", "text ~ \'bug\' AND created >= -7d"'),
    maxResults: z.number()
      .default(20)
      .describe('Maximum number of results to return (default: 20)'),
    startAt: z.number()
      .default(0)
      .describe('Pagination offset - start index for results (default: 0)'),
    fields: z.array(z.string())
      .optional()
      .describe('Optional list of fields to include. Defaults to [key, summary, status, assignee, priority, description]')
  },
  async (args) => {
    try {
      Logger.info('JIRA_TOOL', 'Searching Jira issues', {
        jql: args.jql,
        maxResults: args.maxResults,
        startAt: args.startAt
      });

      const baseUrl = getJiraBaseUrl();
      const headers = getJiraHeaders();

      const requestBody = {
        jql: args.jql,
        maxResults: args.maxResults,
        startAt: args.startAt,
        fields: args.fields || ['key', 'summary', 'status', 'assignee', 'priority', 'description', 'created', 'updated']
      };

      const response = await fetch(`${baseUrl}/rest/api/3/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        Logger.error('JIRA_TOOL', 'Jira search failed', {
          status: response.status,
          error: errorText
        });
        throw new Error(`Jira API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;

      Logger.info('JIRA_TOOL', 'Jira search completed', {
        totalResults: data.total,
        returnedResults: data.issues?.length || 0
      });

      // Format results for better readability
      const formattedIssues = data.issues?.map((issue: any) => ({
        key: issue.key,
        summary: issue.fields?.summary,
        status: issue.fields?.status?.name,
        assignee: issue.fields?.assignee?.displayName || 'Unassigned',
        priority: issue.fields?.priority?.name || 'None',
        description: issue.fields?.description || 'No description',
        created: issue.fields?.created,
        updated: issue.fields?.updated,
        url: `${baseUrl}/browse/${issue.key}`
      })) || [];

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            total: data.total,
            startAt: data.startAt,
            maxResults: data.maxResults,
            issues: formattedIssues
          }, null, 2)
        }]
      };
    } catch (error) {
      Logger.error('JIRA_TOOL', 'Jira search error', error);
      return {
        content: [{
          type: 'text',
          text: `Error searching Jira: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
);

/**
 * Tool: jira_get_issue
 *
 * Get detailed information about a specific Jira issue by its key
 */
const jiraGetIssueTool = tool(
  'jira_get_issue',
  'Get detailed information about a specific Jira issue by its key (e.g., PROJ-123)',
  {
    issueKey: z.string()
      .describe('The Jira issue key (e.g., PROJ-123)'),
    fields: z.array(z.string())
      .optional()
      .describe('Optional list of fields to include')
  },
  async (args) => {
    try {
      Logger.info('JIRA_TOOL', 'Getting Jira issue', { issueKey: args.issueKey });

      const baseUrl = getJiraBaseUrl();
      const headers = getJiraHeaders();

      const fieldsParam = args.fields ? `?fields=${args.fields.join(',')}` : '';
      const response = await fetch(`${baseUrl}/rest/api/3/issue/${args.issueKey}${fieldsParam}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        Logger.error('JIRA_TOOL', 'Jira get issue failed', {
          status: response.status,
          error: errorText
        });
        throw new Error(`Jira API error: ${response.status} - ${errorText}`);
      }

      const issue = await response.json() as any;

      Logger.info('JIRA_TOOL', 'Jira issue retrieved', { issueKey: args.issueKey });

      // Format issue details
      const formattedIssue = {
        key: issue.key,
        summary: issue.fields?.summary,
        description: issue.fields?.description,
        status: issue.fields?.status?.name,
        assignee: issue.fields?.assignee?.displayName || 'Unassigned',
        reporter: issue.fields?.reporter?.displayName,
        priority: issue.fields?.priority?.name || 'None',
        issueType: issue.fields?.issuetype?.name,
        created: issue.fields?.created,
        updated: issue.fields?.updated,
        labels: issue.fields?.labels || [],
        components: issue.fields?.components?.map((c: any) => c.name) || [],
        url: `${baseUrl}/browse/${issue.key}`,
        fields: issue.fields
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(formattedIssue, null, 2)
        }]
      };
    } catch (error) {
      Logger.error('JIRA_TOOL', 'Jira get issue error', error);
      return {
        content: [{
          type: 'text',
          text: `Error getting Jira issue: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
);

/**
 * Tool: jira_create_issue
 *
 * Create a new Jira issue
 */
const jiraCreateIssueTool = tool(
  'jira_create_issue',
  'Create a new issue in Jira with specified project, type, summary, and optional description',
  {
    projectKey: z.string()
      .describe('The project key where the issue will be created (e.g., PROJ)'),
    issueType: z.string()
      .describe('Type of issue to create (e.g., Bug, Story, Task, Epic)'),
    summary: z.string()
      .describe('Brief summary of the issue'),
    description: z.string()
      .optional()
      .describe('Detailed description of the issue (optional)'),
    priority: z.string()
      .optional()
      .describe('Priority level (e.g., Highest, High, Medium, Low, Lowest)'),
    assignee: z.string()
      .optional()
      .describe('Email or account ID of the assignee (optional)'),
    labels: z.array(z.string())
      .optional()
      .describe('Array of labels to apply to the issue (optional)')
  },
  async (args) => {
    try {
      Logger.info('JIRA_TOOL', 'Creating Jira issue', {
        projectKey: args.projectKey,
        issueType: args.issueType,
        summary: args.summary
      });

      const baseUrl = getJiraBaseUrl();
      const headers = getJiraHeaders();

      const requestBody: any = {
        fields: {
          project: {
            key: args.projectKey
          },
          issuetype: {
            name: args.issueType
          },
          summary: args.summary
        }
      };

      if (args.description) {
        requestBody.fields.description = args.description;
      }

      if (args.priority) {
        requestBody.fields.priority = {
          name: args.priority
        };
      }

      if (args.assignee) {
        requestBody.fields.assignee = {
          emailAddress: args.assignee
        };
      }

      if (args.labels && args.labels.length > 0) {
        requestBody.fields.labels = args.labels;
      }

      const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        Logger.error('JIRA_TOOL', 'Jira create issue failed', {
          status: response.status,
          error: errorText
        });
        throw new Error(`Jira API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as any;

      Logger.info('JIRA_TOOL', 'Jira issue created', {
        issueKey: result.key,
        issueId: result.id
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            key: result.key,
            id: result.id,
            url: `${baseUrl}/browse/${result.key}`,
            message: `Issue ${result.key} created successfully`
          }, null, 2)
        }]
      };
    } catch (error) {
      Logger.error('JIRA_TOOL', 'Jira create issue error', error);
      return {
        content: [{
          type: 'text',
          text: `Error creating Jira issue: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
);

/**
 * Create and export the Jira Tools MCP Server
 *
 * This server bundles all Jira-related tools and can be registered
 * with the Claude Agent SDK
 */
export const jiraToolsServer = createSdkMcpServer({
  name: 'jira-tools',
  version: '1.0.0',
  tools: [
    jiraSearchTool,
    jiraGetIssueTool,
    jiraCreateIssueTool
  ]
});
