import { Octokit } from '@octokit/rest';
import { Repository } from '../settings/settings';
import { TFile, normalizePath, Notice, MetadataCache } from 'obsidian';
import * as path from 'path';

export interface MediaReference {
  original: string;  // Original reference in markdown
  path: string;      // Path to the media file
  alt: string;       // Alt text (if available)
}

export interface MediaUpload {
  targetPath: string;
  content: string;  // Base64 encoded content
}

export class MediaHandler {
  private octokit: Octokit;
  private repository: Repository;
  private targetPath: string;
  
  constructor(octokit: Octokit, repository: Repository, targetPath: string) {
    this.octokit = octokit;
    this.repository = repository;
    this.targetPath = targetPath;
  }
  
  /**
   * Extract all media references from markdown content
   */
  extractMediaReferences(content: string): MediaReference[] {
    const references: MediaReference[] = [];
    
    // Obsidian internal link format: ![[filename.extension]]
    const obsidianRegex = /!\[\[(.*?)\]\]/g;
    let match;
    while ((match = obsidianRegex.exec(content)) !== null) {
      references.push({
        original: match[0],
        path: match[1],
        alt: path.basename(match[1], path.extname(match[1])) // Use filename as alt
      });
    }
    
    // Regular markdown image format: ![alt](path)
    const markdownRegex = /!\[(.*?)\]\((.*?)\)/g;
    while ((match = markdownRegex.exec(content)) !== null) {
      references.push({
        original: match[0],
        alt: match[1],
        path: match[2]
      });
    }
    
    // HTML image tags: <img src="path" alt="alt">
    const imgRegex = /<img[^>]+src="([^">]+)"[^>]*alt="([^">]*)"[^>]*>/g;
    while ((match = imgRegex.exec(content)) !== null) {
      references.push({
        original: match[0],
        alt: match[2],
        path: match[1]
      });
    }
    
    return references;
  }
  
  /**
   * Process markdown and prepare media for PR
   * Uses Obsidian's metadata cache to properly resolve links
   */
  async processMarkdown(
    content: string, 
    app: any, 
    activeFile: TFile | null
  ): Promise<{
    content: string;
    mediaFiles: MediaUpload[];
  }> {
    new Notice("Starting media processing");
    console.log("MEDIA PROCESSING START =========");
    console.log("Active file:", activeFile ? activeFile.path : "none");
    
    // Extract media references
    const references = this.extractMediaReferences(content);
    console.log(`Found ${references.length} media references:`, references);
    
    if (references.length === 0) {
      console.log("No media references found");
      return { content, mediaFiles: [] };
    }
    
    let processedContent = content;
    const mediaFiles: MediaUpload[] = [];
    let successCount = 0;
    let failureCount = 0;
    
    const vault = app.vault;
    
    // DEBUG: List all files in vault
    const allFiles = vault.getFiles();
    console.log(`Vault contains ${allFiles.length} files`);
    console.log("Looking for files that match our references...");
    
    // Process each reference
    for (const ref of references) {
      console.log(`\nProcessing reference: ${ref.original}`);
      console.log(`Looking for file: ${ref.path}`);
      
      try {
        // Skip external URLs
        if (ref.path.startsWith('http://') || ref.path.startsWith('https://')) {
          console.log('Skipping external URL');
          continue;
        }
        
        // Find the actual file using Obsidian's APIs
        let mediaFile: TFile | null = null;
        
        // STRATEGY 1: Direct match by name
        if (ref.original.startsWith('![[')) {
          console.log("Strategy 1: Looking for exact match by name");
          
          // Try to find the linked file by exact name
          const filename = ref.path;
          mediaFile = allFiles.find(file => file.name === filename) || null;
          
          if (mediaFile) {
            console.log(`Found file by exact name match: ${mediaFile.path}`);
          } else {
            console.log("No exact name match found");
          }
        }
        
        // STRATEGY 2: Look by full path
        if (!mediaFile) {
          console.log("Strategy 2: Looking by full path");
          const filePath = ref.path;
          mediaFile = vault.getAbstractFileByPath(filePath) as TFile || null;
          
          if (mediaFile) {
            console.log(`Found file by path: ${mediaFile.path}`);
          } else {
            console.log(`File not found at path: ${filePath}`);
          }
        }
        
        // STRATEGY 3: Look in same folder as active file
        if (!mediaFile && activeFile) {
          console.log("Strategy 3: Looking in same folder as active file");
          const folder = activeFile.parent;
          if (folder) {
            const folderPath = folder.path;
            const fullPath = `${folderPath}/${ref.path}`;
            console.log(`Trying path: ${fullPath}`);
            mediaFile = vault.getAbstractFileByPath(fullPath) as TFile || null;
            
            if (mediaFile) {
              console.log(`Found file in active file folder: ${mediaFile.path}`);
            } else {
              console.log(`File not found in active file folder: ${fullPath}`);
            }
          }
        }
        
        // STRATEGY 4: Global search by basename
        if (!mediaFile) {
          console.log("Strategy 4: Global search by basename");
          const basename = path.basename(ref.path);
          console.log(`Looking for any file named: ${basename}`);
          
          // List all matching files
          const matchingFiles = allFiles.filter(file => file.name === basename);
          console.log(`Found ${matchingFiles.length} files matching basename`);
          
          if (matchingFiles.length > 0) {
            // Use the first match
            mediaFile = matchingFiles[0];
            console.log(`Using file: ${mediaFile?.path}`);
          }
        }
        
        // Final check - did we find the file?
        if (!mediaFile) {
          console.log(`ERROR: Could not find file for reference: ${ref.path}`);
          new Notice(`Media file not found: ${ref.path}`, 5000);
          failureCount++;
          continue;
        }
        
        console.log(`SUCCESS: Found media file: ${mediaFile.path}`);
        
        // Read file content using the TFile object
        try {
          console.log(`Reading binary data from: ${mediaFile.path}`);
          const fileContent = await vault.readBinary(mediaFile);
          console.log(`Successfully read ${fileContent.byteLength} bytes`);
          
          // Generate target path in repository
          const fileName = mediaFile.name;
          const targetPath = `${this.targetPath}/${fileName}`.replace(/\/+/g, '/');
          console.log(`Target path in repo: ${targetPath}`);
          
          // Convert to base64
          const base64Content = Buffer.from(fileContent).toString('base64');
          console.log(`Base64 content length: ${base64Content.length} characters`);
          
          if (base64Content.length === 0) {
            console.log("ERROR: Empty base64 content");
            new Notice(`Error: Generated empty content for ${fileName}`, 5000);
            failureCount++;
            continue;
          }
          
          // Add to media files for PR
          mediaFiles.push({
            targetPath,
            content: base64Content
          });
          
          console.log(`Added to mediaFiles array`);
          successCount++;
          
          // Replace in markdown with new path
          const newReference = this.createNewReference(ref, `/${targetPath}`);
          console.log(`Replacing ${ref.original} with ${newReference}`);
          processedContent = processedContent.replace(ref.original, newReference);
        } catch (readError) {
          console.error(`ERROR reading file: ${mediaFile.path}`, readError);
          new Notice(`Error reading file: ${readError.message}`, 5000);
          failureCount++;
        }
      } catch (error) {
        console.error(`Failed to process media: ${ref.path}`, error);
        new Notice(`Failed to process media: ${ref.path} - ${error.message}`, 5000);
        failureCount++;
      }
    }
    
    console.log("\nMEDIA PROCESSING SUMMARY:");
    console.log(`- ${successCount} media files processed successfully`);
    console.log(`- ${failureCount} media files failed`);
    console.log(`- Total mediaFiles array: ${mediaFiles.length}`);
    console.log("Media files to be uploaded:", mediaFiles.map(m => m.targetPath));
    console.log("MEDIA PROCESSING END =========");
    
    if (successCount > 0) {
      new Notice(`Prepared ${successCount} media files for upload`);
    }
    
    if (failureCount > 0) {
      new Notice(`Failed to process ${failureCount} media files`, 5000);
    }
    
    return { content: processedContent, mediaFiles };
  }

  /**
   * Create a new markdown reference with the updated path
   */
  private createNewReference(ref: MediaReference, newPath: string): string {
    // For Obsidian internal format
    if (ref.original.startsWith('![[')) {
      return `![${ref.alt}](${newPath})`;
    }
    
    // For standard markdown images
    if (ref.original.startsWith('![')) {
      return `![${ref.alt}](${newPath})`;
    }
    
    // For HTML img tags
    if (ref.original.startsWith('<img')) {
      // Update src attribute
      return ref.original.replace(/src="[^"]+"/, `src="${newPath}"`);
    }
    
    // Default fallback
    return `![${ref.alt}](${newPath})`;
  }
}