import * as fs from 'fs';
import { rgPath as vscodeRgPath } from '@vscode/ripgrep';
import { log, notifyError } from './log';
import { findRipgrepSystemPath } from './findRipgrepSystemPath';

/**
 * Resolve ripgrep binary path from various sources
 */
export function resolveRipgrepPath(userPath?: string): string {
  // Try user-specified override path first
  const userPathTrimmed = userPath?.trim();
  if (userPathTrimmed) {
    const path = userPathTrimmed;
    let isValid = false;
    try {
      isValid = fs.existsSync(path);
      if (isValid) {
        fs.accessSync(path);
        return path;
      }
    } catch {
      // Path is not valid, continue to next option
    }

    log(`User-specified ripgrep path not found: ${path}`);
  }

  // Try system PATH if user path is provided and not valid
  const systemPath = findRipgrepSystemPath();
  if (systemPath) {
    log(
      `User-specified path not found, did you mean to use ripgrep from system PATH? ${systemPath}`,
    );
    return systemPath;
  }

  // Default to vscode ripgrep
  if (vscodeRgPath) {
    log(`Using @vscode/ripgrep bundled binary: ${vscodeRgPath}`);
    return vscodeRgPath;
  }

  // If all else fails, show error and throw
  notifyError('Ripgrep not found. Please install ripgrep or configure a valid path.');
  throw new Error('Ripgrep not found');
}
