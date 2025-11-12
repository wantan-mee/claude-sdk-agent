import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

const TEST_DATA_DIR = path.join(process.cwd(), 'test-data');
const TEST_SESSIONS_FILE = path.join(TEST_DATA_DIR, 'sessions.json');

// Mock config - must use literal value, not computed path
vi.mock('../config/env.js', () => ({
  config: {
    dataDir: './test-data',
    awsRegion: 'us-east-1',
    bedrockModelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    port: 8000,
    nodeEnv: 'test',
    frontendUrl: 'http://localhost:5173',
  },
}));

import { StorageService } from './storage.service.js';

describe('StorageService', () => {
  beforeEach(async () => {
    // Clean up test data directory
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors
    }
  });

  describe('getUserConversation', () => {
    it('should return empty array for non-existent user', async () => {
      const conversation = await StorageService.getUserConversation('user-123');
      expect(conversation).toEqual([]);
    });

    it('should return conversation history for existing user', async () => {
      await StorageService.addMessage('user-123', 'user', 'Hello');
      await StorageService.addMessage('user-123', 'assistant', 'Hi there!');

      const conversation = await StorageService.getUserConversation('user-123');
      expect(conversation).toHaveLength(2);
      expect(conversation[0].role).toBe('user');
      expect(conversation[0].content).toBe('Hello');
      expect(conversation[1].role).toBe('assistant');
      expect(conversation[1].content).toBe('Hi there!');
    });

    it('should handle multiple users independently', async () => {
      await StorageService.addMessage('user-1', 'user', 'Message 1');
      await StorageService.addMessage('user-2', 'user', 'Message 2');

      const conv1 = await StorageService.getUserConversation('user-1');
      const conv2 = await StorageService.getUserConversation('user-2');

      expect(conv1[0].content).toBe('Message 1');
      expect(conv2[0].content).toBe('Message 2');
    });
  });

  describe('addMessage', () => {
    it('should add message to new user conversation', async () => {
      await StorageService.addMessage('user-123', 'user', 'Hello world');

      const conversation = await StorageService.getUserConversation('user-123');
      expect(conversation).toHaveLength(1);
      expect(conversation[0].role).toBe('user');
      expect(conversation[0].content).toBe('Hello world');
      expect(conversation[0].timestamp).toBeDefined();
    });

    it('should append message to existing conversation', async () => {
      await StorageService.addMessage('user-123', 'user', 'First message');
      await StorageService.addMessage('user-123', 'assistant', 'Response');
      await StorageService.addMessage('user-123', 'user', 'Second message');

      const conversation = await StorageService.getUserConversation('user-123');
      expect(conversation).toHaveLength(3);
      expect(conversation[2].content).toBe('Second message');
    });

    it('should update lastActivity timestamp', async () => {
      await StorageService.addMessage('user-123', 'user', 'Message 1');

      const fileContent1 = await fs.readFile(TEST_SESSIONS_FILE, 'utf-8');
      const sessions1 = JSON.parse(fileContent1);
      const firstActivity = sessions1[0].lastActivity;

      await new Promise((resolve) => setTimeout(resolve, 10));
      await StorageService.addMessage('user-123', 'user', 'Message 2');

      const fileContent2 = await fs.readFile(TEST_SESSIONS_FILE, 'utf-8');
      const sessions2 = JSON.parse(fileContent2);

      expect(sessions2[0].lastActivity).toBeGreaterThan(firstActivity);
    });

    it('should preserve createdAt timestamp', async () => {
      await StorageService.addMessage('user-123', 'user', 'Message 1');

      const fileContent1 = await fs.readFile(TEST_SESSIONS_FILE, 'utf-8');
      const sessions1 = JSON.parse(fileContent1);
      const originalCreatedAt = sessions1[0].createdAt;

      await new Promise((resolve) => setTimeout(resolve, 10));
      await StorageService.addMessage('user-123', 'user', 'Message 2');

      const fileContent2 = await fs.readFile(TEST_SESSIONS_FILE, 'utf-8');
      const sessions2 = JSON.parse(fileContent2);

      expect(sessions2[0].createdAt).toBe(originalCreatedAt);
    });
  });

  describe('clearUserSession', () => {
    it('should remove user conversation', async () => {
      await StorageService.addMessage('user-123', 'user', 'Hello');
      expect((await StorageService.getUserConversation('user-123')).length).toBeGreaterThan(0);

      await StorageService.clearUserSession('user-123');
      expect(await StorageService.getUserConversation('user-123')).toEqual([]);
    });

    it('should not affect other users', async () => {
      await StorageService.addMessage('user-1', 'user', 'Message 1');
      await StorageService.addMessage('user-2', 'user', 'Message 2');

      await StorageService.clearUserSession('user-1');

      expect(await StorageService.getUserConversation('user-1')).toEqual([]);
      expect((await StorageService.getUserConversation('user-2')).length).toBe(1);
    });

    it('should handle clearing non-existent user gracefully', async () => {
      await StorageService.clearUserSession('non-existent-user');
      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('File System Operations', () => {
    it('should create data directory if it does not exist', async () => {
      await StorageService.addMessage('user-123', 'user', 'Hello');

      const stats = await fs.stat(TEST_DATA_DIR);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create sessions.json file if it does not exist', async () => {
      await StorageService.addMessage('user-123', 'user', 'Hello');

      const stats = await fs.stat(TEST_SESSIONS_FILE);
      expect(stats.isFile()).toBe(true);
    });

    it('should handle corrupted sessions file by recreating it', async () => {
      // Create directory and write invalid JSON
      await fs.mkdir(TEST_DATA_DIR, { recursive: true });
      await fs.writeFile(TEST_SESSIONS_FILE, 'invalid json{{{');

      // The service will catch the error and recreate the file with empty array
      // So getUserConversation should return empty array (file was fixed)
      const result = await StorageService.getUserConversation('user-123');
      expect(result).toEqual([]);

      // File should now be valid JSON
      const fileContent = await fs.readFile(TEST_SESSIONS_FILE, 'utf-8');
      const sessions = JSON.parse(fileContent); // Should not throw
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions).toHaveLength(0);
    });
  });
});
