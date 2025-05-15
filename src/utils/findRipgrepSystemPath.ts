import { accessSync, constants as F, existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { log } from './log';

/**
 * Common installation paths for ripgrep.
 * These are checked before the system PATH.
 */
const COMMON_RIPGREP_PATHS: string[] = [
  // macOS (Homebrew)
  '/usr/local/bin/rg',
  '/opt/homebrew/bin/rg',
  // Linux (common package manager locations)
  '/usr/bin/rg',
  '/usr/local/bin/rg', // Also common for source installs
  // Windows (Scoop, Chocolatey - adjust if rg.exe is in a subfolder)
  // Assuming rg.exe is directly in these paths or their common bin subdirectories
  // Note: These paths might need adjustment based on typical installations
  process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'scoop', 'shims', 'rg.exe') : '',
  process.env.ProgramData ? join(process.env.ProgramData, 'chocolatey', 'bin', 'rg.exe') : '',
  // Common user-specific install paths for Windows if installed manually or via other means
  process.env.USERPROFILE ? join(process.env.USERPROFILE, 'bin', 'rg.exe') : '',
  process.env.USERPROFILE ? join(process.env.USERPROFILE, 'scoop', 'shims', 'rg.exe') : '',
].filter(Boolean); // Filter out empty strings from process.env paths that might not exist

/**
 * Find ripgrep binary in system PATH or common installation locations.
 */
export function findRipgrepSystemPath(): string | null {
  log(`Starting ripgrep search. Node process PATH: ${process.env.PATH ?? 'Not set'}`);

  const exts =
    process.platform === 'win32'
      ? (process.env.PATHEXT ?? '.EXE;.BAT;.CMD;.COM').toLowerCase().split(';').filter(Boolean)
      : [''];

  // 1. Check common installation paths first
  log('Checking common ripgrep paths...');
  for (const commonPath of COMMON_RIPGREP_PATHS) {
    const pathToCheck = process.platform === 'win32' ? commonPath : `${commonPath}${exts[0]}`;
    if (existsSync(pathToCheck)) {
      try {
        accessSync(pathToCheck, F.X_OK);
        log(`Permissions OK. Found ripgrep binary in common path: ${pathToCheck}`);
        return pathToCheck;
      } catch (error) {
        log(
          `Error accessing common path ${pathToCheck}: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Not executable or accessible, try next common path
      }
    }
  }

  // 2. If not found in common paths, check system PATH
  log('Checking system PATH for ripgrep...');
  const PATH = process.env.PATH ?? '';
  const dirs = PATH.split(delimiter);

  // Windows honours PATHEXT; everywhere else we just try the bare name.

  // Check each directory in PATH for ripgrep binary
  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i];
    if (!dir) {
      continue;
    }

    for (let j = 0; j < exts.length; j++) {
      const candidate = join(dir, `rg${exts[j]}`);

      // 1. Cheap existence check avoids throwing in the common "not here" case.
      if (!existsSync(candidate)) {
        continue;
      }

      try {
        // 2. Ensure it's executable where the concept exists.
        accessSync(candidate, F.X_OK);
        log(`Found ripgrep binary in system PATH: ${candidate}`);
        return candidate;
      } catch {
        /* not executable here – keep looking */
      }
    }
  }
  return null;
}
