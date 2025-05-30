import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

class GitHistoryMCPServer {
  private server: Server;

  constructor() {
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
            name: 'Git Status',
            description: 'Current git repository status and branch information',
          },
        ],
      };
    });

    // Handle resource reading
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      if (uri === 'git://status') {
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: 'Git status functionality will be implemented in next steps',
            },
          ],
        };
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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Git History MCP server running on stdio');
  }
}

const server = new GitHistoryMCPServer();
server.run().catch(console.error);