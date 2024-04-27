import * as vscode from 'vscode';
import * as path from 'path';
import { log } from "../utils/log";
import { checkKillProcess } from "./ripgrep";
import { context as cx, updateAppState } from './context';
import { QPItemQuery } from '../types';
import { closePreviewEditor, setCursorPosition } from './editorActions';

type ConfirmPayload = ConfirmPayloadDefault | ConfirmHorizontalSplitPayload;

type ConfirmPayloadDefault = { context: 'unknown' };

type ConfirmHorizontalSplitPayload = {
  item: QPItemQuery
  context: 'openInHorizontalSplit'
};

export function confirm(payload: ConfirmPayload = {context: 'unknown'}) {
  checkKillProcess();

  let currentItem = cx.qp.selectedItems[0] as QPItemQuery;
  if (payload.context === 'openInHorizontalSplit') {
    currentItem = payload.item;
  }

  if (!currentItem?.data) {
    return;
  }

  const { filePath, linePos, colPos } = currentItem.data;
  vscode.workspace.openTextDocument(path.resolve(filePath)).then(document => {
    const options: vscode.TextDocumentShowOptions = {};

    if(payload.context === 'openInHorizontalSplit') {
      options.viewColumn = vscode.ViewColumn.Beside;
      closePreviewEditor();
    }

    vscode.window.showTextDocument(document, options).then(editor => {
      setCursorPosition(editor, linePos, colPos);
      cx.qp.dispose();
    });
  });
}

// start periscope extension/search
export function start() {
  log('start');
  cx.resetContext();
  setExtensionActiveContext(true);
}

// end periscope extension
export function finished() {
  setExtensionActiveContext(false);
  updateAppState('FINISHED');
  checkKillProcess();
  cx.highlightDecoration.remove();
  disposeAll();
  cx.previousActiveEditor = undefined;
  log('finished');
}

// create vscode context for the extension for targeted keybindings
/**
 * eg:
 * {
    "key": "ctrl+\\",
    "command": "periscope.openInHorizontalSplit",
    "when": "periscopeActive"  <<< this is the context
  }
 */
export function setExtensionActiveContext(flag: boolean) {
  log(`setContext ${flag}`);
  vscode.commands.executeCommand('setContext', 'periscopeActive', flag);
}

function disposeAll() {
  cx.disposables.general.forEach(d => d.dispose());
  cx.disposables.rgMenuActions.forEach(d => d.dispose());
  cx.disposables.query.forEach(d => d.dispose());
}
