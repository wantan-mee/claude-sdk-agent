# Claude SDK Agent Chatbot - Architecture & Planning

## Project Overview

Building a full-stack chatbot application powered by Claude Agent SDK with real-time streaming capabilities.

**Core Requirements:**
- Frontend with streaming message support
- Backend hosting Claude SDK Agent
- Flat file storage (no database initially)
- Real-time conversation experience

---

## Architecture Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │          Vue 3 + Vite + TypeScript                 │    │
│  │  - Chat UI Components                              │    │
│  │  - Streaming Message Handler                       │    │
│  │  - Real-time Updates (SSE/WebSocket)              │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    HTTP/SSE/WebSocket
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                         Backend                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │        Node.js 21+ Server (Fastify)                │    │
│  │  - REST API Endpoints                              │    │
│  │  - Streaming Response Handler                      │    │
│  │  - Session Management                              │    │
│  └────────────────────────────────────────────────────┘    │
│                            │                                 │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Claude Agent SDK Integration               │    │
│  │  - Agent Initialization                            │    │
│  │  - Message Processing                              │    │
│  │  - Tool/Function Calling                           │    │
│  └────────────────────────────────────────────────────┘    │
│                            │                                 │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────────┐    │
│  │          Session Tracking (Flat Files)             │    │
│  │  - User → Session ID Mapping (JSON)                │    │
│  │  - Session Metadata (JSON)                         │    │
│  │  Note: Claude SDK manages conversation history     │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
- **Framework**: Vue 3 (Composition API)
  - Why: Lightweight, excellent TypeScript support, reactive system ideal for real-time updates
- **Build Tool**: Vite
  - Why: Blazing fast dev server, optimized builds, first-class Vue support
- **Language**: TypeScript
- **Styling**: Tailwind CSS (fast, modern, responsive)
- **State Management**: Pinia (optional, may use composables instead)
- **Streaming**:
  - Option 1: Server-Sent Events (SSE) - simpler, HTTP-based
  - Option 2: WebSockets - bidirectional, more complex
  - **Recommendation**: Start with SSE for simplicity

### Backend
- **Runtime**: Node.js 21+
- **Framework**: Fastify
  - Why: Better performance, native TypeScript support, excellent SSE/streaming
- **Language**: TypeScript
- **SDK**: Claude Agent SDK (Anthropic)
- **Storage**:
  - Lightweight session tracking (JSON)
  - Claude SDK automatically manages conversation history
  - Only store: user ID → session ID mappings

### Development Tools
- **Package Manager**: pnpm (fast, efficient)
- **Monorepo**: Turborepo or pnpm workspaces
- **Linting**: ESLint + Prettier
- **Type Checking**: TypeScript strict mode

---

## Detailed Component Breakdown

### Frontend Components

#### 1. Chat Interface
```
/frontend/src
├── App.vue                     # Main app component
├── views/
│   └── ChatView.vue            # Main chat page
├── components/
│   ├── ChatContainer.vue       # Main chat wrapper
│   ├── MessageList.vue         # Scrollable message list
│   ├── Message.vue             # Individual message component
│   ├── StreamingMessage.vue    # Real-time streaming message
│   ├── InputBox.vue            # User input textarea
│   └── TypingIndicator.vue     # Loading/streaming indicator
├── composables/
│   ├── useChat.ts              # Chat logic composable
│   ├── useStreaming.ts         # SSE connection composable
│   └── useConversation.ts      # Conversation state management
├── services/
│   └── api-client.ts           # Backend API client
└── types/
    └── index.ts                # TypeScript type definitions
```

#### 2. Streaming Implementation (Frontend)
```typescript
// composables/useStreaming.ts - Vue 3 Composition API
import { ref } from 'vue';

export const useStreaming = (sessionId: string) => {
  const messages = ref([]);
  const streamingContent = ref('');
  const isStreaming = ref(false);

  const sendMessage = async (content: string) => {
    isStreaming.value = true;
    streamingContent.value = '';

    const eventSource = new EventSource(
      `/api/chat/stream?sessionId=${sessionId}&message=${encodeURIComponent(content)}`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'content_delta') {
        streamingContent.value += data.delta;
      } else if (data.type === 'message_complete') {
        messages.value.push(data.message);
        streamingContent.value = '';
        isStreaming.value = false;
        eventSource.close();
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

### Backend Components

#### 1. Server Structure
```
/backend/src
├── index.ts                    # Server entry point
├── config/
│   └── claude-sdk.ts           # SDK initialization
├── routes/
│   ├── chat.routes.ts          # Chat endpoints
│   └── session.routes.ts       # Session management
├── services/
│   ├── agent.service.ts        # Claude SDK agent logic
│   ├── storage.service.ts      # File storage operations
│   └── streaming.service.ts    # SSE/streaming logic
├── models/
│   ├── Conversation.ts         # Conversation model
│   ├── Message.ts              # Message model
│   └── Session.ts              # Session model
└── utils/
    ├── file-storage.ts         # File I/O utilities
    └── logger.ts               # Logging utility
```

#### 2. Claude SDK Integration
```typescript
// agent.service.ts - Core agent logic
import { query } from '@anthropic-ai/claude-agent-sdk';

export class ClaudeAgentService {
  /**
   * Process a chat message using Claude Agent SDK
   * The SDK automatically manages conversation history via session IDs
   */
  async processMessage(
    sessionId: string | undefined,
    userMessage: string,
    onStream: (delta: string) => void
  ) {
    // Use Claude Agent SDK's built-in session management
    const response = query({
      prompt: userMessage,
      options: {
        resume: sessionId,  // SDK loads history automatically
        model: 'claude-sonnet-4-5'
      }
    });

    let newSessionId: string | undefined;
    let fullResponse = '';

    // Stream response chunks
    for await (const message of response) {
      // Capture session ID from init message
      if (message.type === 'system' && message.subtype === 'init') {
        newSessionId = message.session_id;
      }

      // Stream assistant messages
      if (message.type === 'assistant') {
        const content = message.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text') {
              fullResponse += block.text;
              onStream(block.text);
            }
          }
        }
      }
    }

    return { sessionId: newSessionId, response: fullResponse };
  }
}
```

#### 3. Session Tracking (Simplified Storage)
```typescript
// storage.service.ts - Lightweight session management
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

interface UserSession {
  userId: string;
  sessionId: string;  // Claude SDK session ID
  createdAt: number;
  lastActivity: number;
}

export class StorageService {
  /**
   * Get Claude session ID for a user
   * Returns undefined if no active session
   */
  static async getUserSession(userId: string): Promise<string | undefined> {
    const sessions = await this.loadSessions();
    const userSession = sessions.find(s => s.userId === userId);
    return userSession?.sessionId;
  }

  /**
   * Create or update user session mapping
   */
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

    await this.saveSessions(sessions);
  }

  /**
   * Load all sessions from file
   */
  private static async loadSessions(): Promise<UserSession[]> {
    try {
      const data = await fs.readFile(SESSIONS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // File doesn't exist, create it
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(SESSIONS_FILE, JSON.stringify([], null, 2));
      return [];
    }
  }

  /**
   * Save sessions to file
   */
  private static async saveSessions(sessions: UserSession[]): Promise<void> {
    await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  }
}
```

#### 4. Streaming Endpoint (SSE)
```typescript
// chat.routes.ts
import { FastifyInstance } from 'fastify';
import { ClaudeAgentService } from '../services/agent.service.js';
import { StorageService } from '../services/storage.service.js';

export async function chatRoutes(fastify: FastifyInstance) {
  const agentService = new ClaudeAgentService();

  // SSE streaming endpoint
  fastify.get('/chat/stream', async (request, reply) => {
    const { userId, message } = request.query;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const onStream = (delta: string) => {
      reply.raw.write(`data: ${JSON.stringify({
        type: 'content_delta',
        delta
      })}\n\n`);
    };

    try {
      // Get existing session ID for this user (if any)
      const existingSessionId = await StorageService.getUserSession(userId);

      // Process message - SDK handles history via session ID
      const result = await agentService.processMessage(
        existingSessionId,
        message,
        onStream
      );

      // Save new/updated session ID
      if (result.sessionId) {
        await StorageService.saveUserSession(userId, result.sessionId);
      }

      // Send completion event with session ID
      reply.raw.write(`data: ${JSON.stringify({
        type: 'message_complete',
        sessionId: result.sessionId,
        message: { role: 'assistant', content: result.response }
      })}\n\n`);

      reply.raw.end();
    } catch (error) {
      reply.raw.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message
      })}\n\n`);
      reply.raw.end();
    }
  });

  // Get user session info
  fastify.get('/session/:userId', async (request) => {
    const { userId } = request.params;
    const sessionId = await StorageService.getUserSession(userId);
    return { userId, sessionId, hasSession: !!sessionId };
  });
}
```

---

## Data Models

### UserSession (Simplified)
```typescript
interface UserSession {
  userId: string;              // Your application's user ID
  sessionId: string;           // Claude SDK session ID
  createdAt: number;           // Timestamp when session created
  lastActivity: number;        // Last message timestamp
}
```

### Message (Frontend Display Only)
```typescript
// Optional: For client-side message display
interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}
```

**Note**: Conversation history is stored automatically by Claude Agent SDK in:
```
~/.claude/projects/{project-slug}/{session-id}.jsonl
```
You don't need to manage this storage yourself.

---

## File Storage Structure (Simplified)

```
/data
└── sessions.json               # User → Claude Session ID mappings

# Example sessions.json content:
[
  {
    "userId": "user-123",
    "sessionId": "claude-session-abc-456",
    "createdAt": 1704067200000,
    "lastActivity": 1704153600000
  }
]
```

**Conversation History**: Automatically managed by Claude SDK at:
```
~/.claude/projects/{project-slug}/{session-id}.jsonl
```

---

## API Design

### Endpoints

#### Chat Operations
- `GET /api/chat/stream?userId={id}&message={text}` - Stream chat response (SSE)
  - Automatically resumes conversation using stored session ID
  - Returns new session ID on first interaction

#### Session Management
- `GET /api/session/:userId` - Get user's session info
- `DELETE /api/session/:userId` - Clear user's session (start new conversation)

#### Health/Status
- `GET /api/health` - Server health check
- `GET /api/status` - Agent SDK status

---

## Development Workflow

### Project Setup Commands
```bash
# Initialize monorepo
pnpm init

# Create workspace structure
mkdir -p frontend backend shared

# Initialize Vue + Vite frontend
cd frontend && pnpm create vite@latest . --template vue-ts

# Initialize backend
cd ../backend && pnpm init

# Install dependencies
pnpm add -w typescript @types/node tsx

# Backend dependencies
cd backend
pnpm add fastify @fastify/cors
pnpm add @anthropic-ai/claude-agent-sdk
pnpm add -D @types/node tsx nodemon

# Frontend dependencies
cd ../frontend
pnpm add vue-router pinia
pnpm add -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Build & Run Commands
```bash
# Development (from root)
pnpm dev              # Run both frontend + backend concurrently

# Individual services
pnpm dev:frontend     # Vite dev server (port 5173)
pnpm dev:backend      # Backend dev server (port 8000)

# Production build
pnpm build            # Build both projects
pnpm start            # Start production servers

# Testing
pnpm test             # Run all tests
pnpm test:frontend    # Frontend tests
pnpm test:backend     # Backend tests

# Linting
pnpm lint             # Lint all code
pnpm format           # Format with Prettier
```

### Environment Variables

**Backend (.env)**
```bash
ANTHROPIC_API_KEY=sk-ant-...
PORT=8000
NODE_ENV=development
DATA_DIR=./data
FRONTEND_URL=http://localhost:5173
```

**Frontend (.env)**
```bash
VITE_API_URL=http://localhost:8000
```

---

## Implementation Phases

### Phase 1: Foundation (MVP)
- [ ] Setup monorepo structure
- [ ] Initialize Vue 3 + Vite frontend
- [ ] Initialize Fastify backend with Node.js 21+
- [ ] Integrate Claude Agent SDK with session management
- [ ] Implement user → session ID tracking (simple JSON file)
- [ ] Create basic chat UI
- [ ] Implement SSE streaming
- [ ] Test conversation continuity across page refreshes

### Phase 2: Enhancement
- [ ] Add client-side message display (track messages for UI)
- [ ] Implement "New Conversation" feature (clear session ID)
- [ ] Add error handling & retries
- [ ] Improve streaming performance
- [ ] Add loading states & animations
- [ ] Implement markdown rendering for messages
- [ ] Add code syntax highlighting

### Phase 3: Advanced Features
- [ ] Multi-session support per user (session list)
- [ ] Export conversations (parse Claude's JSONL files)
- [ ] Agent tools/function calling UI
- [ ] Conversation forking (use forkSession option)
- [ ] Response regeneration
- [ ] User authentication

### Phase 4: Production Ready (Future)
- [ ] Migrate to database (PostgreSQL/SQLite)
- [ ] Add authentication
- [ ] Rate limiting
- [ ] Monitoring & logging
- [ ] Docker deployment
- [ ] CI/CD pipeline

---

## Key Technical Decisions

### 1. Streaming Approach: SSE vs WebSocket
**Decision: Server-Sent Events (SSE)**

**Rationale:**
- Simpler to implement and debug
- Built on HTTP, works with existing infrastructure
- Native browser support with EventSource API
- Sufficient for unidirectional streaming (server → client)
- Automatic reconnection handling
- Less overhead than WebSocket for this use case

**When to switch to WebSocket:**
- Need bidirectional real-time communication
- Want to send binary data
- Need lower latency for frequent client → server messages

### 2. Monorepo vs Separate Repos
**Decision: Monorepo with pnpm workspaces**

**Rationale:**
- Shared TypeScript types between frontend/backend
- Easier dependency management
- Single source of truth
- Simplified local development
- Better for this project size

### 3. Backend Framework: Express vs Fastify
**Decision: Fastify**

**Rationale:**
- Better performance (2x faster than Express)
- Native TypeScript support
- Built-in schema validation
- Modern async/await architecture
- Excellent SSE/streaming support
- Growing ecosystem

### 4. Storage: Minimal Tracking
**Decision: Simple JSON file for user → session mapping**

**Rationale:**
- Claude Agent SDK handles conversation history automatically
- Only need to track: which user is using which Claude session
- Minimal storage = simpler code, fewer bugs
- Easy to migrate to database later if needed

**What we DON'T store:**
- ❌ Conversation messages (SDK stores this)
- ❌ Message history (SDK manages this)
- ❌ Complex conversation state (SDK handles this)

**What we DO store:**
- ✅ User ID → Claude Session ID mapping
- ✅ Session metadata (created date, last activity)

**Migration plan (if needed):**
- Phase 4: Move to SQLite/PostgreSQL for multi-session support
- Future: Add user authentication and session management

---

## Performance Considerations

### Frontend
- Vue 3 reactivity system for efficient updates
- Virtual scrolling for long message lists (vue-virtual-scroller)
- Optimistic UI updates with reactive refs
- Debounced input handling (VueUse utilities)
- Keep-alive for component caching

### Backend
- Connection pooling (when adding DB)
- File caching layer
- Async file I/O operations
- Stream backpressure handling
- Rate limiting per session

### Streaming Optimization
- Chunk size tuning (balance latency vs overhead)
- Compression for SSE messages
- Heartbeat/keepalive for long connections
- Graceful degradation on connection loss

---

## Security Considerations

### Current Scope (MVP)
- Environment variable for API key (never in code)
- Input validation/sanitization
- Rate limiting by session ID
- CORS configuration
- File path validation (prevent directory traversal)

### Future Security Enhancements
- Authentication & authorization
- API key rotation
- Encrypted storage
- Request signing
- Audit logging
- DDoS protection

---

## Testing Strategy

### Frontend Tests
- Component unit tests (Vitest + Vue Test Utils)
- Integration tests for chat flow
- E2E tests (Playwright or Cypress)
- Streaming behavior tests

### Backend Tests
- Unit tests for services
- Integration tests for API endpoints
- Storage layer tests
- Claude SDK mock tests
- SSE streaming tests

---

## Monitoring & Debugging

### Development
- Console logging with levels
- Request/response logging
- Error stack traces
- Browser DevTools for SSE inspection

### Production (Future)
- Application metrics (response times, error rates)
- Claude API usage tracking
- Storage usage monitoring
- User session analytics

---

## Next Steps

1. **Review & Validate Architecture**
   - Confirm streaming approach (SSE)
   - Confirm tech stack choices
   - Review any specific requirements

2. **Setup Development Environment**
   - Initialize monorepo
   - Create folder structure
   - Setup package.json scripts

3. **Implement Phase 1 MVP**
   - Backend: Claude SDK + SSE streaming
   - Frontend: Chat UI + SSE client
   - Storage: Flat file implementation

4. **Create CLAUDE.md**
   - Document architecture
   - Add development commands
   - Add key patterns and conventions

---

## Open Questions

1. **Claude Agent SDK Version**: Which version should we use? Latest stable?
2. **Session ID Generation**: Client-generated UUID or server-assigned?
3. **Message Limits**: Max conversation length before archiving?
4. **Deployment Target**: Local development only, or planning for cloud deployment?
5. **UI/UX Preferences**: Any specific design system or component library?
6. **Agent Capabilities**: What tools/functions should the agent have access to?

---

## References

- Claude Agent SDK Documentation: [To be added]
- Vue 3 Documentation: https://vuejs.org/
- Vite Documentation: https://vitejs.dev/
- Server-Sent Events: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
- Fastify Documentation: https://fastify.dev/
- Node.js 21 Documentation: https://nodejs.org/docs/latest-v21.x/api/
