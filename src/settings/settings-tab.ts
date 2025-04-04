import { App, Modal, Notice, PluginSettingTab, Setting } from "obsidian";
import ContentPublisher from "../main";
import {
  ContentPublisherSettings,
  Repository,
  SITE_PRESETS,
  SitePreset,
  TEMPLATE_VARIABLES,
} from "./settings";
import { GitHubService } from "../services/github-service";

export class SettingsTab extends PluginSettingTab {
  plugin: ContentPublisher;

  constructor(app: App, plugin: ContentPublisher) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Content Publisher Settings" });

    // GitHub Token Setting
    new Setting(containerEl)
      .setName("GitHub Personal Access Token")
      .setDesc("Token with repo scope permissions for creating PRs")
      .addText((text) =>
        text
          .setPlaceholder("ghp_xxxxxxxxxxxxxxxx")
          .setValue(this.plugin.settings.githubToken)
          .onChange(async (value) => {
            this.plugin.settings.githubToken = value;
            await this.plugin.saveSettings();
          })
      )
      .addButton((button) =>
        button.setButtonText("Test Token").onClick(async () => {
          if (!this.plugin.settings.githubToken) {
            return;
          }

          const github = new GitHubService(this.plugin.settings.githubToken);
          const isValid = await github.validateToken();

          if (isValid) {
            new Notice("GitHub token is valid!");
          } else {
            new Notice(
              "GitHub token is invalid or has insufficient permissions."
            );
          }
        })
      );

    // Rest of the settings implementation...
    // (Keeping the same but fixing specific type issues)

    // Site Generator Presets
    new Setting(containerEl)
      .setName("Site Generator Preset")
      .setDesc("Load preset settings for common static site generators")
      .addDropdown((dropdown) => {
        dropdown.addOption("custom", "Custom");
        dropdown.addOption("nextjs", "NextJS");
        dropdown.addOption("jekyll", "Jekyll");
        dropdown.addOption("hugo", "Hugo");
        dropdown.onChange(async (value) => {
          if (
            value !== "custom" &&
            (value === "nextjs" || value === "jekyll" || value === "hugo")
          ) {
            // Safe access to preset with known keys
            const presetKey = value as "nextjs" | "jekyll" | "hugo";
            const preset: SitePreset = SITE_PRESETS[presetKey];

            // Update settings with the preset
            this.plugin.settings.filenameTemplate = preset.filenameTemplate;

            // Handle repositories update if needed
            // Rest of the implementation...
          }
        });
      });

    new Setting(containerEl)
      .setName("Fetch Repositories")
      .setDesc("Fetch repositories from your GitHub account")
      .addButton((button) =>
        button.setButtonText("Fetch Repositories").onClick(async () => {
          if (!this.plugin.settings.githubToken) {
            new Notice("GitHub token is required to fetch repositories");
            return;
          }

          button.setButtonText("Fetching...");
          button.setDisabled(true);

          try {
            const github = new GitHubService(this.plugin.settings.githubToken);
            const repos = await github.listRepositories();

            if (repos.length === 0) {
              new Notice(
                "No repositories found or unable to fetch repositories"
              );
              return;
            }

            // Open repository selection modal
            this.openRepositorySelectionModal(repos);
          } catch (error) {
            console.error("Error fetching repositories:", error);
            new Notice(`Failed to fetch repositories: ${error.message}`);
          } finally {
            button.setButtonText("Fetch Repositories");
            button.setDisabled(false);
          }
        })
      );
  }

  private openRepositorySelectionModal(repos: Array<{full_name: string, default_branch: string}>) {
    const modal = new Modal(this.app);
    modal.titleEl.setText('Select Repositories');
    
    modal.contentEl.createEl('p', { 
      text: 'Select repositories from your GitHub account to add to the plugin.'
    });
    
    // Track selections directly in an array instead of relying on DOM
    interface RepoSelection {
      owner: string;
      name: string;
      baseBranch: string;
      selected: boolean;
    }
    
    // Parse repos into our tracking structure
    const repoSelections: RepoSelection[] = [];
    
    // Track repositories that are already configured
    const existingRepos = new Set(
      this.plugin.settings.repositories.map(r => `${r.owner}/${r.name}`)
    );
    
    // Create the container
    const repoList = modal.contentEl.createEl('div', { cls: 'repository-list' });
    
    // Add all repos with toggle controls
    repos.forEach(repo => {
      if (!repo.full_name) return;
      
      const [owner, name] = repo.full_name.split('/');
      if (!owner || !name) return;
      
      // Skip repos that are already added
      if (existingRepos.has(repo.full_name)) {
        new Setting(repoList)
          .setName(repo.full_name)
          .setDesc(`Already configured - Default branch: ${repo.default_branch}`)
          .setDisabled(true);
        return;
      }
      
      // Create our tracking object
      const repoSelection: RepoSelection = {
        owner,
        name,
        baseBranch: repo.default_branch,
        selected: false
      };
      
      repoSelections.push(repoSelection);
      
      // Create setting with direct reference to our selection object
      new Setting(repoList)
        .setName(repo.full_name)
        .setDesc(`Default branch: ${repo.default_branch}`)
        .addToggle(toggle => {
          toggle.setValue(false);
          toggle.onChange(value => {
            // Update our tracking directly
            repoSelection.selected = value;
            console.log(`Repository ${repo.full_name} selected: ${value}`);
          });
        });
    });
    
    if (repoSelections.length === 0) {
      modal.contentEl.createEl('p', {
        text: 'All your repositories are already configured in the plugin.',
        cls: 'mod-warning'
      });
    }
    
    // Add buttons at the bottom
    const footerEl = modal.contentEl.createEl('div', { cls: 'repository-modal-footer' });
    
    new Setting(footerEl)
      .addButton(button => button
        .setButtonText('Cancel')
        .onClick(() => {
          modal.close();
        }))
      .addButton(button => button
        .setButtonText('Add Selected')
        .setCta()
        .onClick(async () => {
          // Use our tracking array instead of DOM querying
          const selectedRepos = repoSelections.filter(repo => repo.selected);
          
          if (selectedRepos.length === 0) {
            new Notice('No repositories selected');
            return;
          }
          
          // Format selected repos for the plugin settings
          const reposToAdd = selectedRepos.map(repo => ({
            owner: repo.owner,
            name: repo.name,
            baseBranch: repo.baseBranch,
            targetPath: 'content/posts' // Default path
          }));
          
          // Add to plugin settings
          this.plugin.settings.repositories.push(...reposToAdd);
          
          // Set default if needed
          if (!this.plugin.settings.defaultRepository && reposToAdd.length > 0) {
            const firstRepo = reposToAdd[0];
            this.plugin.settings.defaultRepository = `${firstRepo.owner}/${firstRepo.name}`;
          }
          
          await this.plugin.saveSettings();
          this.display();
          modal.close();
          
          new Notice(`Added ${reposToAdd.length} ${reposToAdd.length === 1 ? 'repository' : 'repositories'}`);
        }));
    
    // Style the modal
    modal.contentEl.addClass('repository-selection-modal');
    
    // Set height and scrolling
    if (repos.length > 10) {
      repoList.style.maxHeight = '300px';
      repoList.style.overflow = 'auto';
      repoList.style.marginBottom = '1em';
    }
    
    // Debugging helper
    console.log(`Found ${repoSelections.length} repositories to display`);
    
    modal.open();
  }

  // Rest of the implementation...
}
