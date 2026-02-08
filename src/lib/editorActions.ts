import * as vscode from 'vscode';
import * as path from 'path';
import { AllQPItemVariants, QPItemBuffer, QPItemFile, QPItemQuery } from '../types';
import { context as cx } from './context';
import { RgMatchResult } from '../types/ripgrep';

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
  const currentItem = cx.qp.activeItems[0] as QPItemQuery | QPItemFile;

  if (!currentItem?.data) {
    return;
  }

  const options: vscode.TextDocumentShowOptions = {
    viewColumn: vscode.ViewColumn.Beside,
  };

  closePreviewEditor();

  // Handle file items differently from query items
  if (currentItem._type === 'QuickPickItemFile') {
    const { filePath } = currentItem.data;
    const document = await vscode.workspace.openTextDocument(filePath);
    const editor = await vscode.window.showTextDocument(document, options);

    if (editor) {
      // For file items, just position at the beginning of the file
      const position = new vscode.Position(0, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter,
      );
    }
  } else {
    const { filePath, linePos, colPos, rawResult } = currentItem.data;
    const document = await vscode.workspace.openTextDocument(filePath);
    const editor = await vscode.window.showTextDocument(document, options);

    if (editor) {
      setCursorPosition(editor, linePos, colPos, rawResult);
    }
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

export function setCursorPosition(
  editor: vscode.TextEditor,
  linePos: number,
  colPos: number,
  rgLine: RgMatchResult['rawResult'],
) {
  // Check if editor is still valid
  if (!editor || editor.document.isClosed) {
    return;
  }

  const lineNumber = Math.max(linePos ? linePos - 1 : 0, 0);
  const charNumber = Math.max(colPos ? colPos - 1 : 0, 0);

  const newPosition = new vscode.Position(lineNumber, charNumber);
  const { range } = editor.document.lineAt(newPosition);

  // Set cursor position and reveal range synchronously
  editor.selection = new vscode.Selection(newPosition, newPosition);
  editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

  // Extract submatches from rgLine and apply decorations
  const matches = rgLine.data.submatches.map(({ start, end }) => ({ start, end }));
  cx.matchDecoration.set(editor, matches);
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

export function peekItem(items: readonly (QPItemQuery | QPItemFile)[]) {
  if (items.length === 0) {
    return;
  }

  const currentItem = items[0];
  if (!currentItem.data) {
    return;
  }

  // Handle file items differently from query items
  if (currentItem._type === 'QuickPickItemFile') {
    const { filePath } = currentItem.data;
    vscode.workspace.openTextDocument(path.resolve(filePath)).then((document) => {
      vscode.window
        .showTextDocument(document, {
          preview: true,
          preserveFocus: true,
        })
        .then((editor) => {
          cx.previewOpenedUris.add(editor.document.uri.toString());
          // For file items, position at the beginning of the file
          const position = new vscode.Position(0, 0);
          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(
            new vscode.Range(position, position),
            vscode.TextEditorRevealType.InCenter,
          );
        });
    });
  } else {
    const { filePath, linePos, colPos, rawResult } = currentItem.data;
    vscode.workspace.openTextDocument(path.resolve(filePath)).then((document) => {
      vscode.window
        .showTextDocument(document, {
          preview: true,
          preserveFocus: true,
        })
        .then((editor) => {
          cx.previewOpenedUris.add(editor.document.uri.toString());
          setCursorPosition(editor, linePos, colPos, rawResult);
        });
    });
  }
}

export function peekBufferItem(items: readonly QPItemBuffer[]) {
  const currentItem = items[0];
  if (!currentItem?.data?.uri) {
    return;
  }

  vscode.workspace.openTextDocument(currentItem.data.uri).then((document) => {
    vscode.window
      .showTextDocument(document, { preview: true, preserveFocus: true })
      .then((editor) => {
        cx.previewOpenedUris.add(editor.document.uri.toString());
      });
  });
}
