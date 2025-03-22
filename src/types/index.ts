import * as vscode from 'vscode';
import { RgMatchRawResult } from './ripgrep';

export interface QPItemDefault extends vscode.QuickPickItem {
  _type: 'QuickPickItemDefault';
}
export interface QPItemQuery extends vscode.QuickPickItem {
  _type: 'QuickPickItemQuery';
  // custom payload
  data: {
    filePath: string;
    linePos: number;
    colPos: number;
    rawResult: RgMatchRawResult;
  };
}
export interface QPItemRgMenuAction extends vscode.QuickPickItem {
  _type: 'QuickPickItemRgMenuAction';
  // custom payload
  data: {
    rgOption: string;
  };
}

export type AllQPItemVariants = QPItemDefault | QPItemQuery | QPItemRgMenuAction;

export type DisposablesMap = {
  general: vscode.Disposable[];
  rgMenuActions: vscode.Disposable[];
  query: vscode.Disposable[];
};
