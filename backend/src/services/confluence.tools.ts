import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { Logger } from './logger.service.js';
import { config } from '../config/env.js';

/**
 * Confluence Tools - Custom tools for searching and interacting with Confluence
 *
 * These tools allow the Claude agent to search Confluence pages, retrieve content,
 * and interact with Confluence spaces.
 */

// Confluence API base URL
const getConfluenceBaseUrl = () => {
  const host = config.confluenceHost;
  if (!host) {
    throw new Error('CONFLUENCE_HOST environment variable is not configured');
  }
  return host.endsWith('/') ? host.slice(0, -1) : host;
};

// Get Confluence authentication headers
const getConfluenceHeaders = () => {
  const email = config.confluenceEmail;
  const apiToken = config.confluenceApiToken;

  if (!email || !apiToken) {
    throw new Error('CONFLUENCE_EMAIL and CONFLUENCE_API_TOKEN environment variables are required');
  }

  // Confluence uses Basic Auth with email and API token (same as Jira)
  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

  return {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
};

/**
 * Tool: confluence_search
 *
 * Search for Confluence pages and content using CQL (Confluence Query Language)
 *
 * Example CQL queries:
 * - "type=page AND space=DOCS"
 * - "text ~ 'architecture' AND space=TECH"
 * - "type=page AND title ~ 'API' AND lastModified >= now('-7d')"
 */
const confluenceSearchTool = tool(
  'confluence_search',
  'Search for Confluence pages and content using CQL (Confluence Query Language). Returns pages with title, excerpt, space, and URL.',
  {
    cql: z.string()
      .describe('CQL query to search content. Examples: "type=page AND space=DOCS", "text ~ \'architecture\'"'),
    limit: z.number()
      .default(20)
      .describe('Maximum number of results to return (default: 20)'),
    start: z.number()
      .default(0)
      .describe('Pagination offset - start index for results (default: 0)'),
    expand: z.string()
      .optional()
      .describe('Optional fields to expand (e.g., "body.view,version,space")')
  },
  async (args) => {
    try {
      Logger.info('CONFLUENCE_TOOL', 'Searching Confluence content', {
        cql: args.cql,
        limit: args.limit,
        start: args.start
      });

      const baseUrl = getConfluenceBaseUrl();
      const headers = getConfluenceHeaders();

      // Build query parameters
      const params = new URLSearchParams({
        cql: args.cql,
        limit: args.limit.toString(),
        start: args.start.toString(),
        ...(args.expand && { expand: args.expand })
      });

      const response = await fetch(`${baseUrl}/wiki/rest/api/content/search?${params}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        Logger.error('CONFLUENCE_TOOL', 'Confluence search failed', {
          status: response.status,
          error: errorText
        });
        throw new Error(`Confluence API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;

      Logger.info('CONFLUENCE_TOOL', 'Confluence search completed', {
        totalResults: data.size,
        returnedResults: data.results?.length || 0
      });

      // Format results for better readability
      const formattedPages = data.results?.map((page: any) => ({
        id: page.id,
        type: page.type,
        title: page.title,
        space: page.space?.name || page.space?.key,
        excerpt: page.excerpt || 'No excerpt available',
        url: `${baseUrl}/wiki${page._links?.webui || ''}`,
        lastModified: page.version?.when,
        author: page.version?.by?.displayName,
        // Include body if expanded
        ...(page.body?.view?.value && { content: page.body.view.value })
      })) || [];

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            total: data.size,
            start: data.start,
            limit: data.limit,
            results: formattedPages
          }, null, 2)
        }]
      };
    } catch (error) {
      Logger.error('CONFLUENCE_TOOL', 'Confluence search error', error);
      return {
        content: [{
          type: 'text',
          text: `Error searching Confluence: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
);

/**
 * Tool: confluence_get_page
 *
 * Get detailed content of a specific Confluence page by ID
 */
const confluenceGetPageTool = tool(
  'confluence_get_page',
  'Get detailed content of a specific Confluence page by its ID or by space key and title',
  {
    pageId: z.string()
      .optional()
      .describe('The Confluence page ID (numeric)'),
    spaceKey: z.string()
      .optional()
      .describe('Space key (required if using title instead of pageId)'),
    title: z.string()
      .optional()
      .describe('Page title (required if using spaceKey instead of pageId)'),
    expand: z.string()
      .default('body.view,version,space,ancestors')
      .describe('Fields to expand (default: body.view,version,space,ancestors)')
  },
  async (args) => {
    try {
      // Validate inputs
      if (!args.pageId && (!args.spaceKey || !args.title)) {
        throw new Error('Either pageId or both spaceKey and title must be provided');
      }

      Logger.info('CONFLUENCE_TOOL', 'Getting Confluence page', {
        pageId: args.pageId,
        spaceKey: args.spaceKey,
        title: args.title
      });

      const baseUrl = getConfluenceBaseUrl();
      const headers = getConfluenceHeaders();

      let page: any;

      if (args.pageId) {
        // Get by page ID
        const params = new URLSearchParams({ expand: args.expand });
        const response = await fetch(`${baseUrl}/wiki/rest/api/content/${args.pageId}?${params}`, {
          method: 'GET',
          headers
        });

        if (!response.ok) {
          const errorText = await response.text();
          Logger.error('CONFLUENCE_TOOL', 'Confluence get page failed', {
            status: response.status,
            error: errorText
          });
          throw new Error(`Confluence API error: ${response.status} - ${errorText}`);
        }

        page = await response.json() as any;
      } else {
        // Search by space and title
        const cql = `type=page AND space="${args.spaceKey}" AND title="${args.title}"`;
        const params = new URLSearchParams({
          cql,
          limit: '1',
          expand: args.expand
        });

        const response = await fetch(`${baseUrl}/wiki/rest/api/content/search?${params}`, {
          method: 'GET',
          headers
        });

        if (!response.ok) {
          const errorText = await response.text();
          Logger.error('CONFLUENCE_TOOL', 'Confluence search by title failed', {
            status: response.status,
            error: errorText
          });
          throw new Error(`Confluence API error: ${response.status} - ${errorText}`);
        }

        const searchData = await response.json() as any;

        if (!searchData.results || searchData.results.length === 0) {
          throw new Error(`Page not found: ${args.title} in space ${args.spaceKey}`);
        }

        page = searchData.results[0];
      }

      Logger.info('CONFLUENCE_TOOL', 'Confluence page retrieved', {
        pageId: page.id,
        title: page.title
      });

      // Format page details
      const formattedPage = {
        id: page.id,
        type: page.type,
        title: page.title,
        space: {
          key: page.space?.key,
          name: page.space?.name
        },
        version: {
          number: page.version?.number,
          when: page.version?.when,
          by: page.version?.by?.displayName,
          message: page.version?.message
        },
        ancestors: page.ancestors?.map((a: any) => ({
          id: a.id,
          title: a.title
        })) || [],
        body: page.body?.view?.value || 'No content available',
        url: `${baseUrl}/wiki${page._links?.webui || ''}`,
        createdDate: page.history?.createdDate,
        createdBy: page.history?.createdBy?.displayName
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(formattedPage, null, 2)
        }]
      };
    } catch (error) {
      Logger.error('CONFLUENCE_TOOL', 'Confluence get page error', error);
      return {
        content: [{
          type: 'text',
          text: `Error getting Confluence page: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
);

/**
 * Tool: confluence_list_spaces
 *
 * List available Confluence spaces
 */
const confluenceListSpacesTool = tool(
  'confluence_list_spaces',
  'List available Confluence spaces with their keys, names, and types',
  {
    type: z.enum(['global', 'personal'])
      .optional()
      .describe('Filter by space type: global or personal (optional)'),
    limit: z.number()
      .default(25)
      .describe('Maximum number of spaces to return (default: 25)'),
    start: z.number()
      .default(0)
      .describe('Pagination offset (default: 0)')
  },
  async (args) => {
    try {
      Logger.info('CONFLUENCE_TOOL', 'Listing Confluence spaces', {
        type: args.type,
        limit: args.limit
      });

      const baseUrl = getConfluenceBaseUrl();
      const headers = getConfluenceHeaders();

      const params = new URLSearchParams({
        limit: args.limit.toString(),
        start: args.start.toString(),
        ...(args.type && { type: args.type })
      });

      const response = await fetch(`${baseUrl}/wiki/rest/api/space?${params}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        Logger.error('CONFLUENCE_TOOL', 'Confluence list spaces failed', {
          status: response.status,
          error: errorText
        });
        throw new Error(`Confluence API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;

      Logger.info('CONFLUENCE_TOOL', 'Confluence spaces listed', {
        totalResults: data.size
      });

      // Format space results
      const formattedSpaces = data.results?.map((space: any) => ({
        key: space.key,
        name: space.name,
        type: space.type,
        description: space.description?.plain?.value || 'No description',
        url: `${baseUrl}/wiki${space._links?.webui || ''}`
      })) || [];

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            total: data.size,
            start: data.start,
            limit: data.limit,
            spaces: formattedSpaces
          }, null, 2)
        }]
      };
    } catch (error) {
      Logger.error('CONFLUENCE_TOOL', 'Confluence list spaces error', error);
      return {
        content: [{
          type: 'text',
          text: `Error listing Confluence spaces: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
);

/**
 * Create and export the Confluence Tools MCP Server
 *
 * This server bundles all Confluence-related tools and can be registered
 * with the Claude Agent SDK
 */
export const confluenceToolsServer = createSdkMcpServer({
  name: 'confluence-tools',
  version: '1.0.0',
  tools: [
    confluenceSearchTool,
    confluenceGetPageTool,
    confluenceListSpacesTool
  ]
});
