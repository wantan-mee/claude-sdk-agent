import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env.js';
import { Logger } from './logger.service.js';

export interface DecomposedQueries {
  originalQuery: string;
  subQueries: string[];
  reasoning: string;
}

export class QueryDecompositionService {
  private static client: Anthropic | null = null;

  /**
   * Initialize the Anthropic client
   */
  static initialize(): void {
    if (!config.anthropicApiKey) {
      Logger.warn('RAG', 'Anthropic API key not configured for query decomposition');
      return;
    }

    this.client = new Anthropic({
      apiKey: config.anthropicApiKey,
    });

    Logger.info('RAG', 'Query decomposition service initialized');
  }

  /**
   * Decompose a complex query into multiple sub-queries for better retrieval
   */
  static async decomposeQuery(query: string): Promise<DecomposedQueries> {
    if (!this.client) {
      this.initialize();
    }

    if (!this.client) {
      // Fallback: return original query if no client available
      return {
        originalQuery: query,
        subQueries: [query],
        reasoning: 'No decomposition performed - API key not configured',
      };
    }

    const timer = Logger.startTimer();
    Logger.info('RAG', 'Decomposing query', { query: query.substring(0, 100) });

    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `You are a query decomposition expert. Your task is to break down complex questions into simpler sub-queries that will help retrieve more comprehensive information from a knowledge base.

Original Question: "${query}"

Analyze this question and generate ${config.ragMaxDecompositionQueries} different search queries that together will help answer the original question comprehensively.

Consider:
1. Different aspects or components of the question
2. Related concepts that might be needed for context
3. Prerequisites or background information
4. Specific details vs broad context
5. Different phrasings that might match documents better

Return your response in this exact JSON format:
{
  "reasoning": "Brief explanation of why you chose these sub-queries",
  "subQueries": [
    "first search query",
    "second search query",
    "etc..."
  ]
}

Only return valid JSON, no other text.`,
          },
        ],
      });

      // Parse the response
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      const parsed = JSON.parse(content.text);
      const duration = timer();

      Logger.info('RAG', 'Query decomposed', {
        original: query.substring(0, 50),
        subQueryCount: parsed.subQueries.length,
        duration,
      });

      return {
        originalQuery: query,
        subQueries: parsed.subQueries.slice(0, config.ragMaxDecompositionQueries),
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      Logger.error('RAG', 'Failed to decompose query', error);

      // Fallback: return original query plus some variations
      return {
        originalQuery: query,
        subQueries: [query],
        reasoning: 'Decomposition failed, using original query',
      };
    }
  }

  /**
   * Expand a query with semantic variations
   */
  static async expandQuery(query: string): Promise<string[]> {
    if (!this.client) {
      this.initialize();
    }

    if (!this.client) {
      return [query];
    }

    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `Generate 3 alternative phrasings for this search query that might match different documents:

Query: "${query}"

Return as JSON array of strings only: ["phrase1", "phrase2", "phrase3"]`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        return [query];
      }

      const alternatives = JSON.parse(content.text);
      return [query, ...alternatives];
    } catch (error) {
      Logger.warn('RAG', 'Query expansion failed', error);
      return [query];
    }
  }
}
