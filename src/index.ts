import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { GitService } from './git-service.js';

class GitHistoryMCPServer {
  private server: Server;
  private gitService: GitService;

  constructor() {
    this.gitService = new GitService();
    this.server = new Server(
      {
        name: 'git-history-mcp',
        version: '0.1.0',
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
        ],
      };
    });

    // Handle resource reading
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      if (uri === 'git://status') {
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
        } catch (error) {
          return {
            contents: [
              {
                uri,
                mimeType: 'text/plain',
                text: `Error reading Git status: ${error}`,
              },
            ],
          };
        }
      }

      throw new Error(`Unknown resource: ${uri}`);
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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Git History MCP server running on stdio');
  }
}

const server = new GitHistoryMCPServer();
server.run().catch(console.error);