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

export interface GitDiffResult {
  files: Array<{
    file: string;
    changes: number;
    insertions: number;
    deletions: number;
    binary: boolean;
  }>;
  summary: {
    changes: number;
    insertions: number;
    deletions: number;
  };
}

export interface GitSearchResult {
  file: string;
  line: number;
  content: string;
}

export interface GitBranchSummary {
  branches: GitBranch[];
  current: string;
  all: string[];
}