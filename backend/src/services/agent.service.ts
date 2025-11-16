import { query } from '@anthropic-ai/claude-agent-sdk';
import { config } from '../config/env.js';
import { ArtifactService } from './artifact.service.js';
import { Logger } from './logger.service.js';
import path from 'path';
import fs from 'fs/promises';

// Enhanced streaming callback to handle all event types
export interface StreamEvent {
  type: 'content_delta' | 'thinking' | 'tool_use' | 'tool_result' | 'status' | 'error' | 'message_complete' | 'file_created' | 'raw_message' | 'metrics' | 'assistant_meta' | 'rag_status';
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
  // Raw message for debugging
  rawMessage?: any;
  // Performance metrics
  metrics?: {
    thinkingTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    duration?: number;
    toolCallCount?: number;
    thinkingBlocks?: number;
  };
  // Assistant message metadata
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
  // RAG-specific fields
  ragData?: {
    subQueries?: string[];
    sources?: string[];
    totalResults?: number;
    processingTime?: number;
  };
}

export class ClaudeAgentService {
  /**
   * Get user-friendly description for tool names
   */
  private getToolDescription(toolName: string): string {
    const toolDescriptions: Record<string, string> = {
      // Web and search tools
      'web_search': '🔍 Searching the web',
      'web_fetch': '🌐 Fetching webpage',
      'scrape': '📄 Scraping content',

      // File operations
      'read_file': '📖 Reading file',
      'write_file': '✍️ Writing file',
      'edit_file': '✏️ Editing file',
      'list_files': '📂 Listing files',
      'create_directory': '📁 Creating directory',

      // Code operations
      'execute_code': '⚡ Executing code',
      'run_command': '💻 Running command',
      'bash': '🖥️ Running shell command',

      // Analysis tools
      'analyze': '🔬 Analyzing',
      'search': '🔎 Searching',
      'grep': '🔍 Searching content',

      // Knowledge base tools
      'search_knowledge_base': '📚 Searching knowledge base',
      'multi_search_knowledge_base': '📚 Multi-searching knowledge base',

      // Default
      'unknown': '🛠️ Using tool',
    };

    return toolDescriptions[toolName] || toolDescriptions['unknown'];
  }

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
    onStream: (event: StreamEvent) => void,
    userId?: string
  ): Promise<{ sessionId: string | undefined; response: string }> {
    // Start performance timer
    const overallTimer = Logger.startTimer();

    // Log agent initialization
    Logger.agentInit(sessionId || 'new', userId || 'unknown', !!sessionId);
    Logger.info('AGENT', 'Processing message', {
      messageLength: userMessage.length,
      preview: userMessage.substring(0, 100)
    }, { sessionId, userId });

    // Initialize artifact directory if needed
    await ArtifactService.initialize();

    // Prepare RAG configuration based on mode
    let augmentedMessage = userMessage;
    let ragSystemPromptAddition = '';
    let mcpServers: Array<{ command: string; args: string[]; env?: Record<string, string> }> = [];

    if (config.enableRag) {
      // RAG modes are mutually exclusive (XOR relationship)
      // Only ONE mode can be active: mcp OR custom_tool OR pre_retrieval
      Logger.info('AGENT', `RAG mode: ${config.ragMode} (exclusive - only one mode active)`, {
        ragMode: config.ragMode,
        mcpEnabled: config.ragMode === 'mcp',
        customToolEnabled: config.ragMode === 'custom_tool',
        preRetrievalEnabled: config.ragMode === 'pre_retrieval',
      }, { sessionId, userId });

      onStream({
        type: 'status',
        status: `Initializing RAG (${config.ragMode} mode)...`,
      });

      // Validate XOR - only one mode should be selected
      const selectedModes = [
        config.ragMode === 'mcp',
        config.ragMode === 'custom_tool',
        config.ragMode === 'pre_retrieval'
      ].filter(Boolean).length;

      if (selectedModes !== 1) {
        Logger.error('AGENT', 'Invalid RAG configuration - exactly one mode must be selected', {
          ragMode: config.ragMode,
          selectedModes,
        });
        throw new Error('RAG configuration error: exactly one mode must be active');
      }

      switch (config.ragMode) {
        case 'mcp':
          // MCP mode: Agent uses MCP server to access Bedrock KB
          // The agent will have a tool to search the KB directly
          // NOTE: When MCP mode is active, custom_tool and pre_retrieval are DISABLED
          Logger.info('AGENT', 'Using MCP mode - custom_tool and pre_retrieval are DISABLED');
          mcpServers.push({
            command: 'npx',
            args: ['tsx', path.join(process.cwd(), 'src/mcp/bedrock-kb-server.ts')],
            env: {
              RAG_BEDROCK_KB_ID: config.ragBedrockKbId,
              RAG_AWS_REGION: config.ragAwsRegion,
              RAG_MAX_RESULTS: String(config.ragMaxResults),
              RAG_MIN_RELEVANCE_SCORE: String(config.ragMinRelevanceScore),
            },
          });

          ragSystemPromptAddition = `

## Knowledge Base Access (MCP Mode)

You have direct access to an AWS Bedrock Knowledge Base through the search_knowledge_base tool.
Use this tool to find relevant information for answering questions.

**Important:** Search the knowledge base multiple times with different queries to get comprehensive information.
The tool returns up to ${config.ragMaxResults} results per search with relevance scores.
Always cite which sources your information comes from.`;

          Logger.info('AGENT', 'MCP server configured for Bedrock KB', {
            kbId: config.ragBedrockKbId,
          }, { sessionId, userId });

          onStream({
            type: 'rag_status',
            status: 'Knowledge Base tool available via MCP',
            ragData: { subQueries: [], sources: [], totalResults: 0, processingTime: 0 },
          });
          break;

        case 'custom_tool':
          // Custom tool mode: Add system prompt for KB awareness
          // Note: Claude Agent SDK handles tool routing internally
          // NOTE: When custom_tool mode is active, mcp and pre_retrieval are DISABLED
          Logger.info('AGENT', 'Using custom_tool mode - mcp and pre_retrieval are DISABLED');
          const { BedrockKBToolService } = await import('./bedrock-kb-tool.service.js');
          await BedrockKBToolService.initialize();
          ragSystemPromptAddition = BedrockKBToolService.getSystemPromptAddition();

          Logger.info('AGENT', 'Custom tool mode initialized for Bedrock KB', {
            kbId: config.ragBedrockKbId,
          }, { sessionId, userId });

          onStream({
            type: 'rag_status',
            status: 'Knowledge Base tool available (custom tool mode)',
            ragData: { subQueries: [], sources: [], totalResults: 0, processingTime: 0 },
          });
          break;

        case 'pre_retrieval':
        default:
          // Pre-retrieval mode: Retrieve context before agent sees message
          // NOTE: When pre_retrieval mode is active, mcp and custom_tool are DISABLED
          Logger.info('AGENT', 'Using pre_retrieval mode - mcp and custom_tool are DISABLED');
          try {
            onStream({
              type: 'status',
              status: 'Retrieving relevant context from knowledge base...',
            });

            const { RAGService } = await import('./rag.service.js');
            await RAGService.initialize();

            augmentedMessage = await RAGService.augmentPrompt(userMessage, (ragEvent) => {
              // Stream RAG progress to frontend
              onStream({
                type: 'rag_status',
                status: ragEvent.message,
                ragData: ragEvent.data,
              });
            });

            Logger.info('AGENT', 'Message augmented with RAG context', {
              originalLength: userMessage.length,
              augmentedLength: augmentedMessage.length,
            }, { sessionId, userId });
          } catch (error) {
            Logger.error('AGENT', 'RAG augmentation failed, proceeding without context', error);
            onStream({
              type: 'status',
              status: 'RAG retrieval failed, proceeding without context',
            });
          }
          break;
      }
    }

    // Build query options
    const queryOptions: any = {
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
- Always cite which documents inform your answer${ragSystemPromptAddition}`
      }
    };

    // Add MCP servers if configured
    if (mcpServers.length > 0) {
      queryOptions.mcpServers = mcpServers;
      Logger.info('AGENT', `Added ${mcpServers.length} MCP server(s) to query options`);
    }

    // Use Claude Agent SDK with full tool access and EXTENDED THINKING
    const response = query({
      prompt: augmentedMessage,
      options: queryOptions,
    });

    let newSessionId: string | undefined;
    let fullResponse = '';
    let currentThinking = ''; // Accumulate thinking text

    // Performance and metrics tracking
    let toolCallCount = 0;
    let thinkingBlocks = 0;
    let totalThinkingLength = 0;
    const toolTimers = new Map<string, ReturnType<typeof Logger.startTimer>>();

    // Track files that existed before processing
    const existingFiles = new Set<string>();
    try {
      const artifacts = await ArtifactService.getArtifacts();
      artifacts.forEach(a => existingFiles.add(a.relativePath));
    } catch (error) {
      // Ignore errors reading existing files
      Logger.warn('AGENT', 'Failed to read existing artifacts', error, { sessionId });
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
      // Log every raw message for complete transparency
      Logger.agentMessage(newSessionId || sessionId || 'unknown', message.type, message);

      // Stream raw message to frontend if debug mode enabled
      if (config.nodeEnv === 'development') {
        onStream({
          type: 'raw_message',
          rawMessage: message,
        });
      }

      // Capture session ID from init message
      if (message.type === 'system' && message.subtype === 'init') {
        newSessionId = message.session_id;
        Logger.info('AGENT', 'Session initialized', {
          sessionId: newSessionId,
          isNewSession: !sessionId
        }, { sessionId: newSessionId, userId });

        onStream({
          type: 'status',
          status: 'Initialized conversation session',
          sessionId: newSessionId,
        });
      }

      // Stream status updates
      if (message.type === 'system' && message.subtype === 'status') {
        const status = (message as any).status || 'Processing...';
        Logger.debug('AGENT_STATUS', status, undefined, { sessionId: newSessionId });

        onStream({
          type: 'status',
          status,
        });
      }

      // Stream assistant messages (thoughts, text, tool use)
      if (message.type === 'assistant') {
        const assistantMsg = message.message;
        const content = assistantMsg.content;

        // Extract metadata from assistant message
        const stopReason = assistantMsg.stop_reason;
        const usage = assistantMsg.usage;
        const modelId = assistantMsg.model;

        // Send status update about the assistant message
        let statusMessage = 'Processing response';
        if (stopReason === 'tool_use') {
          statusMessage = 'Agent is using tools';
        } else if (stopReason === 'end_turn') {
          statusMessage = 'Completing response';
        } else if (stopReason === 'max_tokens') {
          statusMessage = 'Response length limit reached';
        }

        Logger.debug('AGENT_ASSISTANT', `Assistant message received`, {
          stopReason,
          usage,
          model: modelId,
          contentBlocks: Array.isArray(content) ? content.length : 0
        }, { sessionId: newSessionId });

        // Stream assistant metadata to frontend
        onStream({
          type: 'assistant_meta',
          assistantMeta: {
            model: modelId,
            stopReason,
            usage: usage ? {
              inputTokens: usage.input_tokens,
              outputTokens: usage.output_tokens,
              cacheCreationInputTokens: usage.cache_creation_input_tokens,
              cacheReadInputTokens: usage.cache_read_input_tokens,
            } : undefined,
          },
        });

        onStream({
          type: 'status',
          status: statusMessage,
        });

        // 🧠 PRIORITY: Stream thinking blocks FIRST (before content)
        // Extended thinking appears in the message and should be shown prominently
        if ((assistantMsg as any).thinking) {
          const thinkingContent = (assistantMsg as any).thinking;
          const thinkingText = typeof thinkingContent === 'string'
            ? thinkingContent
            : JSON.stringify(thinkingContent, null, 2);

          // Check if this is new thinking or continuation
          if (thinkingText !== currentThinking) {
            // Stream the incremental thinking delta
            const delta = thinkingText.slice(currentThinking.length);
            if (delta) {
              currentThinking = thinkingText;
              totalThinkingLength = thinkingText.length;
              thinkingBlocks++;

              Logger.agentThinking(newSessionId || 'unknown', delta, false);

              onStream({
                type: 'thinking',
                thinking: delta, // Stream only the new part
              });

              onStream({
                type: 'status',
                status: 'Agent is thinking...',
              });
            }
          }
        }

        // Stream content blocks (text, tool use, thinking)
        if (Array.isArray(content)) {
          for (const block of content) {
            // Stream text content
            if (block.type === 'text') {
              fullResponse += block.text;
              Logger.agentContent(newSessionId || 'unknown', block.text);

              onStream({
                type: 'content_delta',
                delta: block.text,
              });

              onStream({
                type: 'status',
                status: 'Generating response...',
              });
            }
            // Stream thinking content blocks (extended thinking)
            else if (block.type === 'thinking') {
              const thinkingText = block.thinking || '';

              thinkingBlocks++;
              Logger.agentThinking(newSessionId || 'unknown', thinkingText, false);

              onStream({
                type: 'thinking',
                thinking: thinkingText,
              });

              onStream({
                type: 'status',
                status: 'Deep reasoning in progress...',
              });
            }
            // Stream tool use - shows what tools the agent is calling
            else if (block.type === 'tool_use') {
              toolCallCount++;
              const toolId = `${block.name}_${toolCallCount}`;
              toolTimers.set(toolId, Logger.startTimer());

              Logger.agentToolUse(newSessionId || 'unknown', block.name, block.input);

              onStream({
                type: 'tool_use',
                toolName: block.name,
                toolInput: block.input,
              });

              // Send detailed status update for tool use
              const toolDescription = this.getToolDescription(block.name);
              onStream({
                type: 'status',
                status: `${toolDescription}: ${block.name}`,
              });
            }
          }
        }

        // Stream usage/token information if available
        if (usage) {
          Logger.debug('AGENT_USAGE', 'Token usage', usage, { sessionId: newSessionId });

          onStream({
            type: 'status',
            status: `Tokens used - Input: ${usage.input_tokens || 0}, Output: ${usage.output_tokens || 0}`,
          });
        }
      }

      // Stream tool results
      if (message.type === 'result') {
        const toolName = (message as any).tool_name || 'Tool';
        const toolId = `${toolName}_${toolCallCount}`;
        const timer = toolTimers.get(toolId);
        const duration = timer ? timer() : undefined;

        Logger.agentToolResult(newSessionId || 'unknown', toolName, (message as any).result || message, duration);

        onStream({
          type: 'tool_result',
          toolName,
          toolResult: (message as any).result || message,
        });
      }

      // Stream tool progress updates
      if (message.type === 'tool_progress') {
        const progressMessage = (message as any).message || 'Processing...';
        Logger.debug('AGENT_TOOL_PROGRESS', progressMessage, undefined, { sessionId: newSessionId });

        onStream({
          type: 'status',
          status: `Tool in progress: ${progressMessage}`,
        });
      }
    }

    // Log final thinking state
    if (currentThinking) {
      Logger.agentThinking(newSessionId || 'unknown', currentThinking, true);
    }

    // Calculate final performance metrics
    const totalDuration = overallTimer();
    const metrics = {
      thinkingTokens: totalThinkingLength,
      outputTokens: fullResponse.length,
      totalTokens: totalThinkingLength + fullResponse.length,
      duration: totalDuration,
      toolCallCount,
      thinkingBlocks,
    };

    // Log completion with metrics
    Logger.agentComplete(newSessionId || 'unknown', metrics.totalTokens, totalDuration);
    Logger.info('AGENT_METRICS', 'Request completed', metrics, { sessionId: newSessionId, userId });

    // Stream metrics to frontend
    onStream({
      type: 'metrics',
      metrics,
    });

    // Stop file watching for this session
    if (newSessionId) {
      ArtifactService.stopWatching(newSessionId);
    }

    return { sessionId: newSessionId, response: fullResponse };
  }
}
