# Agent Tracing Enhancements

This document describes the comprehensive agent tracing system implemented in the backend server.

## Overview

The backend now features **complete transparency** into every single Claude Agent SDK operation, providing detailed logging, performance metrics, and real-time status updates to the frontend.

## New Components

### 1. Enhanced Logger Service (`src/services/logger.service.ts`)

A comprehensive logging system with:

#### Features
- **Color-coded console output** with timestamps
- **File logging** to daily JSONL files (`data/logs/YYYY-MM-DD.jsonl`)
- **Multiple log levels**: DEBUG, INFO, WARN, ERROR
- **Structured logging** with categories and metadata
- **Performance timing** utilities

#### Log Categories
- `SERVER` - Server lifecycle events
- `HTTP` - HTTP request/response logging
- `AGENT` - Agent initialization and completion
- `AGENT_MSG` - Raw agent messages
- `AGENT_THINK` - Thinking/reasoning events
- `AGENT_TOOL` - Tool execution
- `AGENT_TOOL_RESULT` - Tool results with duration
- `AGENT_CONTENT` - Content generation
- `AGENT_USAGE` - Token usage statistics
- `STORAGE` - Session storage operations
- `SSE` - Server-Sent Events connections

#### Example Usage
```typescript
Logger.info('AGENT', 'Processing message', { messageLength: 123 }, { sessionId, userId });
Logger.agentToolUse(sessionId, 'web_search', { query: 'test' });
Logger.agentComplete(sessionId, totalTokens, duration);
```

### 2. Enhanced Agent Service (`src/services/agent.service.ts`)

#### New Tracking Capabilities

**Performance Metrics**
- Total request duration
- Individual tool execution timings
- Token counts (thinking + output)
- Tool call counts
- Thinking block counts

**Message Inspection**
Every assistant message is now analyzed for:
- `model` - Claude model being used
- `stop_reason` - Why the response ended (tool_use, end_turn, max_tokens)
- `usage` - Token usage statistics including cache hits
- `content` - All content blocks (text, thinking, tool_use)

**Enhanced Status Updates**

The frontend now receives status updates for EVERY assistant message type:

1. **Assistant Message Received**
   ```json
   {
     "type": "status",
     "status": "Agent is using tools" // or "Completing response", etc.
   }
   ```

2. **Thinking in Progress**
   ```json
   {
     "type": "thinking",
     "thinking": "Let me search for the best nasi lemak..."
   }
   {
     "type": "status",
     "status": "Agent is thinking..."
   }
   ```

3. **Content Generation**
   ```json
   {
     "type": "content_delta",
     "delta": "Here are the results..."
   }
   {
     "type": "status",
     "status": "Generating response..."
   }
   ```

4. **Deep Reasoning**
   ```json
   {
     "type": "status",
     "status": "Deep reasoning in progress..."
   }
   ```

5. **Tool Usage**
   ```json
   {
     "type": "tool_use",
     "toolName": "web_search",
     "toolInput": { "query": "..." }
   }
   {
     "type": "status",
     "status": "🔍 Searching the web: web_search"
   }
   ```

6. **Token Usage**
   ```json
   {
     "type": "status",
     "status": "Tokens used - Input: 1500, Output: 200"
   }
   ```

#### New StreamEvent Types

```typescript
interface StreamEvent {
  type: 'content_delta' | 'thinking' | 'tool_use' | 'tool_result' |
        'status' | 'error' | 'message_complete' | 'file_created' |
        'raw_message' | 'metrics' | 'assistant_meta';

  // Assistant metadata (NEW)
  assistantMeta?: {
    model?: string;
    stopReason?: string;
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
      cacheCreationInputTokens?: number;
      cacheReadInputTokens?: number;
    };
  };

  // Performance metrics (NEW)
  metrics?: {
    thinkingTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    duration?: number;
    toolCallCount?: number;
    thinkingBlocks?: number;
  };

  // ... other fields
}
```

### 3. Enhanced Chat Routes (`src/routes/chat.routes.ts`)

All endpoints now include:
- Request timing
- Detailed HTTP logging
- User/session tracking
- Error logging with context

### 4. Enhanced Server (`src/index.ts`)

Features:
- Logger initialization on startup
- HTTP request/response middleware with timing
- Enhanced health check with system info
- Process signal handlers (SIGTERM, SIGINT)
- Uncaught exception/rejection handlers
- Beautiful startup banner with configuration details

## What Gets Logged

### Console Output (Development)

```
2025-11-14T10:30:45.123Z [INFO] [SERVER] 🚀 Backend server started successfully
2025-11-14T10:30:50.456Z [INFO] [HTTP] GET /api/chat/stream (user: user123)
2025-11-14T10:30:50.457Z [INFO] [AGENT] Processing message (session: c811b70a...)
2025-11-14T10:30:51.234Z [DEBUG] [AGENT_MSG] Received assistant message
2025-11-14T10:30:51.235Z [DEBUG] [AGENT_THINK] Thinking in progress
2025-11-14T10:30:52.100Z [INFO] [AGENT_TOOL] Executing tool: web_search
2025-11-14T10:30:53.500Z [DEBUG] [AGENT_TOOL_RESULT] Tool result: web_search (1400ms)
2025-11-14T10:30:54.789Z [INFO] [AGENT] Conversation turn complete (3333ms)
2025-11-14T10:30:54.790Z [INFO] [HTTP] GET /api/chat/stream 200 (4334ms)
```

### Log Files (`data/logs/YYYY-MM-DD.jsonl`)

Each line is a JSON object:

```json
{
  "timestamp": "2025-11-14T10:30:50.456Z",
  "level": "INFO",
  "category": "AGENT",
  "message": "Processing message",
  "data": {
    "messageLength": 50,
    "preview": "What are the best restaurants in PJ?"
  },
  "sessionId": "c811b70a-040f-4480-b3c9-34e3151699b2",
  "userId": "user123"
}
```

## Frontend Integration

The frontend now receives detailed real-time updates:

### 1. Assistant Metadata
```typescript
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'assistant_meta') {
    console.log('Model:', data.assistantMeta.model);
    console.log('Stop reason:', data.assistantMeta.stopReason);
    console.log('Tokens:', data.assistantMeta.usage);
  }
};
```

### 2. Status Updates
Every stage of processing now sends status updates:
- "Agent is using tools"
- "Agent is thinking..."
- "Deep reasoning in progress..."
- "Generating response..."
- "Completing response"
- "Tokens used - Input: X, Output: Y"

### 3. Performance Metrics
```typescript
if (data.type === 'metrics') {
  console.log('Duration:', data.metrics.duration, 'ms');
  console.log('Tool calls:', data.metrics.toolCallCount);
  console.log('Thinking blocks:', data.metrics.thinkingBlocks);
}
```

### 4. Raw Messages (Development Only)
```typescript
if (data.type === 'raw_message') {
  // Full Claude SDK message for debugging
  console.log('Raw:', data.rawMessage);
}
```

## Tool Descriptions

User-friendly descriptions for common tools:

| Tool | Description |
|------|-------------|
| `web_search` | 🔍 Searching the web |
| `web_fetch` | 🌐 Fetching webpage |
| `read_file` | 📖 Reading file |
| `write_file` | ✍️ Writing file |
| `bash` | 🖥️ Running shell command |
| `grep` | 🔍 Searching content |

## Performance Benefits

1. **Real-time visibility** into agent operations
2. **Debug capabilities** with raw message streaming
3. **Performance insights** with timing metrics
4. **Token usage tracking** for cost monitoring
5. **Detailed audit trail** in log files
6. **Better UX** with descriptive status updates

## Configuration

### Log Levels

Set in environment or code:
```typescript
Logger.setLevel(LogLevel.DEBUG); // Most verbose
Logger.setLevel(LogLevel.INFO);  // Default in production
```

### File Logging

Logs are automatically written to:
```
data/logs/
  ├── 2025-11-14.jsonl
  ├── 2025-11-15.jsonl
  └── ...
```

### Raw Message Streaming

Automatically enabled in development mode (`NODE_ENV=development`).

## Usage Examples

### Monitoring Agent Activity

```bash
# Watch logs in real-time
tail -f data/logs/$(date +%Y-%m-%d).jsonl | jq .

# Filter by category
tail -f data/logs/$(date +%Y-%m-%d).jsonl | jq 'select(.category == "AGENT_TOOL")'

# Track performance
tail -f data/logs/$(date +%Y-%m-%d).jsonl | jq 'select(.duration != null) | {category, message, duration}'
```

### Analyzing Token Usage

```bash
# Total tokens by session
cat data/logs/2025-11-14.jsonl | jq 'select(.category == "AGENT_USAGE") | .data.usage'
```

### Finding Errors

```bash
# All errors today
cat data/logs/$(date +%Y-%m-%d).jsonl | jq 'select(.level == "ERROR")'
```

## Next Steps

### Potential Enhancements

1. **Log aggregation** - Send logs to external service (DataDog, CloudWatch)
2. **Metrics dashboard** - Real-time visualization of agent performance
3. **Alerting** - Notify on errors or performance issues
4. **Log rotation** - Automatic cleanup of old log files
5. **Sampling** - Reduce DEBUG logs in production

### Frontend Enhancements

1. **Activity panel** - Show real-time agent status
2. **Token counter** - Display cumulative token usage
3. **Performance graphs** - Visualize response times
4. **Tool usage history** - Track which tools are called

## Summary

The enhanced backend now provides:

✅ **Complete transparency** - Every agent operation is logged and streamed
✅ **Performance tracking** - Detailed timing and metrics
✅ **Rich status updates** - Informative feedback for every stage
✅ **Debug capabilities** - Raw message inspection in development
✅ **Audit trail** - Persistent logs in JSONL format
✅ **Better UX** - User-friendly tool descriptions and status messages

The system is production-ready with configurable log levels and automatic file logging.
