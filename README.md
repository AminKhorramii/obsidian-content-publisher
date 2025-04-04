# Obsidian Content Publisher

Create GitHub Pull Requests directly from your Obsidian notes for content publishing workflows.

## Features

- One-click publishing from Obsidian to GitHub PRs
- Template-based file naming and PR creation
- YAML frontmatter parsing for metadata extraction
- Multi-repository support
- Optimized for static site generators (NextJS, Jekyll, Hugo, etc.)
- Customizable templates for commit messages, PR descriptions, and branch names

## Installation

1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode
3. Click "Browse" and search for "Content Publisher"
4. Install the plugin and enable it

## Manual Installation

1. Download the latest release from the Releases page
2. Extract the zip file into your `.obsidian/plugins/` folder
3. Enable the plugin in Obsidian's Community Plugins settings

## GitHub Token Setup

This plugin requires a GitHub Personal Access Token with permissions to create branches and pull requests:

1. Go to GitHub → Settings → Developer Settings → Personal Access Tokens
2. Generate a new token with `repo` scope
3. Copy your token and paste it in the plugin settings

## Usage

1. Write your content in Obsidian
2. Click the "Create GitHub PR" ribbon icon or use the command palette
3. Fill in the details in the modal
4. Click "Create Pull Request"

## Template Variables

You can use the following variables in your templates:

- `{{title}}` - The title of the note
- `{{slug}}` - URL-friendly version of the title
- `{{description}}` - Description from frontmatter or modal input
- `{{date}}` - Current date (use format specifiers like `{{date:YYYY-MM-DD}}`)
- `{{tags}}` - Tags from frontmatter

## Configuration for Common Static Site Generators

The plugin includes presets for popular static site generators:

- NextJS
- Jekyll
- Hugo
- Gatsby

## Contributing

Contributions are welcome! Please submit your PRs.

## License

This project is licensed under the MIT License.