import { Octokit } from '@octokit/rest';
import { Notice } from 'obsidian';

import { Repository } from '../settings/settings';

export interface CreatePROptions {
  repository: Repository;
  filename: string;
  content: string;
  title: string;
  body: string;
  commitMessage: string;
  branchName: string;
}

export class GitHubService {
  private octokit: Octokit;
  
  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }
  
  /**
   * Validates GitHub token by making a simple API call
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.octokit.users.getAuthenticated();
      return true;
    } catch (error) {
      console.error('GitHub token validation failed:', error);
      return false;
    }
  }
  
  /**
   * Creates a pull request with the provided content
   */
  async createPullRequest(options: CreatePROptions): Promise<string> {
    const { repository, filename, content, title, body, commitMessage, branchName } = options;
    
    try {
      // 1. Get the latest commit SHA from the base branch
      const { data: refData } = await this.octokit.git.getRef({
        owner: repository.owner,
        repo: repository.name,
        ref: `heads/${repository.baseBranch}`
      });
      const baseSha = refData.object.sha;
      
      // 2. Create a new branch from the base branch
      await this.octokit.git.createRef({
        owner: repository.owner,
        repo: repository.name,
        ref: `refs/heads/${branchName}`,
        sha: baseSha
      });
      
      // 3. Create/update the file in the new branch
      const filePath = repository.targetPath ? 
        `${repository.targetPath}/${filename}`.replace(/\/+/g, '/') : 
        filename;
      
      await this.octokit.repos.createOrUpdateFileContents({
        owner: repository.owner,
        repo: repository.name,
        path: filePath,
        message: commitMessage,
        content: Buffer.from(content).toString('base64'),
        branch: branchName
      });
      
      // 4. Create the pull request
      const { data: prData } = await this.octokit.pulls.create({
        owner: repository.owner,
        repo: repository.name,
        title: title,
        body: body,
        head: branchName,
        base: repository.baseBranch
      });
      
      return prData.html_url;
    } catch (error) {
      console.error('Error creating pull request:', error);
      throw new Error(`Failed to create PR: ${error.message}`);
    }
  }
  
  /**
   * Fetches repositories the user has access to
   */
  async listRepositories(): Promise<Array<{full_name: string, default_branch: string}>> {
    try {
      const { data } = await this.octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100
      });
      
      return data.map(repo => ({
        full_name: repo.full_name,
        default_branch: repo.default_branch
      }));
    } catch (error) {
      console.error('Error fetching repositories:', error);
      new Notice('Failed to fetch repositories. Check your GitHub token.');
      return [];
    }
  }
}