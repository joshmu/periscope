import * as vscode from 'vscode';
import { QPItemQuery } from '../types';
import { formatPathLabel, formatPathFileLabel, formatFilenameLabel } from './formatPathLabel';

// required to update the quick pick item with result information
export function createResultItem(
  filePath: string,
  fileContents: string,
  linePos: number,
  colPos: number,
  rawResult?: unknown,
): QPItemQuery {
  return {
    _type: 'QuickPickItemQuery',
    label: fileContents?.trim(),
    data: {
      filePath,
      linePos,
      colPos,
      rawResult,
    },
    // description: `${folders.join(path.sep)}`,
    detail: formatPathLabel(filePath),
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

export function createResultItemFile(
  filePath: string,
  fileContents: string,
  linePos: number,
  colPos: number,
  rawResult?: unknown,
): QPItemQuery {
  return {
    _type: 'QuickPickItemQuery',
    label: formatFilenameLabel(filePath),
    data: {
      filePath,
      linePos,
      colPos,
      rawResult,
    },
    // description: `${folders.join(path.sep)}`,
    detail: formatPathFileLabel(filePath),
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
