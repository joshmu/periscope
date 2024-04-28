import * as vscode from 'vscode';

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
    rawResult: unknown;
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

export type RgLine = {
  type: string;
  data: {
    path: { text: string };
    lines: { text: string };
    // eslint-disable-next-line @typescript-eslint/naming-convention
    line_number: number;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    absolute_offset: number;
    submatches: {
      end: number;
      match: {
        text: string;
      };
      start: number;
    }[];
  };
};
