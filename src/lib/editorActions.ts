import * as vscode from 'vscode';
import { previousActiveEditor, updatePreviousActiveEditor } from './editorContext';
import { activeQP } from './quickpickContext';
import { AllQPItemVariants, QPItemQuery } from '../types';
import {context as cx} from './context';

export function closePreviewEditor() {
  if(previousActiveEditor) {
    vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    updatePreviousActiveEditor(undefined); // prevent focus onDidHide
  }
}

// Open the current qp selected item in a horizontal split
export const openInHorizontalSplit = () => {
  if(!activeQP) {
    return;
  }

  // grab the current selected item
  const currentItem = activeQP.activeItems[0] as QPItemQuery;

  if (!currentItem?.data) {
    return;
  }

  const options: vscode.TextDocumentShowOptions = {
    viewColumn: vscode.ViewColumn.Beside,
  };

  closePreviewEditor();

  const { filePath, linePos, colPos } = currentItem.data;
  vscode.workspace.openTextDocument(filePath).then((document) => {
    vscode.window.showTextDocument(document, options).then((editor) => {
      // set cursor & view position
      const position = new vscode.Position(linePos, colPos);
      editor.revealRange(new vscode.Range(position, position));
      activeQP?.dispose();
    });
  });
};

// Open the native VSCode search with the provided query and enable regex
export function openNativeVscodeSearch(query: string, qp: vscode.QuickPick<AllQPItemVariants>) {
  // remove the config suffix from the query
  const trimmedQuery = query.slice(
    0,
    query.indexOf(cx.config.gotoNativeSearchSuffix)
  );

  vscode.commands.executeCommand('workbench.action.findInFiles', {
    query: trimmedQuery,
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
      .edit(editBuilder => {
        editBuilder.insert(selection.active, '');
      })
      .then(() => {
        const newPosition = new vscode.Position(lineNumber, charNumber);
        const range = editor.document.lineAt(newPosition).range;
        editor.selection = new vscode.Selection(newPosition, newPosition);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        cx.highlightDecoration.set(editor);
      });
  }
