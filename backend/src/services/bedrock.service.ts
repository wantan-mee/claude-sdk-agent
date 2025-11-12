import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { config } from '../config/env.js';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export class BedrockAgentService {
  private client: BedrockRuntimeClient;
  private modelId: string;

  constructor() {
    // Initialize Bedrock client - it will use AWS credentials from environment or ~/.aws/credentials
    this.client = new BedrockRuntimeClient({
      region: config.awsRegion,
    });
    this.modelId = config.bedrockModelId;
  }

  /**
   * Process a chat message using AWS Bedrock with conversation history
   * History is managed externally and passed in
   */
  async processMessage(
    conversationHistory: Message[],
    userMessage: string,
    onStream: (delta: string) => void
  ): Promise<{ response: string }> {
    // Build messages array for Bedrock
    const messages = [
      ...conversationHistory.map((msg) => ({
        role: msg.role,
        content: [{ text: msg.content }],
      })),
      {
        role: 'user' as const,
        content: [{ text: userMessage }],
      },
    ];

    // Create the converse stream command
    const command = new ConverseStreamCommand({
      modelId: this.modelId,
      messages,
      inferenceConfig: {
        maxTokens: 4096,
        temperature: 1,
      },
    });

    let fullResponse = '';

    try {
      const response = await this.client.send(command);

      // Process the stream
      if (response.stream) {
        for await (const event of response.stream) {
          if (event.contentBlockDelta?.delta?.text) {
            const textDelta = event.contentBlockDelta.delta.text;
            fullResponse += textDelta;
            onStream(textDelta);
          }
        }
      }
    } catch (error) {
      console.error('Bedrock API error:', error);
      throw new Error(
        `Bedrock API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return { response: fullResponse };
  }
}
