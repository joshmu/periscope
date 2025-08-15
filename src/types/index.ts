import * as vscode from 'vscode';
import { RgMatchResult } from './ripgrep';

export interface QPItemDefault extends vscode.QuickPickItem {
  _type: 'QuickPickItemDefault';
}
export interface QPItemQuery extends vscode.QuickPickItem {
  _type: 'QuickPickItemQuery';
  // custom payload
  data: RgMatchResult;
}
export interface QPItemRgMenuAction extends vscode.QuickPickItem {
  _type: 'QuickPickItemRgMenuAction';
  // custom payload
  data: {
    rgOption: string;
  };
}
export interface QPItemFile extends vscode.QuickPickItem {
  _type: 'QuickPickItemFile';
  // custom payload
  data: {
    filePath: string;
  };
}

export type AllQPItemVariants = QPItemDefault | QPItemQuery | QPItemRgMenuAction | QPItemFile;

export type DisposablesMap = {
  general: vscode.Disposable[];
  rgMenuActions: vscode.Disposable[];
  query: vscode.Disposable[];
};

export type SearchMode = 'all' | 'currentFile' | 'files';
