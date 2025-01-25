import * as vscode from 'vscode';
import * as path from 'path';
import { AllQPItemVariants, QPItemQuery } from '../types';
import { context as cx } from './context';

export function closePreviewEditor() {
  if (cx.previousActiveEditor) {
    vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    cx.previousActiveEditor = undefined; // prevent focus onDidHide
  }
}

// Open the current qp selected item in a horizontal split
export const openInHorizontalSplit = async () => {
  if (!cx.qp) {
    return;
  }

  // grab the current selected item
  const currentItem = cx.qp.activeItems[0] as QPItemQuery;

  if (!currentItem?.data) {
    return;
  }

  const options: vscode.TextDocumentShowOptions = {
    viewColumn: vscode.ViewColumn.Beside,
  };

  closePreviewEditor();

  const { filePath, linePos, colPos } = currentItem.data;
  const document = await vscode.workspace.openTextDocument(filePath);
  const editor = await vscode.window.showTextDocument(document, options);

  if (editor) {
    setCursorPosition(editor, linePos, colPos);
  }
  cx.qp?.dispose();
};

/**
 * Util to ensure correct value is passed to the native vscode search
 */
export function formatNativeVscodeQuery(query: string, suffix: string): string {
  // remove the config suffix from the query and trim any whitespace
  let output = query;
  if (suffix) {
    const index = output.indexOf(suffix);
    if (index !== -1) {
      output = output.slice(0, index);
    }
  }
  return output.trim();
}

// Open the native VSCode search with the provided query and enable regex
export function openNativeVscodeSearch(query: string, qp: vscode.QuickPick<AllQPItemVariants>) {
  vscode.commands.executeCommand('workbench.action.findInFiles', {
    query: formatNativeVscodeQuery(query, cx.config.gotoNativeSearchSuffix),
    isRegex: true,
    isCaseSensitive: false,
    matchWholeWord: false,
    triggerSearch: true,
  });

  // close extension down
  qp.hide();
}

export function setCursorPosition(editor: vscode.TextEditor, linePos: number, colPos: number) {
  const selection = new vscode.Selection(0, 0, 0, 0);
  editor.selection = selection;

  const lineNumber = Math.max(linePos ? linePos - 1 : 0, 0);
  const charNumber = Math.max(colPos ? colPos - 1 : 0, 0);

  editor
    .edit((editBuilder) => {
      editBuilder.insert(selection.active, '');
    })
    .then(() => {
      const newPosition = new vscode.Position(lineNumber, charNumber);
      const { range } = editor.document.lineAt(newPosition);
      editor.selection = new vscode.Selection(newPosition, newPosition);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      cx.highlightDecoration.set(editor);
    });
}

export function handleNoResultsFound() {
  if (cx.config.showPreviousResultsWhenNoMatches) {
    return;
  }

  // hide the previous results if no results found
  cx.qp.items = [];
  // no peek preview available, show the origin document instead
  showPreviewOfOriginDocument();
}

export function showPreviewOfOriginDocument() {
  if (!cx.previousActiveEditor) {
    return;
  }
  vscode.window.showTextDocument(cx.previousActiveEditor.document, {
    preserveFocus: true,
    preview: true,
  });
}

export function peekItem(items: readonly QPItemQuery[]) {
  if (items.length === 0) {
    return;
  }

  const currentItem = items[0];
  if (!currentItem.data) {
    return;
  }

  const { filePath, linePos, colPos } = currentItem.data;
  vscode.workspace.openTextDocument(path.resolve(filePath)).then((document) => {
    vscode.window
      .showTextDocument(document, {
        preview: true,
        preserveFocus: true,
      })
      .then((editor) => {
        setCursorPosition(editor, linePos, colPos);
      });
  });
}
