import { App, Modal, Setting } from 'obsidian';
import { ContentPublisherSettings, Repository } from '../../settings/settings';

export class RepositorySelectModal extends Modal {
  private settings: ContentPublisherSettings;
  private selectedRepository: Repository;
  private onSelect: (repository: Repository) => void;
  
  constructor(
    app: App, 
    settings: ContentPublisherSettings,
    onSelect: (repository: Repository) => void
  ) {
    super(app);
    this.settings = settings;
    this.onSelect = onSelect;
    
    // Default to the first repository or use the default one
    const defaultRepo = settings.defaultRepository.split('/');
    const defaultOwner = defaultRepo[0];
    const defaultName = defaultRepo[1];
    
    const foundRepo = settings.repositories.find(
      r => r.owner === defaultOwner && r.name === defaultName
    );
    
    // Use the first repository as fallback if the default one is not found
    this.selectedRepository = foundRepo || settings.repositories[0];
  }
  
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('repository-select-modal');
    
    contentEl.createEl('h2', { text: 'Select Repository' });
    
    if (this.settings.repositories.length === 0) {
      contentEl.createEl('p', { 
        text: 'No repositories configured. Please add at least one in plugin settings.' 
      });
      
      new Setting(contentEl)
        .addButton(button => button
          .setButtonText('Close')
          .setCta()
          .onClick(() => this.close()));
      
      return;
    }
    
    // Repository list
    this.settings.repositories.forEach(repo => {
      new Setting(contentEl)
        .setName(`${repo.owner}/${repo.name}`)
        .setDesc(`Branch: ${repo.baseBranch}, Path: ${repo.targetPath}`)
        .addButton(button => {
          button.setButtonText('Select')
            .setCta()
            .onClick(() => {
              this.selectedRepository = repo;
              this.onSelect(repo);
              this.close();
            });
          
          // Highlight the default repository
          if (
            this.selectedRepository && 
            repo.owner === this.selectedRepository.owner && 
            repo.name === this.selectedRepository.name
          ) {
            button.buttonEl.addClass('selected-repository');
          }
        });
    });
    
    // Cancel button
    new Setting(contentEl)
      .addButton(button => button
        .setButtonText('Cancel')
        .onClick(() => this.close()));
  }
  
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}