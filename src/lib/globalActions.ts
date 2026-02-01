import * as vscode from 'vscode';
import * as path from 'path';
import { log } from '../utils/log';
import { checkKillProcess } from './ripgrep';
import { context as cx, updateAppState } from './context';
import { QPItemBuffer, QPItemFile, QPItemQuery } from '../types';
import { closePreviewEditor, setCursorPosition } from './editorActions';

type ConfirmPayload = ConfirmPayloadDefault | ConfirmHorizontalSplitPayload;

type ConfirmPayloadDefault = { context: 'unknown' };

type ConfirmHorizontalSplitPayload = {
  item: QPItemQuery | QPItemFile;
  context: 'openInHorizontalSplit';
};

type ConfirmBufferPayload = ConfirmBufferPayloadDefault | ConfirmBufferHorizontalSplitPayload;

type ConfirmBufferPayloadDefault = { context: 'unknown' };

type ConfirmBufferHorizontalSplitPayload = {
  item: QPItemBuffer;
  context: 'openInHorizontalSplit';
};

export function confirm(payload: ConfirmPayload = { context: 'unknown' }) {
  checkKillProcess();

  let currentItem = cx.qp.selectedItems[0] as QPItemQuery | QPItemFile;
  if (payload.context === 'openInHorizontalSplit') {
    currentItem = payload.item;
  }

  if (!currentItem?.data) {
    return;
  }

  // Handle file items differently from query items
  if (currentItem._type === 'QuickPickItemFile') {
    const { filePath } = currentItem.data;
    vscode.workspace.openTextDocument(path.resolve(filePath)).then((document) => {
      const options: vscode.TextDocumentShowOptions = {};

      if (payload.context === 'openInHorizontalSplit') {
        options.viewColumn = vscode.ViewColumn.Beside;
        closePreviewEditor();
      }

      vscode.window.showTextDocument(document, options).then((editor) => {
        // For file items, position at the beginning of the file
        const position = new vscode.Position(0, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter,
        );
        cx.qp.dispose();
      });
    });
  } else {
    const { filePath, linePos, colPos, rawResult } = currentItem.data;
    vscode.workspace.openTextDocument(path.resolve(filePath)).then((document) => {
      const options: vscode.TextDocumentShowOptions = {};

      if (payload.context === 'openInHorizontalSplit') {
        options.viewColumn = vscode.ViewColumn.Beside;
        closePreviewEditor();
      }

      vscode.window.showTextDocument(document, options).then((editor) => {
        setCursorPosition(editor, linePos, colPos, rawResult);
        cx.qp.dispose();
      });
    });
  }
}

export function confirmBuffer(payload: ConfirmBufferPayload = { context: 'unknown' }) {
  let currentItem = cx.qp.selectedItems[0] as QPItemBuffer;
  if (payload.context === 'openInHorizontalSplit') {
    currentItem = payload.item;
  }

  if (!currentItem?.data?.uri) {
    return;
  }

  const { uri } = currentItem.data;

  vscode.workspace.openTextDocument(uri).then((document) => {
    const options: vscode.TextDocumentShowOptions = {};

    if (payload.context === 'openInHorizontalSplit') {
      options.viewColumn = vscode.ViewColumn.Beside;
      closePreviewEditor();
    }

    vscode.window.showTextDocument(document, options).then(() => {
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
  cx.matchDecoration.remove();
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
  cx.disposables.general.forEach((d) => d.dispose());
  cx.disposables.rgMenuActions.forEach((d) => d.dispose());
  cx.disposables.query.forEach((d) => d.dispose());
}
