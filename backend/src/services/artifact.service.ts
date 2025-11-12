import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env.js';
import { watch, FSWatcher } from 'fs';

export interface ArtifactFile {
  path: string;
  relativePath: string;
  content?: string;
  size: number;
  created: Date;
}

export class ArtifactService {
  private static outputDir = config.agentOutputDir;
  private static watchers: Map<string, FSWatcher> = new Map();

  /**
   * Initialize the agent output directory
   */
  static async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
      console.log(`✅ Agent output directory initialized: ${this.outputDir}`);
    } catch (error) {
      console.error('Failed to initialize agent output directory:', error);
      throw error;
    }
  }

  /**
   * Watch for file changes in the agent output directory
   * Calls the callback when files are created or modified
   */
  static watchDirectory(
    sessionId: string,
    callback: (event: 'add' | 'change', filePath: string) => void
  ): void {
    // Close existing watcher for this session if any
    this.stopWatching(sessionId);

    const watcher = watch(
      this.outputDir,
      { recursive: true },
      async (eventType, filename) => {
        if (!filename) return;

        const fullPath = path.join(this.outputDir, filename);

        // Skip directories and hidden files
        if (filename.startsWith('.')) return;

        try {
          const stats = await fs.stat(fullPath);
          if (stats.isDirectory()) return;

          if (eventType === 'rename') {
            // File created or renamed
            callback('add', fullPath);
          } else if (eventType === 'change') {
            // File modified
            callback('change', fullPath);
          }
        } catch (error) {
          // File might have been deleted, ignore
        }
      }
    );

    this.watchers.set(sessionId, watcher);
  }

  /**
   * Stop watching for a specific session
   */
  static stopWatching(sessionId: string): void {
    const watcher = this.watchers.get(sessionId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(sessionId);
    }
  }

  /**
   * Get all files in the agent output directory
   */
  static async getArtifacts(): Promise<ArtifactFile[]> {
    try {
      const artifacts: ArtifactFile[] = [];
      await this.scanDirectory(this.outputDir, artifacts);
      return artifacts;
    } catch (error) {
      console.error('Failed to get artifacts:', error);
      return [];
    }
  }

  /**
   * Recursively scan directory for files
   */
  private static async scanDirectory(
    dir: string,
    artifacts: ArtifactFile[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, artifacts);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          const relativePath = path.relative(this.outputDir, fullPath);

          artifacts.push({
            path: fullPath,
            relativePath,
            size: stats.size,
            created: stats.birthtime,
          });
        }
      }
    } catch (error) {
      console.error(`Failed to scan directory ${dir}:`, error);
    }
  }

  /**
   * Read artifact content
   */
  static async readArtifact(relativePath: string): Promise<string> {
    const fullPath = path.join(this.outputDir, relativePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  /**
   * Clear all artifacts
   */
  static async clearArtifacts(): Promise<void> {
    try {
      await fs.rm(this.outputDir, { recursive: true, force: true });
      await this.initialize();
    } catch (error) {
      console.error('Failed to clear artifacts:', error);
      throw error;
    }
  }
}
