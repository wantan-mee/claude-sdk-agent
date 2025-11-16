#!/usr/bin/env node

/**
 * MCP Server for AWS Bedrock Knowledge Base
 *
 * This server provides tools for searching and retrieving information
 * from an AWS Bedrock Knowledge Base, enabling agentic RAG workflows.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

// Configuration from environment variables
const KB_ID = process.env.RAG_BEDROCK_KB_ID || '';
const AWS_REGION = process.env.RAG_AWS_REGION || 'us-east-1';
const MAX_RESULTS = parseInt(process.env.RAG_MAX_RESULTS || '10', 10);
const MIN_SCORE = parseFloat(process.env.RAG_MIN_RELEVANCE_SCORE || '0.5');

// Initialize Bedrock client
const bedrockClient = new BedrockAgentRuntimeClient({
  region: AWS_REGION,
});

// Create MCP server
const server = new Server(
  {
    name: 'bedrock-kb-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_knowledge_base',
        description: `Search the AWS Bedrock Knowledge Base for relevant information. Use this tool to find answers to questions about your domain-specific knowledge. You can call this tool multiple times with different queries to gather comprehensive information. Each search returns up to ${MAX_RESULTS} relevant passages with their sources and relevance scores.`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query to find relevant information in the knowledge base. Be specific and use relevant keywords.',
            },
            num_results: {
              type: 'number',
              description: `Number of results to return (default: ${MAX_RESULTS}, max: 25)`,
              default: MAX_RESULTS,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_kb_info',
        description: 'Get information about the configured Knowledge Base, including its ID and current settings.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'search_knowledge_base') {
    if (!KB_ID) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: Knowledge Base ID not configured. Please set RAG_BEDROCK_KB_ID environment variable.',
          },
        ],
        isError: true,
      };
    }

    const query = args?.query as string;
    const numResults = Math.min((args?.num_results as number) || MAX_RESULTS, 25);

    try {
      const command = new RetrieveCommand({
        knowledgeBaseId: KB_ID,
        retrievalQuery: {
          text: query,
        },
        retrievalConfiguration: {
          vectorSearchConfiguration: {
            numberOfResults: numResults,
          },
        },
      });

      const response = await bedrockClient.send(command);
      const results: Array<{
        content: string;
        source: string;
        score: number;
      }> = [];

      if (response.retrievalResults) {
        for (const result of response.retrievalResults) {
          const score = result.score || 0;
          if (score >= MIN_SCORE) {
            results.push({
              content: result.content?.text || '',
              source: result.location?.s3Location?.uri || 'Unknown source',
              score,
            });
          }
        }
      }

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No results found for query: "${query}"\n\nTry rephrasing your search or using different keywords.`,
            },
          ],
        };
      }

      // Format results for readability
      let formattedResults = `## Knowledge Base Search Results\n\n`;
      formattedResults += `**Query:** ${query}\n`;
      formattedResults += `**Results Found:** ${results.length}\n\n`;
      formattedResults += `---\n\n`;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const sourceName = result.source.split('/').pop() || result.source;
        formattedResults += `### Result ${i + 1}\n`;
        formattedResults += `**Source:** ${sourceName}\n`;
        formattedResults += `**Relevance:** ${(result.score * 100).toFixed(1)}%\n\n`;
        formattedResults += `${result.content}\n\n`;
        formattedResults += `---\n\n`;
      }

      return {
        content: [
          {
            type: 'text',
            text: formattedResults,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: `Error searching Knowledge Base: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (name === 'get_kb_info') {
    return {
      content: [
        {
          type: 'text',
          text: `## Knowledge Base Configuration\n\n` +
            `- **KB ID:** ${KB_ID || 'NOT CONFIGURED'}\n` +
            `- **AWS Region:** ${AWS_REGION}\n` +
            `- **Max Results:** ${MAX_RESULTS}\n` +
            `- **Min Relevance Score:** ${MIN_SCORE}\n`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: `Unknown tool: ${name}`,
      },
    ],
    isError: true,
  };
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Bedrock KB MCP Server started');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
