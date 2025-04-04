import { moment } from 'obsidian';

/**
 * Processes a template string using the provided variables
 */
export function processTemplate(template: string, variables: Record<string, any>): string {
  let processed = template;
  
  // Process date variables with format specifiers
  const dateRegex = /\{\{date(?::([^}]+))?\}\}/g;
  processed = processed.replace(dateRegex, (match, format) => {
    // Use moment correctly in Obsidian context
    const now = window.moment();
    return format ? now.format(format) : now.format('YYYY-MM-DD');
  });
  
  // Process simple variable replacements
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    processed = processed.replace(regex, value?.toString() || '');
  });
  
  return processed;
}

/**
 * Creates a set of processed templates based on the metadata
 */
export function processTemplates(
  templates: { 
    branchTemplate: string;
    commitMessageTemplate: string;
    prTitleTemplate: string;
    prBodyTemplate: string;
    filenameTemplate: string;
  },
  metadata: Record<string, any>
): {
  branchName: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
  filename: string;
} {
  return {
    branchName: processTemplate(templates.branchTemplate, metadata),
    commitMessage: processTemplate(templates.commitMessageTemplate, metadata),
    prTitle: processTemplate(templates.prTitleTemplate, metadata),
    prBody: processTemplate(templates.prBodyTemplate, metadata),
    filename: processTemplate(templates.filenameTemplate, metadata)
  };
}