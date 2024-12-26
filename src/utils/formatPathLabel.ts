import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from './getConfig';

/**
 * Util to improve formatting of file paths
 * provides control to abbreviate paths that are too long
 * exposes initial folder display depth and end folder display depth
 * workspace folder name is displayed at the start of the path to provide additional context
 */
export function formatPathLabel(filePath: string) {
  const { workspaceFolders } = vscode.workspace;
  const config = getConfig();

  if (!workspaceFolders) {
    return filePath;
  }

  // find correct workspace folder
  const workspaceFolder =
    workspaceFolders.find((folder) => filePath.startsWith(folder.uri.fsPath)) ||
    workspaceFolders[0];

  const workspaceFolderName = workspaceFolder.name;
  let relativeFilePath;
  let folders;

  if (config.showWorkspaceFolderInFilePath) {
    relativeFilePath = path.relative(workspaceFolder.uri.fsPath, filePath);
    folders = [workspaceFolderName, ...relativeFilePath.split(path.sep)];
  } else {
    relativeFilePath = path.relative(workspaceFolder.uri.fsPath, filePath).replace(/(\.\.\/)+/, '');
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
  return folders.join(path.sep);
}
