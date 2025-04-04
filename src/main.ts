import { Plugin, Editor, MarkdownView, Notice } from 'obsidian';
import { ContentPublisherSettings, DEFAULT_SETTINGS } from './settings/settings';
import { SettingsTab } from './settings/settings-tab';
import { PRCreationModal } from './ui/modals/pr-modal';
import { GitHubService } from './services/github-service';

export default class ContentPublisher extends Plugin {
  settings: ContentPublisherSettings;
  
  async onload() {
    console.log('Loading Content Publisher plugin');
    await this.loadSettings();
    
    // Add settings tab
    this.addSettingTab(new SettingsTab(this.app, this));
    
    // Add command to create PR from current note
    this.addCommand({
      id: 'create-github-pr',
      name: 'Create GitHub PR from current note',
      editorCheckCallback: (checking: boolean, editor: Editor, view: MarkdownView) => {
        if (checking) {
          return !!editor;
        }
        
        this.createPRFromCurrentNote(editor, view);
        return true;
      }
    });
    
    // Add command to validate GitHub token
    this.addCommand({
      id: 'validate-github-token',
      name: 'Validate GitHub Token',
      callback: async () => {
        await this.validateGitHubToken();
      }
    });
    
    // Add ribbon icon
    this.addRibbonIcon('git-pull-request', 'Create GitHub PR', (evt: MouseEvent) => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view) {
        this.createPRFromCurrentNote(view.editor, view);
      } else {
        new Notice('No active Markdown file');
      }
    });
  }
  
  onunload() {
    console.log('Unloading Content Publisher plugin');
  }
  
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  
  async saveSettings() {
    await this.saveData(this.settings);
  }
  
  private createPRFromCurrentNote(editor: Editor, view: MarkdownView) {
    const content = editor.getValue();
    
    // Check if GitHub token is configured
    if (!this.settings.githubToken) {
      new Notice('GitHub token not configured. Please set it in plugin settings.');
      this.activateSettingsTab();
      return;
    }
    
    // Check if any repositories are configured
    if (!this.settings.repositories.length) {
      new Notice('No repositories configured. Please add at least one in plugin settings.');
      this.activateSettingsTab();
      return;
    }
    
    // Open PR creation modal
    new PRCreationModal(this.app, content, this.settings).open();
  }
  
  private async validateGitHubToken() {
    if (!this.settings.githubToken) {
      new Notice('GitHub token not configured. Please set it in plugin settings.');
      this.activateSettingsTab();
      return;
    }
    
    const github = new GitHubService(this.settings.githubToken);
    const isValid = await github.validateToken();
    
    if (isValid) {
      new Notice('GitHub token is valid!');
    } else {
      new Notice('GitHub token is invalid or has insufficient permissions.');
    }
  }
  
  private activateSettingsTab() {
    // Use type assertion to access the setting property
    // This is necessary because the Obsidian typings don't include this property
    // but it exists in the runtime API
    (this.app as any).setting.open();
    (this.app as any).setting.openTabById(this.manifest.id);
  }
}