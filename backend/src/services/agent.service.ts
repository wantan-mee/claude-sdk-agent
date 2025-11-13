import { query } from '@anthropic-ai/claude-agent-sdk';
import { config } from '../config/env.js';
import { ArtifactService } from './artifact.service.js';
import path from 'path';
import fs from 'fs/promises';

// Enhanced streaming callback to handle all event types
export interface StreamEvent {
  type: 'content_delta' | 'thinking' | 'tool_use' | 'tool_result' | 'status' | 'error' | 'message_complete' | 'file_created';
  delta?: string;
  thinking?: string;
  toolName?: string;
  toolInput?: any;
  toolResult?: any;
  status?: string;
  sessionId?: string;
  message?: any;
  error?: string;
  // File-related fields
  fileName?: string;
  filePath?: string;
  fileSize?: number;
}

export class ClaudeAgentService {
  /**
   * Process a chat message using Claude Agent SDK with EXTENDED THINKING enabled
   * The SDK automatically manages conversation history via session IDs
   * Streams ALL events including deep reasoning thoughts, tool use, and status updates
   *
   * Extended thinking enables:
   * - Multi-step reasoning chains
   * - Iterative tool use (search multiple times, refine queries)
   * - Self-correction and verification
   * - Deep analysis before answering
   */
  async processMessage(
    sessionId: string | undefined,
    userMessage: string,
    onStream: (event: StreamEvent) => void
  ): Promise<{ sessionId: string | undefined; response: string }> {
    // Initialize artifact directory if needed
    await ArtifactService.initialize();

    // Use Claude Agent SDK with full tool access and EXTENDED THINKING
    const response = query({
      prompt: userMessage,
      options: {
        resume: sessionId, // SDK loads history automatically
        model: 'claude-sonnet-4-5',
        cwd: config.agentOutputDir, // Set working directory to agent-output

        // 🧠 ENABLE EXTENDED THINKING for deep reasoning
        // This allows the agent to think through complex problems step-by-step
        // before responding. Essential for multi-round knowledge base searches.
        maxThinkingTokens: 10000, // Allow up to 10k tokens for reasoning

        // Enable all tools (web search, file operations, bash, etc.)
        permissionMode: 'bypassPermissions', // Allow all operations without prompting

        // System prompt encouraging deep reasoning
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: `

When answering questions:
1. Think step-by-step about what information you need
2. Use tools iteratively - search, analyze, search again if needed
3. Refine your queries based on what you learn
4. Verify your understanding before answering
5. Synthesize information from multiple sources

For knowledge base searches:
- Start with broad queries to understand the domain
- Follow up with specific queries for details
- Search 3-5 times if needed to get complete context
- Always cite which documents inform your answer`
        }
      },
    });

    let newSessionId: string | undefined;
    let fullResponse = '';
    let currentThinking = ''; // Accumulate thinking text

    // Track files that existed before processing
    const existingFiles = new Set<string>();
    try {
      const artifacts = await ArtifactService.getArtifacts();
      artifacts.forEach(a => existingFiles.add(a.relativePath));
    } catch (error) {
      // Ignore errors reading existing files
    }

    // Set up file watching for this session
    if (sessionId || newSessionId) {
      const watchSessionId = sessionId || 'temp';
      ArtifactService.watchDirectory(watchSessionId, async (event, filePath) => {
        const relativePath = path.relative(config.agentOutputDir, filePath);

        // Only notify about new files (not changes to existing files)
        if (event === 'add' && !existingFiles.has(relativePath)) {
          try {
            const stats = await fs.stat(filePath);
            onStream({
              type: 'file_created',
              fileName: path.basename(filePath),
              filePath: relativePath,
              fileSize: stats.size,
            });
            existingFiles.add(relativePath);
          } catch (error) {
            // File might have been deleted already
          }
        }
      });
    }

    // Stream ALL response events for transparency
    for await (const message of response) {
      // Capture session ID from init message
      if (message.type === 'system' && message.subtype === 'init') {
        newSessionId = message.session_id;
        onStream({
          type: 'status',
          status: 'Initialized conversation session',
        });
      }

      // Stream status updates
      if (message.type === 'system' && message.subtype === 'status') {
        onStream({
          type: 'status',
          status: (message as any).status || 'Processing...',
        });
      }

      // Stream assistant messages (thoughts, text, tool use)
      if (message.type === 'assistant') {
        const content = message.message.content;

        // 🧠 PRIORITY: Stream thinking blocks FIRST (before content)
        // Extended thinking appears in the message and should be shown prominently
        if ((message.message as any).thinking) {
          const thinkingContent = (message.message as any).thinking;
          const thinkingText = typeof thinkingContent === 'string'
            ? thinkingContent
            : JSON.stringify(thinkingContent, null, 2);

          // Check if this is new thinking or continuation
          if (thinkingText !== currentThinking) {
            // Stream the incremental thinking delta
            const delta = thinkingText.slice(currentThinking.length);
            if (delta) {
              currentThinking = thinkingText;
              onStream({
                type: 'thinking',
                thinking: delta, // Stream only the new part
              });
            }
          }
        }

        // Stream content blocks (text, tool use)
        if (Array.isArray(content)) {
          for (const block of content) {
            // Stream text content
            if (block.type === 'text') {
              fullResponse += block.text;
              onStream({
                type: 'content_delta',
                delta: block.text,
              });
            }
            // Stream tool use - shows what tools the agent is calling
            else if (block.type === 'tool_use') {
              onStream({
                type: 'tool_use',
                toolName: block.name,
                toolInput: block.input,
              });

              // Send status update for better UX
              onStream({
                type: 'status',
                status: `Using ${block.name}...`,
              });
            }
          }
        }
      }

      // Stream tool results
      if (message.type === 'result') {
        onStream({
          type: 'tool_result',
          toolName: (message as any).tool_name || 'Tool',
          toolResult: (message as any).result || message,
        });
      }

      // Stream tool progress updates
      if (message.type === 'tool_progress') {
        onStream({
          type: 'status',
          status: `Tool in progress: ${(message as any).message || 'Processing...'}`,
        });
      }
    }

    // Stop file watching for this session
    if (newSessionId) {
      ArtifactService.stopWatching(newSessionId);
    }

    return { sessionId: newSessionId, response: fullResponse };
  }
}
