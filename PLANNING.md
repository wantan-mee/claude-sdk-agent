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
│  │          Next.js 14+ (App Router)                  │    │
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
│  │        Node.js Server (Express/Fastify)            │    │
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
│  │          Flat File Storage Layer                   │    │
│  │  - Conversation History (JSON)                     │    │
│  │  - User Sessions (JSON)                            │    │
│  │  - Agent State (JSON)                              │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
  - Why: Native streaming support, Server Components, excellent DX
- **Language**: TypeScript
- **UI Library**: React 18+
- **Styling**: Tailwind CSS (fast, modern, responsive)
- **Streaming**:
  - Option 1: Server-Sent Events (SSE) - simpler, HTTP-based
  - Option 2: WebSockets - bidirectional, more complex
  - **Recommendation**: Start with SSE for simplicity

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express or Fastify
  - Express: More familiar, extensive ecosystem
  - Fastify: Better performance, native TypeScript support
  - **Recommendation**: Fastify for performance + TS
- **Language**: TypeScript
- **SDK**: Claude Agent SDK (Anthropic)
- **Storage**:
  - File system with JSON files
  - Directory structure: `/data/sessions/{sessionId}/`

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
/frontend/app
├── page.tsx                    # Main chat page
├── components/
│   ├── ChatContainer.tsx       # Main chat wrapper
│   ├── MessageList.tsx         # Scrollable message list
│   ├── Message.tsx             # Individual message component
│   ├── StreamingMessage.tsx    # Real-time streaming message
│   ├── InputBox.tsx            # User input textarea
│   └── TypingIndicator.tsx     # Loading/streaming indicator
├── hooks/
│   ├── useChat.ts              # Chat logic hook
│   ├── useStreaming.ts         # SSE/WebSocket connection
│   └── useConversation.ts      # Conversation state management
└── lib/
    ├── api-client.ts           # Backend API client
    └── types.ts                # Shared TypeScript types
```

#### 2. Streaming Implementation (Frontend)
```typescript
// Approach: Server-Sent Events (SSE)
const useStreaming = (sessionId: string) => {
  const [messages, setMessages] = useState([]);
  const [streamingContent, setStreamingContent] = useState('');

  const sendMessage = async (content: string) => {
    const eventSource = new EventSource(
      `/api/chat/stream?sessionId=${sessionId}&message=${encodeURIComponent(content)}`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'content_delta') {
        setStreamingContent(prev => prev + data.delta);
      } else if (data.type === 'message_complete') {
        setMessages(prev => [...prev, data.message]);
        setStreamingContent('');
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };
  };

  return { messages, streamingContent, sendMessage };
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
import { Agent } from '@anthropic-ai/sdk-agent';

export class ClaudeAgentService {
  private agent: Agent;

  constructor() {
    this.agent = new Agent({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-5-sonnet-20241022',
    });
  }

  async processMessage(
    sessionId: string,
    userMessage: string,
    onStream: (delta: string) => void
  ) {
    // Load conversation history from file
    const history = await this.loadHistory(sessionId);

    // Send to Claude SDK with streaming
    const response = await this.agent.chat({
      messages: [...history, { role: 'user', content: userMessage }],
      stream: true,
    });

    // Handle streaming response
    let fullResponse = '';
    for await (const chunk of response) {
      if (chunk.type === 'content_block_delta') {
        fullResponse += chunk.delta.text;
        onStream(chunk.delta.text);
      }
    }

    // Save to file storage
    await this.saveMessage(sessionId, userMessage, fullResponse);

    return fullResponse;
  }

  private async loadHistory(sessionId: string) {
    // Load from flat file
    return StorageService.loadConversation(sessionId);
  }

  private async saveMessage(sessionId: string, user: string, assistant: string) {
    // Save to flat file
    await StorageService.appendMessages(sessionId, [
      { role: 'user', content: user, timestamp: Date.now() },
      { role: 'assistant', content: assistant, timestamp: Date.now() }
    ]);
  }
}
```

#### 3. Storage Layer (Flat Files)
```typescript
// storage.service.ts
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

export class StorageService {
  static async loadConversation(sessionId: string) {
    const filePath = path.join(DATA_DIR, 'sessions', sessionId, 'messages.json');

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // Create new session file
      await this.initializeSession(sessionId);
      return [];
    }
  }

  static async appendMessages(sessionId: string, messages: Message[]) {
    const filePath = path.join(DATA_DIR, 'sessions', sessionId, 'messages.json');
    const existing = await this.loadConversation(sessionId);
    const updated = [...existing, ...messages];

    await fs.writeFile(filePath, JSON.stringify(updated, null, 2));
  }

  static async initializeSession(sessionId: string) {
    const sessionDir = path.join(DATA_DIR, 'sessions', sessionId);
    await fs.mkdir(sessionDir, { recursive: true });
    await fs.writeFile(
      path.join(sessionDir, 'messages.json'),
      JSON.stringify([], null, 2)
    );
    await fs.writeFile(
      path.join(sessionDir, 'metadata.json'),
      JSON.stringify({
        id: sessionId,
        createdAt: Date.now(),
        lastActivity: Date.now()
      }, null, 2)
    );
  }
}
```

#### 4. Streaming Endpoint (SSE)
```typescript
// chat.routes.ts
import { FastifyInstance } from 'fastify';

export async function chatRoutes(fastify: FastifyInstance) {
  // SSE streaming endpoint
  fastify.get('/chat/stream', async (request, reply) => {
    const { sessionId, message } = request.query;

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
      const response = await agentService.processMessage(
        sessionId,
        message,
        onStream
      );

      // Send completion event
      reply.raw.write(`data: ${JSON.stringify({
        type: 'message_complete',
        message: { role: 'assistant', content: response }
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

  // Get conversation history
  fastify.get('/chat/history/:sessionId', async (request) => {
    const { sessionId } = request.params;
    return StorageService.loadConversation(sessionId);
  });
}
```

---

## Data Models

### Message
```typescript
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  id?: string;
  metadata?: Record<string, any>;
}
```

### Conversation
```typescript
interface Conversation {
  sessionId: string;
  messages: Message[];
  createdAt: number;
  lastActivity: number;
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
  };
}
```

### Session
```typescript
interface Session {
  id: string;
  createdAt: number;
  lastActivity: number;
  messageCount: number;
}
```

---

## File Storage Structure

```
/data
├── sessions/
│   ├── session-abc123/
│   │   ├── messages.json       # Conversation history
│   │   └── metadata.json       # Session metadata
│   ├── session-def456/
│   │   ├── messages.json
│   │   └── metadata.json
│   └── ...
└── sessions.index.json         # Quick lookup of all sessions
```

---

## API Design

### Endpoints

#### Chat Operations
- `GET /api/chat/stream?sessionId={id}&message={text}` - Stream chat response (SSE)
- `GET /api/chat/history/:sessionId` - Get conversation history
- `POST /api/chat/message` - Send message (non-streaming fallback)

#### Session Management
- `POST /api/session/create` - Create new session
- `GET /api/session/:sessionId` - Get session details
- `GET /api/sessions` - List all sessions
- `DELETE /api/session/:sessionId` - Delete session

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

# Initialize Next.js frontend
cd frontend && pnpm create next-app@latest . --typescript --tailwind --app

# Initialize backend
cd ../backend && pnpm init

# Install dependencies
pnpm add -w typescript @types/node tsx

# Backend dependencies
cd backend
pnpm add fastify @fastify/cors
pnpm add @anthropic-ai/sdk-agent
pnpm add -D @types/node tsx nodemon

# Frontend dependencies
cd ../frontend
pnpm add eventsource-parser
```

### Build & Run Commands
```bash
# Development (from root)
pnpm dev              # Run both frontend + backend concurrently

# Individual services
pnpm dev:frontend     # Next.js dev server (port 3000)
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
FRONTEND_URL=http://localhost:3000
```

**Frontend (.env.local)**
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Implementation Phases

### Phase 1: Foundation (MVP)
- [ ] Setup monorepo structure
- [ ] Initialize Next.js frontend
- [ ] Initialize Fastify backend
- [ ] Integrate Claude Agent SDK
- [ ] Implement flat file storage
- [ ] Create basic chat UI
- [ ] Implement SSE streaming
- [ ] Basic session management

### Phase 2: Enhancement
- [ ] Add conversation history UI
- [ ] Implement session persistence
- [ ] Add error handling & retries
- [ ] Improve streaming performance
- [ ] Add loading states & animations
- [ ] Implement markdown rendering for messages
- [ ] Add code syntax highlighting

### Phase 3: Advanced Features
- [ ] Multi-session support (tabs/sidebar)
- [ ] Export conversations
- [ ] Search conversation history
- [ ] Agent tools/function calling UI
- [ ] Conversation branching/editing
- [ ] Response regeneration

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

### 4. Storage: Flat Files vs Database
**Decision: Flat Files (Phase 1)**

**Rationale:**
- Simpler initial implementation
- No database setup/maintenance
- Easy to inspect and debug
- Sufficient for MVP/testing
- Easy migration path to database later

**Migration plan:**
- Phase 4: Move to SQLite (single file, no server)
- Future: PostgreSQL for production scale

---

## Performance Considerations

### Frontend
- React Server Components for initial render
- Client-side state for real-time updates
- Virtualized message list for long conversations
- Optimistic UI updates
- Debounced input handling

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
- Component unit tests (Jest + React Testing Library)
- Integration tests for chat flow
- E2E tests (Playwright)
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
- Next.js Streaming: https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming
- Server-Sent Events: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
- Fastify Documentation: https://fastify.dev/
