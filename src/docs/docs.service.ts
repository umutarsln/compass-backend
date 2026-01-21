import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DocMetadata, DocsListResponseDto } from './dto/docs-list.dto';
import { DocResponseDto } from './dto/doc-response.dto';

@Injectable()
export class DocsService {
  private readonly logger = new Logger(DocsService.name);
  
  // Get docs path - works in both development and production
  // __dirname in compiled code: backend/dist/docs
  // We need to go: dist/docs -> dist -> backend -> src/docs
  private readonly docsPath = (() => {
    // __dirname in compiled code is: backend/dist/docs
    // Go up two levels to get to backend directory: dist/docs -> dist -> backend
    // Then go to src/docs
    const backendRoot = path.resolve(__dirname, '..', '..');
    const docsPath = path.join(backendRoot, 'src', 'docs');
    
    this.logger.log(`[DocsService] __dirname: ${__dirname}`);
    this.logger.log(`[DocsService] Backend root: ${backendRoot}`);
    this.logger.log(`[DocsService] Resolved docs path: ${docsPath}`);
    this.logger.log(`[DocsService] Docs path exists: ${fs.existsSync(docsPath)}`);
    
    return docsPath;
  })();

  /**
   * Get all documentation metadata
   */
  async getAllDocs(): Promise<DocsListResponseDto> {
    this.logger.log(`[getAllDocs] Reading docs from: ${this.docsPath}`);

    if (!fs.existsSync(this.docsPath)) {
      this.logger.warn(`[getAllDocs] Docs directory does not exist: ${this.docsPath}`);
      return { docs: [] };
    }

    const docs: DocMetadata[] = [];
    const entries = fs.readdirSync(this.docsPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const moduleName = entry.name;
        const readmePath = path.join(this.docsPath, moduleName, 'README.md');

        if (fs.existsSync(readmePath)) {
          try {
            const content = fs.readFileSync(readmePath, 'utf-8');
            const title = this.extractTitle(content);
            const description = this.extractDescription(content);

            docs.push({
              module: moduleName,
              title: title || this.formatModuleName(moduleName),
              description: description || `${this.formatModuleName(moduleName)} module documentation`,
              path: `/docs/${moduleName}`,
            });
          } catch (error) {
            this.logger.error(`[getAllDocs] Error reading ${readmePath}: ${error.message}`);
          }
        }
      }
    }

    // Sort by module name
    docs.sort((a, b) => a.module.localeCompare(b.module));

    this.logger.log(`[getAllDocs] Found ${docs.length} documentation files`);
    return { docs };
  }

  /**
   * Get documentation by module name
   */
  async getDocByModule(module: string): Promise<DocResponseDto> {
    this.logger.log(`[getDocByModule] Getting doc for module: ${module}`);

    const readmePath = path.join(this.docsPath, module, 'README.md');

    if (!fs.existsSync(readmePath)) {
      this.logger.warn(`[getDocByModule] Documentation not found: ${readmePath}`);
      throw new NotFoundException(`Documentation for module '${module}' not found`);
    }

    try {
      const content = fs.readFileSync(readmePath, 'utf-8');
      const stats = fs.statSync(readmePath);
      const title = this.extractTitle(content) || this.formatModuleName(module);

      return {
        module,
        content,
        title,
        lastModified: stats.mtime,
      };
    } catch (error) {
      this.logger.error(`[getDocByModule] Error reading ${readmePath}: ${error.message}`);
      throw new NotFoundException(`Error reading documentation for module '${module}'`);
    }
  }

  /**
   * Extract title from markdown content (first # heading)
   */
  private extractTitle(content: string): string | null {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : null;
  }

  /**
   * Extract description from markdown content (first paragraph after title)
   */
  private extractDescription(content: string): string | null {
    const lines = content.split('\n');
    let foundTitle = false;

    for (const line of lines) {
      if (line.startsWith('# ')) {
        foundTitle = true;
        continue;
      }

      if (foundTitle && line.trim() && !line.startsWith('#')) {
        // Return first non-empty line after title
        return line.trim().substring(0, 200); // Limit to 200 chars
      }
    }

    return null;
  }

  /**
   * Format module name for display (e.g., "user" -> "User")
   */
  private formatModuleName(module: string): string {
    return module.charAt(0).toUpperCase() + module.slice(1);
  }
}
