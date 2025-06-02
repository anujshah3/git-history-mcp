import { simpleGit, SimpleGit, StatusResult } from 'simple-git';
import { resolve } from 'path';
import { GitCommit, GitFileHistory } from './types.js';

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

  async getFileHistory(filePath: string, limit: number = 10): Promise<GitFileHistory> {
    try {
      const log = await this.git.log({
        file: filePath,
        maxCount: limit,
        format: {
          hash: '%H',
          date: '%ai',
          message: '%s',
          author_name: '%an',
          author_email: '%ae',
        },
      });

      const commits = log.all.map(commit => ({
        hash: commit.hash,
        date: commit.date,
        message: commit.message,
        author: commit.author_name,
        email: commit.author_email,
      }));

      return {
        file: filePath,
        commits,
        totalCommits: commits.length,
      };
    } catch (error) {
      throw new Error(`Failed to get file history for ${filePath}: ${error}`);
    }
  }

  async getFileBlame(filePath: string): Promise<Array<{
    hash: string;
    line: string;
    author: string;
    date: string;
    lineNumber: number;
  }>> {
    try {
      const blame = await this.git.raw(['blame', '--line-porcelain', filePath]);
      const lines = blame.split('\n');
      const result: Array<{
        hash: string;
        line: string;
        author: string;
        date: string;
        lineNumber: number;
      }> = [];

      let currentHash = '';
      let currentAuthor = '';
      let currentDate = '';
      let lineCounter = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // first token in a blame line is the commit hash
        if (line.match(/^[0-9a-f]{40}/)) {
          const parts = line.split(' ');
          currentHash = parts[0];
          lineCounter++;
        } else if (line.startsWith('author ')) {
          currentAuthor = line.substring(7);
        } else if (line.startsWith('author-time ')) {
          const timestamp = parseInt(line.substring(12));
          currentDate = new Date(timestamp * 1000).toISOString();
        } else if (line.startsWith('\t')) {
          // line starting with a tab contain the actual file content
          result.push({
            hash: currentHash,
            author: currentAuthor,
            date: currentDate,
            line: line.substring(1),
            lineNumber: lineCounter,
          });
        }
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to get blame information for ${filePath}: ${error}`);
    }
  }

  async getFileChanges(filePath: string, sinceCommit?: string): Promise<Array<{
    hash: string;
    date: string;
    message: string;
    author: string;
    diff: string;
  }>> {
    try {
      const history = await this.getFileHistory(filePath, sinceCommit ? undefined : 10);
      const commits = history.commits;
      
      // for each commit, get the diff
      const changes = await Promise.all(commits.map(async (commit: GitCommit) => {
        // get the diff for this specific commit and file
        const diff = await this.git.diff([`${commit.hash}^..${commit.hash}`, '--', filePath]);
        
        return {
          hash: commit.hash,
          date: commit.date,
          message: commit.message,
          author: commit.author,
          diff,
        };
      }));

      return changes;
    } catch (error) {
      throw new Error(`Failed to get changes for ${filePath}: ${error}`);
    }
  }

  async getRepositoryChangeSummary(limit: number = 10): Promise<Array<{
    file: string;
    commits: number;
    lastModified: string;
    authors: string[];
  }>> {
    try {
      const files = await this.git.raw(['ls-files']);
      const fileList = files.split('\n').filter(f => f.trim().length > 0);
      
      // for each file, get basic stats
      const fileStats = await Promise.all(
        fileList.slice(0, limit).map(async (file) => {
          const history = await this.getFileHistory(file, 5);
          const uniqueAuthors = [...new Set(history.commits.map((c: GitCommit) => c.author))];
          const lastModified = history.commits.length > 0 ? history.commits[0].date : '';
          
          return {
            file,
            commits: history.totalCommits,
            lastModified,
            authors: uniqueAuthors as string[],
          };
        })
      );

      // sort by no. of commits (most active files first)
      return fileStats.sort((a, b) => b.commits - a.commits);
    } catch (error) {
      throw new Error(`Failed to get repo change summary: ${error}`);
    }
  }

  async getRelatedFiles(filePath: string, limit: number = 5): Promise<Array<{
    file: string;
    coChangeCount: number;
    lastModifiedTogether: string;
  }>> {
    try {
      const fileHistory = await this.getFileHistory(filePath);
      const fileCommits = fileHistory.commits.map(c => c.hash);

      if (fileCommits.length === 0) {
        return [];
      }

      // list of all files in the repo
      const files = await this.git.raw(['ls-files']);
      const fileList = files.split('\n')
        .filter(f => f.trim().length > 0 && f !== filePath);

      // for each file, check how many times it was changed with the target file
      const relatedFiles = await Promise.all(
        fileList.slice(0, Math.min(100, fileList.length)).map(async (file) => {
          const otherFileHistory = await this.getFileHistory(file);
          const otherFileCommits = new Set(otherFileHistory.commits.map(c => c.hash));
          
          // count how many times they were changed together
          const commonCommits = fileCommits.filter(hash => otherFileCommits.has(hash));
          
          if (commonCommits.length === 0) {
            return null;
          }

          // find the most recent common commit
          const lastCommonCommit = fileHistory.commits.find(c =>
            commonCommits.includes(c.hash)
          );

          return {
            file,
            coChangeCount: commonCommits.length,
            lastModifiedTogether: lastCommonCommit?.date || '',
          };
        })
      );

      // filter out nulls and sort by co-change count
      const filteredFiles = relatedFiles
        .filter(f => f !== null) as Array<{
          file: string;
          coChangeCount: number;
          lastModifiedTogether: string;
        }>;
        
      return filteredFiles
        .sort((a, b) => b.coChangeCount - a.coChangeCount)
        .slice(0, limit);
    } catch (error) {
      throw new Error(`failed to get related files for ${filePath}: ${error}`);
    }
  }

  async getCodeOwnership(path: string): Promise<Array<{
    author: string;
    email: string;
    linesChanged: number;
    percentage: number;
  }>> {
    try {
      const shortlog = await this.git.raw([
        'log', 
        '--pretty=format:%an <%ae>', 
        '--numstat',
        '--',
        path
      ]);

      const lines = shortlog.split('\n');
      const ownershipMap = new Map<string, { email: string, linesChanged: number }>();
      
      let currentAuthor = '';
      let currentEmail = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line === '') continue;
        
        // Lines with author info look like "Author Name <email@example.com>"
        if (line.includes('<') && line.includes('>')) {
          const match = line.match(/(.*) <(.*)>/);
          if (match) {
            currentAuthor = match[1];
            currentEmail = match[2];
            
            if (!ownershipMap.has(currentAuthor)) {
              ownershipMap.set(currentAuthor, { email: currentEmail, linesChanged: 0 });
            }
          }
        } else if (line.match(/^\d+\s+\d+\s+/)) {
          // Lines with numbers are stats lines: "<added> <deleted> <filename>"
          const [added, deleted] = line.split(/\s+/).map(n => parseInt(n));
          
          if (!isNaN(added) && !isNaN(deleted) && ownershipMap.has(currentAuthor)) {
            const currentStats = ownershipMap.get(currentAuthor)!;
            ownershipMap.set(currentAuthor, {
              ...currentStats,
              linesChanged: currentStats.linesChanged + added + deleted
            });
          }
        }
      }
      
      // convert map to array and calculate percentages
      const totalLines = Array.from(ownershipMap.values())
        .reduce((sum, { linesChanged }) => sum + linesChanged, 0);
      
      const ownership = Array.from(ownershipMap.entries())
        .map(([author, { email, linesChanged }]) => ({
          author,
          email,
          linesChanged,
          percentage: totalLines === 0 ? 0 : Math.round((linesChanged / totalLines) * 100)
        }))
        .sort((a, b) => b.linesChanged - a.linesChanged);
      
      return ownership;
    } catch (error) {
      throw new Error(`failed to get code ownership information for ${path}: ${error}`);
    }
  }

  async getFileContributors(filePath: string): Promise<Array<{
    author: string;
    email: string;
    commits: number;
    additions: number;
    deletions: number;
  }>> {
    try {
      // get detailed stats with numstat
      const numstat = await this.git.raw([
        'log', 
        '--numstat', 
        '--format="%H %an %ae %at"', 
        '--', 
        filePath
      ]);

      const authorMap = new Map<string, {
        email: string;
        commits: number;
        additions: number;
        deletions: number;
      }>();

      const lines = numstat.split('\n');
      let currentAuthor = '';
      let currentEmail = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (!line) continue; //empty lines
        
        // lines with commit info start with a hash
        if (line.startsWith('"') && line.includes(' ')) {
          const parts = line.substring(1).split(' ');
          if (parts.length >= 3) {
            currentAuthor = parts[1] + " " + parts[2];
            currentEmail = parts[3];
            
            if (!authorMap.has(currentAuthor)) {
              authorMap.set(currentAuthor, {
                email: currentEmail,
                commits: 0,
                additions: 0,
                deletions: 0
              });
            }
            
            const authorInfo = authorMap.get(currentAuthor)!;
            authorInfo.commits += 1;
            authorMap.set(currentAuthor, authorInfo);
          }
        } 
        // lines with stats have format: <additions> <deletions> <file>
        else if (line.match(/^\d+\s+\d+\s+/)) {
          const [adds, dels] = line.split(/\s+/).map(n => parseInt(n));
          
          if (!isNaN(adds) && !isNaN(dels) && authorMap.has(currentAuthor)) {
            const authorInfo = authorMap.get(currentAuthor)!;
            authorInfo.additions += adds;
            authorInfo.deletions += dels;
            authorMap.set(currentAuthor, authorInfo);
          }
        }
      }

      // convert map to array and sort by commit count
      return Array.from(authorMap.entries())
        .map(([author, info]) => ({
          author,
          email: info.email,
          commits: info.commits,
          additions: info.additions,
          deletions: info.deletions
        }))
        .sort((a, b) => b.commits - a.commits);
    } catch (error) {
      throw new Error(`failed to get file contributors for ${filePath}: ${error}`);
    }
  }

  async getFileLifecycle(filePath: string): Promise<{
    creationDate: string;
    changeFrequency: string;
    hotspots: Array<{
      commit: string;
      date: string;
      message: string;
    }>;
  }> {
    try {
      const history = await this.getFileHistory(filePath);
      
      const oldestCommit = history.commits[history.commits.length - 1] || null;
      
      const now = new Date();
      const commits30 = history.commits.filter(c => {
        const commitDate = new Date(c.date);
        const daysDiff = (now.getTime() - commitDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 30;
      }).length;
      
      const commits90 = history.commits.filter(c => {
        const commitDate = new Date(c.date);
        const daysDiff = (now.getTime() - commitDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 90;
      }).length;
      
      const commitsYear = history.commits.filter(c => {
        const commitDate = new Date(c.date);
        const daysDiff = (now.getTime() - commitDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 365;
      }).length;
      
      // Calculate frequency description
      let frequencyDescription = "inactive";
      if (commits30 > 10) {
        frequencyDescription = "very active (10+ changes in last month)";
      } else if (commits30 > 5) {
        frequencyDescription = "active (5+ changes in last month)";
      } else if (commits90 > 10) {
        frequencyDescription = "moderately active (10+ changes in last quarter)";
      } else if (commitsYear > 10) {
        frequencyDescription = "occasionally modified (10+ changes in last year)";
      } else if (commitsYear > 0) {
        frequencyDescription = "rarely modified (less than 10 changes in last year)";
      }
      
      // Find most significant commits (by diff size or important messages)
      const significantCommits = history.commits
        .filter(commit => {
          // Consider commits with important-sounding messages as significant
          const importantPrefixes = ['add', 'fix', 'feature', 'refactor', 'rewrite', 'implement'];
          const message = commit.message.toLowerCase();
          return importantPrefixes.some(prefix => message.startsWith(prefix));
        })
        .slice(0, 5) // yop 5 significant commits
        .map(commit => ({
          commit: commit.hash,
          date: commit.date,
          message: commit.message
        }));
      
      return {
        creationDate: oldestCommit ? oldestCommit.date : '',
        changeFrequency: frequencyDescription,
        hotspots: significantCommits,
      };
    } catch (error) {
      throw new Error(`failed to get file lifecycle information for ${filePath}: ${error}`);
    }
  }
}