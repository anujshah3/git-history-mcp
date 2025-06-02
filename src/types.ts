/**
 * Common types for Git History MCP Server
 */

export interface GitCommit {
  hash: string;
  date: string;
  message: string;
  author: string;
  email: string;
}

export interface GitFileHistory {
  file: string;
  commits: GitCommit[];
  totalCommits: number;
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
  lastCommit?: GitCommit;
}

export interface MCPError extends Error {
  code?: string;
  details?: any;
}

export interface GitFileContributor {
  author: string;
  email: string;
  commits: number;
  additions: number;
  deletions: number;
}

export interface GitFileLifecycle {
  creationDate: string;
  changeFrequency: string;
  hotspots: Array<{
    commit: string;
    date: string;
    message: string;
  }>;
}