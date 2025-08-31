import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from './getConfig';

/**
 * Util to improve formatting of file paths
 * provides control to abbreviate paths that are too long
 * exposes initial folder display depth and end folder display depth
 * workspace folder name is displayed at the start of the path to provide additional context
 */
export function formatPathLabel(filePath: string, options?: { lineNumber?: number }) {
  const { workspaceFolders } = vscode.workspace;
  const config = getConfig();

  let lineNumberSuffix = '';
  if (typeof options?.lineNumber === 'number' && config.showLineNumbers) {
    lineNumberSuffix = `:${options.lineNumber}`;
  }

  if (!workspaceFolders) {
    return `${filePath}${lineNumberSuffix}`;
  }

  // Handle root path consistently across platforms
  if (filePath === '/' || filePath === '\\' || /^[A-Z]:\\$/i.test(filePath)) {
    return ['workspace', '..', '..'].join(path.sep);
  }

  // Normalize path separators for consistent handling
  const normalizedFilePath = filePath.split(/[/\\]/).join(path.sep);

  // find correct workspace folder
  const workspaceFolder =
    workspaceFolders.find((folder) => {
      const normalizedFolderPath = folder.uri.fsPath.split(/[/\\]/).join(path.sep);
      return normalizedFilePath.startsWith(normalizedFolderPath);
    }) || workspaceFolders[0];

  const workspaceFolderName = workspaceFolder.name;
  let relativeFilePath;
  let folders;

  if (config.showWorkspaceFolderInFilePath) {
    relativeFilePath = path.relative(workspaceFolder.uri.fsPath, normalizedFilePath);
    folders = [workspaceFolderName, ...relativeFilePath.split(path.sep)];
  } else {
    relativeFilePath = path
      .relative(workspaceFolder.uri.fsPath, normalizedFilePath)
      .replace(/(\.\.\/)+/, '');
    folders = [...relativeFilePath.split(path.sep)];
  }

  // abbreviate path if too long
  if (folders.length > config.startFolderDisplayDepth + config.endFolderDisplayDepth) {
    const initialFolders = folders.splice(
      config.startFolderDisplayIndex,
      config.startFolderDisplayDepth,
    );
    folders.splice(0, folders.length - config.endFolderDisplayDepth);
    folders.unshift(...initialFolders, '...');
  }

  return `${folders.join(path.sep)}${lineNumberSuffix}`;
}
