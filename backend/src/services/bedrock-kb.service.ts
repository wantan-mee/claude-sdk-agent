import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
  RetrieveCommandInput,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { config } from '../config/env.js';
import { Logger } from './logger.service.js';

export interface RetrievalResult {
  content: string;
  source: string;
  score: number;
  metadata?: Record<string, string>;
}

export interface RetrievalResponse {
  results: RetrievalResult[];
  query: string;
  totalResults: number;
}

export class BedrockKBService {
  private static client: BedrockAgentRuntimeClient | null = null;

  /**
   * Initialize the Bedrock client
   */
  static initialize(): void {
    if (!config.ragBedrockKbId) {
      Logger.warn('RAG', 'Bedrock Knowledge Base ID not configured');
      return;
    }

    this.client = new BedrockAgentRuntimeClient({
      region: config.ragAwsRegion,
    });

    Logger.info('RAG', 'Bedrock KB client initialized', {
      region: config.ragAwsRegion,
      kbId: config.ragBedrockKbId,
    });
  }

  /**
   * Retrieve relevant documents from Bedrock Knowledge Base
   */
  static async retrieve(query: string): Promise<RetrievalResponse> {
    if (!this.client) {
      this.initialize();
    }

    if (!this.client) {
      throw new Error('Bedrock KB client not initialized');
    }

    const timer = Logger.startTimer();
    Logger.info('RAG', `Retrieving from KB: ${query.substring(0, 100)}...`, {
      query,
      maxResults: config.ragMaxResults,
    });

    try {
      const input: RetrieveCommandInput = {
        knowledgeBaseId: config.ragBedrockKbId,
        retrievalQuery: {
          text: query,
        },
        retrievalConfiguration: {
          vectorSearchConfiguration: {
            numberOfResults: config.ragMaxResults,
          },
        },
      };

      const command = new RetrieveCommand(input);
      const response = await this.client.send(command);

      const results: RetrievalResult[] = [];

      if (response.retrievalResults) {
        for (const result of response.retrievalResults) {
          const score = result.score || 0;

          // Filter by minimum relevance score
          if (score >= config.ragMinRelevanceScore) {
            results.push({
              content: result.content?.text || '',
              source: result.location?.s3Location?.uri || 'Unknown source',
              score,
              metadata: result.metadata as Record<string, string> | undefined,
            });
          }
        }
      }

      const duration = timer();
      Logger.info('RAG', `Retrieved ${results.length} results`, {
        query: query.substring(0, 50),
        totalResults: results.length,
        duration,
      });

      return {
        results,
        query,
        totalResults: results.length,
      };
    } catch (error) {
      Logger.error('RAG', 'Failed to retrieve from Bedrock KB', error);
      throw error;
    }
  }

  /**
   * Retrieve and format results as context string
   */
  static async retrieveAsContext(query: string): Promise<string> {
    const response = await this.retrieve(query);

    if (response.results.length === 0) {
      return '';
    }

    const contextParts = response.results.map((result, index) => {
      return `[Source ${index + 1}: ${result.source}]\n${result.content}\n`;
    });

    return contextParts.join('\n---\n\n');
  }
}
