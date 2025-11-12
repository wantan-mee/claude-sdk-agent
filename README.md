# Claude SDK Agent Chatbot

Full-stack chatbot application powered by Claude Agent SDK with real-time streaming capabilities.

## Features

- 🤖 **Claude Agent SDK Integration** - Powered by Anthropic's Claude Agent SDK
- 💬 **Real-time Streaming** - Server-Sent Events (SSE) for instant message delivery
- 🎨 **Modern UI** - Vue 3 + Vite with Tailwind CSS
- 🔄 **Conversation Continuity** - Automatic session management across page refreshes
- 📦 **Monorepo Architecture** - Frontend, backend, and shared types in one repo
- 🚀 **TypeScript** - Full type safety across the stack

## Tech Stack

### Frontend
- **Framework**: Vue 3 (Composition API)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Language**: TypeScript

### Backend
- **Runtime**: Node.js 21+
- **Framework**: Fastify
- **SDK**: Claude Agent SDK (@anthropic-ai/claude-agent-sdk)
- **Language**: TypeScript

### Storage
- Simple JSON file for user → session ID mappings
- Claude SDK automatically manages conversation history

## Quick Start

### Prerequisites

- Node.js 21+ installed
- pnpm 8+ installed
- Anthropic API key ([get one here](https://console.anthropic.com/))

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd claude-sdk-agent
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment variables**

   Backend:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env and add your ANTHROPIC_API_KEY
   ```

   Frontend:
   ```bash
   cd ../frontend
   cp .env.example .env
   # (Optional) Edit .env if needed
   ```

4. **Start the development servers**

   From the root directory:
   ```bash
   pnpm dev
   ```

   This will start:
   - Backend server at http://localhost:8000
   - Frontend dev server at http://localhost:5173

5. **Open the application**

   Navigate to http://localhost:5173 in your browser

## Project Structure

```
claude-sdk-agent/
├── frontend/          # Vue 3 + Vite frontend
│   ├── src/
│   │   ├── components/   # Vue components
│   │   ├── views/        # Page components
│   │   ├── composables/  # Vue composables (useStreaming)
│   │   ├── types/        # TypeScript types
│   │   └── main.ts       # App entry point
│   └── package.json
├── backend/           # Fastify server
│   ├── src/
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   ├── config/       # Configuration
│   │   └── index.ts      # Server entry point
│   └── package.json
├── shared/            # Shared TypeScript types
│   └── types.ts
├── data/              # Session storage (auto-created)
│   └── sessions.json
└── package.json       # Root workspace config
```

## Available Scripts

### Root (Workspace)
- `pnpm dev` - Run both frontend and backend concurrently
- `pnpm build` - Build both projects for production
- `pnpm test` - Run all tests
- `pnpm lint` - Lint all code
- `pnpm format` - Format code with Prettier

### Frontend Only
- `pnpm dev:frontend` - Start Vite dev server
- `pnpm build:frontend` - Build for production
- `pnpm test:frontend` - Run frontend tests

### Backend Only
- `pnpm dev:backend` - Start backend dev server
- `pnpm build:backend` - Compile TypeScript
- `pnpm test:backend` - Run backend tests

## API Endpoints

### Chat
- `GET /api/chat/stream?userId={id}&message={text}` - Stream chat response (SSE)

### Session Management
- `GET /api/session/:userId` - Get user's session info
- `DELETE /api/session/:userId` - Clear session (start new conversation)

### Health
- `GET /api/health` - Server health check

## How It Works

### Conversation Flow

1. **User sends message** → Frontend captures input
2. **SSE connection** → Opens EventSource to `/api/chat/stream`
3. **Backend processes** → Retrieves session ID from storage
4. **Claude SDK** → Resumes conversation using session ID
5. **Streaming response** → Backend streams chunks to frontend
6. **UI updates** → Frontend displays message in real-time
7. **Session saved** → Backend stores updated session ID

### Session Management

- **First Message**: Claude SDK creates new session, returns session ID
- **Subsequent Messages**: Backend uses stored session ID to resume conversation
- **New Conversation**: Delete session ID to start fresh
- **History Storage**: Automatically managed by Claude SDK in `~/.claude/projects/`

## Configuration

### Backend Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...    # Your Claude API key

# Optional
PORT=8000                        # Server port (default: 8000)
NODE_ENV=development             # Environment
DATA_DIR=../data                 # Storage directory
FRONTEND_URL=http://localhost:5173  # CORS origin
```

### Frontend Environment Variables

```bash
VITE_API_URL=http://localhost:8000  # Backend API URL
```

## Development

### Adding New Features

1. **New API Endpoint**: Add to `backend/src/routes/`
2. **New UI Component**: Add to `frontend/src/components/`
3. **Shared Types**: Add to `shared/types.ts`

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Frontend tests only
pnpm test:frontend

# Backend tests only
pnpm test:backend
```

### Linting & Formatting

```bash
# Lint all code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format with Prettier
pnpm format
```

## Troubleshooting

### Backend won't start

- **Check API key**: Ensure `ANTHROPIC_API_KEY` is set in `backend/.env`
- **Check port**: Make sure port 8000 is not in use
- **Check Node version**: Requires Node.js 21+

### Frontend can't connect to backend

- **Check proxy**: Vite config proxies `/api` to backend
- **Check CORS**: Backend allows `FRONTEND_URL` origin
- **Check backend is running**: Visit http://localhost:8000/api/health

### Session not persisting

- **Check data directory**: Ensure `data/` folder exists
- **Check permissions**: Ensure write permissions on `data/sessions.json`
- **Check browser**: Clear browser cache/localStorage

### Streaming not working

- **Check SSE headers**: Backend must set `text/event-stream`
- **Check browser console**: Look for EventSource errors
- **Check network tab**: Inspect SSE connection in DevTools

## Production Deployment

### Build for Production

```bash
# Build both frontend and backend
pnpm build

# Built files will be in:
# - frontend/dist/
# - backend/dist/
```

### Environment Setup

1. Set production environment variables
2. Use process manager (PM2, systemd, etc.) for backend
3. Serve frontend with nginx/Apache or CDN
4. Consider adding authentication layer
5. Setup proper logging and monitoring

## Resources

- [Claude Agent SDK Docs](https://docs.claude.com/en/api/agent-sdk/overview)
- [Vue 3 Documentation](https://vuejs.org/)
- [Vite Documentation](https://vitejs.dev/)
- [Fastify Documentation](https://fastify.dev/)
- [Tailwind CSS](https://tailwindcss.com/)

## License

MIT

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.

## Support

For issues and questions, please open a GitHub issue.
