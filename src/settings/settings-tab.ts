import { App, Modal, Notice, PluginSettingTab, Setting } from 'obsidian';
import ContentPublisher from '../main';
import { ContentPublisherSettings, Repository, SITE_PRESETS, SitePreset, TEMPLATE_VARIABLES } from './settings';
import { GitHubService } from '../services/github-service';

export class SettingsTab extends PluginSettingTab {
  plugin: ContentPublisher;
  
  constructor(app: App, plugin: ContentPublisher) {
    super(app, plugin);
    this.plugin = plugin;
  }
  
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    
    containerEl.createEl('h2', { text: 'Content Publisher Settings' });
    
    // GitHub Token Setting
    new Setting(containerEl)
      .setName('GitHub Personal Access Token')
      .setDesc('Token with repo scope permissions for creating PRs')
      .addText(text => text
        .setPlaceholder('ghp_xxxxxxxxxxxxxxxx')
        .setValue(this.plugin.settings.githubToken)
        .onChange(async (value) => {
          this.plugin.settings.githubToken = value;
          await this.plugin.saveSettings();
        }))
      .addButton(button => button
        .setButtonText('Test Token')
        .onClick(async () => {
          if (!this.plugin.settings.githubToken) {
            return;
          }
          
          const github = new GitHubService(this.plugin.settings.githubToken);
          const isValid = await github.validateToken();
          
          if (isValid) {
            new Notice('GitHub token is valid!');
          } else {
            new Notice('GitHub token is invalid or has insufficient permissions.');
          }
        }));
    
    // Rest of the settings implementation...
    // (Keeping the same but fixing specific type issues)
    
    // Site Generator Presets
    new Setting(containerEl)
      .setName('Site Generator Preset')
      .setDesc('Load preset settings for common static site generators')
      .addDropdown(dropdown => {
        dropdown.addOption('custom', 'Custom');
        dropdown.addOption('nextjs', 'NextJS');
        dropdown.addOption('jekyll', 'Jekyll');
        dropdown.addOption('hugo', 'Hugo');
        dropdown.onChange(async (value) => {
          if (value !== 'custom' && 
              (value === 'nextjs' || value === 'jekyll' || value === 'hugo')) {
            // Safe access to preset with known keys
            const presetKey = value as 'nextjs' | 'jekyll' | 'hugo';
            const preset: SitePreset = SITE_PRESETS[presetKey];
            
            // Update settings with the preset
            this.plugin.settings.filenameTemplate = preset.filenameTemplate;
            
            // Handle repositories update if needed
            // Rest of the implementation...
          }
        });
      });
      
    // Repository selection modal implementation
    // (fixing the part with type issues)
  }
  
  private openRepositorySelectionModal(repos: Array<{full_name: string, default_branch: string}>) {
    const modal = new Modal(this.app);
    modal.titleEl.setText('Select Repositories');
    
    modal.contentEl.createEl('p', { 
      text: 'Select repositories from your GitHub account to add to the plugin.'
    });
    
    const repoList = modal.contentEl.createEl('div', { cls: 'repository-list' });
    
    repos.forEach(repo => {
      if (!repo.full_name) return;
      
      const parts = repo.full_name.split('/');
      if (parts.length !== 2) return;
      
      const [owner, name] = parts;
      
      // Skip repos that are already added
      const isAdded = this.plugin.settings.repositories.some(
        r => r.owner === owner && r.name === name
      );
      
      if (!isAdded) {
        new Setting(repoList)
          .setName(repo.full_name)
          .setDesc(`Default branch: ${repo.default_branch}`)
          .addToggle(toggle => toggle
            .setValue(false)
            .setTooltip('Add this repository'));
      }
    });
    
    new Setting(modal.contentEl)
      .addButton(button => button
        .setButtonText('Cancel')
        .onClick(() => {
          modal.close();
        }))
      .addButton(button => button
        .setButtonText('Add Selected')
        .setCta()
        .onClick(async () => {
          // Fix the type issue with selectedRepos
          interface RepoData {
            owner: string;
            name: string;
            baseBranch: string;
            targetPath: string;
          }
          
          const selectedRepos: RepoData[] = [];
          
          repoList.querySelectorAll('.setting').forEach((el) => {
            const nameEl = el.querySelector('.setting-name') as HTMLElement;
            const toggleEl = el.querySelector('.checkbox-container input') as HTMLInputElement;
            
            if (toggleEl && toggleEl.checked && nameEl && nameEl.textContent) {
              const parts = nameEl.textContent.split('/');
              if (parts.length !== 2) return;
              
              const [owner, name] = parts;
              const foundRepo = repos.find(r => r.full_name === nameEl.textContent);
              
              if (foundRepo) {
                selectedRepos.push({
                  owner,
                  name,
                  baseBranch: foundRepo.default_branch,
                  targetPath: 'content/posts'
                });
              }
            }
          });
          
          if (selectedRepos.length === 0) {
            new Notice('No repositories selected');
            return;
          }
          
          // Add selected repositories
          this.plugin.settings.repositories.push(...selectedRepos);
          
          // Set default if none is set
          if (!this.plugin.settings.defaultRepository && selectedRepos.length > 0) {
            const firstRepo = selectedRepos[0];
            this.plugin.settings.defaultRepository = `${firstRepo.owner}/${firstRepo.name}`;
          }
          
          await this.plugin.saveSettings();
          this.display();
          modal.close();
          
          new Notice(`Added ${selectedRepos.length} repositories`);
        }));
    
    modal.open();
  }
  
  // Rest of the implementation...
}