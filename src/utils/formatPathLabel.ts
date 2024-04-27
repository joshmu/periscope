import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from './getConfig';

/**
 * Util to improve formatting of file paths
 * provides control to abbreviate paths that are too long
 * exposes initial folder display depth and end folder display depth
 * workspace folder name is displayed at the start of the path to provide additional context when necessary
 */
export function formatPathLabel(filePath: string) {
  let workspaceFolders = vscode.workspace.workspaceFolders;
  let config = getConfig();

  if (!workspaceFolders) {
    return filePath;
  }

  // find correct workspace folder
  let workspaceFolder = workspaceFolders[0];
  for (const folder of workspaceFolders) {
    if (filePath.startsWith(folder.uri.fsPath)) {
      workspaceFolder = folder;
      break;
    }
  }

  const workspaceFolderName = workspaceFolder.name;
  const relativeFilePath = path.relative(workspaceFolder.uri.fsPath, filePath);
  const folders = [workspaceFolderName, ...relativeFilePath.split(path.sep)];

  // abbreviate path if too long
  if (
    folders.length >
    config.startFolderDisplayDepth + config.endFolderDisplayDepth
  ) {
    const initialFolders = folders.splice(config.startFolderDisplayIndex, config.startFolderDisplayDepth);
    folders.splice(0, folders.length - config.endFolderDisplayDepth);
    folders.unshift(...initialFolders, '...');
  }
  return folders.join(path.sep);
}
