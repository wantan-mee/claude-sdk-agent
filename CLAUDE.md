# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack chatbot application powered by Claude Agent SDK with real-time streaming capabilities. Built as a monorepo with Vue 3 + Vite frontend and Fastify backend (Node.js 21+) using flat file storage.

## Repository Structure

```
claude-sdk-agent/
├── frontend/          # Vue 3 + Vite with TypeScript
├── backend/           # Fastify server (Node.js 21+) with Claude Agent SDK
├── shared/            # Shared TypeScript types and utilities
└── data/              # Flat file storage (sessions, conversations)
```

## Development Commands

### Setup
```bash
# Install all dependencies (from root)
pnpm install

# Setup environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Running the Application
```bash
# Run both frontend and backend concurrently (from root)
pnpm dev

# Run services individually
pnpm dev:frontend    # Vite dev server (http://localhost:5173)
pnpm dev:backend     # Fastify server (http://localhost:8000)
```

### Building
```bash
# Build both projects
pnpm build

# Build individually
pnpm build:frontend
pnpm build:backend

# Start production servers
pnpm start
```

### Testing
```bash
# Run all tests
pnpm test

# Test specific workspace
pnpm test:frontend
pnpm test:backend

# Run tests in watch mode
pnpm test:watch
```

### Code Quality
```bash
# Lint all code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code with Prettier
pnpm format

# Type checking
pnpm type-check
```

## Architecture Overview

### Request Flow
```
User → Frontend (Vue 3 + Vite)
       ↓
       SSE Connection (/api/chat/stream)
       ↓
     Backend (Fastify + Node.js 21+)
       ↓
     Claude Agent SDK (streaming)
       ↓
     Flat File Storage (/data/sessions/)
```

### Key Components

**Frontend (`/frontend`)**
- **Framework**: Vue 3 with Composition API
- **Build Tool**: Vite for fast dev server and optimized builds
- **Streaming**: Server-Sent Events (SSE) via EventSource API
- **State Management**: Vue composables (ref, reactive) with custom composables
- **UI**: Tailwind CSS for styling, responsive design
- **Key Files**:
  - `src/App.vue` - Main app component
  - `src/views/ChatView.vue` - Main chat interface
  - `src/composables/useStreaming.ts` - SSE connection and streaming logic
  - `src/services/api-client.ts` - Backend API client

**Backend (`/backend`)**
- **Runtime**: Node.js 21+
- **Framework**: Fastify with TypeScript
- **Claude Integration**: `@anthropic-ai/sdk-agent` package
- **Streaming**: SSE implementation in chat routes
- **Storage**: JSON flat files in `/data/sessions/{sessionId}/`
- **Key Files**:
  - `src/index.ts` - Server entry point
  - `src/services/agent.service.ts` - Claude SDK integration
  - `src/services/storage.service.ts` - File I/O operations
  - `src/routes/chat.routes.ts` - SSE streaming endpoints

**Storage Structure** (`/data`)
```
data/
├── sessions/
│   └── {sessionId}/
│       ├── messages.json     # Conversation history
│       └── metadata.json     # Session metadata
└── sessions.index.json       # Quick session lookup
```

## Critical Patterns & Conventions

### Streaming Implementation

**Frontend (SSE Client - Vue Composable)**
```typescript
// composables/useStreaming.ts - Vue 3 Composition API
import { ref } from 'vue';

export const useStreaming = (sessionId: string) => {
  const messages = ref([]);
  const streamingContent = ref('');
  const isStreaming = ref(false);

  const sendMessage = async (content: string) => {
    isStreaming.value = true;
    const eventSource = new EventSource(
      `/api/chat/stream?sessionId=${sessionId}&message=${encodeURIComponent(content)}`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Handle: content_delta, message_complete, error
      if (data.type === 'content_delta') {
        streamingContent.value += data.delta;
      }
    };

    eventSource.onerror = () => {
      isStreaming.value = false;
      eventSource.close();
    };
  };

  return { messages, streamingContent, isStreaming, sendMessage };
};
```

**Backend (SSE Server)**
```typescript
// Set proper headers for SSE
reply.raw.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
});

// Send formatted SSE messages
reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
```

### Claude Agent SDK Usage

```typescript
// Initialize agent
const agent = new Agent({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
});

// Stream responses
const response = await agent.chat({
  messages: conversationHistory,
  stream: true,
});

// Process streaming chunks
for await (const chunk of response) {
  if (chunk.type === 'content_block_delta') {
    onStream(chunk.delta.text);
  }
}
```

### File Storage Operations

```typescript
// Always use async file operations
await fs.readFile(filePath, 'utf-8');
await fs.writeFile(filePath, data);

// Create directories recursively
await fs.mkdir(sessionDir, { recursive: true });

// Path validation - prevent directory traversal
const safePath = path.join(DATA_DIR, path.normalize(sessionId).replace(/^(\.\.(\/|\\|$))+/, ''));
```

## Important Technical Decisions

### 1. Streaming: Server-Sent Events (SSE)
- **Why**: Simpler than WebSocket, HTTP-based, sufficient for unidirectional streaming
- **Trade-off**: Not suitable for client → server real-time updates
- **Alternative**: Consider WebSocket if bidirectional real-time communication is needed

### 2. Storage: Flat Files (JSON)
- **Current**: Simple JSON files in `/data/sessions/`
- **Why**: No database setup, easy debugging, sufficient for MVP
- **Migration Path**: SQLite → PostgreSQL when scaling needed
- **Considerations**:
  - No concurrent write protection (add file locking if multiple backend instances)
  - No query optimization (add indexing/caching if performance issues)

### 3. Monorepo: pnpm Workspaces
- **Why**: Shared types, unified dependency management, simpler deployment
- **Structure**: Separate `frontend/`, `backend/`, `shared/` workspaces
- **Shared Code**: Place shared TypeScript types/utils in `/shared` workspace

### 4. Backend: Fastify over Express
- **Why**: Better performance, native TypeScript support, modern async/await
- **Plugin System**: Use Fastify plugins for modular route registration
- **Schema Validation**: Leverage Fastify's built-in JSON schema validation

## Environment Configuration

### Backend Environment Variables
```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...    # Claude API key
PORT=8000                        # Server port

# Optional
NODE_ENV=development             # Environment
DATA_DIR=./data                  # Storage directory
FRONTEND_URL=http://localhost:5173  # CORS origin
```

### Frontend Environment Variables
```bash
VITE_API_URL=http://localhost:8000  # Backend API URL
```

## Common Development Tasks

### Adding a New API Endpoint
1. Create route handler in `/backend/src/routes/`
2. Register route in `/backend/src/index.ts`
3. Add TypeScript types in `/shared/types/`
4. Update API client in `/frontend/src/services/api-client.ts`
5. Add error handling and validation

### Adding a New UI Component
1. Create component in `/frontend/src/components/`
2. Use TypeScript for props with `defineProps<PropsInterface>()`
3. Style with Tailwind CSS classes
4. Use Composition API with `<script setup lang="ts">`
5. Write component tests with Vitest + Vue Test Utils

### Modifying Storage Structure
1. Update types in `/shared/types/`
2. Create migration utility in `/backend/src/utils/migration.ts`
3. Update `StorageService` methods
4. Test with existing data files
5. Document changes in PLANNING.md

### Adding Agent Tools/Functions
1. Define tool schema in `/backend/src/services/agent.service.ts`
2. Implement tool handler function
3. Register tool with Claude Agent SDK
4. Update frontend to display tool usage
5. Add error handling for tool failures

## Testing Guidelines

### Frontend Testing
- **Unit Tests**: Components with Vitest + Vue Test Utils
- **Integration Tests**: User flows and API interactions
- **E2E Tests**: Full chat scenarios with Playwright or Cypress
- **Mock**: Backend API responses for isolated testing

### Backend Testing
- **Unit Tests**: Services and utilities with Jest
- **Integration Tests**: API endpoints with supertest
- **Mock**: Claude SDK responses for consistent testing
- **Storage Tests**: File operations with temp directories

### Testing SSE/Streaming
```typescript
// Test SSE endpoint with supertest
const response = await request(app)
  .get('/api/chat/stream')
  .query({ sessionId: 'test', message: 'hello' })
  .set('Accept', 'text/event-stream')
  .expect('Content-Type', /text\/event-stream/)
  .expect(200);
```

## Debugging Tips

### Frontend Debugging
- **SSE Connection**: Use Chrome DevTools → Network → EventStream to inspect SSE messages
- **Vue State**: Use Vue DevTools to inspect component state and reactive refs
- **API Calls**: Check Network tab for failed requests
- **Vite HMR**: Check console for Hot Module Replacement errors

### Backend Debugging
- **Logs**: Check console output for service logs
- **SSE**: Test endpoints with `curl` or tools like `websocat`
- **File Storage**: Inspect `/data/sessions/` directory for stored data
- **Claude SDK**: Enable debug logging with `DEBUG=anthropic:*`

### Common Issues
- **CORS errors**: Check `FRONTEND_URL` in backend `.env`
- **SSE not connecting**: Verify proper headers in streaming endpoint
- **File not found**: Ensure `DATA_DIR` exists and has write permissions
- **API key issues**: Verify `ANTHROPIC_API_KEY` is valid and not expired

## Performance Optimization

### Frontend
- Leverage Vue 3 reactivity system for efficient updates
- Implement virtual scrolling for long message lists (vue-virtual-scroller)
- Debounce user input (300ms) with VueUse utilities
- Use `computed` for derived state and `watchEffect` sparingly
- Keep-alive for component caching when needed

### Backend
- Use streaming to reduce time-to-first-byte
- Implement file caching for frequently accessed sessions
- Add rate limiting per session
- Use async file I/O operations

### Storage
- Keep index file for quick session lookup
- Archive old sessions (>30 days inactive)
- Implement pagination for message history
- Consider compression for large conversations

## Security Considerations

### Current Implementation
- API key stored in environment variable (never commit)
- Input sanitization for user messages
- File path validation to prevent directory traversal
- CORS configuration to restrict origins

### Future Enhancements
- Add authentication/authorization
- Implement rate limiting per user
- Add request validation with JSON schemas
- Consider encrypting stored conversations

## Migration Path to Database

When scaling beyond flat files:

1. **Phase 1**: Add SQLite (single-file database, minimal setup)
   - Keep file-based interface, swap storage backend
   - No infrastructure changes needed

2. **Phase 2**: PostgreSQL for production
   - Better concurrency support
   - Full-text search capabilities
   - Better performance at scale

3. **Migration Strategy**:
   - Create database schema matching current JSON structure
   - Write migration script to import existing files
   - Update `StorageService` to use database queries
   - Keep same API interface for backward compatibility

## Resources

- **Claude Agent SDK**: [Documentation Link]
- **Vue 3 Documentation**: https://vuejs.org/
- **Vite Documentation**: https://vitejs.dev/
- **Server-Sent Events**: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
- **Fastify**: https://fastify.dev/
- **Node.js 21 Documentation**: https://nodejs.org/docs/latest-v21.x/api/
- **pnpm Workspaces**: https://pnpm.io/workspaces
- **VueUse**: https://vueuse.org/ (Composable utilities)

## Project Status

**Current Phase**: Planning & Architecture Design
**Next Steps**: Initialize monorepo structure and implement Phase 1 MVP

See `PLANNING.md` for detailed implementation phases and technical specifications.
