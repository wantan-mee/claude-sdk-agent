import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env.js';

const SESSIONS_FILE = path.join(config.dataDir, 'sessions.json');

export interface UserSession {
  userId: string;
  sessionId: string;
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
    const userSession = sessions.find((s) => s.userId === userId);
    return userSession?.sessionId;
  }

  /**
   * Create or update user session mapping
   */
  static async saveUserSession(userId: string, sessionId: string): Promise<void> {
    const sessions = await this.loadSessions();
    const existingIndex = sessions.findIndex((s) => s.userId === userId);

    const sessionData: UserSession = {
      userId,
      sessionId,
      createdAt: existingIndex >= 0 ? sessions[existingIndex].createdAt : Date.now(),
      lastActivity: Date.now(),
    };

    if (existingIndex >= 0) {
      sessions[existingIndex] = sessionData;
    } else {
      sessions.push(sessionData);
    }

    await this.saveSessions(sessions);
  }

  /**
   * Clear user session (for new conversation)
   */
  static async clearUserSession(userId: string): Promise<void> {
    const sessions = await this.loadSessions();
    const filtered = sessions.filter((s) => s.userId !== userId);
    await this.saveSessions(filtered);
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
      await fs.mkdir(config.dataDir, { recursive: true });
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
