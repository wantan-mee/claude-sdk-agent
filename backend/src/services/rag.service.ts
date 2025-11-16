import { config } from '../config/env.js';
import { Logger } from './logger.service.js';
import { BedrockKBService, RetrievalResult } from './bedrock-kb.service.js';
import { QueryDecompositionService } from './query-decomposition.service.js';

export interface RAGContext {
  query: string;
  context: string;
  sources: string[];
  subQueries: string[];
  totalResults: number;
  processingTime: number;
}

export interface RAGStreamEvent {
  type: 'decomposition' | 'retrieval' | 'aggregation' | 'complete';
  message: string;
  data?: any;
}

export class RAGService {
  private static initialized = false;

  /**
   * Initialize RAG services
   */
  static async initialize(): Promise<void> {
    if (!config.enableRag) {
      Logger.info('RAG', 'RAG is disabled');
      return;
    }

    if (this.initialized) {
      return;
    }

    Logger.info('RAG', 'Initializing RAG service');

    // Initialize sub-services
    BedrockKBService.initialize();
    QueryDecompositionService.initialize();

    this.initialized = true;
    Logger.info('RAG', 'RAG service initialized successfully');
  }

  /**
   * Check if RAG is enabled and configured
   */
  static isEnabled(): boolean {
    return config.enableRag && !!config.ragBedrockKbId;
  }

  /**
   * Perform deep RAG retrieval with query decomposition and multi-hop
   */
  static async retrieveContext(
    query: string,
    onEvent?: (event: RAGStreamEvent) => void
  ): Promise<RAGContext> {
    if (!this.isEnabled()) {
      return {
        query,
        context: '',
        sources: [],
        subQueries: [],
        totalResults: 0,
        processingTime: 0,
      };
    }

    const overallTimer = Logger.startTimer();
    const allResults: Map<string, RetrievalResult> = new Map();
    const allSources: Set<string> = new Set();

    // Step 1: Decompose the query
    onEvent?.({
      type: 'decomposition',
      message: 'Analyzing question and generating sub-queries...',
    });

    const decomposed = await QueryDecompositionService.decomposeQuery(query);

    Logger.info('RAG', 'Query decomposed', {
      original: query.substring(0, 50),
      subQueries: decomposed.subQueries,
      reasoning: decomposed.reasoning,
    });

    onEvent?.({
      type: 'decomposition',
      message: `Generated ${decomposed.subQueries.length} sub-queries`,
      data: { subQueries: decomposed.subQueries, reasoning: decomposed.reasoning },
    });

    // Step 2: Retrieve for each sub-query
    for (let i = 0; i < decomposed.subQueries.length; i++) {
      const subQuery = decomposed.subQueries[i];

      onEvent?.({
        type: 'retrieval',
        message: `Searching knowledge base (${i + 1}/${decomposed.subQueries.length}): ${subQuery.substring(0, 50)}...`,
      });

      try {
        const response = await BedrockKBService.retrieve(subQuery);

        // Deduplicate results by content hash
        for (const result of response.results) {
          const contentKey = this.hashContent(result.content);
          if (!allResults.has(contentKey)) {
            allResults.set(contentKey, result);
            allSources.add(result.source);
          }
        }

        Logger.debug('RAG', `Sub-query ${i + 1} retrieved ${response.results.length} results`, {
          subQuery: subQuery.substring(0, 50),
          newResults: response.results.length,
          totalUnique: allResults.size,
        });
      } catch (error) {
        Logger.error('RAG', `Failed to retrieve for sub-query: ${subQuery}`, error);
      }
    }

    // Step 3: Aggregate and rank results
    onEvent?.({
      type: 'aggregation',
      message: `Aggregating ${allResults.size} unique results from ${decomposed.subQueries.length} searches...`,
    });

    const rankedResults = this.rankResults(Array.from(allResults.values()));

    // Step 4: Format context
    const context = this.formatContext(rankedResults, query);
    const processingTime = overallTimer();

    Logger.info('RAG', 'RAG retrieval complete', {
      query: query.substring(0, 50),
      totalResults: rankedResults.length,
      uniqueSources: allSources.size,
      processingTime,
    });

    onEvent?.({
      type: 'complete',
      message: `Retrieved ${rankedResults.length} relevant passages from ${allSources.size} sources`,
      data: {
        totalResults: rankedResults.length,
        sources: Array.from(allSources),
        processingTime,
      },
    });

    return {
      query,
      context,
      sources: Array.from(allSources),
      subQueries: decomposed.subQueries,
      totalResults: rankedResults.length,
      processingTime,
    };
  }

  /**
   * Simple content hashing for deduplication
   */
  private static hashContent(content: string): string {
    // Simple hash: use first 100 chars + length
    return `${content.substring(0, 100)}_${content.length}`;
  }

  /**
   * Rank results by relevance score
   */
  private static rankResults(results: RetrievalResult[]): RetrievalResult[] {
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Format retrieved results into a context string for the LLM
   */
  private static formatContext(results: RetrievalResult[], originalQuery: string): string {
    if (results.length === 0) {
      return '';
    }

    let context = `## Retrieved Knowledge Base Context

The following information was retrieved from the knowledge base to help answer the question: "${originalQuery}"

---

`;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const sourceLabel = this.extractSourceName(result.source);

      context += `### Document ${i + 1} [${sourceLabel}]
**Relevance Score:** ${(result.score * 100).toFixed(1)}%

${result.content}

---

`;
    }

    context += `
## Instructions for Using This Context

1. Use the retrieved information to provide accurate, comprehensive answers
2. If the context doesn't fully answer the question, acknowledge what information is missing
3. Cite specific documents by their number (e.g., "According to Document 1...")
4. Synthesize information from multiple documents when relevant
5. If you find contradictions between documents, note them

---

`;

    return context;
  }

  /**
   * Extract a readable source name from S3 URI or path
   */
  private static extractSourceName(source: string): string {
    try {
      // Handle S3 URIs
      if (source.startsWith('s3://')) {
        const parts = source.split('/');
        return parts[parts.length - 1] || source;
      }
      // Handle file paths
      const parts = source.split('/');
      return parts[parts.length - 1] || source;
    } catch {
      return source;
    }
  }

  /**
   * Augment a user message with RAG context
   */
  static async augmentPrompt(
    userMessage: string,
    onEvent?: (event: RAGStreamEvent) => void
  ): Promise<string> {
    if (!this.isEnabled()) {
      return userMessage;
    }

    const ragContext = await this.retrieveContext(userMessage, onEvent);

    if (!ragContext.context) {
      return userMessage;
    }

    // Prepend context to user message
    return `${ragContext.context}

## User Question

${userMessage}`;
  }
}
