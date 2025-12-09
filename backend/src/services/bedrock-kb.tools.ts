import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
  RetrieveAndGenerateCommand,
  RetrieveCommandInput,
  RetrieveAndGenerateCommandInput
} from '@aws-sdk/client-bedrock-agent-runtime';
import { Logger } from './logger.service.js';
import { config } from '../config/env.js';

/**
 * AWS Bedrock Knowledge Base Tools
 *
 * These tools allow the Claude agent to query AWS Bedrock Knowledge Bases
 * for semantic search and retrieval augmented generation (RAG).
 */

// Initialize Bedrock Agent Runtime client
const getBedrockClient = () => {
  const accessKeyId = config.awsAccessKeyId;
  const secretAccessKey = config.awsSecretAccessKey;
  const region = config.awsRegion;

  if (!accessKeyId || !secretAccessKey || !region) {
    throw new Error('AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION) are required');
  }

  return new BedrockAgentRuntimeClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
};

/**
 * Tool: bedrock_kb_retrieve
 *
 * Retrieve relevant documents from AWS Bedrock Knowledge Base using semantic search.
 * Returns raw chunks without generation - useful for finding specific information.
 */
const bedrockKbRetrieveTool = tool(
  'bedrock_kb_retrieve',
  'Retrieve relevant documents from AWS Bedrock Knowledge Base using semantic search. Returns document chunks with relevance scores.',
  {
    query: z.string()
      .describe('The search query to find relevant documents'),
    numberOfResults: z.number()
      .min(1)
      .max(100)
      .default(5)
      .describe('Number of results to return (default: 5, max: 100)'),
    knowledgeBaseId: z.string()
      .optional()
      .describe('Optional Knowledge Base ID (defaults to environment variable)')
  },
  async (args) => {
    try {
      const knowledgeBaseId = args.knowledgeBaseId || config.awsKnowledgeBaseId;

      if (!knowledgeBaseId) {
        throw new Error('Knowledge Base ID is required (provide in args or set AWS_KNOWLEDGE_BASE_ID)');
      }

      Logger.info('BEDROCK_KB_TOOL', 'Retrieving from Knowledge Base', {
        query: args.query,
        numberOfResults: args.numberOfResults,
        knowledgeBaseId
      });

      const client = getBedrockClient();

      const input: RetrieveCommandInput = {
        knowledgeBaseId,
        retrievalQuery: {
          text: args.query
        },
        retrievalConfiguration: {
          vectorSearchConfiguration: {
            numberOfResults: args.numberOfResults
          }
        }
      };

      const command = new RetrieveCommand(input);
      const response = await client.send(command);

      Logger.info('BEDROCK_KB_TOOL', 'Knowledge Base retrieval completed', {
        resultsCount: response.retrievalResults?.length || 0
      });

      // Format results for better readability
      const formattedResults = response.retrievalResults?.map((result, index) => ({
        rank: index + 1,
        score: result.score,
        content: result.content?.text,
        location: {
          type: result.location?.type || 'UNKNOWN',
          s3Location: result.location?.s3Location?.uri || undefined,
          webLocation: result.location?.webLocation?.url || undefined,
          confluenceLocation: (result.location?.confluenceLocation as any)?.url || undefined,
          salesforceLocation: (result.location?.salesforceLocation as any)?.url || undefined,
          sharePointLocation: (result.location?.sharePointLocation as any)?.url || undefined
        },
        metadata: result.metadata
      })) || [];

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query: args.query,
            knowledgeBaseId,
            totalResults: formattedResults.length,
            results: formattedResults
          }, null, 2)
        }]
      };
    } catch (error) {
      Logger.error('BEDROCK_KB_TOOL', 'Knowledge Base retrieval error', error);
      return {
        content: [{
          type: 'text',
          text: `Error retrieving from Knowledge Base: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
);

/**
 * Tool: bedrock_kb_query
 *
 * Query AWS Bedrock Knowledge Base with Retrieval Augmented Generation (RAG).
 * Retrieves relevant documents and generates a synthesized answer using a foundation model.
 */
const bedrockKbQueryTool = tool(
  'bedrock_kb_query',
  'Query AWS Bedrock Knowledge Base with RAG (Retrieval Augmented Generation). Retrieves relevant documents and generates a comprehensive answer.',
  {
    query: z.string()
      .describe('The question or query to answer using the knowledge base'),
    modelArn: z.string()
      .optional()
      .describe('Optional model ARN to use for generation (e.g., arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0)'),
    numberOfResults: z.number()
      .min(1)
      .max(100)
      .default(5)
      .describe('Number of documents to retrieve (default: 5, max: 100)'),
    knowledgeBaseId: z.string()
      .optional()
      .describe('Optional Knowledge Base ID (defaults to environment variable)')
  },
  async (args) => {
    try {
      const knowledgeBaseId = args.knowledgeBaseId || config.awsKnowledgeBaseId;

      if (!knowledgeBaseId) {
        throw new Error('Knowledge Base ID is required (provide in args or set AWS_KNOWLEDGE_BASE_ID)');
      }

      Logger.info('BEDROCK_KB_TOOL', 'Querying Knowledge Base with RAG', {
        query: args.query,
        numberOfResults: args.numberOfResults,
        knowledgeBaseId,
        modelArn: args.modelArn
      });

      const client = getBedrockClient();

      const input: RetrieveAndGenerateCommandInput = {
        input: {
          text: args.query
        },
        retrieveAndGenerateConfiguration: {
          type: 'KNOWLEDGE_BASE',
          knowledgeBaseConfiguration: {
            knowledgeBaseId,
            modelArn: args.modelArn || `arn:aws:bedrock:${config.awsRegion}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
            retrievalConfiguration: {
              vectorSearchConfiguration: {
                numberOfResults: args.numberOfResults
              }
            }
          }
        }
      };

      const command = new RetrieveAndGenerateCommand(input);
      const response = await client.send(command);

      Logger.info('BEDROCK_KB_TOOL', 'Knowledge Base query completed', {
        sessionId: response.sessionId,
        citationsCount: response.citations?.length || 0
      });

      // Format citations
      const formattedCitations = response.citations?.map((citation, index) => ({
        citationNumber: index + 1,
        generatedResponsePart: citation.generatedResponsePart?.textResponsePart?.text || '',
        retrievedReferences: citation.retrievedReferences?.map(ref => ({
          content: ref.content?.text || '',
          location: {
            type: ref.location?.type || 'UNKNOWN',
            s3Location: ref.location?.s3Location?.uri || undefined,
            webLocation: ref.location?.webLocation?.url || undefined,
            confluenceLocation: (ref.location?.confluenceLocation as any)?.url || undefined,
            salesforceLocation: (ref.location?.salesforceLocation as any)?.url || undefined,
            sharePointLocation: (ref.location?.sharePointLocation as any)?.url || undefined
          },
          metadata: ref.metadata
        }))
      })) || [];

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query: args.query,
            knowledgeBaseId,
            sessionId: response.sessionId,
            answer: response.output?.text,
            citations: formattedCitations
          }, null, 2)
        }]
      };
    } catch (error) {
      Logger.error('BEDROCK_KB_TOOL', 'Knowledge Base query error', error);
      return {
        content: [{
          type: 'text',
          text: `Error querying Knowledge Base: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
);

/**
 * Create and export the Bedrock Knowledge Base Tools MCP Server
 *
 * This server bundles all Bedrock KB-related tools and can be registered
 * with the Claude Agent SDK
 */
export const bedrockKbToolsServer = createSdkMcpServer({
  name: 'bedrock-kb-tools',
  version: '1.0.0',
  tools: [
    bedrockKbRetrieveTool,
    bedrockKbQueryTool
  ]
});
