import { Octokit } from "@octokit/rest";
import { Notice } from "obsidian";
import { Repository } from "../settings/settings";
import { MediaUpload } from "./media-handler";
import path from "path";

export interface CreatePROptions {
  repository: Repository;
  filename: string;
  content: string;
  title: string;
  body: string;
  commitMessage: string;
  branchName: string;
  mediaFiles?: MediaUpload[]; // Add this field
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
      console.error("GitHub token validation failed:", error);
      return false;
    }
  }

  /**
   * Get the Octokit instance for direct API access
   */
  getOctokit(): Octokit {
    return this.octokit;
  }

  /**
   * Creates or updates a file in the repository
   * This handles the SHA requirement for existing files
   */
  private async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch: string
  ): Promise<void> {
    try {
      // First try to get the file to see if it exists
      let fileSha: string | undefined;

      try {
        // Check if file already exists
        const { data } = await this.octokit.repos.getContent({
          owner,
          repo,
          path,
          ref: branch,
        });

        // If file exists, get its SHA
        if (!Array.isArray(data) && data.sha) {
          fileSha = data.sha;
          console.log(`File already exists: ${path}, SHA: ${fileSha}`);
        }
      } catch (error) {
        // File doesn't exist, which is fine - we'll create it
        console.log(`File doesn't exist yet: ${path}`);
      }

      // Create or update the file with SHA if it exists
      const params: any = {
        owner,
        repo,
        path,
        message,
        content,
        branch,
      };

      // Only add SHA if file exists
      if (fileSha) {
        params.sha = fileSha;
      }

      await this.octokit.repos.createOrUpdateFileContents(params);
      console.log(`File created/updated successfully: ${path}`);
    } catch (error) {
      console.error(`Error creating/updating file: ${path}`, error);
      throw error;
    }
  }

  /**
   * Creates a pull request with the provided content and media files
   */
  async createPullRequest(options: CreatePROptions): Promise<string> {
    const {
      repository,
      filename,
      content,
      title,
      body,
      commitMessage,
      branchName,
      mediaFiles = [],
    } = options;

    console.log(`Creating PR with ${mediaFiles.length} media files`);

    try {
      // 1. Get the latest commit SHA from the base branch
      const { data: refData } = await this.octokit.git.getRef({
        owner: repository.owner,
        repo: repository.name,
        ref: `heads/${repository.baseBranch}`,
      });
      const baseSha = refData.object.sha;

      // 2. Create a new branch from the base branch
      try {
        await this.octokit.git.createRef({
          owner: repository.owner,
          repo: repository.name,
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        });
        console.log(`Created branch: ${branchName}`);
      } catch (error) {
        // Check if branch already exists
        if (error.status === 422) {
          console.log(`Branch ${branchName} already exists, reusing it`);
        } else {
          throw error;
        }
      }

      // 3. Upload the MEDIA FILES FIRST
      for (const mediaFile of mediaFiles) {
        try {
          console.log(`Uploading media file: ${mediaFile.targetPath}`);
          await this.createOrUpdateFile(
            repository.owner,
            repository.name,
            mediaFile.targetPath,
            mediaFile.content,
            `Add media: ${path.basename(mediaFile.targetPath)}`,
            branchName
          );
        } catch (error) {
          console.error(
            `Error uploading media file ${mediaFile.targetPath}:`,
            error
          );
          new Notice(
            `Error uploading media file: ${mediaFile.targetPath}`,
            5000
          );
          throw error;
        }
      }

      // 4. Create the content file
      const filePath = repository.targetPath
        ? `${repository.targetPath}/${filename}`.replace(/\/+/g, "/")
        : filename;

      console.log(`Creating content file: ${filePath}`);
      await this.createOrUpdateFile(
        repository.owner,
        repository.name,
        filePath,
        Buffer.from(content).toString("base64"),
        commitMessage,
        branchName
      );

      // 5. Create the pull request
      console.log(`Creating pull request with title: "${title}"`);
      const { data: prData } = await this.octokit.pulls.create({
        owner: repository.owner,
        repo: repository.name,
        title: title,
        body: body,
        head: branchName,
        base: repository.baseBranch,
      });

      return prData.html_url;
    } catch (error) {
      console.error("Error creating pull request:", error);
      throw new Error(`Failed to create PR: ${error.message}`);
    }
  }

  /**
   * Fetches repositories the user has access to
   */
  async listRepositories(): Promise<
    Array<{ full_name: string; default_branch: string }>
  > {
    try {
      const { data } = await this.octokit.repos.listForAuthenticatedUser({
        sort: "updated",
        per_page: 100,
      });

      return data.map((repo) => ({
        full_name: repo.full_name,
        default_branch: repo.default_branch,
      }));
    } catch (error) {
      console.error("Error fetching repositories:", error);
      new Notice("Failed to fetch repositories. Check your GitHub token.");
      return [];
    }
  }
}
