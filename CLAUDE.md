# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack chatbot application powered by Claude Agent SDK with real-time streaming capabilities. Built as a monorepo with Vue 3 + Vite frontend and Fastify backend (Node.js 21+). Claude SDK automatically manages conversation history via session IDs.

## Repository Structure

```
claude-sdk-agent/
├── frontend/          # Vue 3 + Vite with TypeScript
├── backend/           # Fastify server (Node.js 21+) with Claude Agent SDK
├── shared/            # Shared TypeScript types and utilities
└── data/              # User session tracking (single JSON file)
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
       SSE Connection (/api/chat/stream?userId=X)
       ↓
     Backend (Fastify + Node.js 21+)
       ↓
     Claude Agent SDK (streaming + auto history)
       ↓
     Session Tracking (/data/sessions.json)
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
- **Claude Integration**: `@anthropic-ai/claude-agent-sdk` package
- **Streaming**: SSE implementation in chat routes
- **Storage**: Simple JSON file for user → session ID mappings
- **Key Files**:
  - `src/index.ts` - Server entry point
  - `src/services/agent.service.ts` - Claude SDK integration with `resume` option
  - `src/services/storage.service.ts` - Session ID tracking
  - `src/routes/chat.routes.ts` - SSE streaming endpoints

**Storage Structure** (`/data`)
```
data/
└── sessions.json          # User → Claude Session ID mappings

# Claude SDK automatically stores conversation history at:
~/.claude/projects/{project-slug}/{session-id}.jsonl
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
import { query } from '@anthropic-ai/claude-agent-sdk';

// Stream responses with automatic history management
const response = query({
  prompt: userMessage,
  options: {
    resume: sessionId,  // SDK automatically loads conversation history
    model: 'claude-sonnet-4-5'
  }
});

let newSessionId: string | undefined;

// Process streaming messages
for await (const message of response) {
  // Capture session ID on first message
  if (message.type === 'system' && message.subtype === 'init') {
    newSessionId = message.session_id;
  }

  // Stream assistant responses
  if (message.type === 'assistant') {
    const content = message.message.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text') {
          onStream(block.text);
        }
      }
    }
  }
}

// Save session ID for next interaction
await saveUserSession(userId, newSessionId);
```

### Session Tracking Operations

```typescript
// storage.service.ts - Simplified session management
import fs from 'fs/promises';

interface UserSession {
  userId: string;
  sessionId: string;  // Claude SDK session ID
  createdAt: number;
  lastActivity: number;
}

// Get user's Claude session ID
static async getUserSession(userId: string): Promise<string | undefined> {
  const sessions = await this.loadSessions();
  return sessions.find(s => s.userId === userId)?.sessionId;
}

// Save/update user session mapping
static async saveUserSession(userId: string, sessionId: string): Promise<void> {
  const sessions = await this.loadSessions();
  const existingIndex = sessions.findIndex(s => s.userId === userId);

  const sessionData: UserSession = {
    userId,
    sessionId,
    createdAt: existingIndex >= 0 ? sessions[existingIndex].createdAt : Date.now(),
    lastActivity: Date.now()
  };

  if (existingIndex >= 0) {
    sessions[existingIndex] = sessionData;
  } else {
    sessions.push(sessionData);
  }

  await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}
```

## Important Technical Decisions

### 1. Streaming: Server-Sent Events (SSE)
- **Why**: Simpler than WebSocket, HTTP-based, sufficient for unidirectional streaming
- **Trade-off**: Not suitable for client → server real-time updates
- **Alternative**: Consider WebSocket if bidirectional real-time communication is needed

### 2. Storage: Minimal Session Tracking
- **Current**: Single JSON file mapping users to Claude session IDs
- **Why**: Claude SDK manages conversation history automatically
- **What We Store**: Only user ID → session ID mappings
- **What SDK Stores**: Complete conversation history in `~/.claude/projects/`
- **Migration Path**: Add database only if you need multi-session support per user

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

### Implementing "New Conversation" Feature
1. Clear user's session ID: `await StorageService.saveUserSession(userId, '')`
2. Next message will create a new Claude session automatically
3. Previous conversation remains in Claude's storage (can be accessed via old session ID)

### Accessing Conversation History
**Note**: Claude SDK manages history internally. To display history in UI:

**Option 1 - Client-side tracking (recommended)**:
```typescript
// Frontend tracks messages as they stream for display purposes
const messages = ref<DisplayMessage[]>([]);

for await (const message of response) {
  if (message.type === 'assistant') {
    messages.value.push({
      role: 'assistant',
      content: extractContent(message),
      timestamp: Date.now()
    });
  }
}

// Store in localStorage for persistence
localStorage.setItem(`messages-${userId}`, JSON.stringify(messages.value));
```

**Option 2 - Parse Claude's JSONL files (advanced)**:
```typescript
// Read ~/.claude/projects/{project-slug}/{session-id}.jsonl
// Not recommended: undocumented format, may change
```

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
- **Session Tracking**: Inspect `/data/sessions.json` for user → session mappings
- **Claude History**: Check `~/.claude/projects/` for conversation JSONL files
- **Claude SDK**: Enable debug logging with `DEBUG=anthropic:*`

### Common Issues
- **CORS errors**: Check `FRONTEND_URL` in backend `.env`
- **SSE not connecting**: Verify proper headers in streaming endpoint
- **Session not persisting**: Check if session ID is being saved correctly in `sessions.json`
- **History not loading**: Verify `resume` option is passed to Claude SDK with correct session ID
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
- Minimal overhead: just a single JSON file with session mappings
- Claude SDK handles conversation storage efficiently
- Optionally clean up old session mappings (>30 days inactive)
- No need for pagination - SDK handles large conversations automatically

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

## Storage Considerations

### Current Approach (Recommended for MVP)
- Single JSON file stores user → session ID mappings
- Claude SDK handles all conversation history automatically
- Simple, reliable, no database needed

### When to Add a Database
Consider migrating to database only if you need:
- **Multi-session per user**: Users managing multiple conversation threads
- **User authentication**: Secure user accounts and permissions
- **Session metadata search**: Find conversations by date, topic, etc.
- **Team/organization features**: Shared workspaces, collaboration

### Migration Strategy (If Needed)
1. Keep Claude SDK session management (don't store messages in DB)
2. Add database table: `user_sessions(user_id, session_id, title, created_at)`
3. Update `StorageService` to use database queries
4. Claude SDK continues managing conversation history automatically

## Resources

- **Claude Agent SDK**: https://docs.claude.com/en/api/agent-sdk/overview
- **Claude Agent SDK (GitHub)**: https://github.com/anthropics/claude-agent-sdk-typescript
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
