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
   * Creates a pull request with the provided content and optional media files
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
  
    console.log("GITHUB PR CREATION START =========");
    console.log(`Creating PR for file: ${filename}`);
    console.log(`Media files to upload: ${mediaFiles.length}`);
    mediaFiles.forEach((media, index) => {
      console.log(`Media file ${index+1}: ${media.targetPath} (content length: ${media.content.length})`);
    });
  
    try {
      // 1. Get the latest commit SHA from the base branch
      console.log(`Getting latest commit from ${repository.baseBranch}`);
      const { data: refData } = await this.octokit.git.getRef({
        owner: repository.owner,
        repo: repository.name,
        ref: `heads/${repository.baseBranch}`,
      });
      const baseSha = refData.object.sha;
      console.log(`Base branch SHA: ${baseSha}`);
  
      // 2. Create a new branch from the base branch
      try {
        console.log(`Creating new branch: ${branchName}`);
        await this.octokit.git.createRef({
          owner: repository.owner,
          repo: repository.name,
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        });
        console.log(`Branch created successfully: ${branchName}`);
      } catch (error) {
        // Check if branch already exists
        if (error.status === 422) {
          console.log(`Branch ${branchName} already exists, reusing it`);
        } else {
          console.error(`ERROR creating branch:`, error);
          throw new Error(`Failed to create branch: ${error.message}`);
        }
      }
  
      // 3. Upload the MEDIA FILES FIRST - MODIFIED FOR DEBUGGING
      console.log(`Uploading ${mediaFiles.length} media files...`);
      
      if (mediaFiles.length === 0) {
        console.log("WARNING: No media files to upload!");
      }
      
      for (let i = 0; i < mediaFiles.length; i++) {
        const mediaFile = mediaFiles[i];
        console.log(`\nUploading media ${i+1}/${mediaFiles.length}: ${mediaFile.targetPath}`);
        
        // Validate media content
        if (!mediaFile.content || mediaFile.content.length === 0) {
          console.error(`ERROR: Empty content for ${mediaFile.targetPath}`);
          new Notice(`Error: Media file has empty content: ${mediaFile.targetPath}`);
          continue; // Skip this file but try to continue with others
        }
        
        try {
          console.log(`Making GitHub API call to upload ${mediaFile.targetPath}`);
          console.log(`Content length: ${mediaFile.content.length} characters`);
          
          const response = await this.octokit.repos.createOrUpdateFileContents({
            owner: repository.owner,
            repo: repository.name,
            path: mediaFile.targetPath,
            message: `Add media: ${path.basename(mediaFile.targetPath)}`,
            content: mediaFile.content,
            branch: branchName,
          });
          
          console.log(`SUCCESS: Media file uploaded: ${mediaFile.targetPath}`);
          console.log(`File URL: ${response.data.content?.html_url || 'unknown'}`);
        } catch (error) {
          console.error(`ERROR uploading media file:`, error);
          console.error(`Error details:`, error.message);
          
          if (error.status) {
            console.error(`HTTP Status: ${error.status}`);
          }
          
          if (error.response?.data) {
            console.error(`API Response:`, error.response.data);
          }
          
          new Notice(`Error uploading media file: ${mediaFile.targetPath}`, 5000);
          // Continue with other files instead of aborting entirely
        }
      }
  
      // 4. Create the content file 
      const filePath = repository.targetPath
        ? `${repository.targetPath}/${filename}`.replace(/\/+/g, "/")
        : filename;
  
      console.log(`Creating content file: ${filePath}`);
      try {
        await this.octokit.repos.createOrUpdateFileContents({
          owner: repository.owner,
          repo: repository.name,
          path: filePath,
          message: commitMessage,
          content: Buffer.from(content).toString("base64"),
          branch: branchName,
        });
        console.log(`Content file created successfully: ${filePath}`);
      } catch (contentError) {
        console.error(`ERROR creating content file:`, contentError);
        throw new Error(`Failed to create content file: ${contentError.message}`);
      }
  
      // 5. Create the pull request
      console.log(`Creating pull request with title: "${title}"`);
      try {
        const { data: prData } = await this.octokit.pulls.create({
          owner: repository.owner,
          repo: repository.name,
          title: title,
          body: body,
          head: branchName,
          base: repository.baseBranch,
        });
        console.log(`Pull request created successfully: ${prData.html_url}`);
        console.log("GITHUB PR CREATION END =========");
        return prData.html_url;
      } catch (prError) {
        console.error(`ERROR creating PR:`, prError);
        throw new Error(`Failed to create PR: ${prError.message}`);
      }
    } catch (error) {
      console.error('ERROR in createPullRequest:', error);
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
