export interface Repository {
  name: string;
  owner: string;
  baseBranch: string;
  targetPath: string;
}

export interface MediaSettings {
  enabled: boolean;
  targetPath: string;
}

export interface ContentPublisherSettings {
  githubToken: string;
  repositories: Repository[];
  defaultRepository: string;
  branchTemplate: string;
  commitMessageTemplate: string;
  prTitleTemplate: string;
  prBodyTemplate: string;
  filenameTemplate: string;
  extractFrontmatter: boolean;
  statusTrackingEnabled: boolean;
  media: MediaSettings;
}

export const DEFAULT_SETTINGS: ContentPublisherSettings = {
  githubToken: "",
  repositories: [
    {
      name: "my-blog",
      owner: "username",
      baseBranch: "main",
      targetPath: "content/posts",
    },
  ],
  defaultRepository: "username/my-blog",
  branchTemplate: "post/{{slug}}",
  commitMessageTemplate: "Add post: {{title}}",
  prTitleTemplate: "Content: {{title}}",
  prBodyTemplate:
    "## New Content Submission\n\n{{description}}\n\n---\n\nSubmitted via Obsidian Content Publisher",
  filenameTemplate: "{{date:YYYY-MM-DD}}-{{slug}}.md",
  extractFrontmatter: true,
  statusTrackingEnabled: true,
  media: {
    enabled: true,
    targetPath: 'public/images'
  }
};

// Template variables reference
export const TEMPLATE_VARIABLES = [
  { key: "{{title}}", description: "The title of the note" },
  { key: "{{slug}}", description: "URL-friendly version of the title" },
  {
    key: "{{description}}",
    description: "Description from frontmatter or modal input",
  },
  { key: "{{date}}", description: "Current date (can use format specifiers)" },
  { key: "{{tags}}", description: "Tags from frontmatter" },
];

// Site generator presets with type safety
export interface SitePreset {
  targetPath: string;
  filenameTemplate: string;
}

export interface SitePresets {
  [key: string]: SitePreset;
  nextjs: SitePreset;
  jekyll: SitePreset;
  hugo: SitePreset;
}

// Site generator presets
export const SITE_PRESETS: SitePresets = {
  nextjs: {
    targetPath: "content/posts",
    filenameTemplate: "{{slug}}.md",
  },
  jekyll: {
    targetPath: "_posts",
    filenameTemplate: "{{date:YYYY-MM-DD}}-{{slug}}.md",
  },
  hugo: {
    targetPath: "content/posts",
    filenameTemplate: "{{slug}}/index.md",
  },
};
