import * as vscode from 'vscode';
import * as path from 'path';
import { log } from "../utils/log";
import { updatePreviousActiveEditor } from "./editorContext";
import { checkKillProcess } from "./ripgrep";
import { context as cx } from './context';
import { QPItemQuery } from '../types';
import { closePreviewEditor, setCursorPosition } from './editorActions';

export function accept(item?: QPItemQuery) {
  checkKillProcess();

  const currentItem = item ? item : cx.qp.selectedItems[0] as QPItemQuery;
  if (!currentItem?.data) {
    return;
  }

  const { filePath, linePos, colPos } = currentItem.data;
  vscode.workspace.openTextDocument(path.resolve(filePath)).then(document => {
    const options: vscode.TextDocumentShowOptions = {};

    if(item) { // horizontal split
      options.viewColumn = vscode.ViewColumn.Beside;
      closePreviewEditor();
    }

    vscode.window.showTextDocument(document, options).then(editor => {
      setCursorPosition(editor, linePos, colPos);
      cx.qp.dispose();
    });
  });
}

export function finished() {
  checkKillProcess();
  cx.highlightDecoration.remove();
  setActiveContext(false);
  disposeAll();
  updatePreviousActiveEditor(undefined);
  log('finished');
}

// create vscode context for the extension for targeted keybindings
export function setActiveContext(flag: boolean) {
  log(`setContext ${flag}`);
  vscode.commands.executeCommand('setContext', 'periscopeActive', flag);
}

function disposeAll() {
  cx.disposables.general.forEach(d => d.dispose());
  cx.disposables.rgMenuActions.forEach(d => d.dispose());
  cx.disposables.query.forEach(d => d.dispose());
}
