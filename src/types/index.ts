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

export type AllQPItemVariants = QPItemDefault | QPItemQuery | QPItemRgMenuAction;

export type DisposablesMap = {
  general: vscode.Disposable[];
  rgMenuActions: vscode.Disposable[];
  query: vscode.Disposable[];
};
