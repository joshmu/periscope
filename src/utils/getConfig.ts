import * as vscode from 'vscode';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { rgPath as vscodeRgPath } from '@vscode/ripgrep';
import { log, notifyError } from './log';

function findRipgrepInPath(): string | null {
  const command = process.platform === 'win32' ? 'where' : 'which';
  try {
    const result = execSync(`${command} rg`, { stdio: 'pipe' }).toString().trim();
    return result && fs.existsSync(result) ? result : null;
  } catch {
    return null;
  }
}

function resolveRipgrepPath(userPath?: string): string {
  // Try user-specified path first
  if (userPath?.trim()) {
    const path = userPath.trim();
    if (fs.existsSync(path)) {
      try {
        fs.accessSync(path);
        return path;
      } catch (error) {
        log(`PERISCOPE: Error checking ripgrep path: ${error}`);
      }
    }
    log(`PERISCOPE: User-specified ripgrep path not found: ${path}`);
  }

  // Try system PATH
  const systemPath = findRipgrepInPath();
  if (systemPath) {
    log(`PERISCOPE: Using ripgrep from system PATH: ${systemPath}`);
    return systemPath;
  }

  // Fallback to vscode ripgrep
  if (vscodeRgPath && fs.existsSync(vscodeRgPath)) {
    log(`PERISCOPE: Using @vscode/ripgrep bundled binary: ${vscodeRgPath}`);
    return vscodeRgPath;
  }

  // If all else fails, show error and throw
  notifyError('Ripgrep not found. Please install ripgrep or configure a valid path.');
  throw new Error('Ripgrep not found');
}

// CONFIG: this should match the contribution in package.json
type ConfigItems =
  | 'rgOptions'
  | 'addSrcPaths'
  | 'rgGlobExcludes'
  | 'rgMenuActions'
  | 'rgQueryParams'
  | 'rgQueryParamsShowTitle'
  | 'rgPath'
  | 'showWorkspaceFolderInFilePath'
  | 'startFolderDisplayDepth'
  | 'startFolderDisplayIndex'
  | 'endFolderDisplayDepth'
  | 'alwaysShowRgMenuActions'
  | 'showPreviousResultsWhenNoMatches'
  | 'gotoRgMenuActionsPrefix'
  | 'enableGotoNativeSearch'
  | 'gotoNativeSearchSuffix'
  | 'peekBorderColor'
  | 'peekBorderWidth'
  | 'peekBorderStyle';

export function getConfig() {
  const vsConfig = vscode.workspace.getConfiguration('periscope');
  const userRgPath = vsConfig.get<string | undefined>('rgPath', undefined);

  return {
    rgOptions: vsConfig.get<string[]>('rgOptions', ['--smart-case', '--sortr path']),
    addSrcPaths: vsConfig.get<string[]>('addSrcPaths', []),
    rgGlobExcludes: vsConfig.get<string[]>('rgGlobExcludes', []),
    rgMenuActions: vsConfig.get<{ label?: string; value: string }[]>('rgMenuActions', []),
    rgQueryParams: vsConfig.get<{ param?: string; regex: string }[]>('rgQueryParams', []),
    rgQueryParamsShowTitle: vsConfig.get<boolean>('rgQueryParamsShowTitle', true),
    rgPath: resolveRipgrepPath(userRgPath),
    showWorkspaceFolderInFilePath: vsConfig.get<boolean>('showWorkspaceFolderInFilePath', true),
    startFolderDisplayIndex: vsConfig.get<number>('startFolderDisplayIndex', 0),
    startFolderDisplayDepth: vsConfig.get<number>('startFolderDisplayDepth', 1),
    endFolderDisplayDepth: vsConfig.get<number>('endFolderDisplayDepth', 4),
    alwaysShowRgMenuActions: vsConfig.get<boolean>('alwaysShowRgMenuActions', true),
    showPreviousResultsWhenNoMatches: vsConfig.get<boolean>('showPreviousResultsWhenNoMatches', false),
    gotoRgMenuActionsPrefix: vsConfig.get<string>('gotoRgMenuActionsPrefix', '<<') || '<<',
    enableGotoNativeSearch: vsConfig.get<boolean>('enableGotoNativeSearch', true),
    gotoNativeSearchSuffix: vsConfig.get<string>('gotoNativeSearchSuffix', '>>') || '>>',
    peekBorderColor: vsConfig.get<string>('peekBorderColor', 'rgb(150,200,200)'),
    peekBorderWidth: vsConfig.get<string>('peekBorderWidth', '2px'),
    peekBorderStyle: vsConfig.get<string>('peekBorderStyle', 'solid'),
  };
}
