import { App, Modal, Setting, Notice, ButtonComponent } from 'obsidian';

import { ContentPublisherSettings, Repository } from '../../settings/settings';
import { GitHubService } from '../../services/github-service';
import { extractFrontmatter, createMetadata, generateSlug } from '../../utils/frontmatter';
import { processTemplates } from '../../utils/templates';

export class PRCreationModal extends Modal {
  private content: string;
  private settings: ContentPublisherSettings;
  private title: string = '';
  private description: string = '';
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
    const [owner, repo] = this.settings.defaultRepository.split('/');
    const foundRepo = this.settings.repositories.find(r => 
      r.owner === owner && r.name === repo
    );
    
    // If repository not found, use the first one or create a fallback
    if (foundRepo) {
      this.selectedRepository = foundRepo;
    } else if (this.settings.repositories.length > 0) {
      this.selectedRepository = this.settings.repositories[0];
    } else {
      // Create a fallback repository if none exist
      this.selectedRepository = {
        owner: 'username',
        name: 'repository',
        baseBranch: 'main',
        targetPath: 'content/posts'
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
    contentEl.addClass('content-publisher-modal');
    
    contentEl.createEl('h2', { text: 'Create GitHub Pull Request' });
    
    // Repository selection
    new Setting(contentEl)
      .setName('Repository')
      .setDesc('Select target repository')
      .addDropdown(dropdown => {
        this.settings.repositories.forEach(repo => {
          dropdown.addOption(`${repo.owner}/${repo.name}`, `${repo.owner}/${repo.name}`);
        });
        dropdown.setValue(this.settings.defaultRepository);
        dropdown.onChange(value => {
          const [owner, name] = value.split('/');
          const repo = this.settings.repositories.find(
            r => r.owner === owner && r.name === name
          );
          if (repo) {
            this.selectedRepository = repo;
          }
        });
      });
    
    // Title
    const titleSetting = new Setting(contentEl)
      .setName('Title')
      .setDesc('Title for your content')
      .addText(text => {
        text.setValue(this.title)
          .onChange(value => {
            this.title = value;
            if (this.slugInput) {
              this.slugInput.value = generateSlug(value);
            }
          });
        this.titleInput = text.inputEl;
      });
    
    // Slug
    const slugSetting = new Setting(contentEl)
      .setName('Slug')
      .setDesc('URL-friendly identifier (auto-generated from title)')
      .addText(text => {
        text.setValue(generateSlug(this.title));
        this.slugInput = text.inputEl;
      });
    
    // Description
    const descSetting = new Setting(contentEl)
      .setName('Description')
      .setDesc('Brief description (will be used in PR)')
      .addTextArea(text => {
        text.setValue(this.description)
          .onChange(value => {
            this.description = value;
          });
        this.descriptionInput = text.inputEl;
        text.inputEl.rows = 4;
      });
    
    // Submit button
    new Setting(contentEl)
      .addButton(btn => {
        this.submitBtn = btn;
        btn.setButtonText('Create Pull Request')
          .setCta()
          .onClick(() => this.createPR());
      });
  }
  
  private async createPR() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    this.submitBtn.setButtonText('Creating PR...');
    this.submitBtn.setDisabled(true);
    
    try {
      if (!this.settings.githubToken) {
        new Notice('GitHub token not configured. Please set it in plugin settings.');
        return;
      }
      
      if (!this.title) {
        new Notice('Title is required');
        return;
      }
      
      // Prepare metadata
      const metadata = createMetadata(this.content, {
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
      
      // Create PR via GitHub service
      const github = new GitHubService(this.settings.githubToken);
      const prUrl = await github.createPullRequest({
        repository: this.selectedRepository,
        filename: processed.filename,
        content: this.content,
        title: processed.prTitle,
        body: processed.prBody,
        commitMessage: processed.commitMessage,
        branchName: processed.branchName
      });
      
      new Notice(`Pull request created successfully!`);
      
      // Open PR in browser
      window.open(prUrl, '_blank');
      
      this.close();
    } catch (error) {
      console.error('Error creating PR:', error);
      new Notice(`Failed to create PR: ${error.message}`);
    } finally {
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