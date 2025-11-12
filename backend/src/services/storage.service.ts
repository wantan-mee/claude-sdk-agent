import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env.js';

const SESSIONS_FILE = path.join(config.dataDir, 'sessions.json');

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface UserSession {
  userId: string;
  conversationHistory: Message[];
  createdAt: number;
  lastActivity: number;
}

export class StorageService {
  /**
   * Get conversation history for a user
   * Returns empty array if no active session
   */
  static async getUserConversation(userId: string): Promise<Message[]> {
    const sessions = await this.loadSessions();
    const userSession = sessions.find((s) => s.userId === userId);
    return userSession?.conversationHistory || [];
  }

  /**
   * Add a message to user's conversation history
   */
  static async addMessage(
    userId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<void> {
    const sessions = await this.loadSessions();
    const existingIndex = sessions.findIndex((s) => s.userId === userId);

    const newMessage: Message = {
      role,
      content,
      timestamp: Date.now(),
    };

    if (existingIndex >= 0) {
      // Update existing session
      sessions[existingIndex].conversationHistory.push(newMessage);
      sessions[existingIndex].lastActivity = Date.now();
    } else {
      // Create new session
      const sessionData: UserSession = {
        userId,
        conversationHistory: [newMessage],
        createdAt: Date.now(),
        lastActivity: Date.now(),
      };
      sessions.push(sessionData);
    }

    await this.saveSessions(sessions);
  }

  /**
   * Clear user conversation (for new conversation)
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
