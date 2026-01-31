import * as vscode from 'vscode';
import * as path from 'path';
import { QPItemQuery, QPItemFile, QPItemBuffer } from '../types';
import { RgMatchResult } from '../types/ripgrep';
import { formatPathLabel } from './formatPathLabel';

// required to update the quick pick item with result information
export function createResultItem(searchResult: RgMatchResult): QPItemQuery {
  return {
    _type: 'QuickPickItemQuery',
    label: searchResult.textResult?.trim(),
    data: searchResult,
    // description: `${folders.join(path.sep)}`,
    detail: formatPathLabel(searchResult.filePath, { lineNumber: searchResult.linePos }),
    /**
     * ! required to support regex
     * otherwise quick pick will automatically remove results that don't have an exact match
     */
    alwaysShow: true,
    buttons: [
      {
        iconPath: new vscode.ThemeIcon('split-horizontal'),
        tooltip: 'Open in Horizontal split',
      },
    ],
  };
}

// create a quick pick item for file path results
export function createFileItem(filePath: string): QPItemFile {
  return {
    _type: 'QuickPickItemFile',
    label: formatPathLabel(filePath),
    data: { filePath },
    alwaysShow: true,
    buttons: [
      {
        iconPath: new vscode.ThemeIcon('split-horizontal'),
        tooltip: 'Open in Horizontal split',
      },
    ],
  };
}

// create a quick pick item for buffer/open document
export function createBufferItem(document: vscode.TextDocument): QPItemBuffer {
  const isDirty = document.isDirty;
  const fileName = path.basename(document.uri.fsPath) || document.uri.fsPath;
  const dirtyIndicator = isDirty ? ' $(circle-filled)' : '';

  return {
    _type: 'QuickPickItemBuffer',
    label: `${fileName}${dirtyIndicator}`,
    description: document.languageId,
    detail: formatPathLabel(document.uri.fsPath),
    data: {
      uri: document.uri,
      isDirty,
    },
    alwaysShow: true,
    buttons: [
      {
        iconPath: new vscode.ThemeIcon('split-horizontal'),
        tooltip: 'Open in Horizontal split',
      },
    ],
  };
}
