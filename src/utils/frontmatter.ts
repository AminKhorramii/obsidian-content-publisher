interface Frontmatter {
    title?: string;
    description?: string;
    tags?: string[];
    date?: string;
    slug?: string;
    [key: string]: any;
  }
  
  /**
   * Extracts YAML frontmatter from markdown content
   */
  export function extractFrontmatter(markdown: string): { frontmatter: Frontmatter; content: string } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
    const match = markdown.match(frontmatterRegex);
    
    if (!match) {
      return { 
        frontmatter: {},
        content: markdown 
      };
    }
    
    const frontmatterString = match[1];
    const content = markdown.slice(match[0].length);
    
    try {
      // Simple YAML parsing (in a real plugin, use a proper YAML parser)
      const frontmatter: Frontmatter = {};
      const lines = frontmatterString.split('\n');
      
      for (const line of lines) {
        if (!line.trim() || !line.includes(':')) continue;
        
        const [key, ...valueParts] = line.split(':');
        let value = valueParts.join(':').trim();
        
        // Handle quoted strings
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // Handle arrays (very simple implementation)
        if (value.startsWith('[') && value.endsWith(']')) {
          value = value.slice(1, -1);
          frontmatter[key.trim()] = value.split(',').map(v => v.trim());
        } else {
          frontmatter[key.trim()] = value;
        }
      }
      
      return { frontmatter, content };
    } catch (e) {
      console.error('Error parsing frontmatter:', e);
      return { 
        frontmatter: {},
        content: markdown 
      };
    }
  }
  
  /**
   * Generates a URL-friendly slug from a title
   */
  export function generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  
  /**
   * Creates metadata object from note content and additional info
   */
  export function createMetadata(
    markdown: string, 
    additionalMetadata: Partial<Frontmatter> = {}
  ): Frontmatter {
    const { frontmatter } = extractFrontmatter(markdown);
    const combinedMetadata = { ...frontmatter, ...additionalMetadata };
    
    // Generate title from filename if not present
    if (!combinedMetadata.title) {
      combinedMetadata.title = 'Untitled Note';
    }
    
    // Generate slug if not present
    if (!combinedMetadata.slug) {
      combinedMetadata.slug = generateSlug(combinedMetadata.title);
    }
    
    // Add current date if not present
    if (!combinedMetadata.date) {
      combinedMetadata.date = new Date().toISOString();
    }
    
    return combinedMetadata;
  }