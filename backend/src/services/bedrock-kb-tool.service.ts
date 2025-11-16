import { config } from '../config/env.js';
import { BedrockKBService } from './bedrock-kb.service.js';
import { Logger } from './logger.service.js';

/**
 * Custom tool definitions for Bedrock KB access
 * These can be injected into Claude Agent SDK's tool list
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface ToolResult {
  success: boolean;
  content: string;
  error?: string;
}

export class BedrockKBToolService {
  private static initialized = false;

  /**
   * Initialize the tool service
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    BedrockKBService.initialize();
    this.initialized = true;
    Logger.info('RAG', 'Bedrock KB Tool Service initialized');
  }

  /**
   * Get tool definitions for Claude Agent SDK
   */
  static getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'search_knowledge_base',
        description: `Search the AWS Bedrock Knowledge Base for relevant information about your domain. Use this tool to find answers to questions. You can call this tool multiple times with different queries to gather comprehensive information. Returns up to ${config.ragMaxResults} relevant passages with sources and relevance scores. Always use this tool when you need factual information about the domain.`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query. Be specific and use relevant keywords for better results.',
            },
            num_results: {
              type: 'number',
              description: `Number of results to return (default: ${config.ragMaxResults})`,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'multi_search_knowledge_base',
        description: 'Perform multiple searches on the Knowledge Base in one call. Useful for complex questions that need information from different angles. Provide multiple search queries and get aggregated results.',
        inputSchema: {
          type: 'object',
          properties: {
            queries: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of search queries to execute',
            },
            num_results_per_query: {
              type: 'number',
              description: 'Number of results per query (default: 5)',
            },
          },
          required: ['queries'],
        },
      },
    ];
  }

  /**
   * Execute a tool call
   */
  static async executeTool(
    toolName: string,
    args: Record<string, any>
  ): Promise<ToolResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    Logger.info('RAG', `Executing tool: ${toolName}`, args);

    try {
      switch (toolName) {
        case 'search_knowledge_base':
          return await this.searchKnowledgeBase(args);
        case 'multi_search_knowledge_base':
          return await this.multiSearchKnowledgeBase(args);
        default:
          return {
            success: false,
            content: '',
            error: `Unknown tool: ${toolName}`,
          };
      }
    } catch (error) {
      Logger.error('RAG', `Tool execution failed: ${toolName}`, error);
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Search knowledge base tool implementation
   */
  private static async searchKnowledgeBase(
    args: Record<string, any>
  ): Promise<ToolResult> {
    const query = args.query as string;
    const numResults = args.num_results || config.ragMaxResults;

    if (!query) {
      return {
        success: false,
        content: '',
        error: 'Query is required',
      };
    }

    const response = await BedrockKBService.retrieve(query);
    const results = response.results.slice(0, numResults);

    if (results.length === 0) {
      return {
        success: true,
        content: `No results found for query: "${query}"\n\nTry rephrasing your search or using different keywords.`,
      };
    }

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

    Logger.info('RAG', `Search returned ${results.length} results`, {
      query: query.substring(0, 50),
    });

    return {
      success: true,
      content: formattedResults,
    };
  }

  /**
   * Multi-search knowledge base tool implementation
   */
  private static async multiSearchKnowledgeBase(
    args: Record<string, any>
  ): Promise<ToolResult> {
    const queries = args.queries as string[];
    const numResultsPerQuery = args.num_results_per_query || 5;

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return {
        success: false,
        content: '',
        error: 'Queries array is required',
      };
    }

    let allResults = `## Multi-Query Knowledge Base Search\n\n`;
    allResults += `**Queries:** ${queries.length}\n\n`;

    for (let q = 0; q < queries.length; q++) {
      const query = queries[q];
      allResults += `### Query ${q + 1}: "${query}"\n\n`;

      try {
        const response = await BedrockKBService.retrieve(query);
        const results = response.results.slice(0, numResultsPerQuery);

        if (results.length === 0) {
          allResults += `No results found.\n\n`;
        } else {
          for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const sourceName = result.source.split('/').pop() || result.source;
            allResults += `**${i + 1}. ${sourceName}** (${(result.score * 100).toFixed(1)}%)\n`;
            allResults += `${result.content.substring(0, 500)}${result.content.length > 500 ? '...' : ''}\n\n`;
          }
        }
      } catch (error) {
        allResults += `Error searching: ${error instanceof Error ? error.message : 'Unknown error'}\n\n`;
      }

      allResults += `---\n\n`;
    }

    Logger.info('RAG', `Multi-search completed for ${queries.length} queries`);

    return {
      success: true,
      content: allResults,
    };
  }

  /**
   * Get system prompt addition for KB-aware agent
   */
  static getSystemPromptAddition(): string {
    return `
## Knowledge Base Access

You have access to a Knowledge Base containing domain-specific information. Use the search_knowledge_base tool to find relevant information.

**Best Practices:**
1. **Search before answering** - Always search the KB for factual questions
2. **Multiple searches** - Use different phrasings and keywords to find comprehensive information
3. **Cite sources** - Reference which documents your information comes from
4. **Acknowledge gaps** - If the KB doesn't have the answer, say so clearly
5. **Synthesize information** - Combine insights from multiple search results

**When to search:**
- Questions about specific features, configurations, or procedures
- Technical details or specifications
- Policy or process questions
- Any domain-specific knowledge

**Search tips:**
- Use specific keywords from the question
- Try synonyms or alternative phrasings
- Break complex questions into smaller searches
- Search for related concepts that might provide context
`;
  }
}
