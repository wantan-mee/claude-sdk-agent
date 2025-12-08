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
    confluenceHost: 'https://test-domain.atlassian.net',
    confluenceEmail: 'test@example.com',
    confluenceApiToken: 'test-token'
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
const { confluenceToolsServer } = await import('./confluence.tools.js');

describe('Confluence Tools Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('Server Configuration', () => {
    it('should create MCP server with correct name and version', () => {
      expect(confluenceToolsServer).toBeDefined();
      expect(confluenceToolsServer.name).toBe('confluence-tools');
      expect(confluenceToolsServer.version).toBe('1.0.0');
    });

    it('should have three tools registered', () => {
      expect(confluenceToolsServer.tools).toBeDefined();
      expect(confluenceToolsServer.tools.length).toBe(3);
    });

    it('should have confluence_search tool', () => {
      const searchTool = confluenceToolsServer.tools.find(t => t.name === 'confluence_search');
      expect(searchTool).toBeDefined();
      expect(searchTool?.name).toBe('confluence_search');
    });

    it('should have confluence_get_page tool', () => {
      const getTool = confluenceToolsServer.tools.find(t => t.name === 'confluence_get_page');
      expect(getTool).toBeDefined();
      expect(getTool?.name).toBe('confluence_get_page');
    });

    it('should have confluence_list_spaces tool', () => {
      const listTool = confluenceToolsServer.tools.find(t => t.name === 'confluence_list_spaces');
      expect(listTool).toBeDefined();
      expect(listTool?.name).toBe('confluence_list_spaces');
    });
  });

  describe('confluence_search tool', () => {
    it('should search Confluence pages successfully', async () => {
      const mockResponse = {
        size: 2,
        start: 0,
        limit: 20,
        results: [
          {
            id: '123',
            type: 'page',
            title: 'Test Page 1',
            space: { key: 'DOCS', name: 'Documentation' },
            excerpt: 'This is a test page',
            _links: { webui: '/spaces/DOCS/pages/123' },
            version: {
              when: '2024-01-01T00:00:00.000Z',
              by: { displayName: 'John Doe' }
            }
          },
          {
            id: '124',
            type: 'page',
            title: 'Test Page 2',
            space: { key: 'TECH', name: 'Technical Docs' },
            excerpt: 'Another test page',
            _links: { webui: '/spaces/TECH/pages/124' },
            version: {
              when: '2024-01-02T00:00:00.000Z',
              by: { displayName: 'Jane Smith' }
            }
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const searchTool = confluenceToolsServer.tools.find(t => t.name === 'confluence_search');
      expect(searchTool).toBeDefined();

      const result = await searchTool!.handler({
        cql: 'type=page AND space=DOCS',
        limit: 20,
        start: 0
      });

      expect(result.content).toBeDefined();
      expect(result.content.length).toBe(1);
      expect(result.content[0].type).toBe('text');

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.total).toBe(2);
      expect(resultData.results.length).toBe(2);
      expect(resultData.results[0].title).toBe('Test Page 1');
      expect(resultData.results[0].space).toBe('Documentation');
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      });

      const searchTool = confluenceToolsServer.tools.find(t => t.name === 'confluence_search');
      const result = await searchTool!.handler({
        cql: 'type=page',
        limit: 20,
        start: 0
      });

      expect(result.content[0].text).toContain('Error searching Confluence');
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const searchTool = confluenceToolsServer.tools.find(t => t.name === 'confluence_search');
      const result = await searchTool!.handler({
        cql: 'type=page',
        limit: 20,
        start: 0
      });

      expect(result.content[0].text).toContain('Network error');
    });
  });

  describe('confluence_get_page tool', () => {
    it('should get page by ID successfully', async () => {
      const mockPage = {
        id: '123',
        type: 'page',
        title: 'Test Page',
        space: { key: 'DOCS', name: 'Documentation' },
        version: {
          number: 5,
          when: '2024-01-01T00:00:00.000Z',
          by: { displayName: 'John Doe' },
          message: 'Updated content'
        },
        ancestors: [
          { id: '100', title: 'Parent Page' }
        ],
        body: {
          view: {
            value: '<p>This is the page content</p>'
          }
        },
        _links: { webui: '/spaces/DOCS/pages/123' },
        history: {
          createdDate: '2023-12-01T00:00:00.000Z',
          createdBy: { displayName: 'Jane Smith' }
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPage
      });

      const getTool = confluenceToolsServer.tools.find(t => t.name === 'confluence_get_page');
      const result = await getTool!.handler({
        pageId: '123',
        expand: 'body.view,version,space,ancestors'
      });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.id).toBe('123');
      expect(resultData.title).toBe('Test Page');
      expect(resultData.version.number).toBe(5);
      expect(resultData.ancestors.length).toBe(1);
      expect(resultData.ancestors[0].title).toBe('Parent Page');
    });

    it('should get page by space and title successfully', async () => {
      const mockSearchResponse = {
        results: [
          {
            id: '123',
            type: 'page',
            title: 'Test Page',
            space: { key: 'DOCS', name: 'Documentation' },
            body: {
              view: { value: '<p>Content</p>' }
            },
            version: {
              number: 1,
              when: '2024-01-01T00:00:00.000Z',
              by: { displayName: 'John Doe' }
            },
            ancestors: [],
            _links: { webui: '/spaces/DOCS/pages/123' }
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse
      });

      const getTool = confluenceToolsServer.tools.find(t => t.name === 'confluence_get_page');
      const result = await getTool!.handler({
        spaceKey: 'DOCS',
        title: 'Test Page',
        expand: 'body.view,version,space,ancestors'
      });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.title).toBe('Test Page');
      expect(resultData.space.key).toBe('DOCS');
    });

    it('should handle page not found', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] })
      });

      const getTool = confluenceToolsServer.tools.find(t => t.name === 'confluence_get_page');
      const result = await getTool!.handler({
        spaceKey: 'DOCS',
        title: 'Nonexistent Page',
        expand: 'body.view'
      });

      expect(result.content[0].text).toContain('Page not found');
    });

    it('should validate input parameters', async () => {
      const getTool = confluenceToolsServer.tools.find(t => t.name === 'confluence_get_page');
      const result = await getTool!.handler({
        expand: 'body.view'
      });

      expect(result.content[0].text).toContain('Either pageId or both spaceKey and title must be provided');
    });
  });

  describe('confluence_list_spaces tool', () => {
    it('should list spaces successfully', async () => {
      const mockResponse = {
        size: 2,
        start: 0,
        limit: 25,
        results: [
          {
            key: 'DOCS',
            name: 'Documentation',
            type: 'global',
            description: {
              plain: { value: 'Main documentation space' }
            },
            _links: { webui: '/spaces/DOCS' }
          },
          {
            key: 'TECH',
            name: 'Technical Docs',
            type: 'global',
            description: {
              plain: { value: 'Technical documentation' }
            },
            _links: { webui: '/spaces/TECH' }
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const listTool = confluenceToolsServer.tools.find(t => t.name === 'confluence_list_spaces');
      const result = await listTool!.handler({
        limit: 25,
        start: 0
      });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.total).toBe(2);
      expect(resultData.spaces.length).toBe(2);
      expect(resultData.spaces[0].key).toBe('DOCS');
      expect(resultData.spaces[0].name).toBe('Documentation');
      expect(resultData.spaces[0].description).toBe('Main documentation space');
    });

    it('should filter by space type', async () => {
      const mockResponse = {
        size: 1,
        start: 0,
        limit: 25,
        results: [
          {
            key: 'PERSONAL',
            name: 'Personal Space',
            type: 'personal',
            description: { plain: { value: 'My personal space' } },
            _links: { webui: '/spaces/PERSONAL' }
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const listTool = confluenceToolsServer.tools.find(t => t.name === 'confluence_list_spaces');
      const result = await listTool!.handler({
        type: 'personal',
        limit: 25,
        start: 0
      });

      const resultData = JSON.parse(result.content[0].text);
      expect(resultData.spaces.length).toBe(1);
      expect(resultData.spaces[0].type).toBe('personal');
    });

    it('should handle API errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden'
      });

      const listTool = confluenceToolsServer.tools.find(t => t.name === 'confluence_list_spaces');
      const result = await listTool!.handler({
        limit: 25,
        start: 0
      });

      expect(result.content[0].text).toContain('Error listing Confluence spaces');
    });
  });
});
