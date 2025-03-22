import * as vscode from 'vscode';
import { QPItemQuery } from '../types';
import { RgMatchResult } from '../types/ripgrep';
import { formatPathLabel } from './formatPathLabel';

// required to update the quick pick item with result information
export function createResultItem(searchResult: RgMatchResult): QPItemQuery {
  return {
    _type: 'QuickPickItemQuery',
    label: searchResult.textResult?.trim(),
    data: {
      filePath: searchResult.filePath,
      linePos: searchResult.linePos,
      colPos: searchResult.colPos,
      rawResult: searchResult.rawResult,
    },
    // description: `${folders.join(path.sep)}`,
    detail: formatPathLabel(searchResult.filePath),
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
