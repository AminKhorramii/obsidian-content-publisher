import { App, Modal, Setting, Notice, ButtonComponent } from "obsidian";

import { ContentPublisherSettings, Repository } from "../../settings/settings";
import { GitHubService } from "../../services/github-service";
import {
  extractFrontmatter,
  createMetadata,
  generateSlug,
} from "../../utils/frontmatter";
import { processTemplates } from "../../utils/templates";
import { MediaHandler, MediaUpload } from "../../services/media-handler";

export class PRCreationModal extends Modal {
  private content: string;
  private settings: ContentPublisherSettings;
  private title: string = "";
  private description: string = "";
  private selectedRepository: Repository;
  private titleInput: HTMLInputElement;
  private slugInput: HTMLInputElement;
  private descriptionInput: HTMLTextAreaElement;
  private submitBtn: ButtonComponent;
  private isSubmitting = false;

  constructor(app: App, content: string, settings: ContentPublisherSettings) {
    super(app);
    this.content = content;
    this.settings = settings;

    // Find the repository based on default settings
    const [owner, repo] = this.settings.defaultRepository.split("/");
    const foundRepo = this.settings.repositories.find(
      (r) => r.owner === owner && r.name === repo
    );

    // If repository not found, use the first one or create a fallback
    if (foundRepo) {
      this.selectedRepository = foundRepo;
    } else if (this.settings.repositories.length > 0) {
      this.selectedRepository = this.settings.repositories[0];
    } else {
      // Create a fallback repository if none exist
      this.selectedRepository = {
        owner: "username",
        name: "repository",
        baseBranch: "main",
        targetPath: "content/posts",
      };
    }

    // Extract metadata from content if enabled
    if (this.settings.extractFrontmatter) {
      const { frontmatter } = extractFrontmatter(content);
      if (frontmatter.title) {
        this.title = frontmatter.title;
      }
      if (frontmatter.description) {
        this.description = frontmatter.description;
      }
    }
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("content-publisher-modal");

    contentEl.createEl("h2", { text: "Create GitHub Pull Request" });

    // Repository selection
    new Setting(contentEl)
      .setName("Repository")
      .setDesc("Select target repository")
      .addDropdown((dropdown) => {
        this.settings.repositories.forEach((repo) => {
          dropdown.addOption(
            `${repo.owner}/${repo.name}`,
            `${repo.owner}/${repo.name}`
          );
        });
        dropdown.setValue(this.settings.defaultRepository);
        dropdown.onChange((value) => {
          const [owner, name] = value.split("/");
          const repo = this.settings.repositories.find(
            (r) => r.owner === owner && r.name === name
          );
          if (repo) {
            this.selectedRepository = repo;
          }
        });
      });

    // Title
    const titleSetting = new Setting(contentEl)
      .setName("Title")
      .setDesc("Title for your content")
      .addText((text) => {
        text.setValue(this.title).onChange((value) => {
          this.title = value;
          if (this.slugInput) {
            this.slugInput.value = generateSlug(value);
          }
        });
        this.titleInput = text.inputEl;
      });

    // Slug
    const slugSetting = new Setting(contentEl)
      .setName("Slug")
      .setDesc("URL-friendly identifier (auto-generated from title)")
      .addText((text) => {
        text.setValue(generateSlug(this.title));
        this.slugInput = text.inputEl;
      });

    // Description
    const descSetting = new Setting(contentEl)
      .setName("Description")
      .setDesc("Brief description (will be used in PR)")
      .addTextArea((text) => {
        text.setValue(this.description).onChange((value) => {
          this.description = value;
        });
        this.descriptionInput = text.inputEl;
        text.inputEl.rows = 4;
      });

    // Submit button
    new Setting(contentEl).addButton((btn) => {
      this.submitBtn = btn;
      btn
        .setButtonText("Create Pull Request")
        .setCta()
        .onClick(() => this.createPR());
    });
  }

  private async createPR() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    this.submitBtn.setButtonText("Creating PR...");
    this.submitBtn.setDisabled(true);

    try {
      if (!this.settings.githubToken) {
        new Notice(
          "GitHub token not configured. Please set it in plugin settings."
        );
        return;
      }

      if (!this.title) {
        new Notice("Title is required");
        return;
      }

      // Initialize GitHub service
      const github = new GitHubService(this.settings.githubToken);
    
      // Process media if enabled
      let processedContent = this.content;
      let mediaFiles: MediaUpload[] = [];
      
      if (this.settings.media.enabled) {
        this.submitBtn.setButtonText('Processing media...');
        
        // Get the active file
        const activeFile = this.app.workspace.getActiveFile();
        
        // Create media handler
        const mediaHandler = new MediaHandler(
          github.getOctokit(),
          this.selectedRepository,
          this.settings.media.targetPath
        );
        
        // Process all media in the content
        try {
          const result = await mediaHandler.processMarkdown(
            processedContent, 
            this.app,
            activeFile
          );
          
          processedContent = result.content;
          mediaFiles = result.mediaFiles;
          
          console.log(`Processed content with ${mediaFiles.length} media files:`);
          console.log(`Media files: ${JSON.stringify(mediaFiles.map(m => m.targetPath))}`);
          
          if (mediaFiles.length > 0) {
            this.submitBtn.setButtonText(`Creating PR with ${mediaFiles.length} media files...`);
          } else {
            this.submitBtn.setButtonText('Creating PR...');
          }
        } catch (error) {
          console.error('Error processing media:', error);
          new Notice(`Media processing error: ${error.message}`);
          // Continue with original content if media processing fails
        }
      }
      
      // Prepare metadata
      const metadata = createMetadata(processedContent, {
        title: this.title,
        description: this.description,
        slug: this.slugInput.value
      });
      
      // Process templates
      const processed = processTemplates({
        branchTemplate: this.settings.branchTemplate,
        commitMessageTemplate: this.settings.commitMessageTemplate,
        prTitleTemplate: this.settings.prTitleTemplate,
        prBodyTemplate: this.settings.prBodyTemplate,
        filenameTemplate: this.settings.filenameTemplate
      }, metadata);
      
      // Make sure we explicitly pass the mediaFiles to the createPullRequest method
      const prUrl = await github.createPullRequest({
        repository: this.selectedRepository,
        filename: processed.filename,
        content: processedContent,
        title: processed.prTitle,
        body: processed.prBody,
        commitMessage: processed.commitMessage,
        branchName: processed.branchName,
        mediaFiles: mediaFiles // Ensure media files are properly passed
      });
      
      new Notice(`Pull request created successfully with ${mediaFiles.length} media files!`);
      
      // Open PR in browser
      window.open(prUrl, '_blank');
      
      this.close();
    } catch (error) {
      console.error('Error creating PR:', error);
      new Notice(`Failed to create PR: ${error.message}`);
      this.isSubmitting = false;
      this.submitBtn.setButtonText('Create Pull Request');
      this.submitBtn.setDisabled(false);
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
