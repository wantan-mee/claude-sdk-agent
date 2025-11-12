import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

const TEST_DATA_DIR = path.join(process.cwd(), 'test-data');
const TEST_SESSIONS_FILE = path.join(TEST_DATA_DIR, 'sessions.json');

// Mock config - must use literal value, not computed path
vi.mock('../config/env.js', () => ({
  config: {
    dataDir: './test-data',
    anthropicApiKey: 'test-key',
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

  describe('getUserSession', () => {
    it('should return undefined for non-existent user', async () => {
      const sessionId = await StorageService.getUserSession('user-123');
      expect(sessionId).toBeUndefined();
    });

    it('should return session ID for existing user', async () => {
      // First save a session
      await StorageService.saveUserSession('user-123', 'session-abc');

      // Then retrieve it
      const sessionId = await StorageService.getUserSession('user-123');
      expect(sessionId).toBe('session-abc');
    });

    it('should handle multiple users', async () => {
      await StorageService.saveUserSession('user-1', 'session-1');
      await StorageService.saveUserSession('user-2', 'session-2');
      await StorageService.saveUserSession('user-3', 'session-3');

      expect(await StorageService.getUserSession('user-1')).toBe('session-1');
      expect(await StorageService.getUserSession('user-2')).toBe('session-2');
      expect(await StorageService.getUserSession('user-3')).toBe('session-3');
    });
  });

  describe('saveUserSession', () => {
    it('should create new user session', async () => {
      await StorageService.saveUserSession('user-123', 'session-abc');

      const sessionId = await StorageService.getUserSession('user-123');
      expect(sessionId).toBe('session-abc');

      // Verify file was created
      const fileContent = await fs.readFile(TEST_SESSIONS_FILE, 'utf-8');
      const sessions = JSON.parse(fileContent);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].userId).toBe('user-123');
      expect(sessions[0].sessionId).toBe('session-abc');
      expect(sessions[0].createdAt).toBeDefined();
      expect(sessions[0].lastActivity).toBeDefined();
    });

    it('should update existing user session', async () => {
      // Create initial session
      await StorageService.saveUserSession('user-123', 'session-abc');
      const firstSession = await StorageService.getUserSession('user-123');
      expect(firstSession).toBe('session-abc');

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update session
      await StorageService.saveUserSession('user-123', 'session-xyz');
      const updatedSession = await StorageService.getUserSession('user-123');
      expect(updatedSession).toBe('session-xyz');

      // Verify only one session exists
      const fileContent = await fs.readFile(TEST_SESSIONS_FILE, 'utf-8');
      const sessions = JSON.parse(fileContent);
      expect(sessions).toHaveLength(1);
    });

    it('should preserve createdAt timestamp when updating', async () => {
      await StorageService.saveUserSession('user-123', 'session-abc');

      const fileContent1 = await fs.readFile(TEST_SESSIONS_FILE, 'utf-8');
      const sessions1 = JSON.parse(fileContent1);
      const originalCreatedAt = sessions1[0].createdAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      await StorageService.saveUserSession('user-123', 'session-xyz');

      const fileContent2 = await fs.readFile(TEST_SESSIONS_FILE, 'utf-8');
      const sessions2 = JSON.parse(fileContent2);

      expect(sessions2[0].createdAt).toBe(originalCreatedAt);
      expect(sessions2[0].lastActivity).toBeGreaterThan(originalCreatedAt);
    });
  });

  describe('clearUserSession', () => {
    it('should remove user session', async () => {
      await StorageService.saveUserSession('user-123', 'session-abc');
      expect(await StorageService.getUserSession('user-123')).toBe('session-abc');

      await StorageService.clearUserSession('user-123');
      expect(await StorageService.getUserSession('user-123')).toBeUndefined();
    });

    it('should not affect other users', async () => {
      await StorageService.saveUserSession('user-1', 'session-1');
      await StorageService.saveUserSession('user-2', 'session-2');

      await StorageService.clearUserSession('user-1');

      expect(await StorageService.getUserSession('user-1')).toBeUndefined();
      expect(await StorageService.getUserSession('user-2')).toBe('session-2');
    });

    it('should handle clearing non-existent user gracefully', async () => {
      await StorageService.clearUserSession('non-existent-user');
      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('File System Operations', () => {
    it('should create data directory if it does not exist', async () => {
      await StorageService.saveUserSession('user-123', 'session-abc');

      const stats = await fs.stat(TEST_DATA_DIR);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create sessions.json file if it does not exist', async () => {
      await StorageService.saveUserSession('user-123', 'session-abc');

      const stats = await fs.stat(TEST_SESSIONS_FILE);
      expect(stats.isFile()).toBe(true);
    });

    it('should handle corrupted sessions file by recreating it', async () => {
      // Create directory and write invalid JSON
      await fs.mkdir(TEST_DATA_DIR, { recursive: true });
      await fs.writeFile(TEST_SESSIONS_FILE, 'invalid json{{{');

      // The service will catch the error and recreate the file with empty array
      // So getUserSession should return undefined (file was fixed)
      const result = await StorageService.getUserSession('user-123');
      expect(result).toBeUndefined();

      // File should now be valid JSON
      const fileContent = await fs.readFile(TEST_SESSIONS_FILE, 'utf-8');
      const sessions = JSON.parse(fileContent); // Should not throw
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions).toHaveLength(0);
    });
  });
});
