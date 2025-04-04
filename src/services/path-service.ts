import { processTemplate } from "../utils/templates";

export interface PathOptions {
  repository: string;
  targetPath: string;
  filename: string;
}

export class PathService {
  /**
   * Resolves a complete file path for the target repository
   */
  resolveTargetPath(options: PathOptions): string {
    const { targetPath, filename } = options;

    // Normalize path by removing leading/trailing slashes and combining paths
    const normalizedPath = [
      targetPath.replace(/^\/+|\/+$/g, ""),
      filename.replace(/^\/+/g, ""),
    ]
      .filter(Boolean)
      .join("/");

    return normalizedPath;
  }

  /**
   * Creates a filename based on a template and metadata
   */
  createFilename(template: string, metadata: Record<string, any>): string {
    return processTemplate(template, metadata);
  }

  /**
   * Ensures the filename has the correct extension
   */
  ensureExtension(filename: string, extension = "md"): string {
    if (!filename.endsWith(`.${extension}`)) {
      return `${filename}.${extension}`;
    }
    return filename;
  }
}

export default PathService;
