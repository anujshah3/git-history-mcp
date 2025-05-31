import { simpleGit, SimpleGit, StatusResult } from 'simple-git';
import { resolve } from 'path';
import { GitCommit } from './types.js';

export interface GitStatus {
  currentBranch: string | null;
  isClean: boolean;
  staged: string[];
  modified: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

export class GitService {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string = process.cwd()) {
    this.repoPath = resolve(repoPath);
    this.git = simpleGit(this.repoPath);
  }

  /**
   * Check if the current directory is a Git repository
   */
  async isGitRepository(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the root directory of the Git repository
   */
  async getRepositoryRoot(): Promise<string> {
    try {
      const rootPath = await this.git.revparse(['--show-toplevel']);
      return rootPath.trim();
    } catch (error) {
      throw new Error('Not in a Git repository');
    }
  }

  /**
   * Get current Git status information
   */
  async getStatus(): Promise<GitStatus> {
    try {
      const status: StatusResult = await this.git.status();
      
      return {
        currentBranch: status.current || null,
        isClean: status.isClean(),
        staged: status.staged,
        modified: status.modified,
        untracked: status.not_added,
        ahead: status.ahead,
        behind: status.behind,
      };
    } catch (error) {
      throw new Error(`Failed to get Git status: ${error}`);
    }
  }

  /**
   * Get basic repository information
   */
  async getRepositoryInfo(): Promise<{
    path: string;
    isRepo: boolean;
    currentBranch: string | null;
  }> {
    const isRepo = await this.isGitRepository();
    
    if (!isRepo) {
      return {
        path: this.repoPath,
        isRepo: false,
        currentBranch: null,
      };
    }

    const status = await this.getStatus();
    const rootPath = await this.getRepositoryRoot();

    return {
      path: rootPath,
      isRepo: true,
      currentBranch: status.currentBranch,
    };
  }

  async getRecentCommits(limit: number = 10): Promise<GitCommit[]> {
    try {
      const log = await this.git.log({
        maxCount: limit,
        format: {
          hash: '%H',
          date: '%ai',
          message: '%s',
          author_name: '%an',
          author_email: '%ae',
        },
      });

      return log.all.map(commit => ({
        hash: commit.hash,
        date: commit.date,
        message: commit.message,
        author: commit.author_name,
        email: commit.author_email,
      }));
    } catch (error) {
      throw new Error(`Failed to get commit history: ${error}`);
    }
  }
}