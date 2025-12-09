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
    jiraHost: 'https://test-domain.atlassian.net',
    jiraEmail: 'test@example.com',
    jiraApiToken: 'test-token'
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

// Import after mocks are set up
const { jiraToolsServer } = await import('./jira.tools.js');

describe('Jira Tools Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('Server Configuration', () => {
    it('should create MCP server with correct name and version', () => {
      expect(jiraToolsServer).toBeDefined();
      expect(jiraToolsServer.name).toBe('jira-tools');
      expect(jiraToolsServer.version).toBe('1.0.0');
    });

    it('should have three tools registered', () => {
      expect(jiraToolsServer.tools).toBeDefined();
      expect(jiraToolsServer.tools.length).toBe(3);
    });

    it('should have jira_search tool', () => {
      const searchTool = jiraToolsServer.tools.find(t => t.name === 'jira_search');
      expect(searchTool).toBeDefined();
      expect(searchTool?.name).toBe('jira_search');
    });

    it('should have jira_get_issue tool', () => {
      const getTool = jiraToolsServer.tools.find(t => t.name === 'jira_get_issue');
      expect(getTool).toBeDefined();
      expect(getTool?.name).toBe('jira_get_issue');
    });

    it('should have jira_create_issue tool', () => {
      const createTool = jiraToolsServer.tools.find(t => t.name === 'jira_create_issue');
      expect(createTool).toBeDefined();
      expect(createTool?.name).toBe('jira_create_issue');
    });
  });

  describe('jira_search tool', () => {
    it('should search Jira issues successfully', async () => {
      const mockResponse = {
        total: 2,
        startAt: 0,
        maxResults: 20,
        issues: [
          {
            key: 'PROJ-123',
            fields: {
              summary: 'Test issue 1',
              status: { name: 'Open' },
              assignee: { displayName: 'John Doe' },
              priority: { name: 'High' },
              description: 'Test description',
              created: '2024-01-01T00:00:00.000Z',
              updated: '2024-01-02T00:00:00.000Z'
            }
          },
          {
            key: 'PROJ-124',
            fields: {
              summary: 'Test issue 2',
              status: { name: 'In Progress' },
              assignee: null,
              priority: { name: 'Medium' },
              description: 'Another test',
              created: '2024-01-03T00:00:00.000Z',
              updated: '2024-01-04T00:00:00.000Z'
            }
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const searchTool = jiraToolsServer.tools.find(t => t.name === 'jira_search');
      expect(searchTool).toBeDefined();

      const result = await searchTool!.handler({
        jql: 'project = PROJ AND status = Open',
        maxResults: 20,
        startAt: 0
      });

      expect(result.content).toBeDefined();
      expect(result.content.length).toBe(1);
      expect(result.content[0].type).toBe('text');

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.total).toBe(2);
      expect(resultData.issues.length).toBe(2);
      expect(resultData.issues[0].key).toBe('PROJ-123');
      expect(resultData.issues[0].summary).toBe('Test issue 1');
      expect(resultData.issues[1].assignee).toBe('Unassigned');
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      });

      const searchTool = jiraToolsServer.tools.find(t => t.name === 'jira_search');
      const result = await searchTool!.handler({
        jql: 'project = PROJ',
        maxResults: 20,
        startAt: 0
      });

      expect(result.content[0].text).toContain('Error searching Jira');
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const searchTool = jiraToolsServer.tools.find(t => t.name === 'jira_search');
      const result = await searchTool!.handler({
        jql: 'project = PROJ',
        maxResults: 20,
        startAt: 0
      });

      expect(result.content[0].text).toContain('Network error');
    });
  });

  describe('jira_get_issue tool', () => {
    it('should get issue details successfully', async () => {
      const mockIssue = {
        key: 'PROJ-123',
        fields: {
          summary: 'Test issue',
          description: 'Test description',
          status: { name: 'Open' },
          assignee: { displayName: 'John Doe' },
          reporter: { displayName: 'Jane Smith' },
          priority: { name: 'High' },
          issuetype: { name: 'Bug' },
          created: '2024-01-01T00:00:00.000Z',
          updated: '2024-01-02T00:00:00.000Z',
          labels: ['bug', 'urgent'],
          components: [{ name: 'Backend' }]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockIssue
      });

      const getTool = jiraToolsServer.tools.find(t => t.name === 'jira_get_issue');
      const result = await getTool!.handler({
        issueKey: 'PROJ-123'
      });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.key).toBe('PROJ-123');
      expect(resultData.summary).toBe('Test issue');
      expect(resultData.labels).toEqual(['bug', 'urgent']);
      expect(resultData.components).toEqual(['Backend']);
    });

    it('should handle 404 errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Issue not found'
      });

      const getTool = jiraToolsServer.tools.find(t => t.name === 'jira_get_issue');
      const result = await getTool!.handler({
        issueKey: 'PROJ-999'
      });

      expect(result.content[0].text).toContain('Error getting Jira issue');
    });
  });

  describe('jira_create_issue tool', () => {
    it('should create issue successfully', async () => {
      const mockResult = {
        key: 'PROJ-125',
        id: '12345'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult
      });

      const createTool = jiraToolsServer.tools.find(t => t.name === 'jira_create_issue');
      const result = await createTool!.handler({
        projectKey: 'PROJ',
        issueType: 'Bug',
        summary: 'New test issue',
        description: 'This is a test'
      });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.success).toBe(true);
      expect(resultData.key).toBe('PROJ-125');
      expect(resultData.id).toBe('12345');
      expect(resultData.message).toContain('PROJ-125 created successfully');
    });

    it('should handle creation errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid project key'
      });

      const createTool = jiraToolsServer.tools.find(t => t.name === 'jira_create_issue');
      const result = await createTool!.handler({
        projectKey: 'INVALID',
        issueType: 'Bug',
        summary: 'Test'
      });

      expect(result.content[0].text).toContain('Error creating Jira issue');
    });
  });
});
