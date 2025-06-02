import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { GitService } from './git-service.js';
import { GitCommit, GitFileHistory } from './types.js';

class GitHistoryMCPServer {
  private server: Server;
  private gitService: GitService;

  constructor() {
    this.gitService = new GitService();
    this.server = new Server(
      {
        name: 'git-history-mcp',
        version: '0.2.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // Handle resource listing
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'git://status',
            mimeType: 'text/plain',
            name: 'Git Repository Status',
            description: 'Current git repository status, branch, and working directory changes',
          },
          {
            uri: 'git://commits',
            mimeType: 'text/plain',
            name: 'Recent Commits',
            description: 'Recent commit history with messages, authors, and dates',
            parameters: [
              { name: 'limit', description: 'Maximum number of commits to show (default: 10)', required: false },
            ],
          },
          {
            uri: 'git://file/history',
            mimeType: 'text/plain',
            name: 'File History',
            description: 'History of a specific file in the repository',
            parameters: [
              { name: 'path', description: 'Path to the file (relative to repository root)', required: true },
              { name: 'limit', description: 'Maximum number of commits to show', required: false },
            ],
          },
          {
            uri: 'git://file/blame',
            mimeType: 'text/plain',
            name: 'File Blame Information',
            description: 'Blame information showing line-by-line authorship of a file',
            parameters: [
              { name: 'path', description: 'Path to the file (relative to repository root)', required: true },
            ],
          },
          {
            uri: 'git://file/changes',
            mimeType: 'text/plain',
            name: 'File Changes',
            description: 'Recent changes made to a specific file',
            parameters: [
              { name: 'path', description: 'Path to the file (relative to repository root)', required: true },
              { name: 'limit', description: 'Maximum number of changes to show', required: false },
            ],
          },
          {
            uri: 'git://summary',
            mimeType: 'text/plain',
            name: 'Repository Change Summary',
            description: 'Summary of changes across the repository',
            parameters: [
              { name: 'limit', description: 'Maximum number of files to include', required: false },
            ],
          },
          {
            uri: 'git://file/related',
            mimeType: 'text/plain',
            name: 'Related Files',
            description: 'Find files that are commonly changed together with a specific file',
            parameters: [
              { name: 'path', description: 'Path to the file (relative to repository root)', required: true },
              { name: 'limit', description: 'Maximum number of related files to show', required: false },
            ],
          },
          {
            uri: 'git://ownership',
            mimeType: 'text/plain',
            name: 'Code Ownership',
            description: 'Get code ownership information for a file or directory',
            parameters: [
              { name: 'path', description: 'Path to the file or directory (relative to repository root)', required: true },
            ],
          },
          {
            uri: 'git://file/contributors',
            mimeType: 'text/plain',
            name: 'File Contributors',
            description: 'List of all contributors to a specific file with their activity information',
            parameters: [
              { name: 'path', description: 'Path to the file (relative to repository root)', required: true },
            ],
          },
          {
            uri: 'git://file/lifecycle',
            mimeType: 'text/plain',
            name: 'File Lifecycle',
            description: 'Detailed lifecycle information for a file including creation date, change frequency, and significant changes',
            parameters: [
              { name: 'path', description: 'Path to the file (relative to repository root)', required: true },
            ],
          },
        ],
      };
    });

    // Handle resource reading
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      const queryParams = new URLSearchParams(uri.split('?')[1] || '');

      try {
        const repoInfo = await this.gitService.getRepositoryInfo();
        
        if (!repoInfo.isRepo) {
          return {
            contents: [
              {
                uri,
                mimeType: 'text/plain',
                text: `Not a Git repository: ${repoInfo.path}`,
              },
            ],
          };
        }

        if (uri === 'git://status') {
          const status = await this.gitService.getStatus();
          const statusText = this.formatGitStatus(repoInfo, status);
          
          return {
            contents: [
              {
                uri,
                mimeType: 'text/plain',
                text: statusText,
              },
            ],
          };
        }

        if (uri.startsWith('git://commits')) {
          const limitParam = queryParams.get('limit');
          let limit = 10;
          
          if (limitParam) {
            const parsedLimit = parseInt(limitParam, 10);
            if (!isNaN(parsedLimit) && parsedLimit > 0) {
              limit = parsedLimit;
            }
          }
          
          const commits = await this.gitService.getRecentCommits(limit);
          const commitsText = this.formatCommitHistory(commits, limit);
          
          return {
            contents: [
              {
                uri,
                mimeType: 'text/plain',
                text: commitsText,
              },
            ],
          };
        }

        if (uri.startsWith('git://file/history')) {
          const filePath = queryParams.get('path');
          if (!filePath) {
            throw new Error('Missing required parameter: path');
          }
          
          const limit = queryParams.get('limit') ? parseInt(queryParams.get('limit')!) : 10;
          const fileHistory = await this.gitService.getFileHistory(filePath, limit);
          const historyText = this.formatFileHistory(fileHistory);
          
          return {
            contents: [
              {
                uri,
                mimeType: 'text/plain',
                text: historyText,
              },
            ],
          };
        }

        if (uri.startsWith('git://file/blame')) {
          const filePath = queryParams.get('path');
          if (!filePath) {
            throw new Error('Missing required parameter: path');
          }
          
          const blameInfo = await this.gitService.getFileBlame(filePath);
          const blameText = this.formatFileBlame(filePath, blameInfo);
          
          return {
            contents: [
              {
                uri,
                mimeType: 'text/plain',
                text: blameText,
              },
            ],
          };
        }

        if (uri.startsWith('git://file/changes')) {
          const filePath = queryParams.get('path');
          if (!filePath) {
            throw new Error('Missing required parameter: path');
          }
          
          const limit = queryParams.get('limit') ? parseInt(queryParams.get('limit')!) : 5;
          const fileChanges = await this.gitService.getFileChanges(filePath);
          const changesText = this.formatFileChanges(filePath, fileChanges.slice(0, limit));
          
          return {
            contents: [
              {
                uri,
                mimeType: 'text/plain',
                text: changesText,
              },
            ],
          };
        }

        if (uri.startsWith('git://summary')) {
          const limit = queryParams.get('limit') ? parseInt(queryParams.get('limit')!) : 10;
          const summary = await this.gitService.getRepositoryChangeSummary(limit);
          const summaryText = this.formatChangeSummary(summary);
          
          return {
            contents: [
              {
                uri,
                mimeType: 'text/plain',
                text: summaryText,
              },
            ],
          };
        }

        if (uri.startsWith('git://file/related')) {
          const filePath = queryParams.get('path');
          if (!filePath) {
            throw new Error('Missing required parameter: path');
          }
          
          const limit = queryParams.get('limit') ? parseInt(queryParams.get('limit')!) : 5;
          const relatedFiles = await this.gitService.getRelatedFiles(filePath, limit);
          const relatedFilesText = this.formatRelatedFiles(filePath, relatedFiles);
          
          return {
            contents: [
              {
                uri,
                mimeType: 'text/plain',
                text: relatedFilesText,
              },
            ],
          };
        }

        if (uri.startsWith('git://ownership')) {
          const path = queryParams.get('path');
          if (!path) {
            throw new Error('Missing required parameter: path');
          }
          
          const ownership = await this.gitService.getCodeOwnership(path);
          const ownershipText = this.formatCodeOwnership(path, ownership);
          
          return {
            contents: [
              {
                uri,
                mimeType: 'text/plain',
                text: ownershipText,
              },
            ],
          };
        }

        if (uri.startsWith('git://file/contributors')) {
          const filePath = queryParams.get('path');
          if (!filePath) {
            throw new Error('Missing required parameter: path');
          }
          
          const contributors = await this.gitService.getFileContributors(filePath);
          const contributorsText = this.formatFileContributors(filePath, contributors);
          
          return {
            contents: [
              {
                uri,
                mimeType: 'text/plain',
                text: contributorsText,
              },
            ],
          };
        }

        if (uri.startsWith('git://file/lifecycle')) {
          const filePath = queryParams.get('path');
          if (!filePath) {
            throw new Error('Missing required parameter: path');
          }
          
          const lifecycleInfo = await this.gitService.getFileLifecycle(filePath);
          const lifecycleText = this.formatFileLifecycle(filePath, lifecycleInfo);
          
          return {
            contents: [
              {
                uri,
                mimeType: 'text/plain',
                text: lifecycleText,
              },
            ],
          };
        }

        throw new Error(`Unknown resource: ${uri}`);
      } catch (error) {
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: `Error reading Git information: ${error}`,
            },
          ],
        };
      }
    });

    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      throw new Error(`Unknown tool: ${request.params.name}`);
    });
  }

  private formatGitStatus(repoInfo: any, status: any): string {
    const lines: string[] = [];
    
    lines.push(`git repo: ${repoInfo.path}`);
    lines.push(`current branch: ${status.currentBranch || 'detached HEAD'}`);
    lines.push(`repo status: ${status.isClean ? 'Clean' : 'Has changes'}`);
    
    if (status.ahead > 0 || status.behind > 0) {
      lines.push(`branch status: ${status.ahead} ahead, ${status.behind} behind`);
    }
    
    if (status.staged.length > 0) {
      lines.push(`\nstaged files (${status.staged.length}):`);
      status.staged.forEach((file: string) => lines.push(`  + ${file}`));
    }
    
    if (status.modified.length > 0) {
      lines.push(`\nmodified files (${status.modified.length}):`);
      status.modified.forEach((file: string) => lines.push(`  M ${file}`));
    }
    
    if (status.untracked.length > 0) {
      lines.push(`\nuntracked files (${status.untracked.length}):`);
      status.untracked.forEach((file: string) => lines.push(`  ? ${file}`));
    }
    
    if (status.isClean) {
      lines.push('\nworking directory is clean');
    }
    
    return lines.join('\n');
  }

  private formatCommitHistory(commits: GitCommit[], limit: number): string {
    if (commits.length === 0) {
      return 'no commits found in repository';
    }

    const lines: string[] = [];
    lines.push(`recent commits (showing ${commits.length} of last ${limit}):`);
    lines.push('');

    commits.forEach((commit, index) => {
      const shortHash = commit.hash.substring(0, 7);
      const date = new Date(commit.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      
      lines.push(`${index + 1}. ${shortHash} - ${commit.message}`);
      lines.push(`   Author: ${commit.author} (${commit.email})`);
      lines.push(`   Date: ${date}`);
      lines.push('');
    });

    return lines.join('\n');
  }

  private formatFileHistory(fileHistory: GitFileHistory): string {
    if (fileHistory.commits.length === 0) {
      return `No commit history found for file: ${fileHistory.file}`;
    }

    const lines: string[] = [];
    lines.push(`File History for: ${fileHistory.file}`);
    lines.push(`Total commits: ${fileHistory.totalCommits}`);
    lines.push('');

    fileHistory.commits.forEach((commit, index) => {
      const shortHash = commit.hash.substring(0, 7);
      const date = new Date(commit.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      
      lines.push(`${index + 1}. ${shortHash} - ${commit.message}`);
      lines.push(`   Author: ${commit.author} (${commit.email})`);
      lines.push(`   Date: ${date}`);
      lines.push('');
    });

    return lines.join('\n');
  }

  private formatFileBlame(filePath: string, blameInfo: Array<{
    hash: string;
    line: string;
    author: string;
    date: string;
    lineNumber: number;
  }>): string {
    if (blameInfo.length === 0) {
      return `No blame information found for file: ${filePath}`;
    }

    const lines: string[] = [];
    lines.push(`Blame Information for: ${filePath}`);
    lines.push(`Total lines: ${blameInfo.length}`);
    lines.push('');
    lines.push('Line | Commit  | Author          | Date       | Content');
    lines.push('-'.repeat(80));

    blameInfo.forEach((line) => {
      const shortHash = line.hash.substring(0, 7);
      const shortDate = new Date(line.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const author = line.author.length > 15 ? line.author.substring(0, 12) + '...' : line.author.padEnd(15);
      const lineNum = line.lineNumber.toString().padStart(4);
      const content = line.line.length > 40 ? line.line.substring(0, 37) + '...' : line.line;
      
      lines.push(`${lineNum} | ${shortHash} | ${author} | ${shortDate} | ${content}`);
    });

    return lines.join('\n');
  }

  private formatFileChanges(filePath: string, changes: Array<{
    hash: string;
    date: string;
    message: string;
    author: string;
    diff: string;
  }>): string {
    if (changes.length === 0) {
      return `No changes found for file: ${filePath}`;
    }

    const lines: string[] = [];
    lines.push(`Recent Changes for: ${filePath}`);
    lines.push(`Total changes: ${changes.length}`);
    lines.push('');

    changes.forEach((change, index) => {
      const shortHash = change.hash.substring(0, 7);
      const date = new Date(change.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      
      lines.push(`Change ${index + 1}: ${shortHash} - ${change.message}`);
      lines.push(`Author: ${change.author}`);
      lines.push(`Date: ${date}`);
      lines.push('');
      lines.push('Diff:');
      lines.push('```');
      lines.push(change.diff);
      lines.push('```');
      lines.push('');
    });

    return lines.join('\n');
  }

  private formatChangeSummary(summary: Array<{
    file: string;
    commits: number;
    lastModified: string;
    authors: string[];
  }>): string {
    if (summary.length === 0) {
      return 'No files found in the repository';
    }

    const lines: string[] = [];
    lines.push(`Repository Change Summary (Top ${summary.length} files)`);
    lines.push('');
    lines.push('File | Commits | Last Modified | Authors');
    lines.push('-'.repeat(80));

    summary.forEach((file) => {
      const fileName = file.file.length > 30 ? file.file.substring(0, 27) + '...' : file.file.padEnd(30);
      const commits = file.commits.toString().padStart(7);
      const date = new Date(file.lastModified).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      const authors = file.authors.length > 3 
        ? file.authors.slice(0, 2).join(', ') + `, +${file.authors.length - 2} more`
        : file.authors.join(', ');
      
      lines.push(`${fileName} | ${commits} | ${date} | ${authors}`);
    });

    return lines.join('\n');
  }

  private formatRelatedFiles(filePath: string, relatedFiles: Array<{
    file: string;
    coChangeCount: number;
    lastModifiedTogether: string;
  }>): string {
    if (relatedFiles.length === 0) {
      return `No related files found for: ${filePath}`;
    }

    const lines: string[] = [];
    lines.push(`Files Related to: ${filePath}`);
    lines.push(`Found ${relatedFiles.length} related files`);
    lines.push('');
    lines.push('File | Co-changes | Last Modified Together');
    lines.push('-'.repeat(80));

    relatedFiles.forEach((related) => {
      const fileName = related.file.length > 40 ? related.file.substring(0, 37) + '...' : related.file.padEnd(40);
      const coChanges = related.coChangeCount.toString().padStart(10);
      const date = related.lastModifiedTogether ? new Date(related.lastModifiedTogether).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }) : 'N/A';
      
      lines.push(`${fileName} | ${coChanges} | ${date}`);
    });

    lines.push('');
    lines.push('Files that are frequently changed together often have logical dependencies.');

    return lines.join('\n');
  }

  private formatCodeOwnership(path: string, ownership: Array<{
    author: string;
    email: string;
    linesChanged: number;
    percentage: number;
  }>): string {
    if (ownership.length === 0) {
      return `No code ownership information found for: ${path}`;
    }

    const totalLinesChanged = ownership.reduce((sum, owner) => sum + owner.linesChanged, 0);
    
    const lines: string[] = [];
    lines.push(`Code Ownership for: ${path}`);
    lines.push(`Total contributors: ${ownership.length}`);
    lines.push(`Total lines changed: ${totalLinesChanged}`);
    lines.push('');
    lines.push('Author | Email | Lines Changed | Percentage');
    lines.push('-'.repeat(80));

    ownership.forEach((owner) => {
      const author = owner.author.length > 20 ? owner.author.substring(0, 17) + '...' : owner.author.padEnd(20);
      const email = owner.email.length > 25 ? owner.email.substring(0, 22) + '...' : owner.email.padEnd(25);
      const linesChanged = owner.linesChanged.toString().padStart(12);
      const percentage = `${owner.percentage}%`.padStart(10);
      
      lines.push(`${author} | ${email} | ${linesChanged} | ${percentage}`);
    });

    return lines.join('\n');
  }

  private formatFileContributors(filePath: string, contributors: Array<{
    author: string;
    email: string;
    commits: number;
    additions: number;
    deletions: number;
  }>): string {
    if (contributors.length === 0) {
      return `No contributors found for file: ${filePath}`;
    }

    const lines: string[] = [];
    lines.push(`Contributors to: ${filePath}`);
    lines.push(`Total contributors: ${contributors.length}`);
    lines.push('');
    lines.push('Author | Email | Commits | Lines Added | Lines Deleted | Impact');
    lines.push('-'.repeat(100));

    contributors.forEach((contributor, index) => {
      const author = contributor.author.length > 20 ? contributor.author.substring(0, 17) + '...' : contributor.author.padEnd(20);
      const email = contributor.email.length > 25 ? contributor.email.substring(0, 22) + '...' : contributor.email.padEnd(25);
      const commits = contributor.commits.toString().padStart(7);
      const additions = contributor.additions.toString().padStart(10);
      const deletions = contributor.deletions.toString().padStart(12);
      
      // Calculate impact score (simple metric: additions + deletions)
      const impact = contributor.additions + contributor.deletions;
      const impactStr = impact.toString().padStart(6);
      
      lines.push(`${author} | ${email} | ${commits} | ${additions} | ${deletions} | ${impactStr}`);
    });

    return lines.join('\n');
  }

  private formatFileLifecycle(filePath: string, lifecycle: {
    creationDate: string;
    changeFrequency: string;
    hotspots: Array<{
      commit: string;
      date: string;
      message: string;
    }>;
  }): string {
    const lines: string[] = [];
    lines.push(`File Lifecycle Information for: ${filePath}`);
    lines.push('');
    
    const creationDate = lifecycle.creationDate 
      ? new Date(lifecycle.creationDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }) 
      : 'Unknown';
    
    lines.push(`Created: ${creationDate}`);
    lines.push(`Change Frequency: ${lifecycle.changeFrequency}`);
    lines.push('');
    
    if (lifecycle.hotspots.length > 0) {
      lines.push('Significant commits:');
      lines.push('-'.repeat(80));
      
      lifecycle.hotspots.forEach((hotspot, index) => {
        const shortHash = hotspot.commit.substring(0, 7);
        const date = new Date(hotspot.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        
        lines.push(`${index + 1}. ${shortHash} (${date}): ${hotspot.message}`);
      });
    } else {
      lines.push('No significant commits found');
    }
    
    lines.push('');
    lines.push('File lifecycle analysis helps understand the evolution and maintenance patterns of code.');
    
    return lines.join('\n');
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Git History MCP server running on stdio');
  }
}

const server = new GitHistoryMCPServer();
server.run().catch(console.error);