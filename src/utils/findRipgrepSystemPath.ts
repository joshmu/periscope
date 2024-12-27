import { execSync } from 'child_process';
import * as fs from 'fs';

/**
 * Find ripgrep binary in system PATH
 */
export function findRipgrepSystemPath(): string | null {
  const command = process.platform === 'win32' ? 'where' : 'which';
  try {
    const result = execSync(`${command} rg`, { stdio: 'pipe' }).toString().trim();
    return result && fs.existsSync(result) ? result : null;
  } catch {
    return null;
  }
}
