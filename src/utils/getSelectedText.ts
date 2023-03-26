import * as vscode from 'vscode';

export function getSelectedText() {
  let selectedText = '';
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    selectedText = editor.document.getText(editor.selection);
  }
  return selectedText;
}
