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