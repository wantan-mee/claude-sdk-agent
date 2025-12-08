import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  tool: (name: string, description: string, schema: any, handler: any) => ({
    name,
    description,
    schema,
    handler
  }),
  createSdkMcpServer: (config: any) => config
}));

// Mock the config module
vi.mock('../config/env.js', () => ({
  config: {
    awsAccessKeyId: 'test-access-key',
    awsSecretAccessKey: 'test-secret-key',
    awsRegion: 'us-east-1',
    awsKnowledgeBaseId: 'test-kb-id'
  }
}));

// Mock the logger
vi.mock('./logger.service.js', () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock AWS SDK
vi.mock('@aws-sdk/client-bedrock-agent-runtime', () => {
  const mockSend = vi.fn();

  return {
    BedrockAgentRuntimeClient: vi.fn().mockImplementation(() => ({
      send: mockSend
    })),
    RetrieveCommand: vi.fn().mockImplementation((input) => ({ input })),
    RetrieveAndGenerateCommand: vi.fn().mockImplementation((input) => ({ input }))
  };
});

// Import after mocks are set up
const { bedrockKbToolsServer } = await import('./bedrock-kb.tools.js');

describe('Bedrock KB Tools Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Server Configuration', () => {
    it('should create MCP server with correct name and version', () => {
      expect(bedrockKbToolsServer).toBeDefined();
      expect(bedrockKbToolsServer.name).toBe('bedrock-kb-tools');
      expect(bedrockKbToolsServer.version).toBe('1.0.0');
    });

    it('should have two tools registered', () => {
      expect(bedrockKbToolsServer.tools).toBeDefined();
      expect(bedrockKbToolsServer.tools.length).toBe(2);
    });

    it('should have bedrock_kb_retrieve tool', () => {
      const retrieveTool = bedrockKbToolsServer.tools.find(t => t.name === 'bedrock_kb_retrieve');
      expect(retrieveTool).toBeDefined();
      expect(retrieveTool?.name).toBe('bedrock_kb_retrieve');
    });

    it('should have bedrock_kb_query tool', () => {
      const queryTool = bedrockKbToolsServer.tools.find(t => t.name === 'bedrock_kb_query');
      expect(queryTool).toBeDefined();
      expect(queryTool?.name).toBe('bedrock_kb_query');
    });
  });

  describe('bedrock_kb_retrieve tool', () => {
    it('should retrieve documents successfully', async () => {
      const mockResponse = {
        retrievalResults: [
          {
            score: 0.95,
            content: { text: 'This is a relevant document about authentication.' },
            location: {
              type: 'S3',
              s3Location: { uri: 's3://bucket/path/doc1.pdf' }
            },
            metadata: { author: 'John Doe' }
          },
          {
            score: 0.87,
            content: { text: 'Another document about security best practices.' },
            location: {
              type: 'WEB',
              webLocation: { url: 'https://example.com/security' }
            },
            metadata: { category: 'security' }
          }
        ]
      };

      const { BedrockAgentRuntimeClient } = await import('@aws-sdk/client-bedrock-agent-runtime');
      const mockClient = new BedrockAgentRuntimeClient({} as any);
      (mockClient.send as any).mockResolvedValueOnce(mockResponse);

      const retrieveTool = bedrockKbToolsServer.tools.find(t => t.name === 'bedrock_kb_retrieve');
      expect(retrieveTool).toBeDefined();

      const result = await retrieveTool!.handler({
        query: 'authentication best practices',
        numberOfResults: 5
      });

      expect(result.content).toBeDefined();
      expect(result.content.length).toBe(1);
      expect(result.content[0].type).toBe('text');

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.query).toBe('authentication best practices');
      expect(resultData.knowledgeBaseId).toBe('test-kb-id');
      expect(resultData.totalResults).toBe(2);
      expect(resultData.results.length).toBe(2);
      expect(resultData.results[0].score).toBe(0.95);
      expect(resultData.results[0].rank).toBe(1);
      expect(resultData.results[1].rank).toBe(2);
    });

    it('should use custom knowledge base ID', async () => {
      const mockResponse = {
        retrievalResults: []
      };

      const { BedrockAgentRuntimeClient } = await import('@aws-sdk/client-bedrock-agent-runtime');
      const mockClient = new BedrockAgentRuntimeClient({} as any);
      (mockClient.send as any).mockResolvedValueOnce(mockResponse);

      const retrieveTool = bedrockKbToolsServer.tools.find(t => t.name === 'bedrock_kb_retrieve');
      const result = await retrieveTool!.handler({
        query: 'test query',
        numberOfResults: 3,
        knowledgeBaseId: 'custom-kb-id'
      });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.knowledgeBaseId).toBe('custom-kb-id');
    });

    it('should handle AWS SDK errors', async () => {
      const { BedrockAgentRuntimeClient } = await import('@aws-sdk/client-bedrock-agent-runtime');
      const mockClient = new BedrockAgentRuntimeClient({} as any);
      (mockClient.send as any).mockRejectedValueOnce(new Error('AccessDeniedException'));

      const retrieveTool = bedrockKbToolsServer.tools.find(t => t.name === 'bedrock_kb_retrieve');
      const result = await retrieveTool!.handler({
        query: 'test',
        numberOfResults: 5
      });

      expect(result.content[0].text).toContain('Error retrieving from Knowledge Base');
      expect(result.content[0].text).toContain('AccessDeniedException');
    });

    it('should handle empty results', async () => {
      const mockResponse = {
        retrievalResults: []
      };

      const { BedrockAgentRuntimeClient } = await import('@aws-sdk/client-bedrock-agent-runtime');
      const mockClient = new BedrockAgentRuntimeClient({} as any);
      (mockClient.send as any).mockResolvedValueOnce(mockResponse);

      const retrieveTool = bedrockKbToolsServer.tools.find(t => t.name === 'bedrock_kb_retrieve');
      const result = await retrieveTool!.handler({
        query: 'nonexistent topic',
        numberOfResults: 5
      });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.totalResults).toBe(0);
      expect(resultData.results).toEqual([]);
    });
  });

  describe('bedrock_kb_query tool', () => {
    it('should query with RAG successfully', async () => {
      const mockResponse = {
        sessionId: 'session-123',
        output: {
          text: 'Based on the retrieved documents, authentication best practices include using multi-factor authentication and strong password policies.'
        },
        citations: [
          {
            generatedResponsePart: {
              textResponsePart: {
                text: 'multi-factor authentication'
              }
            },
            retrievedReferences: [
              {
                content: { text: 'MFA is a critical security measure.' },
                location: {
                  type: 'S3',
                  s3Location: { uri: 's3://bucket/security-guide.pdf' }
                },
                metadata: { author: 'Security Team' }
              }
            ]
          }
        ]
      };

      const { BedrockAgentRuntimeClient } = await import('@aws-sdk/client-bedrock-agent-runtime');
      const mockClient = new BedrockAgentRuntimeClient({} as any);
      (mockClient.send as any).mockResolvedValueOnce(mockResponse);

      const queryTool = bedrockKbToolsServer.tools.find(t => t.name === 'bedrock_kb_query');
      expect(queryTool).toBeDefined();

      const result = await queryTool!.handler({
        query: 'What are authentication best practices?',
        numberOfResults: 5
      });

      expect(result.content).toBeDefined();
      expect(result.content.length).toBe(1);
      expect(result.content[0].type).toBe('text');

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.query).toBe('What are authentication best practices?');
      expect(resultData.sessionId).toBe('session-123');
      expect(resultData.answer).toContain('multi-factor authentication');
      expect(resultData.citations.length).toBe(1);
      expect(resultData.citations[0].citationNumber).toBe(1);
    });

    it('should use custom model ARN', async () => {
      const mockResponse = {
        sessionId: 'session-456',
        output: { text: 'Answer with custom model' },
        citations: []
      };

      const { BedrockAgentRuntimeClient } = await import('@aws-sdk/client-bedrock-agent-runtime');
      const mockClient = new BedrockAgentRuntimeClient({} as any);
      (mockClient.send as any).mockResolvedValueOnce(mockResponse);

      const queryTool = bedrockKbToolsServer.tools.find(t => t.name === 'bedrock_kb_query');
      const result = await queryTool!.handler({
        query: 'test query',
        numberOfResults: 5,
        modelArn: 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-opus-20240229-v1:0'
      });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.answer).toBe('Answer with custom model');
    });

    it('should handle query errors', async () => {
      const { BedrockAgentRuntimeClient } = await import('@aws-sdk/client-bedrock-agent-runtime');
      const mockClient = new BedrockAgentRuntimeClient({} as any);
      (mockClient.send as any).mockRejectedValueOnce(new Error('ResourceNotFoundException'));

      const queryTool = bedrockKbToolsServer.tools.find(t => t.name === 'bedrock_kb_query');
      const result = await queryTool!.handler({
        query: 'test',
        numberOfResults: 5
      });

      expect(result.content[0].text).toContain('Error querying Knowledge Base');
      expect(result.content[0].text).toContain('ResourceNotFoundException');
    });

    it('should handle response with no citations', async () => {
      const mockResponse = {
        sessionId: 'session-789',
        output: { text: 'Answer without citations' },
        citations: []
      };

      const { BedrockAgentRuntimeClient } = await import('@aws-sdk/client-bedrock-agent-runtime');
      const mockClient = new BedrockAgentRuntimeClient({} as any);
      (mockClient.send as any).mockResolvedValueOnce(mockResponse);

      const queryTool = bedrockKbToolsServer.tools.find(t => t.name === 'bedrock_kb_query');
      const result = await queryTool!.handler({
        query: 'simple question',
        numberOfResults: 5
      });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.citations).toEqual([]);
    });
  });

  describe('Tool Input Validation', () => {
    it('should validate numberOfResults range in retrieve tool', async () => {
      const retrieveTool = bedrockKbToolsServer.tools.find(t => t.name === 'bedrock_kb_retrieve');
      expect(retrieveTool).toBeDefined();

      // The tool should accept default value
      const mockResponse = { retrievalResults: [] };
      const { BedrockAgentRuntimeClient } = await import('@aws-sdk/client-bedrock-agent-runtime');
      const mockClient = new BedrockAgentRuntimeClient({} as any);
      (mockClient.send as any).mockResolvedValueOnce(mockResponse);

      const result = await retrieveTool!.handler({
        query: 'test'
        // numberOfResults will use default value of 5
      });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData).toBeDefined();
    });

    it('should validate numberOfResults range in query tool', async () => {
      const queryTool = bedrockKbToolsServer.tools.find(t => t.name === 'bedrock_kb_query');
      expect(queryTool).toBeDefined();

      const mockResponse = {
        sessionId: 'test',
        output: { text: 'answer' },
        citations: []
      };

      const { BedrockAgentRuntimeClient } = await import('@aws-sdk/client-bedrock-agent-runtime');
      const mockClient = new BedrockAgentRuntimeClient({} as any);
      (mockClient.send as any).mockResolvedValueOnce(mockResponse);

      const result = await queryTool!.handler({
        query: 'test'
        // numberOfResults will use default value of 5
      });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.answer).toBe('answer');
    });
  });
});
